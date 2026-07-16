import { COST_DEFAULTS } from "@/config/costs";
import {
  allocateInfrastructureCost,
  calculateProductCost,
} from "@/lib/costs/calculate-product-cost";
import {
  budgetStatus,
  projectMonthEndCost,
} from "@/lib/costs/monthly-projection";
import { getMonthlyFixedInfrastructureCost } from "@/lib/costs/pricing";
import type { SupabaseClient } from "@supabase/supabase-js";

function monthStartIso() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

export async function loadMonthUsageSnapshot(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data } = await supabase
    .from("ai_usage_events")
    .select(
      "provider, operation, estimated_cost, input_tokens, cached_input_tokens, output_tokens, ocr_unit_count, image_count, request_count, retry_count, cache_hit, product_id, status",
    )
    .eq("user_id", userId)
    .gte("created_at", monthStartIso());

  const rows = data ?? [];
  const productIds = new Set(
    rows
      .filter((r) => r.provider === "openai" && r.status === "ok")
      .map((r) => r.product_id || r.operation),
  );

  let openAICost = 0;
  let googleVisionCost = 0;
  let zxingScans = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let cachedInputTokens = 0;
  let ocrUnits = 0;
  let cacheHits = 0;
  let retries = 0;
  let imagesAnalyzed = 0;

  for (const row of rows) {
    const cost = Number(row.estimated_cost || 0);
    if (row.provider === "openai") openAICost += cost;
    if (row.provider === "google_vision") googleVisionCost += cost;
    if (row.provider === "zxing" && row.status === "ok") {
      zxingScans += 1;
    }
    inputTokens += Number(row.input_tokens || 0);
    outputTokens += Number(row.output_tokens || 0);
    cachedInputTokens += Number(row.cached_input_tokens || 0);
    ocrUnits += Number(row.ocr_unit_count || 0);
    imagesAnalyzed += Number(row.image_count || 0);
    retries += Number(row.retry_count || 0);
    if (row.cache_hit) cacheHits += 1;
  }

  return {
    productsProcessed:
      productIds.size ||
      rows.filter(
        (r) => r.provider === "openai" && r.operation === "analyze_product",
      ).length,
    openAICost,
    googleVisionCost,
    zxingScans,
    inputTokens,
    outputTokens,
    cachedInputTokens,
    ocrUnits,
    cacheHits,
    retries,
    imagesAnalyzed,
  };
}

export async function buildCostDashboard(
  supabase: SupabaseClient | null,
  userId?: string,
) {
  const now = new Date();
  const dayOfMonth = now.getUTCDate();
  const daysInMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
  ).getUTCDate();

  const monthlyFixed = getMonthlyFixedInfrastructureCost();

  let snapshot = {
    productsProcessed: 0,
    openAICost: 0,
    googleVisionCost: 0,
    zxingScans: 0,
    inputTokens: 0,
    outputTokens: 0,
    cachedInputTokens: 0,
    ocrUnits: 0,
    cacheHits: 0,
    retries: 0,
    imagesAnalyzed: 0,
  };

  let budget = {
    monthlyProductTarget: COST_DEFAULTS.monthlyProductTarget,
    monthlyBudgetWarningUsd: COST_DEFAULTS.monthlyBudgetWarningUsd,
    monthlyBudgetLimitUsd: COST_DEFAULTS.monthlyBudgetLimitUsd,
    enforcementMode: COST_DEFAULTS.budgetEnforcementMode,
    defaultAnalysisTier: COST_DEFAULTS.defaultTier,
  };

  if (supabase && userId) {
    snapshot = await loadMonthUsageSnapshot(supabase, userId);
    const { data: budgetRow } = await supabase
      .from("budget_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (budgetRow) {
      budget = {
        monthlyProductTarget: Number(budgetRow.monthly_product_target),
        monthlyBudgetWarningUsd: Number(budgetRow.monthly_budget_warning_usd),
        monthlyBudgetLimitUsd: Number(budgetRow.monthly_budget_limit_usd),
        enforcementMode:
          (budgetRow.enforcement_mode as typeof COST_DEFAULTS.budgetEnforcementMode) ||
          COST_DEFAULTS.budgetEnforcementMode,
        defaultAnalysisTier:
          (budgetRow.default_analysis_tier as typeof COST_DEFAULTS.defaultTier) ||
          COST_DEFAULTS.defaultTier,
      };
    }
  }

  const projection = projectMonthEndCost({
    snapshot,
    monthlyFixedInfrastructureCost: monthlyFixed,
    monthlyProductTarget: budget.monthlyProductTarget,
    dayOfMonth,
    daysInMonth,
  });

  const status = budgetStatus({
    projectedMonthEndTotal: projection.projectedMonthEndTotal,
    warningBudgetUsd: budget.monthlyBudgetWarningUsd,
    limitBudgetUsd: budget.monthlyBudgetLimitUsd,
  });

  const allocatedInfra = allocateInfrastructureCost({
    monthlyFixedInfrastructureCost: monthlyFixed,
    monthlyProcessedProducts: Math.max(snapshot.productsProcessed, 1),
  });

  const avgOpenAI =
    snapshot.productsProcessed > 0
      ? snapshot.openAICost / snapshot.productsProcessed
      : 0;
  const avgVision =
    snapshot.productsProcessed > 0
      ? snapshot.googleVisionCost / snapshot.productsProcessed
      : 0;

  return {
    disclaimer:
      "All figures are internal estimates for platform operating costs only. Not an official invoice. Marketplace fees and COGS are excluded.",
    category: "platform_operating_costs" as const,
    assumptions: {
      monthlyProductTarget: budget.monthlyProductTarget,
      avgImages: COST_DEFAULTS.defaultImagesPerProduct,
      avgOcrImages: COST_DEFAULTS.googleVisionMaxImagesPerProduct,
      optimizedRangeUsd: [60, 70] as const,
      recommendedBudgetUsd: [75, 100] as const,
    },
    budget,
    snapshot,
    projection,
    status,
    percentOfBudgetUsed:
      (projection.estimatedTotalToDate /
        Math.max(budget.monthlyBudgetLimitUsd, 0.01)) *
      100,
    allocatedInfrastructurePerProduct: allocatedInfra,
    averageProductCost:
      snapshot.productsProcessed > 0
        ? calculateProductCost({
            openAICost: avgOpenAI,
            googleVisionCost: avgVision,
            allocatedInfrastructureCost: allocatedInfra,
          })
        : null,
    pricingDefaults: {
      openai: {
        input: COST_DEFAULTS.openaiInputPricePerMillion,
        cachedInput: COST_DEFAULTS.openaiCachedInputPricePerMillion,
        output: COST_DEFAULTS.openaiOutputPricePerMillion,
        economyInput: COST_DEFAULTS.openaiEconomyInputPricePerMillion,
        economyOutput: COST_DEFAULTS.openaiEconomyOutputPricePerMillion,
      },
      googleVision: {
        freeUnits: COST_DEFAULTS.googleVisionFreeUnitsMonthly,
        pricePer1000: COST_DEFAULTS.googleVisionPricePer1000Units,
      },
    },
  };
}
