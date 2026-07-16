import type { SupabaseClient } from "@supabase/supabase-js";
import type { OCRImageResult } from "@/types/vision";

export const OCR_CACHE_VERSION = "ocr-v1";

export async function loadCachedOcr(
  supabase: SupabaseClient | null | undefined,
  userId: string | undefined,
  imageHash: string,
): Promise<OCRImageResult | null> {
  if (!supabase || !userId || !imageHash) return null;
  try {
    const { data } = await supabase
      .from("image_analysis_cache")
      .select("result_json")
      .eq("user_id", userId)
      .eq("image_hash", imageHash)
      .eq("provider", "google_vision")
      .eq("analysis_version", OCR_CACHE_VERSION)
      .maybeSingle();
    if (!data?.result_json) return null;
    return data.result_json as OCRImageResult;
  } catch {
    return null;
  }
}

export async function saveCachedOcr(
  supabase: SupabaseClient | null | undefined,
  userId: string | undefined,
  imageHash: string,
  result: OCRImageResult,
) {
  if (!supabase || !userId || !imageHash) return;
  try {
    await supabase.from("image_analysis_cache").upsert(
      {
        user_id: userId,
        image_hash: imageHash,
        provider: "google_vision",
        analysis_version: OCR_CACHE_VERSION,
        result_json: result,
      },
      { onConflict: "user_id,image_hash,provider,analysis_version" },
    );
  } catch {
    // never break OCR flow for cache write failures
  }
}
