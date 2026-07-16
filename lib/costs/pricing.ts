import type { AnalysisTier } from "@/config/costs";
import { COST_DEFAULTS } from "@/config/costs";
import type { OpenAIPricing } from "@/lib/costs/calculate-openai-cost";
import type { GoogleVisionPricing } from "@/lib/costs/calculate-google-vision-cost";

export function getOpenAIPricingForTier(tier: AnalysisTier): OpenAIPricing {
  if (tier === "advanced") {
    return {
      inputPricePerMillion: COST_DEFAULTS.openaiInputPricePerMillion,
      cachedInputPricePerMillion: COST_DEFAULTS.openaiCachedInputPricePerMillion,
      outputPricePerMillion: COST_DEFAULTS.openaiOutputPricePerMillion,
    };
  }
  return {
    inputPricePerMillion: COST_DEFAULTS.openaiEconomyInputPricePerMillion,
    cachedInputPricePerMillion:
      COST_DEFAULTS.openaiEconomyCachedInputPricePerMillion,
    outputPricePerMillion: COST_DEFAULTS.openaiEconomyOutputPricePerMillion,
  };
}

export function getGoogleVisionPricing(): GoogleVisionPricing {
  return {
    freeUnitsMonthly: COST_DEFAULTS.googleVisionFreeUnitsMonthly,
    pricePer1000Units: COST_DEFAULTS.googleVisionPricePer1000Units,
  };
}

export function getMonthlyFixedInfrastructureCost(): number {
  return (
    COST_DEFAULTS.supabaseMonthlyBaseCost +
    COST_DEFAULTS.vercelMonthlyBaseCost +
    COST_DEFAULTS.domainMiscMonthlyCost
  );
}
