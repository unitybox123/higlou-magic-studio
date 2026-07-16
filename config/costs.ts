export type AnalysisTier = "economy" | "advanced";

export type BudgetEnforcementMode =
  | "warn_only"
  | "require_admin_confirmation"
  | "block_advanced_analysis"
  | "block_all_new_ai_analysis";

export type CostCategory =
  | "platform_operating_costs"
  | "marketplace_selling_costs"
  | "product_and_fulfillment_costs";

export const COST_DEFAULTS = {
  monthlyProductTarget: Number(process.env.MONTHLY_PRODUCT_TARGET || 500),
  monthlyBudgetWarningUsd: Number(process.env.MONTHLY_BUDGET_WARNING_USD || 75),
  monthlyBudgetLimitUsd: Number(process.env.MONTHLY_BUDGET_LIMIT_USD || 100),
  openaiInputPricePerMillion: Number(
    process.env.OPENAI_INPUT_PRICE_PER_MILLION || 1,
  ),
  openaiCachedInputPricePerMillion: Number(
    process.env.OPENAI_CACHED_INPUT_PRICE_PER_MILLION || 0.5,
  ),
  openaiOutputPricePerMillion: Number(
    process.env.OPENAI_OUTPUT_PRICE_PER_MILLION || 6,
  ),
  openaiEconomyInputPricePerMillion: Number(
    process.env.OPENAI_ECONOMY_INPUT_PRICE_PER_MILLION || 0.15,
  ),
  openaiEconomyCachedInputPricePerMillion: Number(
    process.env.OPENAI_ECONOMY_CACHED_INPUT_PRICE_PER_MILLION || 0.075,
  ),
  openaiEconomyOutputPricePerMillion: Number(
    process.env.OPENAI_ECONOMY_OUTPUT_PRICE_PER_MILLION || 0.6,
  ),
  googleVisionFreeUnitsMonthly: Number(
    process.env.GOOGLE_VISION_FREE_UNITS_MONTHLY || 1000,
  ),
  googleVisionPricePer1000Units: Number(
    process.env.GOOGLE_VISION_PRICE_PER_1000_UNITS || 1.5,
  ),
  supabaseMonthlyBaseCost: Number(process.env.SUPABASE_MONTHLY_BASE_COST || 25),
  vercelMonthlyBaseCost: Number(process.env.VERCEL_MONTHLY_BASE_COST || 20),
  domainMiscMonthlyCost: Number(process.env.DOMAIN_MISC_MONTHLY_COST || 3),
  defaultImagesPerProduct: Number(process.env.DEFAULT_IMAGES_PER_PRODUCT || 8),
  maxImagesPerProduct: Number(process.env.MAX_IMAGES_PER_PRODUCT || 12),
  googleVisionMaxImagesPerProduct: Number(
    process.env.GOOGLE_VISION_MAX_IMAGES_PER_PRODUCT || 4,
  ),
  maxRetriesPerAnalysis: Number(process.env.MAX_RETRIES_PER_ANALYSIS || 2),
  economyModel: process.env.OPENAI_ECONOMY_MODEL || "gpt-4o-mini",
  advancedModel: process.env.OPENAI_ADVANCED_MODEL || "gpt-4o",
  defaultTier: "economy" as AnalysisTier,
  budgetEnforcementMode: "warn_only" as BudgetEnforcementMode,
};

export const LAUNCH_COST_ASSUMPTIONS = {
  productsPerMonth: 500,
  avgImagesPerProduct: 8,
  avgOcrImagesPerProduct: 4,
  estimatedInputTokensPerProduct: 12_000,
  estimatedOutputTokensPerProduct: 2_000,
  optimizedMonthlyRangeUsd: [60, 70] as const,
  recommendedBudgetRangeUsd: [75, 100] as const,
  targetCostPerProductUsd: [0.12, 0.2] as const,
};
