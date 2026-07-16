import OpenAI from "openai";
import { AI_PROVIDER_DEFAULTS } from "@/config/ai-providers";
import { COST_DEFAULTS, type AnalysisTier } from "@/config/costs";

export function createOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return new OpenAI({ apiKey });
}

export function getOpenAIModel(tier: AnalysisTier | "standard" = "economy") {
  if (tier === "advanced") {
    return (
      process.env.OPENAI_ADVANCED_MODEL ||
      process.env.OPENAI_MODEL ||
      COST_DEFAULTS.advancedModel
    );
  }
  // standard shares economy model; cost optimizer varies image count instead
  return (
    process.env.OPENAI_ECONOMY_MODEL ||
    process.env.OPENAI_MODEL ||
    COST_DEFAULTS.economyModel ||
    AI_PROVIDER_DEFAULTS.openaiModel
  );
}

export function shouldEscalateToAdvanced(options: {
  requestedTier?: AnalysisTier;
  forceDeepAnalysis?: boolean;
  validationFailed?: boolean;
  lowConfidence?: boolean;
  ambiguousCategory?: boolean;
  conflictingEvidence?: boolean;
}): AnalysisTier {
  if (options.requestedTier === "advanced" || options.forceDeepAnalysis) {
    return "advanced";
  }
  if (
    options.validationFailed ||
    options.lowConfidence ||
    options.ambiguousCategory ||
    options.conflictingEvidence
  ) {
    return "advanced";
  }
  return "economy";
}
