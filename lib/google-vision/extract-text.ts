import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getGoogleVisionClient } from "@/lib/google-vision/client";
import { normalizeOcrText } from "@/lib/google-vision/normalize-ocr";
import {
  loadCachedOcr,
  saveCachedOcr,
} from "@/lib/google-vision/ocr-cache";
import type { OCRImageResult } from "@/types/vision";
import { AI_PROVIDER_DEFAULTS } from "@/config/ai-providers";
import { recordAiUsageEvent } from "@/lib/ai/usage";
import { calculateGoogleVisionCost } from "@/lib/costs/calculate-google-vision-cost";
import { getGoogleVisionPricing } from "@/lib/costs/pricing";

export function hashImageBuffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export type ExtractTextFromImageInput = {
  imageId: string;
  imageUrl?: string;
  buffer?: Buffer;
  imageUrlFetch?: string;
  useDocumentFallback?: boolean;
  userId?: string;
  productId?: string;
  supabase?: SupabaseClient | null;
  imageHash?: string;
  unitsUsedThisMonthBefore?: number;
};

export type ExtractTextDetail = {
  ocr: OCRImageResult | null;
  cacheHit: boolean;
  unitsBilled: number;
  estimatedCost: number;
};

export type ExtractTextFromImagesInput = {
  images: Array<{
    imageId: string;
    imageUrl?: string;
    buffer: Buffer;
    imageHash?: string;
  }>;
  useDocumentFallback?: boolean;
  userId?: string;
  productId?: string;
  supabase?: SupabaseClient | null;
  unitsUsedThisMonthBefore?: number;
};

export type ExtractTextBatchResult = {
  results: OCRImageResult[];
  warnings: string[];
  unitsUsed: number;
  cacheHits: number;
  estimatedCost: number;
};

async function resolveBuffer(
  input: ExtractTextFromImageInput,
): Promise<Buffer | null> {
  if (input.buffer) return input.buffer;
  const url = input.imageUrlFetch || input.imageUrl;
  if (!url) return null;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch image: ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

/**
 * TEXT_DETECTION (+ optional DOCUMENT_TEXT_DETECTION fallback) for one image.
 * Service Account only. Records usage and prefers hash cache.
 */
export async function extractTextFromImageDetailed(
  input: ExtractTextFromImageInput,
): Promise<ExtractTextDetail> {
  const client = getGoogleVisionClient();
  if (!client) {
    return { ocr: null, cacheHit: false, unitsBilled: 0, estimatedCost: 0 };
  }

  const buffer = await resolveBuffer(input);
  if (!buffer) {
    return { ocr: null, cacheHit: false, unitsBilled: 0, estimatedCost: 0 };
  }

  const imageHash = input.imageHash || hashImageBuffer(buffer);
  const cached = await loadCachedOcr(input.supabase, input.userId, imageHash);
  if (cached) {
    await recordAiUsageEvent(input.supabase ?? null, {
      userId: input.userId,
      productId: input.productId,
      provider: "google_vision",
      operation: "TEXT_DETECTION_CACHE",
      imageCount: 1,
      ocrUnitCount: 0,
      cacheHit: true,
      estimatedCost: 0,
      status: "ok",
    });
    return {
      ocr: { ...cached, imageId: input.imageId, imageUrl: input.imageUrl },
      cacheHit: true,
      unitsBilled: 0,
      estimatedCost: 0,
    };
  }

  const content = buffer.toString("base64");
  const [textResult] = await client.textDetection({
    image: { content },
  });

  let fullText =
    textResult.fullTextAnnotation?.text ||
    textResult.textAnnotations?.[0]?.description ||
    "";
  let feature: OCRImageResult["feature"] = "TEXT_DETECTION";
  let billableUnits = 1;

  if (
    !fullText.trim() &&
    (input.useDocumentFallback ?? AI_PROVIDER_DEFAULTS.documentTextFallback)
  ) {
    const [docResult] = await client.documentTextDetection({
      image: { content },
    });
    fullText =
      docResult.fullTextAnnotation?.text ||
      docResult.textAnnotations?.[0]?.description ||
      "";
    feature = "DOCUMENT_TEXT_DETECTION";
    billableUnits = 2;
  }

  const pages = textResult.fullTextAnnotation?.pages ?? [];
  const confidences = pages
    .flatMap((page) => page.confidence ?? [])
    .filter((c): c is number => typeof c === "number");
  const confidence = confidences.length
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : null;

  const cost = calculateGoogleVisionCost({
    unitsUsedThisMonthBefore: input.unitsUsedThisMonthBefore ?? 0,
    units: billableUnits,
    pricing: getGoogleVisionPricing(),
  }).estimatedCost;

  const normalized = normalizeOcrText(fullText);
  if (!normalized) {
    await recordAiUsageEvent(input.supabase ?? null, {
      userId: input.userId,
      productId: input.productId,
      provider: "google_vision",
      operation: feature,
      imageCount: 1,
      ocrUnitCount: billableUnits,
      cacheHit: false,
      estimatedCost: cost,
      status: "empty",
    });
    return {
      ocr: null,
      cacheHit: false,
      unitsBilled: billableUnits,
      estimatedCost: cost,
    };
  }

  const result: OCRImageResult = {
    imageId: input.imageId,
    imageUrl: input.imageUrl,
    fullText,
    normalizedText: normalized,
    provider: "google_vision",
    confidence,
    feature,
  };

  await saveCachedOcr(input.supabase, input.userId, imageHash, result);

  await recordAiUsageEvent(input.supabase ?? null, {
    userId: input.userId,
    productId: input.productId,
    provider: "google_vision",
    operation: feature,
    imageCount: 1,
    ocrUnitCount: billableUnits,
    cacheHit: false,
    estimatedCost: cost,
    status: "ok",
  });

  return {
    ocr: result,
    cacheHit: false,
    unitsBilled: billableUnits,
    estimatedCost: cost,
  };
}

export async function extractTextFromImage(
  input: ExtractTextFromImageInput,
): Promise<OCRImageResult | null> {
  const detail = await extractTextFromImageDetailed(input);
  return detail.ocr;
}

/**
 * OCR a pre-filtered candidate list (from selectOcrImages).
 * Individual Vision failures become warnings — never aborts the pipeline.
 */
export async function extractTextFromImages(
  input: ExtractTextFromImagesInput,
): Promise<ExtractTextBatchResult> {
  const results: OCRImageResult[] = [];
  const warnings: string[] = [];
  let unitsUsed = 0;
  let cacheHits = 0;
  let estimatedCost = 0;
  let monthUnits = input.unitsUsedThisMonthBefore ?? 0;

  if (!getGoogleVisionClient()) {
    return { results, warnings, unitsUsed, cacheHits, estimatedCost };
  }

  for (const image of input.images) {
    try {
      const detail = await extractTextFromImageDetailed({
        imageId: image.imageId,
        imageUrl: image.imageUrl,
        buffer: image.buffer,
        imageHash: image.imageHash || hashImageBuffer(image.buffer),
        useDocumentFallback: input.useDocumentFallback,
        userId: input.userId,
        productId: input.productId,
        supabase: input.supabase,
        unitsUsedThisMonthBefore: monthUnits,
      });

      if (detail.cacheHit) cacheHits += 1;
      unitsUsed += detail.unitsBilled;
      estimatedCost += detail.estimatedCost;
      monthUnits += detail.unitsBilled;
      if (detail.ocr) results.push(detail.ocr);
    } catch (error) {
      const detail =
        error instanceof Error ? error.message.slice(0, 180) : "unknown error";
      const billingHint = /billing|PERMISSION_DENIED|CLOUD_BILLING|API has not been used|enable/i.test(
        detail,
      )
        ? " Enable Cloud Vision API billing on the GCP project, or use Improve Labels after Vision is fixed."
        : "";
      warnings.push(
        `Google Vision OCR unavailable for one or more images (${detail}). Continued with barcode + AI.${billingHint}`,
      );
      await recordAiUsageEvent(input.supabase ?? null, {
        userId: input.userId,
        productId: input.productId,
        provider: "google_vision",
        operation: "TEXT_DETECTION",
        imageCount: 1,
        ocrUnitCount: 0,
        status: "error",
        errorCode:
          error instanceof Error ? error.message.slice(0, 80) : "vision_error",
      });
    }
  }

  return { results, warnings, unitsUsed, cacheHits, estimatedCost };
}

/** @deprecated Prefer extractTextFromImage */
export async function extractTextFromImageBuffer(options: {
  imageId: string;
  imageUrl?: string;
  buffer: Buffer;
  useDocumentFallback?: boolean;
}): Promise<OCRImageResult | null> {
  return extractTextFromImage(options);
}
