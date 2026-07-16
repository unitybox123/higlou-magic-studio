/**
 * Infrastructure / stage failures must never collapse into a single
 * "can't identify product" message.
 */
export type AnalysisFailureCode =
  | "UNSUPPORTED_INPUT_FORMAT"
  | "IMAGE_DECODE_FAILED"
  | "IMAGE_TOO_SMALL"
  | "NO_PRODUCT_VISIBLE"
  | "RECOGNITION_FAILED"
  | "BARCODE_NOT_FOUND"
  | "OCR_FAILED"
  | "CATEGORY_RESOLUTION_FAILED"
  | "LISTING_BUILD_FAILED";

/** Soft codes never abort the whole analysis as a global fatal error. */
export const SOFT_ANALYSIS_FAILURE_CODES: readonly AnalysisFailureCode[] = [
  "BARCODE_NOT_FOUND",
  "OCR_FAILED",
  "CATEGORY_RESOLUTION_FAILED",
] as const;

export function isSoftAnalysisFailure(code: AnalysisFailureCode): boolean {
  return (SOFT_ANALYSIS_FAILURE_CODES as readonly string[]).includes(code);
}

const FAILURE_MESSAGES: Record<AnalysisFailureCode, string> = {
  UNSUPPORTED_INPUT_FORMAT: "We couldn’t process this image format.",
  IMAGE_DECODE_FAILED:
    "This photo could not be opened. Please upload it again.",
  IMAGE_TOO_SMALL:
    "Photos are too small to analyze reliably. Upload larger originals and try again.",
  NO_PRODUCT_VISIBLE: "We couldn’t find a product in this photo.",
  RECOGNITION_FAILED: "We couldn’t confidently identify the product.",
  BARCODE_NOT_FOUND: "No barcode detected.",
  OCR_FAILED: "We couldn’t read label text from these photos.",
  CATEGORY_RESOLUTION_FAILED:
    "Product identified. Category match needs review.",
  LISTING_BUILD_FAILED:
    "Product identified, but we couldn’t finish building the listing draft.",
};

export function messageForAnalysisFailure(code: AnalysisFailureCode): string {
  return FAILURE_MESSAGES[code];
}

export function httpStatusForAnalysisFailure(code: AnalysisFailureCode): number {
  if (isSoftAnalysisFailure(code)) return 200;
  if (
    code === "UNSUPPORTED_INPUT_FORMAT" ||
    code === "IMAGE_DECODE_FAILED" ||
    code === "IMAGE_TOO_SMALL" ||
    code === "NO_PRODUCT_VISIBLE"
  ) {
    return 422;
  }
  return 400;
}
