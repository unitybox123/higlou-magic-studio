/**
 * Independent analysis pipeline stages.
 * Recognition success must never be conflated with extraction / category / listing failures.
 */
export type AnalysisStageStatus =
  | "waiting"
  | "running"
  | "success"
  | "partial"
  | "missing"
  | "failed";

export type AnalysisStageSnapshot = {
  status: AnalysisStageStatus;
  message?: string;
};

export type AnalysisPipelineStages = {
  /** What product is this? (brand / type / size from vision) */
  recognition: AnalysisStageSnapshot & {
    brand?: string;
    productType?: string;
    size?: string;
    confidence?: number;
  };
  /** Label / OCR / barcode reading */
  extraction: AnalysisStageSnapshot & {
    ocr: AnalysisStageStatus;
    barcode: AnalysisStageStatus;
  };
  /** eBay category match */
  classification: AnalysisStageSnapshot & {
    categoryId?: string;
    categoryName?: string;
  };
  /** Draft listing fields assembled */
  listing: AnalysisStageSnapshot;
};

export function emptyAnalysisStages(
  overrides?: Partial<AnalysisPipelineStages>,
): AnalysisPipelineStages {
  return {
    recognition: { status: "waiting", ...overrides?.recognition },
    extraction: {
      status: "waiting",
      ocr: "waiting",
      barcode: "waiting",
      ...overrides?.extraction,
    },
    classification: { status: "waiting", ...overrides?.classification },
    listing: { status: "waiting", ...overrides?.listing },
  };
}
