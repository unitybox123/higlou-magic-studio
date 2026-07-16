export type GoogleVisionMode = "off" | "fallback" | "always";

export const AI_PROVIDER_DEFAULTS = {
  openaiEnabled: true,
  openaiModel: process.env.OPENAI_MODEL || "gpt-4o",
  maxAnalysisImages: Number(process.env.MAX_ANALYSIS_IMAGES || 12),
  minConfidence: 0.6,
  retryLimit: 2,
  timeoutMs: 90_000,
  googleVisionEnabled: process.env.GOOGLE_VISION_ENABLED !== "false",
  googleVisionMode: (process.env.GOOGLE_VISION_MODE ||
    "fallback") as GoogleVisionMode,
  googleVisionMaxImages: Number(process.env.GOOGLE_VISION_MAX_IMAGES || 4),
  documentTextFallback: true,
  ocrConfidenceThreshold: 0.5,
  allowImproveOcr: true,
  barcodeEnabled: process.env.ENABLE_BARCODE_SCANNING !== "false",
  barcodeEnhancedContrast: true,
  barcodeTryRotation: true,
  preferBarcodeOverOcr: true,
  validateUpcEanChecksum: true,
} as const;

export const MAX_IMAGE_SIZE_MB = Number(process.env.MAX_IMAGE_SIZE_MB || 10);
