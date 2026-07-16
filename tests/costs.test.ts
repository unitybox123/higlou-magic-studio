import { describe, expect, it } from "vitest";
import { calculateOpenAICost } from "@/lib/costs/calculate-openai-cost";
import { calculateGoogleVisionCost } from "@/lib/costs/calculate-google-vision-cost";
import {
  budgetStatus,
  projectMonthEndCost,
} from "@/lib/costs/monthly-projection";
import { evaluateBudgetGate } from "@/lib/costs/budget-alerts";
import { calculateProductCost } from "@/lib/costs/calculate-product-cost";

const pricing = {
  inputPricePerMillion: 1,
  cachedInputPricePerMillion: 0.5,
  outputPricePerMillion: 6,
};

describe("calculateOpenAICost", () => {
  it("handles input only", () => {
    const result = calculateOpenAICost(
      { prompt_tokens: 1_000_000, completion_tokens: 0 },
      pricing,
    );
    expect(result.estimatedCost).toBeCloseTo(1);
    expect(result.outputCost).toBe(0);
  });

  it("handles input and output", () => {
    const result = calculateOpenAICost(
      { prompt_tokens: 6_000_000, completion_tokens: 1_000_000 },
      pricing,
    );
    expect(result.estimatedCost).toBeCloseTo(12);
  });

  it("does not double-count cached input", () => {
    const result = calculateOpenAICost(
      {
        prompt_tokens: 2_000_000,
        completion_tokens: 0,
        prompt_tokens_details: { cached_tokens: 1_000_000 },
      },
      pricing,
    );
    // 1M billable @ $1 + 1M cached @ $0.5 = 1.5
    expect(result.estimatedCost).toBeCloseTo(1.5);
    expect(result.inputTokens).toBe(2_000_000);
    expect(result.cachedInputTokens).toBe(1_000_000);
  });

  it("supports decimal pricing and tokens", () => {
    const result = calculateOpenAICost(
      { prompt_tokens: 500_000, completion_tokens: 250_000 },
      {
        inputPricePerMillion: 0.15,
        cachedInputPricePerMillion: 0.075,
        outputPricePerMillion: 0.6,
      },
    );
    expect(result.estimatedCost).toBeCloseTo(0.075 + 0.15);
  });

  it("handles zero tokens", () => {
    const result = calculateOpenAICost(
      { prompt_tokens: 0, completion_tokens: 0 },
      pricing,
    );
    expect(result.estimatedCost).toBe(0);
  });

  it("handles missing pricing with NaN safely", () => {
    const result = calculateOpenAICost(
      { prompt_tokens: 1000, completion_tokens: 1000 },
      {
        inputPricePerMillion: Number.NaN,
        cachedInputPricePerMillion: 0,
        outputPricePerMillion: 6,
      },
    );
    expect(result.estimatedCost).toBe(0);
  });

  it("handles incomplete usage", () => {
    const result = calculateOpenAICost(undefined, pricing);
    expect(result.estimatedCost).toBe(0);
    expect(result.inputTokens).toBe(0);
  });
});

describe("calculateGoogleVisionCost", () => {
  const vision = { freeUnitsMonthly: 1000, pricePer1000Units: 1.5 };

  it("first 1000 units free", () => {
    expect(
      calculateGoogleVisionCost({
        units: 800,
        unitsAreMonthToDate: true,
        pricing: vision,
      }).estimatedCost,
    ).toBe(0);
  });

  it("exactly 1000 units free", () => {
    expect(
      calculateGoogleVisionCost({
        units: 1000,
        unitsAreMonthToDate: true,
        pricing: vision,
      }).estimatedCost,
    ).toBe(0);
  });

  it("2000 units costs $1.50", () => {
    expect(
      calculateGoogleVisionCost({
        units: 2000,
        unitsAreMonthToDate: true,
        pricing: vision,
      }).estimatedCost,
    ).toBeCloseTo(1.5);
  });

  it("prorates partial blocks", () => {
    expect(
      calculateGoogleVisionCost({
        units: 1500,
        unitsAreMonthToDate: true,
        pricing: vision,
      }).estimatedCost,
    ).toBeCloseTo(0.75);
  });

  it("prices incremental units after free tier", () => {
    const result = calculateGoogleVisionCost({
      unitsUsedThisMonthBefore: 999,
      units: 3,
      pricing: vision,
    });
    expect(result.freeUnitsApplied).toBe(1);
    expect(result.billableUnits).toBe(2);
    expect(result.estimatedCost).toBeCloseTo(0.003);
  });

  it("cache hit units stay free when billed as 0", () => {
    expect(
      calculateGoogleVisionCost({
        unitsUsedThisMonthBefore: 2000,
        units: 0,
        pricing: vision,
      }).estimatedCost,
    ).toBe(0);
  });

  it("records multi-feature usage as separate unit batches", () => {
    const featureA = calculateGoogleVisionCost({
      unitsUsedThisMonthBefore: 1000,
      units: 1,
      pricing: vision,
    });
    const featureB = calculateGoogleVisionCost({
      unitsUsedThisMonthBefore: 1001,
      units: 1,
      pricing: vision,
    });
    expect(featureA.estimatedCost + featureB.estimatedCost).toBeCloseTo(0.003);
  });
});

describe("monthly projection", () => {
  const baseSnapshot = {
    productsProcessed: 218,
    openAICost: 5.5,
    googleVisionCost: 1.24,
    zxingScans: 100,
    inputTokens: 1,
    outputTokens: 1,
    cachedInputTokens: 0,
    ocrUnits: 800,
    cacheHits: 20,
    retries: 2,
    imagesAnalyzed: 1600,
  };

  it("projects from mid-month", () => {
    const result = projectMonthEndCost({
      snapshot: baseSnapshot,
      monthlyFixedInfrastructureCost: 45,
      monthlyProductTarget: 500,
      dayOfMonth: 15,
      daysInMonth: 30,
    });
    expect(result.estimatedAiCostToDate).toBeCloseTo(6.74);
    expect(result.estimatedTotalToDate).toBeCloseTo(51.74);
    expect(result.projectedMonthEndTotal).toBeCloseTo(6.74 * 2 + 45);
  });

  it("handles first day", () => {
    const result = projectMonthEndCost({
      snapshot: { ...baseSnapshot, productsProcessed: 10 },
      monthlyFixedInfrastructureCost: 45,
      monthlyProductTarget: 500,
      dayOfMonth: 1,
      daysInMonth: 30,
    });
    expect(result.projectedProducts).toBe(300);
  });

  it("handles last day without exploding pace", () => {
    const result = projectMonthEndCost({
      snapshot: baseSnapshot,
      monthlyFixedInfrastructureCost: 45,
      monthlyProductTarget: 500,
      dayOfMonth: 30,
      daysInMonth: 30,
    });
    expect(result.projectedMonthEndTotal).toBeCloseTo(
      result.estimatedTotalToDate,
    );
  });

  it("handles zero products", () => {
    const result = projectMonthEndCost({
      snapshot: { ...baseSnapshot, productsProcessed: 0, openAICost: 0, googleVisionCost: 0 },
      monthlyFixedInfrastructureCost: 45,
      monthlyProductTarget: 500,
      dayOfMonth: 10,
      daysInMonth: 30,
    });
    expect(result.averageCostPerProduct).toBe(0);
    expect(result.estimatedTotalToDate).toBe(45);
    expect(result.productsRemainingToTarget).toBe(500);
  });

  it("handles volume above 500", () => {
    const result = projectMonthEndCost({
      snapshot: { ...baseSnapshot, productsProcessed: 600 },
      monthlyFixedInfrastructureCost: 45,
      monthlyProductTarget: 500,
      dayOfMonth: 20,
      daysInMonth: 30,
    });
    expect(result.productsRemainingToTarget).toBe(0);
  });
});

describe("budget alerts", () => {
  it("is ok under 75%", () => {
    expect(
      budgetStatus({
        projectedMonthEndTotal: 50,
        warningBudgetUsd: 75,
        limitBudgetUsd: 100,
      }),
    ).toBe("ok");
  });

  it("warns at 75%", () => {
    expect(
      budgetStatus({
        projectedMonthEndTotal: 75,
        warningBudgetUsd: 75,
        limitBudgetUsd: 100,
      }),
    ).toBe("warning");
  });

  it("high warning at 90%", () => {
    expect(
      budgetStatus({
        projectedMonthEndTotal: 90,
        warningBudgetUsd: 75,
        limitBudgetUsd: 100,
      }),
    ).toBe("high_warning");
  });

  it("over limit at 100%", () => {
    expect(
      budgetStatus({
        projectedMonthEndTotal: 100,
        warningBudgetUsd: 75,
        limitBudgetUsd: 100,
      }),
    ).toBe("over_limit");
  });

  it("warn_only never blocks", () => {
    const gate = evaluateBudgetGate({
      projectedMonthEndTotal: 120,
      warningBudgetUsd: 75,
      limitBudgetUsd: 100,
      enforcementMode: "warn_only",
      requestedTier: "advanced",
    });
    expect(gate.allowed).toBe(true);
    expect(gate.allowAdvanced).toBe(true);
  });

  it("can block advanced analysis", () => {
    const gate = evaluateBudgetGate({
      projectedMonthEndTotal: 95,
      warningBudgetUsd: 75,
      limitBudgetUsd: 100,
      enforcementMode: "block_advanced_analysis",
      requestedTier: "advanced",
    });
    expect(gate.allowed).toBe(true);
    expect(gate.allowAdvanced).toBe(false);
  });

  it("can block all new AI analysis at limit", () => {
    const gate = evaluateBudgetGate({
      projectedMonthEndTotal: 105,
      warningBudgetUsd: 75,
      limitBudgetUsd: 100,
      enforcementMode: "block_all_new_ai_analysis",
      requestedTier: "economy",
    });
    expect(gate.allowed).toBe(false);
    expect(gate.message).toMatch(/CSV downloads/i);
  });

  it("product cost formula", () => {
    expect(
      calculateProductCost({
        openAICost: 0.024,
        googleVisionCost: 0.003,
        allocatedInfrastructureCost: 0.09,
      }).estimatedProductCost,
    ).toBeCloseTo(0.117);
  });
});
