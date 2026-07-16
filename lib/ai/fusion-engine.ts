import type { Evidence, EvidenceSource, FieldConflict } from "@/types/product-analysis";
import type { BarcodeDetection } from "@/types/barcode";
import type { OCRImageResult } from "@/types/vision";
import type { AnalysisResult } from "@/types/analysis";
import {
  extractLikelyBrand,
  extractLikelyModel,
  extractLikelySize,
  extractLikelyUpc,
} from "@/lib/google-vision/normalize-ocr";
import { validateBarcode } from "@/lib/barcode/validators";
import { AI_PROVIDER_DEFAULTS } from "@/config/ai-providers";
import { resolveMaterialEvidence } from "@/lib/ai/infer-material";

export interface FusionInput {
  openai: AnalysisResult;
  barcodes: BarcodeDetection[];
  ocrResults: OCRImageResult[];
  userHints?: {
    brand?: string;
    model?: string;
    upc?: string;
    size?: string;
    condition?: string;
  };
}

export interface FusionOutput {
  analysis: AnalysisResult;
  evidence: Record<string, Evidence<string | number | string[] | null>>;
  conflicts: FieldConflict[];
}

function evidenceOf<T>(
  value: T | null,
  source: EvidenceSource,
  confidence: number,
  sourceImageIds: string[] = [],
  reason?: string,
): Evidence<T> {
  const empty =
    value === null ||
    value === undefined ||
    (typeof value === "string" && !value.trim()) ||
    (Array.isArray(value) && value.length === 0);
  return {
    value: empty ? null : value,
    confidence: empty ? 0 : confidence,
    source,
    sourceImageIds,
    needsReview: empty || confidence < AI_PROVIDER_DEFAULTS.minConfidence,
    reason,
  };
}

function pickBestString(candidates: Evidence<string>[]): Evidence<string> {
  const usable = candidates.filter((c) => c.value);
  if (!usable.length) {
    return evidenceOf<string>(null, "derived", 0, [], "no_evidence");
  }
  const priority: EvidenceSource[] = [
    "user_input",
    "zxing_barcode",
    "google_vision_ocr",
    "openai_visual",
    "settings_default",
    "derived",
  ];
  usable.sort((a, b) => {
    const pa = priority.indexOf(a.source);
    const pb = priority.indexOf(b.source);
    if (pa !== pb) return pa - pb;
    return b.confidence - a.confidence;
  });
  return usable[0];
}

export function fuseProductAnalysis(input: FusionInput): FusionOutput {
  const conflicts: FieldConflict[] = [];
  const ocrText = input.ocrResults.map((r) => r.normalizedText).join("\n");
  const ocrImageIds = input.ocrResults.map((r) => r.imageId);

  const barcodeUpc = input.barcodes.find(
    (b) =>
      ["UPC_A", "UPC_E", "EAN_8", "EAN_13"].includes(b.format) &&
      (b.checksumValid === true || b.checksumValid === null),
  );

  const ocrUpcRaw = extractLikelyUpc(ocrText);
  const ocrUpcValidated = ocrUpcRaw
    ? validateBarcode(ocrUpcRaw, { requireChecksum: true })
    : null;

  const upcCandidates: Evidence<string>[] = [];
  if (input.userHints?.upc) {
    upcCandidates.push(
      evidenceOf(input.userHints.upc, "user_input", 1, [], "user"),
    );
  }
  if (barcodeUpc) {
    upcCandidates.push(
      evidenceOf(
        barcodeUpc.value,
        "zxing_barcode",
        barcodeUpc.confidence,
        [barcodeUpc.sourceImageId],
        "barcode",
      ),
    );
  }
  if (ocrUpcValidated?.ok) {
    upcCandidates.push(
      evidenceOf(
        ocrUpcValidated.value,
        "google_vision_ocr",
        0.75,
        ocrImageIds,
        "ocr_digits",
      ),
    );
  }
  if (input.openai.upc) {
    upcCandidates.push(
      evidenceOf(
        input.openai.upc,
        "openai_visual",
        input.openai.confidence.upc ?? 0.5,
        [],
        "openai",
      ),
    );
  }

  // Conflict detection for UPC
  const distinctUpc = [
    ...new Set(upcCandidates.filter((c) => c.value).map((c) => c.value!)),
  ];
  if (distinctUpc.length > 1) {
    conflicts.push({
      field: "upc",
      values: upcCandidates
        .filter((c) => c.value)
        .map((c) => ({
          value: c.value!,
          source: c.source,
          confidence: c.confidence,
        })),
      chosen: null,
      reason: "conflicting_upc_sources",
    });
  }

  let upc = pickBestString(upcCandidates);
  if (
    AI_PROVIDER_DEFAULTS.preferBarcodeOverOcr &&
    barcodeUpc &&
    barcodeUpc.checksumValid === true
  ) {
    upc = evidenceOf(
      barcodeUpc.value,
      "zxing_barcode",
      0.99,
      [barcodeUpc.sourceImageId],
      "prefer_valid_barcode",
    );
    if (conflicts[0]?.field === "upc") {
      conflicts[0].chosen = barcodeUpc.value;
      conflicts[0].reason =
        "Selected ZXing barcode with valid checksum over contradictory OCR/AI";
    }
  }

  const brand = pickBestString([
    input.userHints?.brand
      ? evidenceOf(input.userHints.brand, "user_input", 1)
      : evidenceOf<string>(null, "user_input", 0),
    (() => {
      const fromOcr = extractLikelyBrand(ocrText);
      return evidenceOf(
        fromOcr,
        "google_vision_ocr",
        fromOcr ? 0.85 : 0,
        ocrImageIds,
      );
    })(),
    evidenceOf(
      input.openai.brand || null,
      "openai_visual",
      input.openai.confidence.brand ?? 0,
    ),
  ]);

  const model = pickBestString([
    input.userHints?.model
      ? evidenceOf(input.userHints.model, "user_input", 1)
      : evidenceOf<string>(null, "user_input", 0),
    evidenceOf(
      extractLikelyModel(ocrText),
      "google_vision_ocr",
      0.8,
      ocrImageIds,
    ),
    evidenceOf(
      input.openai.model || null,
      "openai_visual",
      input.openai.confidence.model ?? 0,
    ),
  ]);

  const size = pickBestString([
    input.userHints?.size
      ? evidenceOf(input.userHints.size, "user_input", 1)
      : evidenceOf<string>(null, "user_input", 0),
    evidenceOf(
      extractLikelySize(ocrText),
      "google_vision_ocr",
      0.8,
      ocrImageIds,
    ),
    evidenceOf(
      input.openai.size || null,
      "openai_visual",
      input.openai.confidence.size ?? 0,
    ),
  ]);

  const condition = pickBestString([
    input.userHints?.condition
      ? evidenceOf(input.userHints.condition, "user_input", 1)
      : evidenceOf<string>(null, "user_input", 0),
    evidenceOf(
      input.openai.condition || null,
      "openai_visual",
      input.openai.confidence.condition ?? 0,
    ),
  ]);

  const materialEvidence = resolveMaterialEvidence({
    openaiMaterials: input.openai.materials,
    openaiMaterialConfidence: input.openai.fieldMeta.material?.confidence,
    openaiMaterialNeedsReview: input.openai.fieldMeta.material?.needs_review,
    ocrText,
    colors: input.openai.colors,
    productType: input.openai.type,
    categoryName: input.openai.categoryName,
    title: input.openai.title,
    features: input.openai.features,
  });

  const fused: AnalysisResult = {
    ...input.openai,
    brand: brand.value || "",
    model: model.value || "",
    upc: upc.value || "",
    size: size.value || "",
    condition: condition.value || input.openai.condition || "",
    materials: materialEvidence.materials,
    detectedText: [
      ...input.openai.detectedText,
      ...input.ocrResults.map((r) => r.normalizedText),
    ],
    confidence: {
      ...input.openai.confidence,
      brand: brand.confidence,
      model: model.confidence,
      upc: upc.confidence,
      size: size.confidence,
      condition: condition.confidence,
    },
    fieldMeta: {
      ...input.openai.fieldMeta,
      brand: {
        confidence: brand.confidence,
        source:
          brand.source === "user_input"
            ? "user"
            : brand.source === "openai_visual"
              ? "image"
              : "inferred",
        needs_review: brand.needsReview,
      },
      model: {
        confidence: model.confidence,
        source:
          model.source === "user_input"
            ? "user"
            : model.source === "openai_visual"
              ? "image"
              : "inferred",
        needs_review: model.needsReview,
      },
      upc: {
        confidence: upc.confidence,
        source:
          upc.source === "user_input"
            ? "user"
            : upc.source === "openai_visual"
              ? "image"
              : "inferred",
        needs_review: upc.needsReview,
      },
      size: {
        confidence: size.confidence,
        source:
          size.source === "user_input"
            ? "user"
            : size.source === "openai_visual"
              ? "image"
              : "inferred",
        needs_review: size.needsReview,
      },
      condition: {
        confidence: condition.confidence,
        source:
          condition.source === "user_input"
            ? "user"
            : condition.source === "openai_visual"
              ? "image"
              : "inferred",
        needs_review: condition.needsReview,
      },
      material: {
        confidence: materialEvidence.confidence,
        source:
          materialEvidence.source === "google_vision_ocr"
            ? "image"
            : materialEvidence.source === "openai_visual"
              ? "image"
              : "inferred",
        needs_review: materialEvidence.needsReview,
      },
    },
    warnings: [
      ...input.openai.warnings,
      ...conflicts.map((c) => `Conflict on ${c.field}: ${c.reason}`),
      ...(upc.needsReview && !upc.value
        ? ["UPC not confidently detected — left empty"]
        : []),
      ...(materialEvidence.materials.length && materialEvidence.needsReview
        ? [
            `Material estimated (${materialEvidence.materials.join(", ")}) — confirm before publishing`,
          ]
        : []),
    ],
  };

  return {
    analysis: fused,
    evidence: {
      brand,
      model,
      upc,
      size,
      condition,
    },
    conflicts,
  };
}
