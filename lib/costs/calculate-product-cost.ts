export function calculateProductCost(options: {
  openAICost: number;
  googleVisionCost: number;
  allocatedInfrastructureCost: number;
}): {
  estimatedProductCost: number;
  category: "platform_operating_costs";
  disclaimer: string;
} {
  const estimatedProductCost =
    (options.openAICost || 0) +
    (options.googleVisionCost || 0) +
    (options.allocatedInfrastructureCost || 0);

  return {
    estimatedProductCost,
    category: "platform_operating_costs",
    disclaimer:
      "Estimated platform operating cost only. Excludes eBay fees, shipping, COGS, and taxes.",
  };
}

export function allocateInfrastructureCost(options: {
  monthlyFixedInfrastructureCost: number;
  monthlyProcessedProducts: number;
}): number {
  const products = Math.max(options.monthlyProcessedProducts, 1);
  return options.monthlyFixedInfrastructureCost / products;
}
