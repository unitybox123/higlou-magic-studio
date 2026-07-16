export const IMAGE_ANALYSIS_DEFAULTS = {
  maxAnalysisImages: 12,
  maxOcrImagesHardCap: 8,
  defaultOcrImages: 4,
  analysisVersion: "hybrid-v1",
  progressSteps: [
    "Uploading images",
    "Checking image quality",
    "Scanning barcodes",
    "Reading labels and packaging",
    "Identifying the product",
    "Comparing detected information",
    "Creating optimized eBay title",
    "Building Item Specifics",
    "Creating Higlou Store description",
    "Validating the active eBay template",
    "Your listing is ready",
  ] as const,
};

/** Heuristic keywords that suggest an image is worth OCR spend. */
export const OCR_CANDIDATE_HINTS = [
  "label",
  "back",
  "rear",
  "packaging",
  "box",
  "upc",
  "barcode",
  "tag",
  "care",
  "spec",
  "manual",
  "sticker",
  "size",
  "material",
];
