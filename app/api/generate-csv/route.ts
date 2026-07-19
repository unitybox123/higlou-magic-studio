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
import { sanitizeEbayHtml } from "@/lib/ebay/sanitize-html";
import {
  draftDefaultsToPolicyValues,
  loadSellerDraftDefaults,
} from "@/lib/ebay/draft-defaults";
import {
  estimatePackageAndShipping,
  packageEstimateToCsvValues,
} from "@/lib/ebay/package-shipping";
import { ensureEbayCategory } from "@/lib/ebay/ensure-category";
import { enrichItemSpecificsForExport } from "@/lib/ebay/enrich-export-specifics";
import { requireUser } from "@/lib/auth/require-user";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

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
  /**
   * draft = official Create Drafts (default — eBay accepts the first #INFO line).
   * Only use a seller-uploaded Create/Schedule template when it is a real eBay file
   * (never Higlou-invented INFO lines — Seller Hub rejects those).
   */
  exportMode: z.enum(["draft", "publish"]).default("draft"),
});

function formatCsvRouteError(error: unknown): string {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues?: Array<{ path?: unknown[]; message?: string }> })
      .issues;
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

    let authClient: Awaited<
      ReturnType<typeof requireUser>
    > | null = null;
    let userId: string | undefined;
    if (isSupabaseConfigured()) {
      authClient = await requireUser();
      if (authClient.ok) userId = authClient.user.id;
    }

    const itemPhotoUrls = data.itemPhotoUrls;

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

    // Default: exact official Create Drafts seed (Shark/Aquafina uploads that completed).
    // Invented Create/Schedule INFO lines cause: "We couldn't identify your template".
    let templateRaw = loadSeedTemplateRaw();
    let templateSource: "database" | "seed" = "seed";
    let useAddAction = false;

    if (isRealEbayCreateSchedule) {
      templateRaw = active.raw;
      templateSource = active.source;
      useAddAction = true;
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

    const ensuredCategory = await ensureEbayCategory({
      categoryId: data.categoryId,
      categoryName: data.categoryName,
      productType: data.productType,
      title: data.title,
      brand: data.brand,
      userId,
      productId: data.productId,
      supabase: authClient?.ok ? authClient.supabase : null,
      // Export must not spend OpenAI tokens — analysis already resolved category.
      allowAi: false,
    });
    const categoryId = ensuredCategory.categoryId || data.categoryId;
    const categoryName = ensuredCategory.categoryName || data.categoryName || "";
    if (!/^\d{3,8}$/.test(categoryId)) {
      return NextResponse.json(
        {
          error:
            "Could not resolve a valid eBay category ID. Pick a category on the details step, then export again.",
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
        itemPhotoUrls.filter((url) => /^https:\/\//i.test(url)),
      ),
    );
    setIfPresent(["Condition ID", "Condition"], data.conditionId);
    setIfPresent(["Description"], sanitizeEbayHtml(data.descriptionHtml));
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

    // Create Drafts template only reads the official 11 columns (+ optional C:*).
    // Shipping, location, weight, and return policy require manual completion on eBay
    // unless using an official Create/Schedule template with Business Policies.
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

    const selectedService =
      packageEstimate.shippingService || data.shippingService || "USPSGroundAdvantage";

    const uploadHint = useAddAction
      ? "Upload as Create or Schedule new listings."
      : "Upload as Create drafts. Then complete location, shipping, returns, and any missing specifics on eBay.";

    if (authClient?.ok) {
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
          .update({ status: "CSV Generated", updated_at: new Date().toISOString() })
          .eq("id", data.productId)
          .eq("user_id", authClient.user.id);
      }
    }

    // Keep custom headers short/ASCII — invalid ByteStrings crash NextResponse on Vercel.
    const responseHeaders: Record<string, string> = {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": buildAttachmentContentDisposition(fileName),
      "X-Higlou-Template-Type": toAsciiHttpHeaderValue(parsed.meta.templateType),
      "X-Higlou-Template-Source": toAsciiHttpHeaderValue(templateSource),
      "X-Higlou-Export-Mode": toAsciiHttpHeaderValue(
        useAddAction ? "publish" : "draft",
      ),
      "X-Higlou-Upload-Hint": toAsciiHttpHeaderValue(uploadHint),
    };
    try {
      return new NextResponse(csv, {
        status: 200,
        headers: responseHeaders,
      });
    } catch (headerError) {
      console.error("[generate-csv] response headers failed", headerError);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="Higlou_Export.csv"`,
        },
      });
    }
  } catch (error) {
    const message = formatCsvRouteError(error);
    console.error("[generate-csv]", message, error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
