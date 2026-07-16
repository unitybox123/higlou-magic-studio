import {
  emptyAnalysisStages,
  type AnalysisPipelineStages,
} from "@/types/analysis-stages";

function avgConfidence(
  confidence: Record<string, number> | undefined,
): number | undefined {
  if (!confidence) return undefined;
  const values = Object.values(confidence).filter(
    (v) => typeof v === "number" && Number.isFinite(v),
  );
  if (!values.length) return undefined;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Build independent stage snapshots.
 * Recognition success is never downgraded by missing barcode / category / specifics.
 */
export function buildAnalysisPipelineStages(input: {
  analysis: {
    brand?: string;
    type?: string;
    title?: string;
    size?: string;
    upc?: string;
    categoryId?: string;
    categoryName?: string;
    confidence?: Record<string, number>;
  };
  barcodeCount: number;
  ocrImageCount: number;
  ocrWeak: boolean;
  categorySource?: string;
  categoryMissing?: boolean;
  categoryFailed?: boolean;
  listingFailed?: boolean;
}): AnalysisPipelineStages {
  const brand = (input.analysis.brand || "").trim();
  const productType = (input.analysis.type || "").trim();
  const title = (input.analysis.title || "").trim();
  const size = (input.analysis.size || "").trim();
  const recognized = Boolean(brand || productType || title);
  const confidence = avgConfidence(input.analysis.confidence);

  const ocrStatus =
    input.ocrImageCount === 0
      ? ("missing" as const)
      : input.ocrWeak
        ? ("partial" as const)
        : ("success" as const);
  const barcodeStatus =
    input.barcodeCount > 0 ? ("success" as const) : ("missing" as const);

  const extractionStatus =
    ocrStatus === "success" || barcodeStatus === "success"
      ? ("success" as const)
      : ocrStatus === "partial"
        ? ("partial" as const)
        : ("missing" as const);

  const hasCategory = Boolean(
    (input.analysis.categoryId || "").trim() &&
      (input.analysis.categoryName || "").trim(),
  );

  return emptyAnalysisStages({
    recognition: {
      status: recognized ? "success" : "partial",
      brand: brand || undefined,
      productType: productType || title || undefined,
      size: size || undefined,
      confidence,
      message: recognized
        ? "Product recognized from photos"
        : "Photos analyzed — identity fields may need review",
    },
    extraction: {
      status: extractionStatus,
      ocr: ocrStatus,
      barcode: barcodeStatus,
      message:
        barcodeStatus === "missing" && ocrStatus !== "success"
          ? "UPC not detected · label reading limited"
          : barcodeStatus === "missing"
            ? "No barcode detected."
            : ocrStatus === "partial"
              ? "Label partially read"
              : "Label / barcode evidence collected",
    },
    classification: {
      status: input.categoryFailed
        ? "failed"
        : input.categoryMissing
          ? "partial"
          : hasCategory
            ? "success"
            : "partial",
      categoryId: input.analysis.categoryId || undefined,
      categoryName: input.analysis.categoryName || undefined,
      message: input.categoryFailed
        ? "Product identified. Category match needs review."
        : hasCategory
          ? input.categorySource && input.categorySource !== "model"
            ? `Category matched (${input.categorySource})`
            : "Category matched"
          : "Finding best eBay category…",
    },
    listing: {
      status: input.listingFailed
        ? "failed"
        : recognized
          ? "success"
          : "partial",
      message: input.listingFailed
        ? "Product identified, but listing draft needs review"
        : recognized
          ? "Draft listing fields ready for review"
          : "Listing draft incomplete — review required",
    },
  });
}
