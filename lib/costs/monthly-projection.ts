export type MonthlyUsageSnapshot = {
  productsProcessed: number;
  openAICost: number;
  googleVisionCost: number;
  zxingScans: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  ocrUnits: number;
  cacheHits: number;
  retries: number;
  imagesAnalyzed: number;
};

export function projectMonthEndCost(options: {
  snapshot: MonthlyUsageSnapshot;
  monthlyFixedInfrastructureCost: number;
  monthlyProductTarget: number;
  dayOfMonth: number;
  daysInMonth: number;
}): {
  estimatedAiCostToDate: number;
  estimatedInfrastructure: number;
  estimatedTotalToDate: number;
  averageCostPerProduct: number;
  projectedMonthEndAi: number;
  projectedMonthEndTotal: number;
  projectedProducts: number;
  productsRemainingToTarget: number;
} {
  const day = Math.max(1, Math.min(options.dayOfMonth, options.daysInMonth));
  const aiToDate =
    options.snapshot.openAICost + options.snapshot.googleVisionCost;
  const infra = options.monthlyFixedInfrastructureCost;
  const products = options.snapshot.productsProcessed;
  const averageCostPerProduct =
    products > 0 ? (aiToDate + infra) / products : 0;

  const paceFactor = options.daysInMonth / day;
  const projectedProducts = Math.round(products * paceFactor);
  const projectedMonthEndAi = aiToDate * paceFactor;
  const projectedMonthEndTotal = projectedMonthEndAi + infra;

  return {
    estimatedAiCostToDate: aiToDate,
    estimatedInfrastructure: infra,
    estimatedTotalToDate: aiToDate + infra,
    averageCostPerProduct,
    projectedMonthEndAi,
    projectedMonthEndTotal,
    projectedProducts,
    productsRemainingToTarget: Math.max(
      0,
      options.monthlyProductTarget - products,
    ),
  };
}

export function budgetStatus(options: {
  projectedMonthEndTotal: number;
  warningBudgetUsd: number;
  limitBudgetUsd: number;
}): "ok" | "warning" | "high_warning" | "over_limit" {
  const { projectedMonthEndTotal, warningBudgetUsd, limitBudgetUsd } = options;
  const pct = projectedMonthEndTotal / Math.max(limitBudgetUsd, 0.01);
  if (pct >= 1) return "over_limit";
  if (pct >= 0.9) return "high_warning";
  if (projectedMonthEndTotal >= warningBudgetUsd || pct >= 0.75)
    return "warning";
  return "ok";
}
