import {
  IMAGE_ANALYSIS_DEFAULTS,
  OCR_CANDIDATE_HINTS,
} from "@/config/image-analysis";
import { AI_PROVIDER_DEFAULTS } from "@/config/ai-providers";
import type { GoogleVisionMode } from "@/types/vision";

export interface OcrCandidateImage {
  id: string;
  url: string;
  fileName?: string;
  isPrimary?: boolean;
}

function scoreOcrCandidate(image: OcrCandidateImage, index: number): number {
  const name = `${image.fileName || ""} ${image.url}`.toLowerCase();
  let score = 0;

  for (const hint of OCR_CANDIDATE_HINTS) {
    if (name.includes(hint)) score += 3;
  }

  // Stronger priorities called out in product requirements
  if (/(barcode|upc|ean|qr)/i.test(name)) score += 4;
  if (/(label|tag|sticker)/i.test(name)) score += 3;
  if (/(back|rear|packaging|box|package)/i.test(name)) score += 3;
  if (/(text|detail|close|zoom)/i.test(name)) score += 2;

  if (image.isPrimary) score += 1;
  // Prefer non-primary angles for packaging/back text.
  if (index > 0) score += 1;

  return score;
}

/**
 * Decide which images to send to Google Vision OCR.
 * Never sends the full gallery — caps at GOOGLE_VISION_MAX_IMAGES (default 4).
 */
export function selectOcrImages(options: {
  images: OcrCandidateImage[];
  mode?: GoogleVisionMode;
  maxImages?: number;
  forceImproveOcr?: boolean;
  barcodesFound?: boolean;
  openaiLowConfidence?: boolean;
  missingCriticalFields?: boolean;
  visionEnabled?: boolean;
}): OcrCandidateImage[] {
  if (options.visionEnabled === false) return [];

  const mode = options.mode ?? AI_PROVIDER_DEFAULTS.googleVisionMode;
  if (mode === "off" && !options.forceImproveOcr) return [];

  const hardCap = Math.min(
    options.maxImages ?? AI_PROVIDER_DEFAULTS.googleVisionMaxImages,
    IMAGE_ANALYSIS_DEFAULTS.maxOcrImagesHardCap,
  );

  if (!options.images.length || hardCap <= 0) return [];

  const scored = options.images.map((image, index) => ({
    image,
    score: scoreOcrCandidate(image, index),
  }));

  scored.sort((a, b) => b.score - a.score);

  if (mode === "always" || options.forceImproveOcr) {
    return scored.slice(0, hardCap).map((s) => s.image);
  }

  // fallback mode — only when OCR is likely to add value
  const shouldRun =
    options.forceImproveOcr ||
    !options.barcodesFound ||
    Boolean(options.openaiLowConfidence) ||
    Boolean(options.missingCriticalFields) ||
    scored.some((s) => s.score >= 3);

  if (!shouldRun) return [];

  // Prefer positively scored images; if none score, still sample a few.
  const positive = scored.filter((s) => s.score > 0);
  const pool = positive.length ? positive : scored;
  return pool.slice(0, hardCap).map((s) => s.image);
}
