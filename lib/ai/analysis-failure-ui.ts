import {
  messageForAnalysisFailure,
  type AnalysisFailureCode,
} from "@/types/analysis-failures";

const PHOTO_INFRA_CODES: readonly AnalysisFailureCode[] = [
  "UNSUPPORTED_INPUT_FORMAT",
  "IMAGE_DECODE_FAILED",
  "IMAGE_TOO_SMALL",
];

const KNOWN_CODES: readonly AnalysisFailureCode[] = [
  "UNSUPPORTED_INPUT_FORMAT",
  "IMAGE_DECODE_FAILED",
  "IMAGE_TOO_SMALL",
  "NO_PRODUCT_VISIBLE",
  "RECOGNITION_FAILED",
  "BARCODE_NOT_FOUND",
  "OCR_FAILED",
  "CATEGORY_RESOLUTION_FAILED",
  "LISTING_BUILD_FAILED",
];

function asFailureCode(
  code: string | null | undefined,
): AnalysisFailureCode | null {
  if (!code) return null;
  return (KNOWN_CODES as readonly string[]).includes(code)
    ? (code as AnalysisFailureCode)
    : null;
}

export function isPhotoInfrastructureFailure(
  code: string | null | undefined,
): boolean {
  return Boolean(
    code && (PHOTO_INFRA_CODES as readonly string[]).includes(code),
  );
}

export function isRecognitionFailure(
  code: string | null | undefined,
): boolean {
  return code === "RECOGNITION_FAILED" || code === "NO_PRODUCT_VISIBLE";
}

/**
 * Map API failure codes to user copy. Never invent “can't identify product”
 * for format / decode / size issues.
 */
export function humanizeAnalysisFailure(
  code: string | null | undefined,
  rawMessage?: string | null,
): string {
  const known = asFailureCode(code);
  if (known) return messageForAnalysisFailure(known);

  const raw = (rawMessage || "").trim();
  if (/can't identify this product/i.test(raw)) {
    return messageForAnalysisFailure("IMAGE_TOO_SMALL");
  }
  return raw || "Product analysis failed";
}
