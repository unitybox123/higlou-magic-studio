import type { SupabaseClient } from "@supabase/supabase-js";
import type { ImageQualityResult } from "@/lib/images/quality-engine";
import type { BarcodeDetection } from "@/types/barcode";
import type { OCRImageResult } from "@/types/vision";
import type { NormalizedProduct } from "@/types/normalized-product";
import {
  PIPELINE_VERSION,
  PROMPT_VERSION,
} from "@/lib/cache/product-fingerprint";

export type CachedImageBundle = {
  quality?: ImageQualityResult;
  barcodes?: BarcodeDetection[];
  ocr?: OCRImageResult | null;
};

export type CachedProductAnalysis = {
  normalizedProduct: NormalizedProduct;
  confidenceJson: Record<string, unknown>;
  costJson: Record<string, unknown>;
  analysisResult: unknown;
  evidence: unknown;
  conflicts: unknown;
  pipeline: unknown;
  barcodes: BarcodeDetection[];
  ocrResults: OCRImageResult[];
};

const IMAGE_PROVIDER = "higlou_image_bundle";
const IMAGE_VERSION = "image-bundle-v1";

export async function loadImageBundleCache(
  supabase: SupabaseClient | null | undefined,
  userId: string | undefined,
  imageHash: string,
): Promise<CachedImageBundle | null> {
  if (!supabase || !userId || !imageHash) return null;
  try {
    const { data } = await supabase
      .from("image_analysis_cache")
      .select("result_json")
      .eq("user_id", userId)
      .eq("image_hash", imageHash)
      .eq("provider", IMAGE_PROVIDER)
      .eq("analysis_version", IMAGE_VERSION)
      .maybeSingle();
    if (!data?.result_json) return null;
    return data.result_json as CachedImageBundle;
  } catch {
    return null;
  }
}

export async function saveImageBundleCache(
  supabase: SupabaseClient | null | undefined,
  userId: string | undefined,
  imageHash: string,
  bundle: CachedImageBundle,
) {
  if (!supabase || !userId || !imageHash) return;
  try {
    await supabase.from("image_analysis_cache").upsert(
      {
        user_id: userId,
        image_hash: imageHash,
        provider: IMAGE_PROVIDER,
        analysis_version: IMAGE_VERSION,
        result_json: bundle,
      },
      { onConflict: "user_id,image_hash,provider,analysis_version" },
    );
  } catch {
    // never break analysis for cache write
  }
}

export async function loadProductAnalysisCache(
  supabase: SupabaseClient | null | undefined,
  userId: string | undefined,
  fingerprint: string,
): Promise<CachedProductAnalysis | null> {
  if (!supabase || !userId || !fingerprint) return null;
  try {
    const { data } = await supabase
      .from("product_analysis_cache")
      .select(
        "normalized_product_json, confidence_json, cost_json, analysis_payload, hit_count",
      )
      .eq("user_id", userId)
      .eq("product_fingerprint", fingerprint)
      .eq("pipeline_version", PIPELINE_VERSION)
      .eq("prompt_version", PROMPT_VERSION)
      .maybeSingle();

    if (!data?.normalized_product_json || !data?.analysis_payload) return null;

    await supabase
      .from("product_analysis_cache")
      .update({
        last_used_at: new Date().toISOString(),
        hit_count: Number(data.hit_count || 0) + 1,
      })
      .eq("user_id", userId)
      .eq("product_fingerprint", fingerprint);

    const payload = data.analysis_payload as Record<string, unknown>;
    return {
      normalizedProduct: data.normalized_product_json as NormalizedProduct,
      confidenceJson: (data.confidence_json || {}) as Record<string, unknown>,
      costJson: (data.cost_json || {}) as Record<string, unknown>,
      analysisResult: payload.analysis,
      evidence: payload.evidence,
      conflicts: payload.conflicts,
      pipeline: payload.pipeline,
      barcodes: (payload.barcodes as BarcodeDetection[]) || [],
      ocrResults: (payload.ocrResults as OCRImageResult[]) || [],
    };
  } catch {
    return null;
  }
}

export async function saveProductAnalysisCache(
  supabase: SupabaseClient | null | undefined,
  userId: string | undefined,
  fingerprint: string,
  payload: CachedProductAnalysis,
) {
  if (!supabase || !userId || !fingerprint) return;
  try {
    await supabase.from("product_analysis_cache").upsert(
      {
        user_id: userId,
        product_fingerprint: fingerprint,
        normalized_product_json: payload.normalizedProduct,
        confidence_json: payload.confidenceJson,
        cost_json: payload.costJson,
        analysis_payload: {
          analysis: payload.analysisResult,
          evidence: payload.evidence,
          conflicts: payload.conflicts,
          pipeline: payload.pipeline,
          barcodes: payload.barcodes,
          ocrResults: payload.ocrResults,
        },
        pipeline_version: PIPELINE_VERSION,
        prompt_version: PROMPT_VERSION,
        last_used_at: new Date().toISOString(),
        hit_count: 1,
      },
      { onConflict: "user_id,product_fingerprint,pipeline_version,prompt_version" },
    );
  } catch {
    // ignore
  }
}
