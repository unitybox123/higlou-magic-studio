"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CONDITION_OPTIONS } from "@/config/condition-map";
import { DEFAULT_VALUES } from "@/config/default-values";
import { STORE_BRANDING_DEFAULTS } from "@/config/store-branding";
import { createEmptyListing } from "@/lib/demo/sample-listing";
import {
  EBAY_CATEGORY_OPTIONS,
  resolveEbayCategory,
} from "@/config/ebay-categories";
import { buildHiglouDescriptionHtml } from "@/lib/ebay/description-html";
import { sanitizeEbayHtml } from "@/lib/ebay/sanitize-html";
import {
  buildEbayTitle,
  generateSku,
} from "@/lib/ebay/listing-helpers";
import { estimatePackageAndShipping } from "@/lib/ebay/package-shipping";
import {
  hasCriticalErrors,
  validateListing,
} from "@/lib/validation/listing";
import {
  ANALYSIS_PROGRESS_STEPS,
  type AnalysisResult,
} from "@/types/analysis";
import type { ProductImage, ProductListing } from "@/types/product";
import type { AnalysisCostEstimate } from "@/components/listing/analysis-cost-panel";
import {
  mapAnalysisStepToPipeline,
} from "@/components/listing/analysis-pipeline";
import {
  getAttentionFields,
} from "@/components/listing/review-helpers";
import { readAiProviderSettings } from "@/components/settings/ai-settings-form";
import type { ConfidenceStatus } from "@/lib/ai/confidence-engine";
import type { WizardStep } from "@/components/listing/wizard/types";
import { WizardShell } from "@/components/listing/wizard/wizard-shell";
import { PhotosScreen } from "@/components/listing/wizard/photos-screen";
import { UnderstandScreen } from "@/components/listing/wizard/understand-screen";
import { ReviewScreen } from "@/components/listing/wizard/review-screen";
import { ExportScreen } from "@/components/listing/wizard/export-screen";
import { MoreDetailsDialog } from "@/components/listing/wizard/more-details-dialog";
import { humanizeAnalysisFailure } from "@/lib/ai/analysis-failure-ui";

const LISTING_SAVE_REQUIRED_MESSAGE =
  "Save the listing first so your draft can sync to eBay export.";

const PRODUCT_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function mapApiProductToListing(product: Record<string, unknown>): ProductListing {
  const base = createEmptyListing();
  const images = Array.isArray(product.images)
    ? (product.images as Array<Record<string, unknown>>).map(
        (image, index): ProductImage => ({
          id: String(image.id ?? `img-${index}`),
          url: String(image.publicUrl ?? image.url ?? ""),
          storagePath: String(image.storagePath ?? ""),
          fileName: String(image.fileName ?? "image.jpg"),
          sortOrder: Number(image.sortOrder ?? index),
          isPrimary: Boolean(image.isPrimary),
          mimeType: String(image.mimeType ?? "image/jpeg"),
          sizeBytes: Number(image.sizeBytes ?? 0),
          uploadProgress: 100,
        }),
      )
    : [];

  const itemSpecifics = Array.isArray(product.itemSpecifics)
    ? (product.itemSpecifics as Array<Record<string, unknown>>).map((field) => ({
        key: String(field.key ?? field.csvColumn ?? "C:Custom"),
        label: String(field.label ?? "Custom"),
        value: String(field.value ?? ""),
        required: Boolean(field.required),
        confidence:
          field.confidence === null || field.confidence === undefined
            ? undefined
            : Number(field.confidence),
        isCustom: Boolean(field.isCustom),
      }))
    : base.itemSpecifics;

  return {
    ...base,
    id: String(product.id ?? base.id),
    status: (product.status as ProductListing["status"]) || base.status,
    title: String(product.title ?? ""),
    subtitle: String(product.subtitle ?? ""),
    brand: String(product.brand ?? ""),
    collection: String(product.collection ?? ""),
    model: String(product.model ?? ""),
    mpn: String(product.mpn ?? ""),
    upc: String(product.upc ?? ""),
    sku: String(product.sku ?? ""),
    productType: String(product.productType ?? ""),
    categoryId: String(product.categoryId ?? ""),
    categoryName: String(product.categoryName ?? ""),
    condition: String(product.condition ?? "New"),
    conditionId: String(product.conditionId ?? "NEW"),
    conditionDescription: String(product.conditionDescription ?? ""),
    price:
      product.price === null || product.price === undefined
        ? null
        : Number(product.price),
    quantity: Number(product.quantity ?? 1),
    listingFormat:
      (product.listingFormat as ProductListing["listingFormat"]) ||
      "FixedPrice",
    size: String(product.size ?? ""),
    type: String(product.productType ?? ""),
    colors: Array.isArray(product.colors)
      ? (product.colors as string[])
      : [],
    materials: Array.isArray(product.materials)
      ? (product.materials as string[])
      : [],
    features: Array.isArray(product.features)
      ? (product.features as string[])
      : [],
    setIncludes: Array.isArray(product.setIncludes)
      ? (product.setIncludes as string[])
      : [],
    missingItems: Array.isArray(product.missingItems)
      ? (product.missingItems as string[])
      : [],
    descriptionSummary: String(product.descriptionSummary ?? ""),
    descriptionHtml: String(product.descriptionHtml ?? base.descriptionHtml),
    itemSpecifics,
    images,
    shippingPolicyId: String(product.shippingPolicyId ?? ""),
    returnPolicyId: String(product.returnPolicyId ?? ""),
    paymentPolicyId: String(product.paymentPolicyId ?? ""),
    handlingTime: Number(product.handlingTime ?? 1),
    itemLocation: String(product.itemLocation || DEFAULT_VALUES.itemLocation),
    postalCode: String(product.postalCode || DEFAULT_VALUES.postalCode),
    country: String(product.country || DEFAULT_VALUES.country),
    createdAt: String(product.createdAt ?? base.createdAt),
    updatedAt: String(product.updatedAt ?? base.updatedAt),
  };
}

export function NewListingWorkspace({
  productId,
}: {
  productId?: string;
} = {}) {
  const [listing, setListing] = useState<ProductListing>(() => createEmptyListing());
  const [step, setStep] = useState<WizardStep>("photos");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisErrorCode, setAnalysisErrorCode] = useState<string | null>(
    null,
  );
  const [analysisStages, setAnalysisStages] = useState<
    import("@/types/analysis-stages").AnalysisPipelineStages | null
  >(null);
  const [costEstimate, setCostEstimate] = useState<AnalysisCostEstimate | null>(
    null,
  );
  const [loadingProduct, setLoadingProduct] = useState(Boolean(productId));
  const [fieldConfidence, setFieldConfidence] = useState<
    Record<string, { status: ConfidenceStatus; sources: string[]; confidence: number }>
  >({});
  const [moreOpen, setMoreOpen] = useState(false);
  const [publishingDonBaraton, setPublishingDonBaraton] = useState(false);
  const analyzeAbortRef = useRef(false);
  const firstAttentionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    (async () => {
      setLoadingProduct(true);
      try {
        const response = await fetch(`/api/products/${productId}`);
        if (!response.ok) {
          throw new Error("Failed to load product");
        }
        const body = (await response.json()) as {
          product: Record<string, unknown>;
        };
        if (!cancelled && body.product) {
          setListing(mapApiProductToListing(body.product));
          setStep("review");
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error ? error.message : "Failed to load product",
          );
        }
      } finally {
        if (!cancelled) setLoadingProduct(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const update = <K extends keyof ProductListing>(
    key: K,
    value: ProductListing[K],
  ) => {
    setListing((prev) => ({ ...prev, [key]: value, updatedAt: new Date().toISOString() }));
  };

  const validationItems = useMemo(() => validateListing(listing), [listing]);
  const blocked = hasCriticalErrors(validationItems);
  const attentionFields = useMemo(() => getAttentionFields(listing), [listing]);

  const orderedImageUrls = useMemo(() => {
    const ordered = [...listing.images].sort((a, b) => {
      if (a.isPrimary === b.isPrimary) return a.sortOrder - b.sortOrder;
      return a.isPrimary ? -1 : 1;
    });
    return ordered.map((img) => img.url).filter(Boolean);
  }, [listing.images]);

  const httpsImageUrls = useMemo(
    () => orderedImageUrls.filter((url) => /^https:\/\//i.test(url)),
    [orderedImageUrls],
  );

  const exported = listing.status === "CSV Generated";
  const donBaratonPublished = listing.status === "Published";

  const regenerateFieldWithAi = async (
    field: "title" | "description",
    instruction?: string,
  ) => {
    try {
      const response = await fetch("/api/regenerate-field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field,
          productId: /^[0-9a-f-]{36}$/i.test(listing.id)
            ? listing.id
            : undefined,
          listingSnapshot: {
            title: listing.title,
            brand: listing.brand,
            model: listing.model,
            categoryName: listing.categoryName,
            condition: listing.condition,
            size: listing.size,
            upc: listing.upc,
            descriptionSummary: listing.descriptionSummary,
            colors: listing.colors,
            materials: listing.materials,
            features: listing.features,
          },
          instruction:
            instruction ??
            (field === "title"
              ? "Make the title better without inventing facts"
              : "Regenerate description from saved analysis facts"),
        }),
      });
      const body = (await response.json()) as {
        title?: string;
        descriptionSummary?: string;
        error?: string;
        budgetWarning?: string;
      };
      if (!response.ok) {
        toast.error(body.error || "Partial regeneration failed");
        return;
      }
      if (field === "title" && body.title) {
        update("title", body.title.slice(0, 80));
        toast.success("Title updated");
      }
      if (field === "description" && body.descriptionSummary) {
        update("descriptionSummary", body.descriptionSummary);
        const html = sanitizeEbayHtml(
          buildHiglouDescriptionHtml({
            productTitle: listing.title,
            productIntroduction: body.descriptionSummary,
            features: listing.features,
            itemCondition: `${listing.condition}${
              listing.conditionDescription
                ? ` — ${listing.conditionDescription}`
                : ""
            }`,
            packageContents: listing.setIncludes,
            shippingInformation: STORE_BRANDING_DEFAULTS.shippingInformation,
            specs: [
              { label: "Brand", value: listing.brand },
              { label: "Model", value: listing.model },
              { label: "Size", value: listing.size },
              { label: "Color", value: listing.colors.join(" / ") },
              { label: "Type", value: listing.productType || listing.type },
              { label: "Material", value: listing.materials.join(" / ") },
              { label: "Style", value: listing.style },
              { label: "Department", value: listing.department },
            ].filter((row) => row.value.trim()),
          }),
        );
        update("descriptionHtml", html);
        toast.success("Description updated");
      }
      if (body.budgetWarning) toast.message(body.budgetWarning);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Partial regeneration failed",
      );
    }
  };

  const applyAnalysisResult = (analysis: AnalysisResult, prev: ProductListing) => {
    const brand = analysis.brand || prev.brand;
    const model = analysis.model || analysis.collection || prev.model;
    const productType = analysis.type || prev.productType;
    const size = analysis.size || prev.size;
    const colors = analysis.colors.length ? analysis.colors : prev.colors;
    const numberOfItems = analysis.numberOfItems ?? prev.numberOfItems;

    const title =
      analysis.title ||
      buildEbayTitle({
        brand,
        model: analysis.collection || model,
        type: productType,
        size,
        pieces: numberOfItems,
        color: colors[0],
      });

    const sku = generateSku({
      brand,
      model: model || analysis.collection,
      size,
      color: colors[0],
    });

    const itemSpecifics =
      analysis.itemSpecifics.length > 0
        ? analysis.itemSpecifics.map((field) => ({
            key: field.key.startsWith("C:") ? field.key : `C:${field.key}`,
            label: field.label,
            value: field.value,
            confidence: field.confidence,
          }))
        : prev.itemSpecifics;

    const category = resolveEbayCategory({
      categoryId: analysis.categoryId || prev.categoryId,
      categoryName: analysis.categoryName || prev.categoryName,
      productType: productType || analysis.type || analysis.categoryId,
      title,
      brand,
      materials: analysis.materials,
      features: analysis.features,
    });

    const shipping = estimatePackageAndShipping({
      title,
      productType,
      size,
      categoryName: category.categoryName,
      brand,
      quantity: analysis.quantity || prev.quantity,
    });

    const next: ProductListing = {
      ...prev,
      title: title.slice(0, 80),
      brand,
      collection: analysis.collection || prev.collection,
      model,
      mpn: analysis.mpn || "",
      upc: analysis.upc || "",
      sku,
      productType,
      type: productType,
      categoryId: category.categoryId,
      categoryName: category.categoryName,
      itemLocation: prev.itemLocation || DEFAULT_VALUES.itemLocation,
      postalCode: prev.postalCode || DEFAULT_VALUES.postalCode,
      country: prev.country || DEFAULT_VALUES.country,
      shippingService: shipping.shippingService,
      shippingCost: shipping.shippingCost,
      freeShipping: shipping.shippingCost === 0,
      condition: analysis.condition || prev.condition,
      conditionId:
      analysis.conditionId || prev.conditionId || "NEW",
      conditionDescription:
        (analysis as { conditionNotes?: string }).conditionNotes ||
        prev.conditionDescription,
      price: analysis.price ?? prev.price,
      quantity: analysis.quantity || prev.quantity,
      size,
      colors,
      materials: analysis.materials.length ? analysis.materials : prev.materials,
      pattern: analysis.pattern || prev.pattern,
      style: analysis.style || prev.style,
      department: analysis.department || prev.department,
      room: analysis.room || prev.room,
      features: analysis.features.length ? analysis.features : prev.features,
      setIncludes: analysis.setIncludes.length
        ? analysis.setIncludes
        : prev.setIncludes,
      missingItems: Array.isArray((analysis as { missingItems?: string[] }).missingItems)
        ? ((analysis as { missingItems?: string[] }).missingItems as string[])
        : prev.missingItems,
      numberOfItems,
      careInstructions: analysis.careInstructions.length
        ? analysis.careInstructions
        : prev.careInstructions,
      countryOfManufacture:
        analysis.countryOfManufacture || prev.countryOfManufacture,
      descriptionSummary:
        analysis.descriptionSummary || prev.descriptionSummary,
      itemSpecifics,
      status: "Needs Review",
      updatedAt: new Date().toISOString(),
      descriptionHtml: "",
    };

    next.descriptionHtml = sanitizeEbayHtml(
      buildHiglouDescriptionHtml({
        productTitle: next.title,
        productIntroduction: next.descriptionSummary,
        features: next.features,
        itemCondition: `${next.condition}${
          next.conditionDescription ? ` — ${next.conditionDescription}` : ""
        }`,
        packageContents: [
          ...next.setIncludes,
          ...(next.missingItems?.length
            ? next.missingItems.map((m) => `Missing: ${m}`)
            : []),
        ],
        shippingInformation: STORE_BRANDING_DEFAULTS.shippingInformation,
        specs: [
          { label: "Brand", value: next.brand },
          { label: "Model", value: next.model },
          { label: "Size", value: next.size },
          { label: "Color", value: next.colors.join(" / ") },
          { label: "Type", value: next.productType || next.type },
          { label: "Material", value: next.materials.join(" / ") },
          { label: "Style", value: next.style },
          { label: "Department", value: next.department },
        ].filter((row) => row.value.trim()),
      }),
    );

    return next;
  };

  const analyzeProduct = async (options?: {
    forceImproveOcr?: boolean;
    forceDeepAnalysis?: boolean;
    forceFreshAnalysis?: boolean;
  }) => {
    if (!listing.images.length) {
      toast.error("Upload at least one product image first");
      return;
    }
    if (!httpsImageUrls.length) {
      toast.error(
        "Upload images to HTTPS public URLs before analyzing (retry failed uploads).",
      );
      return;
    }

    analyzeAbortRef.current = false;
    setAnalyzing(true);
    setStep("analyzing");
    setAnalysisStep(0);
    setAnalysisError(null);
    setAnalysisErrorCode(null);
    setAnalysisStages(null);
    update("status", "Analyzing");

    const progressTimer = window.setInterval(() => {
      setAnalysisStep((s) =>
        Math.min(s + 1, ANALYSIS_PROGRESS_STEPS.length - 1),
      );
    }, 700);

    try {
      const aiProviders = readAiProviderSettings();
      const response = await fetch("/api/analyze-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrls: httpsImageUrls,
          forceImproveOcr: Boolean(options?.forceImproveOcr),
          forceDeepAnalysis: Boolean(options?.forceDeepAnalysis),
          forceFreshAnalysis: Boolean(options?.forceFreshAnalysis),
          analysisTier: options?.forceDeepAnalysis ? "advanced" : "economy",
          productId: /^[0-9a-f-]{36}$/i.test(listing.id) ? listing.id : undefined,
          providers: {
            openaiEnabled: aiProviders.openaiEnabled,
            googleVisionEnabled: aiProviders.googleVisionEnabled,
            barcodeEnabled: aiProviders.barcodeEnabled,
            googleVisionMode: aiProviders.googleVisionMode,
            googleVisionMaxImages: aiProviders.googleVisionMaxImages,
            documentTextFallback: aiProviders.documentTextFallback,
          },
          imageMeta: listing.images
            .filter((img) => /^https:\/\//i.test(img.url))
            .map((img) => ({
              id: img.id,
              url: img.url,
              fileName: img.fileName,
              isPrimary: img.isPrimary,
            })),
          productHints: {
            brand: listing.brand,
            model: listing.model,
            upc: listing.upc,
            categoryId: listing.categoryId,
            categoryName: listing.categoryName,
            condition: listing.condition,
            size: listing.size,
          },
        }),
      });

      const body = (await response.json().catch(() => null)) as {
        analysis?: AnalysisResult;
        error?: string;
        code?: string;
        costEstimate?: AnalysisCostEstimate & {
          cacheHit?: boolean;
          savingsNote?: string;
        };
        budgetWarning?: string;
        recommendations?: string[];
        stages?: import("@/types/analysis-stages").AnalysisPipelineStages;
        normalizedProduct?: {
          identity?: Record<
            string,
            { status: ConfidenceStatus; sources: string[]; confidence: number }
          >;
          analysis?: { cacheHit?: boolean };
        };
        pipeline?: {
          barcodeCount?: number;
          ocrImageCount?: number;
          openaiImages?: number;
          cacheHit?: boolean;
          stages?: import("@/types/analysis-stages").AnalysisPipelineStages;
        };
      } | null;

      if (analyzeAbortRef.current) {
        toast.message("Analysis cancelled");
        setStep("photos");
        return;
      }

      if (!response.ok || !body?.analysis) {
        const raw =
          body?.error ||
          (body?.code === "MISSING_OPENAI_API_KEY"
            ? "OPENAI_API_KEY is not configured"
            : "Product analysis failed");
        const message =
          raw.includes("conditionId") || raw.includes("invalid_type")
            ? "Analysis almost finished, but one product field needed a cleanup. Please try again."
            : raw.startsWith("[")
              ? "Analysis failed while validating AI output. Please try again."
              : humanizeAnalysisFailure(body?.code, raw);
        setAnalysisError(message);
        setAnalysisErrorCode(body?.code ?? null);
        setAnalysisStages(body?.stages ?? body?.pipeline?.stages ?? null);
        if (body?.recommendations?.length) {
          toast.message("Budget recommendations", {
            description: body.recommendations.slice(0, 3).join(" · "),
          });
        }
        update("status", "Needs Review");
        toast.error(message);
        return;
      }

      setAnalysisStep(ANALYSIS_PROGRESS_STEPS.length - 1);
      setAnalysisStages(body.stages ?? body.pipeline?.stages ?? null);
      setAnalysisErrorCode(null);
      const identity = body.normalizedProduct?.identity ?? {};
      const attributes = (
        body.normalizedProduct as
          | {
              attributes?: {
                material?: {
                  status: ConfidenceStatus;
                  sources: string[];
                  confidence: number;
                };
              };
            }
          | undefined
      )?.attributes;
      const nextConfidence: typeof fieldConfidence = {};
      for (const key of ["brand", "model", "upc", "mpn", "productType"] as const) {
        const field = identity[key];
        if (field) {
          nextConfidence[key] = {
            status: field.status,
            sources: field.sources,
            confidence: field.confidence,
          };
        }
      }
      if (attributes?.material) {
        nextConfidence.material = {
          status: attributes.material.status,
          sources: attributes.material.sources,
          confidence: attributes.material.confidence,
        };
      }
      setFieldConfidence(nextConfidence);
      const cacheHit = Boolean(
        body.pipeline?.cacheHit ||
          body.costEstimate?.cacheHit ||
          body.normalizedProduct?.analysis?.cacheHit,
      );
      setListing((prev) => applyAnalysisResult(body.analysis!, prev));
      setStep("reveal");
      setCostEstimate({
        ...(body.costEstimate ?? {}),
        barcodeCount: body.pipeline?.barcodeCount,
        ocrImageCount: body.pipeline?.ocrImageCount,
        imageCount: body.pipeline?.openaiImages,
      });
      if (body.budgetWarning) {
        toast.message(body.budgetWarning);
      }
      if (cacheHit) {
        toast.success("Loaded from cache — no paid AI calls");
      } else if (body.analysis.warnings?.length) {
        toast.message("Your listing is ready — a few fields need a quick review", {
          description: body.analysis.warnings.slice(0, 3).join(" · "),
        });
      } else {
        toast.success(
          body.costEstimate?.savingsNote
            ? `Listing ready · ${body.costEstimate.savingsNote}`
            : "Your listing is ready — review when you’re set",
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Product analysis failed";
      setAnalysisError(message);
      update("status", "Needs Review");
      toast.error(message);
    } finally {
      window.clearInterval(progressTimer);
      setAnalyzing(false);
    }
  };

  const persistDraft = async (options?: {
    quiet?: boolean;
  }): Promise<
    | { ok: true; productId: string }
    | { ok: false; message: string }
  > => {
    localStorage.setItem(
      `higlou-listing-${listing.id}`,
      JSON.stringify(listing),
    );

    try {
      const payload = {
        title: listing.title,
        subtitle: listing.subtitle,
        brand: listing.brand,
        collection: listing.collection,
        model: listing.model,
        sku: listing.sku,
        upc: listing.upc,
        mpn: listing.mpn,
        categoryId: listing.categoryId,
        categoryName: listing.categoryName,
        condition: listing.condition,
        conditionId: listing.conditionId,
        conditionDescription: listing.conditionDescription,
        price: listing.price,
        quantity: listing.quantity,
        listingFormat: listing.listingFormat,
        descriptionHtml: listing.descriptionHtml,
        descriptionSummary: listing.descriptionSummary,
        itemSpecifics: listing.itemSpecifics,
        features: listing.features,
        setIncludes: listing.setIncludes,
        colors: listing.colors,
        materials: listing.materials,
        size: listing.size,
        productType: listing.productType,
        shippingPolicyId: listing.shippingPolicyId,
        returnPolicyId: listing.returnPolicyId,
        paymentPolicyId: listing.paymentPolicyId,
        handlingTime: listing.handlingTime,
        itemLocation: listing.itemLocation,
        postalCode: listing.postalCode,
        country: listing.country,
        status: listing.status,
        images: listing.images
          .filter((image) => /^https:\/\//i.test(image.url))
          .map((image) => ({
            publicUrl: image.url,
            storagePath: image.storagePath || "",
            fileName: image.fileName,
            sortOrder: image.sortOrder,
            isPrimary: image.isPrimary,
            mimeType: image.mimeType,
            sizeBytes: image.sizeBytes,
          })),
      };

      const isUuid = PRODUCT_UUID_RE.test(listing.id);

      const response = await fetch(
        isUuid ? `/api/products/${listing.id}` : "/api/products",
        {
          method: isUuid ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (response.status === 401 || response.status === 503) {
        if (!options?.quiet) {
          toast.success("Draft saved locally (sign in to sync with Supabase)");
        }
        return {
          ok: false,
          message:
            "Sign in to save your listing, then try again. / Inicia sesión para guardar tu anuncio e intenta de nuevo.",
        };
      }

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error || "Failed to sync draft");
      }

      const body = (await response.json()) as {
        product?: { id?: string };
      };
      const savedId = body.product?.id;
      if (savedId && PRODUCT_UUID_RE.test(savedId)) {
        if (savedId !== listing.id) {
          setListing((prev) => ({
            ...prev,
            id: savedId,
            updatedAt: new Date().toISOString(),
          }));
        }
        if (!options?.quiet) {
          toast.success("Draft saved to Supabase");
        }
        return { ok: true, productId: savedId };
      }

      if (isUuid) {
        if (!options?.quiet) {
          toast.success("Draft saved to Supabase");
        }
        return { ok: true, productId: listing.id };
      }

      return { ok: false, message: LISTING_SAVE_REQUIRED_MESSAGE };
    } catch (error) {
      if (!options?.quiet) {
        toast.message("Saved locally", {
          description:
            error instanceof Error ? error.message : "Cloud sync unavailable",
        });
      }
      return {
        ok: false,
        message:
          error instanceof Error
            ? `${error.message} — ${LISTING_SAVE_REQUIRED_MESSAGE}`
            : LISTING_SAVE_REQUIRED_MESSAGE,
      };
    }
  };

  const saveDraft = async () => {
    await persistDraft({ quiet: false });
  };

  const generateCsv = async () => {
    const items = validateListing(listing);
    if (hasCriticalErrors(items)) {
      toast.error("Fix critical validation errors before generating CSV");
      setMoreOpen(true);
      return;
    }

    try {
      const response = await fetch("/api/generate-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: /^[0-9a-f-]{36}$/i.test(listing.id) ? listing.id : undefined,
          sku: listing.sku,
          categoryId: listing.categoryId,
          title: listing.title,
          upc: listing.upc,
          price: listing.price,
          quantity: listing.quantity,
          itemPhotoUrls: orderedImageUrls,
          conditionId: listing.conditionId,
          descriptionHtml: listing.descriptionHtml,
          format: listing.listingFormat,
          brand: listing.brand,
          model: listing.model || listing.collection,
          size: listing.size,
          productType: listing.productType || listing.type,
          categoryName: listing.categoryName,
          itemSpecifics: listing.itemSpecifics.map((field) => ({
            key: field.key,
            value: field.value,
          })),
          policyValues: {
            ...(listing.shippingPolicyId
              ? { "Shipping profile name": listing.shippingPolicyId }
              : {}),
            ...(listing.returnPolicyId
              ? { "Return profile name": listing.returnPolicyId }
              : {}),
            ...(listing.paymentPolicyId
              ? { "Payment profile name": listing.paymentPolicyId }
              : {}),
          },
          itemLocation: listing.itemLocation || DEFAULT_VALUES.itemLocation,
          postalCode: listing.postalCode || DEFAULT_VALUES.postalCode,
          country: listing.country || DEFAULT_VALUES.country,
          handlingTime: listing.handlingTime,
          shippingPolicyId: listing.shippingPolicyId,
          returnPolicyId: listing.returnPolicyId,
          paymentPolicyId: listing.paymentPolicyId,
          shippingService: listing.shippingService,
          shippingCost: listing.shippingCost ?? undefined,
          // Official Create Drafts template (eBay rejects invented Create/Schedule INFO).
          exportMode: "draft",
        }),
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(errorBody?.error || "CSV generation failed");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") || "";
      const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      const asciiMatch = disposition.match(/filename="([^"]+)"/);
      const fileName = utf8Match
        ? decodeURIComponent(utf8Match[1])
        : asciiMatch?.[1] || "Higlou_Export.csv";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);
      update("status", "CSV Generated");
      const uploadHint =
        response.headers.get("X-Higlou-Upload-Hint") ||
        'Upload as "Create or Schedule new listings" — not Create drafts.';
      toast.success(`Downloaded ${fileName}`, {
        description: uploadHint,
        duration: 12000,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "CSV generation failed");
    }
  };

  const publishToDonBaraton = async () => {
    const saved = await persistDraft({ quiet: true });
    if (!saved.ok) {
      toast.error(saved.message);
      return;
    }

    const productId = listing.id;
    if (!/^[0-9a-f-]{36}$/i.test(productId)) {
      toast.error("Save the listing before publishing to Don Baraton");
      return;
    }

    setPublishingDonBaraton(true);
    try {
      const response = await fetch("/api/marketplace/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        listing?: { slug: string };
      } | null;
      if (!response.ok) {
        throw new Error(body?.error || "Failed to publish to Don Baraton");
      }
      update("status", "Published");
      const storefront =
        process.env.NEXT_PUBLIC_DON_BARATON_URL || "http://localhost:3001";
      toast.success("Published to Don Baraton", {
        description: body?.listing?.slug
          ? `${storefront}/item/${body.listing.slug}`
          : storefront,
        duration: 10000,
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Don Baraton publish failed",
      );
    } finally {
      setPublishingDonBaraton(false);
    }
  };

  const startNewProduct = () => {
    setListing(createEmptyListing());
    setStep("photos");
    setAnalysisError(null);
    setCostEstimate(null);
    setFieldConfidence({});
    setMoreOpen(false);
    toast.success("Ready for a new product");
  };

  const generateCsvDisabledReason = blocked
    ? "Blocked by critical validation errors"
    : "";

  const exportDisabled = blocked || loadingProduct;

  const pipelineIndex = mapAnalysisStepToPipeline(
    analysisStep,
    ANALYSIS_PROGRESS_STEPS.length,
  );

  const productLabel =
    [listing.brand, listing.model || listing.collection, listing.productType]
      .filter(Boolean)
      .join(" ") || listing.title;

  const showChrome =
    step !== "photos" && step !== "analyzing" && step !== "reveal";

  return (
    <WizardShell
      step={step}
      exported={exported}
      flush
      headerActions={
        showChrome ? (
          <button
            type="button"
            onClick={() => void saveDraft()}
            disabled={loadingProduct}
            className="hidden h-9 items-center rounded-full border border-border bg-surface px-4 text-sm font-medium sm:inline-flex"
          >
            Save Draft
          </button>
        ) : undefined
      }
    >
      {loadingProduct ? (
        <p className="mb-4 px-6 text-sm text-muted-foreground">
          Loading product…
        </p>
      ) : null}

      {step === "photos" ? (
        <PhotosScreen
          images={listing.images}
          productId={listing.id}
          price={listing.price}
          condition={listing.condition}
          uploadingPending={listing.images.length > 0 && !httpsImageUrls.length}
          canContinue={httpsImageUrls.length > 0 && !analyzing}
          analysisError={analysisError}
          onImagesChange={(images) => update("images", images)}
          onPriceChange={(price) => update("price", price)}
          onConditionChange={(condition) => {
            const match = CONDITION_OPTIONS.find((c) => c.label === condition);
            setListing((prev) => ({
              ...prev,
              condition,
              conditionId: match?.conditionId ?? prev.conditionId,
              updatedAt: new Date().toISOString(),
            }));
          }}
          onContinue={() => void analyzeProduct()}
        />
      ) : null}

      {step === "analyzing" || step === "reveal" ? (
        <UnderstandScreen
          mode={step === "reveal" ? "reveal" : "analyzing"}
          listing={listing}
          images={listing.images}
          activeIndex={pipelineIndex}
          analysisError={analysisError}
          analysisErrorCode={analysisErrorCode}
          stages={analysisStages}
          materialConfidence={fieldConfidence.material}
          onCancel={() => {
            if (step === "analyzing") {
              analyzeAbortRef.current = true;
              setAnalyzing(false);
              toast.message("Cancelled");
            }
            setStep("photos");
          }}
          onRetry={() => void analyzeProduct()}
          onContinue={() => setStep("review")}
        />
      ) : null}

      {step === "review" ? (
        <ReviewScreen
          listing={listing}
          attentionFields={attentionFields}
          analyzing={analyzing}
          firstAttentionRef={firstAttentionRef}
          onUpdate={update}
          onCategoryChange={(categoryId) => {
            const match = EBAY_CATEGORY_OPTIONS.find((c) => c.id === categoryId);
            setListing((prev) => ({
              ...prev,
              categoryId,
              categoryName: match?.name || prev.categoryName,
              updatedAt: new Date().toISOString(),
            }));
          }}
          onConditionChange={(condition) => {
            const match = CONDITION_OPTIONS.find((c) => c.label === condition);
            setListing((prev) => ({
              ...prev,
              condition,
              conditionId: match?.conditionId ?? prev.conditionId,
            }));
          }}
          onImproveTitle={(instruction) =>
            void regenerateFieldWithAi("title", instruction)
          }
          onRegenerateDescription={() =>
            void regenerateFieldWithAi("description")
          }
          onContinue={() => setStep("export")}
          onBack={productId ? undefined : () => setStep("reveal")}
          onOpenMore={() => setMoreOpen(true)}
        />
      ) : null}

      {step === "export" ? (
        <ExportScreen
          listing={listing}
          productName={productLabel}
          photoCount={listing.images.length}
          exported={exported}
          exportDisabled={exportDisabled}
          exportDisabledReason={generateCsvDisabledReason}
          onExport={() => void generateCsv()}
          onPublishToDonBaraton={() => void publishToDonBaraton()}
          publishingDonBaraton={publishingDonBaraton}
          donBaratonPublished={donBaratonPublished}
          onBack={() => setStep("review")}
          onOpenMore={() => setMoreOpen(true)}
          onStartNew={startNewProduct}
          onSaveDraft={() => void saveDraft()}
        />
      ) : null}

      <MoreDetailsDialog
        open={moreOpen}
        onOpenChange={setMoreOpen}
        listing={listing}
        fieldConfidence={fieldConfidence}
        analyzing={analyzing}
        loadingProduct={loadingProduct}
        httpsImageUrls={httpsImageUrls}
        onUpdate={update}
        onRegenerateDescription={() =>
          void regenerateFieldWithAi("description")
        }
        setFieldConfidence={setFieldConfidence}
      />
    </WizardShell>
  );
}
