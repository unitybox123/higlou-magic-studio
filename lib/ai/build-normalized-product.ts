import {
  confidentField,
  mapLegacySource,
  overallConfidence,
  applyConflictPenalty,
  type ConfidentField,
  type EvidenceSource,
} from "@/lib/ai/confidence-engine";
import type { AnalysisResult } from "@/types/analysis";
import type { FieldConflict } from "@/types/product-analysis";
import type { NormalizedProduct } from "@/types/normalized-product";
import {
  PIPELINE_VERSION,
  PROMPT_VERSION,
} from "@/lib/cache/product-fingerprint";
import type { ConditionAnalysis } from "@/lib/ai/condition-analyzer";
import type { PackageContentsResult } from "@/lib/ai/package-contents";
import { conditionToConfidentFields } from "@/lib/ai/condition-analyzer";
import { packageToConfidentFields } from "@/lib/ai/package-contents";

function mapCondition(
  condition: string,
): ConfidentField<"new" | "open_box" | "used" | "for_parts" | "unknown"> {
  const c = condition.toLowerCase();
  let mapped: "new" | "open_box" | "used" | "for_parts" | "unknown" = "unknown";
  if (c.includes("new") && !c.includes("open")) mapped = "new";
  else if (c.includes("open")) mapped = "open_box";
  else if (c.includes("parts")) mapped = "for_parts";
  else if (c.includes("used") || c.includes("pre-owned") || c.includes("good"))
    mapped = "used";
  return confidentField(mapped === "unknown" ? null : mapped, mapped === "unknown" ? 0 : 0.7, [
    "openai",
  ]);
}

function identityFromMeta(
  value: string,
  confidence: number,
  source: string | undefined,
  conflicted: boolean,
  identityField = true,
): ConfidentField<string> {
  const sources: EvidenceSource[] = [mapLegacySource(source)];
  const conf = applyConflictPenalty(confidence, conflicted);
  return confidentField(value || null, conf, sources, { identityField });
}

export function buildNormalizedProduct(input: {
  analysis: AnalysisResult;
  fingerprint: string;
  imageUrls: string[];
  imageHashes: string[];
  conflicts?: FieldConflict[];
  warnings?: string[];
  cacheHit?: boolean;
  planReasons?: string[];
  savingsNote?: string;
  conditionAnalysis?: ConditionAnalysis;
  packageAnalysis?: PackageContentsResult;
  ebayItemSpecifics?: Record<string, ConfidentField<string>>;
}): NormalizedProduct {
  const a = input.analysis;
  const conflictFields = new Set((input.conflicts ?? []).map((c) => c.field));

  const brand = identityFromMeta(
    a.brand,
    a.fieldMeta.brand?.confidence ?? a.confidence.brand ?? 0,
    a.fieldMeta.brand?.source,
    conflictFields.has("brand"),
  );
  const model = identityFromMeta(
    a.model,
    a.fieldMeta.model?.confidence ?? a.confidence.model ?? 0,
    a.fieldMeta.model?.source,
    conflictFields.has("model"),
  );
  const upc = identityFromMeta(
    a.upc,
    a.fieldMeta.upc?.confidence ?? a.confidence.upc ?? 0,
    a.fieldMeta.upc?.source,
    conflictFields.has("upc"),
  );
  const mpn = identityFromMeta(
    a.mpn,
    a.fieldMeta.mpn?.confidence ?? 0.5,
    a.fieldMeta.mpn?.source,
    conflictFields.has("mpn"),
  );

  const productType = confidentField(
    a.type || null,
    a.confidence.category ?? 0.65,
    ["openai"],
  );

  const title = confidentField(a.title || null, 0.8, ["openai"]);
  const description = confidentField(
    a.descriptionSummary || null,
    0.75,
    ["openai"],
  );
  const price = confidentField(
    typeof a.price === "number" ? a.price : null,
    typeof a.price === "number" ? 0.55 : 0,
    ["openai"],
  );

  const itemSpecifics: Record<string, ConfidentField<string>> =
    input.ebayItemSpecifics ??
    Object.fromEntries(
      (a.itemSpecifics ?? [])
        .filter((s) => s.key)
        .map((s) => [
          s.key,
          confidentField(s.value || null, s.confidence ?? 0.65, ["openai"]),
        ]),
    );

  const categoryId = confidentField(
    a.categoryId || null,
    a.confidence.category ?? 0,
    a.categoryId ? ["category_resolver", "openai"] : ["openai"],
  );

  const conditionFields = input.conditionAnalysis
    ? conditionToConfidentFields(input.conditionAnalysis)
    : {
        type: mapCondition(a.condition || ""),
        notes: confidentField(
          (a as { conditionNotes?: string }).conditionNotes ||
            a.condition ||
            null,
          a.confidence.condition ?? 0.5,
          [mapLegacySource(a.fieldMeta.condition?.source)],
        ),
        defects: ((a as { defects?: string[] }).defects ?? []).map((d) =>
          confidentField(d, 0.7, ["openai"]),
        ),
        conditionId: confidentField(
          a.conditionId || null,
          a.conditionId ? 0.8 : 0,
          ["openai"],
        ),
      };

  const packageFields = input.packageAnalysis
    ? packageToConfidentFields(input.packageAnalysis)
    : {
        includedItems: (a.setIncludes ?? []).map((item) =>
          confidentField(item, 0.65, ["openai"]),
        ),
        missingItems: ((a as { missingItems?: string[] }).missingItems ?? []).map(
          (item) => confidentField(item, 0.65, ["openai"]),
        ),
      };

  const identityFields = [brand, model, upc, mpn, productType, categoryId, title];
  const overall = overallConfidence(identityFields);
  const requiresReview =
    identityFields.some((f) => f.status === "review" || f.status === "empty") ||
    !categoryId.value ||
    conditionFields.type.status === "review";

  return {
    identity: {
      productType,
      brand,
      model,
      mpn,
      upc,
    },
    attributes: {
      size: confidentField(a.size || null, a.confidence.size ?? 0.5, [
        mapLegacySource(a.fieldMeta.size?.source),
      ]),
      color: confidentField(
        a.colors?.join(" / ") || null,
        a.colors?.length ? 0.7 : 0,
        ["openai"],
      ),
      material: confidentField(
        a.materials?.join(" / ") || null,
        a.fieldMeta.material?.confidence ??
          (a.materials?.length ? 0.65 : 0),
        a.fieldMeta.material?.source
          ? [mapLegacySource(a.fieldMeta.material.source)]
          : a.materials?.length
            ? ["openai"]
            : ["default"],
        {
          reason: a.fieldMeta.material?.needs_review
            ? "visual_material_estimate"
            : undefined,
        },
      ),
      style: confidentField(a.style || null, a.style ? 0.6 : 0, ["openai"]),
      department: confidentField(a.department || null, a.department ? 0.6 : 0, [
        "openai",
      ]),
    },
    condition: {
      type: conditionFields.type,
      notes: conditionFields.notes,
      defects: conditionFields.defects,
    },
    includedItems: packageFields.includedItems,
    missingItems: packageFields.missingItems,
    media: {
      imageUrls: input.imageUrls,
      imageHashes: input.imageHashes,
    },
    commerce: {
      title,
      description,
      price,
      quantity: a.quantity || 1,
    },
    marketplace: {
      ebay: {
        categoryId,
        itemSpecifics,
        conditionId: conditionFields.conditionId,
      },
    },
    analysis: {
      productFingerprint: input.fingerprint,
      pipelineVersion: PIPELINE_VERSION,
      promptVersion: PROMPT_VERSION,
      overallConfidence: overall,
      requiresReview,
      warnings: input.warnings ?? a.warnings ?? [],
      cacheHit: input.cacheHit,
      planReasons: input.planReasons,
      savingsNote: input.savingsNote,
    },
  };
}

/** Flatten NormalizedProduct identity policies back onto AnalysisResult strings. */
export function applyConfidencePolicyToAnalysis(
  analysis: AnalysisResult,
  normalized: NormalizedProduct,
): AnalysisResult {
  const next = { ...analysis };
  const id = normalized.identity;
  if (id.brand.status === "empty") next.brand = "";
  else if (id.brand.value) next.brand = id.brand.value;
  if (id.model.status === "empty") next.model = "";
  else if (id.model.value) next.model = id.model.value;
  if (id.upc.status === "empty") next.upc = "";
  else if (id.upc.value) next.upc = id.upc.value;
  if (id.mpn.status === "empty") next.mpn = "";
  else if (id.mpn.value) next.mpn = id.mpn.value;

  next.fieldMeta = {
    ...next.fieldMeta,
    brand: {
      confidence: id.brand.confidence,
      source:
        id.brand.sources[0] === "user"
          ? "user"
          : id.brand.sources[0] === "barcode" || id.brand.sources[0] === "ocr"
            ? "image"
            : "inferred",
      needs_review: id.brand.status !== "confirmed",
    },
    model: {
      confidence: id.model.confidence,
      source:
        id.model.sources[0] === "user"
          ? "user"
          : id.model.sources[0] === "barcode" || id.model.sources[0] === "ocr"
            ? "image"
            : "inferred",
      needs_review: id.model.status !== "confirmed",
    },
    upc: {
      confidence: id.upc.confidence,
      source:
        id.upc.sources[0] === "barcode"
          ? "image"
          : id.upc.sources[0] === "user"
            ? "user"
            : "inferred",
      needs_review: id.upc.status !== "confirmed",
    },
  };

  next.confidence = {
    ...next.confidence,
    brand: id.brand.confidence,
    model: id.model.confidence,
    upc: id.upc.confidence,
    category: normalized.marketplace.ebay?.categoryId.confidence ?? 0,
  };

  if (normalized.analysis.requiresReview) {
    next.warnings = Array.from(
      new Set([
        ...next.warnings,
        "Some identity fields need review (confidence below confirmed threshold).",
      ]),
    );
  }

  return next;
}
