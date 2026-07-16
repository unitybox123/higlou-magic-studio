export type OpenAIUsageLike = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_tokens_details?: {
    cached_tokens?: number;
  };
  input_tokens?: number;
  output_tokens?: number;
  // Chat Completions modern shapes
  promptTokens?: number;
  completionTokens?: number;
};

export type OpenAIPricing = {
  inputPricePerMillion: number;
  cachedInputPricePerMillion: number;
  outputPricePerMillion: number;
};

export function normalizeOpenAIUsage(usage?: OpenAIUsageLike | null) {
  const inputTokens = Number(
    usage?.prompt_tokens ?? usage?.input_tokens ?? usage?.promptTokens ?? 0,
  );
  const outputTokens = Number(
    usage?.completion_tokens ??
      usage?.output_tokens ??
      usage?.completionTokens ??
      0,
  );
  const cachedInputTokens = Number(
    usage?.prompt_tokens_details?.cached_tokens ?? 0,
  );
  // Billable input excludes cached tokens so we don't double-count.
  const billableInputTokens = Math.max(0, inputTokens - cachedInputTokens);

  return {
    inputTokens,
    billableInputTokens,
    cachedInputTokens,
    outputTokens,
  };
}

export function calculateOpenAICost(
  usage: OpenAIUsageLike | null | undefined,
  pricing: OpenAIPricing,
): {
  inputCost: number;
  cachedInputCost: number;
  outputCost: number;
  estimatedCost: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
} {
  if (
    !pricing ||
    Number.isNaN(pricing.inputPricePerMillion) ||
    Number.isNaN(pricing.outputPricePerMillion)
  ) {
    return {
      inputCost: 0,
      cachedInputCost: 0,
      outputCost: 0,
      estimatedCost: 0,
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
    };
  }

  const normalized = normalizeOpenAIUsage(usage);
  const inputCost =
    (normalized.billableInputTokens / 1_000_000) *
    pricing.inputPricePerMillion;
  const cachedInputCost =
    (normalized.cachedInputTokens / 1_000_000) *
    (pricing.cachedInputPricePerMillion || 0);
  const outputCost =
    (normalized.outputTokens / 1_000_000) * pricing.outputPricePerMillion;

  return {
    inputCost,
    cachedInputCost,
    outputCost,
    estimatedCost: inputCost + cachedInputCost + outputCost,
    inputTokens: normalized.inputTokens,
    cachedInputTokens: normalized.cachedInputTokens,
    outputTokens: normalized.outputTokens,
  };
}
