import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { COST_DEFAULTS } from "@/config/costs";

const budgetSchema = z.object({
  monthlyProductTarget: z.number().int().min(1).max(100000).optional(),
  monthlyBudgetWarningUsd: z.number().min(1).max(100000).optional(),
  monthlyBudgetLimitUsd: z.number().min(1).max(100000).optional(),
  enforcementMode: z
    .enum([
      "warn_only",
      "require_admin_confirmation",
      "block_advanced_analysis",
      "block_all_new_ai_analysis",
    ])
    .optional(),
  defaultAnalysisTier: z.enum(["economy", "advanced"]).optional(),
});

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      monthlyProductTarget: COST_DEFAULTS.monthlyProductTarget,
      monthlyBudgetWarningUsd: COST_DEFAULTS.monthlyBudgetWarningUsd,
      monthlyBudgetLimitUsd: COST_DEFAULTS.monthlyBudgetLimitUsd,
      enforcementMode: COST_DEFAULTS.budgetEnforcementMode,
      defaultAnalysisTier: COST_DEFAULTS.defaultTier,
    });
  }

  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { data } = await auth.supabase
    .from("budget_settings")
    .select("*")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({
      monthlyProductTarget: COST_DEFAULTS.monthlyProductTarget,
      monthlyBudgetWarningUsd: COST_DEFAULTS.monthlyBudgetWarningUsd,
      monthlyBudgetLimitUsd: COST_DEFAULTS.monthlyBudgetLimitUsd,
      enforcementMode: COST_DEFAULTS.budgetEnforcementMode,
      defaultAnalysisTier: COST_DEFAULTS.defaultTier,
    });
  }

  return NextResponse.json({
    monthlyProductTarget: Number(data.monthly_product_target),
    monthlyBudgetWarningUsd: Number(data.monthly_budget_warning_usd),
    monthlyBudgetLimitUsd: Number(data.monthly_budget_limit_usd),
    enforcementMode: data.enforcement_mode,
    defaultAnalysisTier: data.default_analysis_tier,
  });
}

export async function PUT(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is required to persist budget settings" },
      { status: 503 },
    );
  }

  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  try {
    const body = budgetSchema.parse(await request.json());
    const row = {
      user_id: auth.user.id,
      monthly_product_target:
        body.monthlyProductTarget ?? COST_DEFAULTS.monthlyProductTarget,
      monthly_budget_warning_usd:
        body.monthlyBudgetWarningUsd ?? COST_DEFAULTS.monthlyBudgetWarningUsd,
      monthly_budget_limit_usd:
        body.monthlyBudgetLimitUsd ?? COST_DEFAULTS.monthlyBudgetLimitUsd,
      enforcement_mode:
        body.enforcementMode ?? COST_DEFAULTS.budgetEnforcementMode,
      default_analysis_tier:
        body.defaultAnalysisTier ?? COST_DEFAULTS.defaultTier,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await auth.supabase
      .from("budget_settings")
      .upsert(row, { onConflict: "user_id" })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      monthlyProductTarget: Number(data.monthly_product_target),
      monthlyBudgetWarningUsd: Number(data.monthly_budget_warning_usd),
      monthlyBudgetLimitUsd: Number(data.monthly_budget_limit_usd),
      enforcementMode: data.enforcement_mode,
      defaultAnalysisTier: data.default_analysis_tier,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid budget settings";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
