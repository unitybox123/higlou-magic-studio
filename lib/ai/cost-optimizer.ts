import type { AnalysisMode } from "@/lib/cache/product-fingerprint";
import type { BarcodeDetection } from "@/types/barcode";

export type AnalysisPlan = {
  runBarcode: boolean;
  runOcr: boolean;
  ocrImageIndexes: number[];
  runOpenAiVision: boolean;
  openAiImageIndexes: number[];
  analysisMode: AnalysisMode;
  reason: string[];
  estimatedSavingsNote: string;
};

export type CostOptimizerInput = {
  usableIndexes: number[];
  barcodes?: BarcodeDetection[];
  barcodeEnabled?: boolean;
  visionEnabled?: boolean;
  openaiEnabled?: boolean;
  forceDeepAnalysis?: boolean;
  forceImproveOcr?: boolean;
  forceFreshAnalysis?: boolean;
  requestedMode?: AnalysisMode;
  ocrTextSignalsStrong?: boolean;
};

/**
 * Decide which paid/local steps to run.
 * Principle: enough evidence → fewer images + cheaper model — not "skip OpenAI entirely".
 */
export function buildAnalysisPlan(input: CostOptimizerInput): AnalysisPlan {
  const reason: string[] = [];
  const indexes = [...input.usableIndexes];
  const barcodeEnabled = input.barcodeEnabled !== false;
  const visionEnabled = input.visionEnabled !== false;
  const openaiEnabled = input.openaiEnabled !== false;

  let mode: AnalysisMode =
    input.requestedMode ||
    (input.forceDeepAnalysis ? "advanced" : "economy");

  const validUpc = (input.barcodes ?? []).some(
    (b) =>
      ["UPC_A", "UPC_E", "EAN_8", "EAN_13"].includes(b.format) &&
      (b.checksumValid === true || b.checksumValid === null) &&
      Boolean(b.value),
  );

  // Always prefer local barcode first on candidates
  const runBarcode = barcodeEnabled && indexes.length > 0;
  if (runBarcode) reason.push("Run local barcode on usable images");

  let runOcr = visionEnabled && indexes.length > 0;
  let ocrImageIndexes = indexes.slice(0, Math.min(4, indexes.length));

  if (validUpc && !input.forceImproveOcr) {
    ocrImageIndexes = indexes.slice(0, Math.min(2, indexes.length));
    reason.push("Valid UPC found — OCR limited to label candidates");
  } else if (!validUpc) {
    reason.push("No barcode UPC — OCR on text-likely candidates");
  }

  if (input.forceImproveOcr) {
    runOcr = visionEnabled;
    ocrImageIndexes = indexes.slice(0, Math.min(6, indexes.length));
    reason.push("Improve OCR forced by user");
  }

  if (!visionEnabled) {
    runOcr = false;
    ocrImageIndexes = [];
    reason.push("Google Vision disabled — OCR skipped");
  }

  let openAiImageIndexes = indexes.slice(0, Math.min(6, indexes.length));
  if (validUpc) {
    openAiImageIndexes = indexes.slice(0, Math.min(3, indexes.length));
    reason.push("UPC evidence — fewer OpenAI images");
  }
  if (input.ocrTextSignalsStrong && !input.forceDeepAnalysis) {
    openAiImageIndexes = indexes.slice(0, Math.min(3, indexes.length));
    mode = mode === "advanced" ? "advanced" : "economy";
    reason.push("Strong OCR brand/model — economy OpenAI with few images");
  }

  if (input.forceDeepAnalysis) {
    mode = "advanced";
    openAiImageIndexes = indexes.slice(0, Math.min(8, indexes.length));
    reason.push("Advanced analysis requested");
  }

  const runOpenAiVision = openaiEnabled && openAiImageIndexes.length > 0;
  if (!openaiEnabled) {
    reason.push("OpenAI disabled");
  } else {
    reason.push(`OpenAI ${mode} on ${openAiImageIndexes.length} image(s)`);
  }

  const skippedOcr = indexes.length - ocrImageIndexes.length;
  const skippedOpenai = indexes.length - openAiImageIndexes.length;
  const estimatedSavingsNote = [
    skippedOcr > 0 ? `${skippedOcr} OCR image(s) skipped` : null,
    skippedOpenai > 0 ? `${skippedOpenai} OpenAI image(s) skipped` : null,
    validUpc ? "barcode short-circuit applied" : null,
  ]
    .filter(Boolean)
    .join("; ") || "full plan";

  return {
    runBarcode,
    runOcr,
    ocrImageIndexes,
    runOpenAiVision,
    openAiImageIndexes,
    analysisMode: mode,
    reason,
    estimatedSavingsNote,
  };
}
