import { NextResponse } from "next/server";
import { z } from "zod";
import {
  findHeader,
  generateEbayCsvFromTemplate,
  loadSeedTemplateRaw,
  parseEbayTemplate,
  templateHasPublishReadyShipping,
} from "@/lib/csv/ebay-template";
import { loadActiveTemplateRaw } from "@/lib/ebay/active-template";
import {
  buildAttachmentContentDisposition,
  buildExportFileName,
  buildItemPhotoUrlValue,
  toAsciiHttpHeaderValue,
} from "@/lib/ebay/listing-helpers";
import {
  draftDefaultsToPolicyValues,
  loadSellerDraftDefaults,
} from "@/lib/ebay/draft-defaults";
import {
  estimatePackageAndShipping,
  packageEstimateToCsvValues,
} from "@/lib/ebay/package-shipping";
import { enrichItemSpecificsForExport } from "@/lib/ebay/enrich-export-specifics";
import { requireUser } from "@/lib/auth/require-user";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import {
  isValidEbayCategoryId,
  resolveEbayCategory,
} from "@/config/ebay-categories";
import { pushEbayCsvToDonBaraton } from "@/lib/don-baraton/import-ebay-csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  productId: z.preprocess(
    (v) => (v === null || v === "" ? undefined : v),
    z.string().uuid().optional(),
  ),
  sku: z.string().min(1),
  categoryId: z.preprocess(
    (v) => (v == null ? "" : String(v)),
    z.string().transform((v) => v.trim()),
  ),
  title: z
    .string()
    .min(1)
    .transform((v) => v.trim().slice(0, 80)),
  upc: z.string().optional().default(""),
  price: z.coerce.number().positive(),
  quantity: z.coerce.number().int().positive(),
  itemPhotoUrls: z.array(z.string()).default([]),
  conditionId: z.string().min(1),
  descriptionHtml: z.preprocess(
    (v) => (v == null ? "" : String(v)),
    z.string().transform((v) => {
      const trimmed = v.trim();
      return trimmed || "<p></p>";
    }),
  ),
  format: z.string().default("FixedPrice"),
  brand: z.string().optional(),
  model: z.string().optional(),
  size: z.string().optional(),
  productType: z.string().optional(),
  categoryName: z.string().optional(),
  itemSpecifics: z
    .array(
      z.object({
        key: z.string(),
        value: z.string(),
      }),
    )
    .default([]),
  policyValues: z.record(z.string(), z.string()).default({}),
  itemLocation: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  handlingTime: z.preprocess(
    (v) => (v === null || v === "" ? undefined : v),
    z.coerce.number().int().min(0).optional(),
  ),
  shippingPolicyId: z.string().optional(),
  returnPolicyId: z.string().optional(),
  paymentPolicyId: z.string().optional(),
  shippingService: z.string().optional(),
  shippingCost: z.preprocess(
    (v) => (v === null || v === "" ? undefined : v),
    z.coerce.number().optional(),
  ),
  packageWeightLbs: z.number().int().min(0).optional(),
  packageWeightOz: z.number().int().min(0).max(15).optional(),
  exportMode: z.enum(["draft", "publish"]).default("draft"),
});

/** Lightweight HTML scrub — never import DOMPurify/jsdom in this route. */
function scrubDescriptionHtml(html: string): string {
  return String(html || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveCategoryId(input: {
  categoryId: string;
  categoryName?: string;
  productType?: string;
  title?: string;
  brand?: string;
}): { categoryId: string; categoryName: string } {
  const raw = (input.categoryId || "").trim();
  if (isValidEbayCategoryId(raw)) {
    return {
      categoryId: raw,
      categoryName: input.categoryName || "",
    };
  }
  const hit = resolveEbayCategory({
    categoryId: "",
    categoryName: input.categoryName,
    productType: input.productType || raw || undefined,
    title: input.title,
    brand: input.brand,
  });
  return {
    categoryId: hit.categoryId || "",
    categoryName: hit.categoryName || input.categoryName || "",
  };
}

function formatCsvRouteError(error: unknown): string {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (
      error as { issues?: Array<{ path?: unknown[]; message?: string }> }
    ).issues;
    if (Array.isArray(issues) && issues.length) {
      return issues
        .map((issue) => {
          const path = Array.isArray(issue.path) ? issue.path.join(".") : "";
          const msg = issue.message || "Invalid value";
          return path ? `${path}: ${msg}` : msg;
        })
        .join("; ");
    }
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Failed to generate CSV";
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsedBody = bodySchema.safeParse(json);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: formatCsvRouteError(parsedBody.error) },
        { status: 400 },
      );
    }
    const data = parsedBody.data;

    let authClient: Awaited<ReturnType<typeof requireUser>> | null = null;
    let userId: string | undefined;
    if (isSupabaseConfigured()) {
      authClient = await requireUser();
      if (authClient.ok) userId = authClient.user.id;
    }

    // Prefer official Create Drafts seed (embedded fallback). Optional seller
    // Create/Schedule template only when it's a real eBay file.
    let templateRaw = loadSeedTemplateRaw();
    let templateSource: "database" | "seed" = "seed";
    let useAddAction = false;

    try {
      const active = await loadActiveTemplateRaw(userId);
      const activeParsed = parseEbayTemplate(active.raw);
      const activeInfo = activeParsed.meta.rawInfoLine.toLowerCase();
      const isFakeHiglouCreateTemplate =
        activeInfo.includes("higlou") ||
        activeInfo.includes("create-or-schedule-listings-higlou");
      const isRealEbayCreateSchedule =
        !isFakeHiglouCreateTemplate &&
        activeParsed.meta.templateType === "new_listing" &&
        templateHasPublishReadyShipping(activeParsed.meta.headers) &&
        (activeInfo.includes("create or schedule") ||
          activeInfo.includes("new-listings") ||
          activeInfo.includes("schedule"));
      if (isRealEbayCreateSchedule) {
        templateRaw = active.raw;
        templateSource = active.source;
        useAddAction = true;
      }
    } catch (templateError) {
      console.warn("[generate-csv] active template skipped", templateError);
    }

    const parsed = parseEbayTemplate(templateRaw);
    if (parsed.meta.templateType === "unknown") {
      return NextResponse.json(
        { error: "Template type is unknown. Validate headers before generating." },
        { status: 400 },
      );
    }

    const headers = parsed.meta.headers;
    const actionHeader =
      findHeader(headers, [
        "Action(SiteID=US|Country=US|Currency=USD|Version=1193|CC=UTF-8)",
        "Action",
      ]) ?? headers[0];

    const valuesByHeader: Record<string, string> = {
      [actionHeader]: useAddAction ? "Add" : "Draft",
    };

    const setIfPresent = (candidates: string[], value: string) => {
      if (!value.trim()) return;
      const header = findHeader(headers, candidates);
      if (header) valuesByHeader[header] = value;
    };

    const resolved = resolveCategoryId({
      categoryId: data.categoryId,
      categoryName: data.categoryName,
      productType: data.productType,
      title: data.title,
      brand: data.brand,
    });
    const categoryId = resolved.categoryId;
    const categoryName = resolved.categoryName;
    if (!isValidEbayCategoryId(categoryId)) {
      return NextResponse.json(
        {
          error:
            "Pick a valid eBay category on the details step, then export again.",
        },
        { status: 400 },
      );
    }

    setIfPresent(["Custom label (SKU)"], data.sku);
    setIfPresent(["Category ID"], categoryId);
    setIfPresent(["Title"], data.title);
    setIfPresent(["UPC"], data.upc);
    setIfPresent(["Price"], String(data.price));
    setIfPresent(["Quantity"], String(data.quantity));
    setIfPresent(
      ["Item photo URL"],
      buildItemPhotoUrlValue(
        data.itemPhotoUrls.filter((url) => /^https:\/\//i.test(url)),
      ),
    );
    setIfPresent(["Condition ID", "Condition"], data.conditionId);
    setIfPresent(["Description"], scrubDescriptionHtml(data.descriptionHtml));
    setIfPresent(["Format"], data.format);
    setIfPresent(["Duration"], "GTC");

    const sellerDefaults = await loadSellerDraftDefaults({
      userId,
      supabase: authClient?.ok ? authClient.supabase : null,
      listingOverrides: {
        shippingPolicyId: data.shippingPolicyId,
        returnPolicyId: data.returnPolicyId,
        paymentPolicyId: data.paymentPolicyId,
        itemLocation: data.itemLocation,
        postalCode: data.postalCode,
        country: data.country,
        handlingTime: data.handlingTime,
      },
    });

    const packageEstimate = estimatePackageAndShipping({
      title: data.title,
      productType: data.productType,
      size: data.size,
      categoryName,
      brand: data.brand,
      quantity: data.quantity,
    });

    if (
      typeof data.packageWeightLbs === "number" &&
      typeof data.packageWeightOz === "number"
    ) {
      packageEstimate.weightLbs = data.packageWeightLbs;
      packageEstimate.weightOz = data.packageWeightOz;
      packageEstimate.totalOz =
        data.packageWeightLbs * 16 + data.packageWeightOz;
    }
    if (data.shippingService?.trim()) {
      packageEstimate.shippingService = data.shippingService.trim();
    }
    if (typeof data.shippingCost === "number") {
      packageEstimate.shippingCost = data.shippingCost;
    }

    const hasShippingProfile = Boolean(sellerDefaults.shippingPolicyId?.trim());

    if (useAddAction) {
      const mergedPolicyValues = {
        ...draftDefaultsToPolicyValues(sellerDefaults),
        ...packageEstimateToCsvValues(packageEstimate, {
          includeInlineShippingService: !hasShippingProfile,
        }),
        ...data.policyValues,
      };

      for (const [header, value] of Object.entries(mergedPolicyValues)) {
        if (!value?.trim()) continue;
        if (headers.includes(header) && !header.startsWith("C:")) {
          valuesByHeader[header] = value;
        } else {
          setIfPresent([header], value);
        }
        if (!valuesByHeader[header]) {
          valuesByHeader[header] = value;
        }
      }

      if (hasShippingProfile) {
        for (const key of [
          "Shipping service 1 option",
          "Shipping service 1 cost",
          "Shipping service 1 priority",
          "ShippingService-1:Option",
          "ShippingService-1:Cost",
          "ShippingService-1:Priority",
        ]) {
          if (key in valuesByHeader) valuesByHeader[key] = "";
        }
      }
    }

    const dynamicCColumns = enrichItemSpecificsForExport({
      categoryId,
      itemSpecifics: data.itemSpecifics,
      brand: data.brand,
      size: data.size,
      model: data.model,
    });

    const csv = generateEbayCsvFromTemplate({
      templateRaw,
      valuesByHeader,
      dynamicCColumns,
      appendPublishReadyColumns: useAddAction,
    });

    const fileName = buildExportFileName({
      brand: data.brand,
      model: data.model,
      size: data.size,
      title: data.title,
      sku: data.sku,
    });

    const uploadHint = useAddAction
      ? "Upload as Create or Schedule new listings."
      : "Upload as Create drafts. Then complete location, shipping, returns, and any missing specifics on eBay.";

    if (authClient?.ok) {
      try {
        await authClient.supabase.from("generated_csv_files").insert({
          user_id: authClient.user.id,
          product_id: data.productId ?? null,
          file_name: fileName,
          content: csv,
          template_sha256: parsed.meta.sha256,
        });
        if (data.productId) {
          await authClient.supabase
            .from("products")
            .update({
              status: "CSV Generated",
              updated_at: new Date().toISOString(),
            })
            .eq("id", data.productId)
            .eq("user_id", authClient.user.id);
        }
      } catch (dbError) {
        console.warn("[generate-csv] history insert skipped", dbError);
      }
    }

    // Best-effort mirror to Don Baratón (same eBay CSV). Never fail eBay export.
    const donBaratonSync = await pushEbayCsvToDonBaraton(csv, fileName);
    const donBaratonHeader =
      donBaratonSync.status === "ok"
        ? "ok"
        : donBaratonSync.status === "skipped"
          ? `skipped:${donBaratonSync.reason}`
          : `error:${donBaratonSync.message}`;

    try {
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": buildAttachmentContentDisposition(fileName),
          "X-Higlou-Template-Source": toAsciiHttpHeaderValue(templateSource),
          "X-Higlou-Export-Mode": toAsciiHttpHeaderValue(
            useAddAction ? "publish" : "draft",
          ),
          "X-Higlou-Upload-Hint": toAsciiHttpHeaderValue(uploadHint),
          "X-Higlou-DonBaraton-Sync": toAsciiHttpHeaderValue(
            donBaratonHeader.slice(0, 180),
          ),
        },
      });
    } catch (headerError) {
      console.error("[generate-csv] headers failed", headerError);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="Higlou_Export.csv"',
        },
      });
    }
  } catch (error) {
    const message = formatCsvRouteError(error);
    console.error("[generate-csv]", message, error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
