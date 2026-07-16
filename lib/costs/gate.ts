import type { SupabaseClient } from "@supabase/supabase-js";
import { COST_DEFAULTS, type AnalysisTier } from "@/config/costs";
import { buildCostDashboard } from "@/lib/costs/dashboard";
import {
  evaluateBudgetGate,
  type BudgetGateResult,
} from "@/lib/costs/budget-alerts";

export type AnalysisBudgetGateResult = BudgetGateResult & {
  dashboard: Awaited<ReturnType<typeof buildCostDashboard>> | null;
};

export async function checkAnalysisBudgetGate(options: {
  supabase: SupabaseClient | null;
  userId?: string;
  requestedTier: AnalysisTier;
  adminConfirmed?: boolean;
}): Promise<AnalysisBudgetGateResult> {
  if (!options.supabase || !options.userId) {
    return {
      allowed: true,
      allowAdvanced: true,
      status: "ok",
      dashboard: null,
    };
  }

  const dashboard = await buildCostDashboard(
    options.supabase,
    options.userId,
  );
  const gate = evaluateBudgetGate({
    projectedMonthEndTotal: dashboard.projection.projectedMonthEndTotal,
    warningBudgetUsd: dashboard.budget.monthlyBudgetWarningUsd,
    limitBudgetUsd: dashboard.budget.monthlyBudgetLimitUsd,
    enforcementMode: dashboard.budget.enforcementMode,
    requestedTier: options.requestedTier,
    adminConfirmed: options.adminConfirmed,
  });

  return { ...gate, dashboard };
}

export function resolveRequestedTier(options: {
  forceDeepAnalysis?: boolean;
  analysisTier?: AnalysisTier;
  defaultTier?: AnalysisTier;
}): AnalysisTier {
  if (options.forceDeepAnalysis || options.analysisTier === "advanced") {
    return "advanced";
  }
  return options.analysisTier || options.defaultTier || COST_DEFAULTS.defaultTier;
}
