import type { SupabaseClient } from "@supabase/supabase-js";

export type UsageProvider =
  | "openai"
  | "google_vision"
  | "zxing"
  | "supabase"
  | "vercel"
  | "cache";

export async function recordAiUsageEvent(
  supabase: SupabaseClient | null,
  event: {
    userId?: string;
    productId?: string | null;
    provider: UsageProvider;
    model?: string | null;
    operation: string;
    requestId?: string | null;
    inputTokens?: number;
    cachedInputTokens?: number;
    outputTokens?: number;
    reasoningTokens?: number;
    imageCount?: number;
    ocrUnitCount?: number;
    requestCount?: number;
    retryCount?: number;
    cacheHit?: boolean;
    estimatedCost?: number;
    status?: string;
    errorCode?: string | null;
  },
) {
  if (!supabase || !event.userId) return;
  try {
    await supabase.from("ai_usage_events").insert({
      user_id: event.userId,
      product_id: event.productId ?? null,
      provider: event.provider,
      model: event.model ?? null,
      operation: event.operation,
      request_id: event.requestId ?? null,
      input_tokens: event.inputTokens ?? 0,
      cached_input_tokens: event.cachedInputTokens ?? 0,
      output_tokens: event.outputTokens ?? 0,
      reasoning_tokens: event.reasoningTokens ?? 0,
      image_count: event.imageCount ?? 0,
      ocr_unit_count: event.ocrUnitCount ?? 0,
      request_count: event.requestCount ?? 1,
      retry_count: event.retryCount ?? 0,
      cache_hit: event.cacheHit ?? false,
      estimated_cost: event.estimatedCost ?? 0,
      status: event.status ?? "ok",
      error_code: event.errorCode ?? null,
    });
  } catch {
    // never break analysis for usage logging
  }
}
