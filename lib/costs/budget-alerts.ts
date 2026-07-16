import type { BudgetEnforcementMode } from "@/config/costs";
import { budgetStatus } from "@/lib/costs/monthly-projection";

export type BudgetGateResult = {
  allowed: boolean;
  allowAdvanced: boolean;
  status: ReturnType<typeof budgetStatus>;
  message?: string;
  recommendations?: string[];
};

export function evaluateBudgetGate(options: {
  projectedMonthEndTotal: number;
  warningBudgetUsd: number;
  limitBudgetUsd: number;
  enforcementMode: BudgetEnforcementMode;
  requestedTier: "economy" | "advanced";
  adminConfirmed?: boolean;
}): BudgetGateResult {
  const status = budgetStatus({
    projectedMonthEndTotal: options.projectedMonthEndTotal,
    warningBudgetUsd: options.warningBudgetUsd,
    limitBudgetUsd: options.limitBudgetUsd,
  });

  const recommendations = [
    "Use Google Vision only in fallback mode",
    "Reduce regenerations",
    "Compress images further",
    "Prefer the economy model",
    "Reuse cached analyses",
    "Skip duplicate image analysis",
  ];

  if (status === "ok") {
    return { allowed: true, allowAdvanced: true, status };
  }

  const warningMessage =
    status === "warning"
      ? "You have used about 75% of your estimated monthly AI budget."
      : status === "high_warning"
        ? "You have used about 90% of your estimated monthly AI budget."
        : "Projected spend meets or exceeds your monthly budget target.";

  if (options.enforcementMode === "warn_only") {
    return {
      allowed: true,
      allowAdvanced: true,
      status,
      message: warningMessage,
      recommendations: status === "high_warning" || status === "over_limit"
        ? recommendations
        : undefined,
    };
  }

  if (options.enforcementMode === "require_admin_confirmation") {
    if (status === "over_limit" && !options.adminConfirmed) {
      return {
        allowed: false,
        allowAdvanced: false,
        status,
        message: `${warningMessage} Admin confirmation is required to continue AI analysis.`,
        recommendations,
      };
    }
    return {
      allowed: true,
      allowAdvanced: true,
      status,
      message: warningMessage,
      recommendations,
    };
  }

  if (options.enforcementMode === "block_advanced_analysis") {
    const blockAdvanced =
      options.requestedTier === "advanced" &&
      (status === "high_warning" || status === "over_limit");
    return {
      allowed: true,
      allowAdvanced: !blockAdvanced,
      status,
      message: warningMessage,
      recommendations,
    };
  }

  // block_all_new_ai_analysis
  if (status === "over_limit") {
    return {
      allowed: false,
      allowAdvanced: false,
      status,
      message: `${warningMessage} New AI analysis is blocked. Editing, CSV downloads, and cached results remain available.`,
      recommendations,
    };
  }

  return {
    allowed: true,
    allowAdvanced: options.requestedTier !== "advanced" || status === "warning",
    status,
    message: warningMessage,
    recommendations,
  };
}
