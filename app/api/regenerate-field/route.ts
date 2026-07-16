import { NextResponse } from "next/server";
import {
  checkRateLimit,
  clientKeyFromRequest,
} from "@/lib/api/rate-limit";
import { requireUser } from "@/lib/auth/require-user";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import {
  partialRegenSchema,
  regenerateListingField,
} from "@/lib/ai/regenerate-field";
import {
  checkAnalysisBudgetGate,
  resolveRequestedTier,
} from "@/lib/costs/gate";
import { AI_PROVIDER_DEFAULTS } from "@/config/ai-providers";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let authResult: Awaited<ReturnType<typeof requireUser>> | null = null;
  let userId: string | undefined;

  if (isSupabaseConfigured()) {
    authResult = await requireUser();
    if (!authResult.ok) return authResult.response;
    userId = authResult.user.id;
  }

  const rate = checkRateLimit({
    key: `regen:${clientKeyFromRequest(request, userId)}`,
    limit: 30,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429 },
    );
  }

  if (!process.env.OPENAI_API_KEY || !AI_PROVIDER_DEFAULTS.openaiEnabled) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured", code: "MISSING_OPENAI_API_KEY" },
      { status: 503 },
    );
  }

  try {
    const body = partialRegenSchema.parse(await request.json());
    const tier = resolveRequestedTier({ analysisTier: "economy" });
    const gate = await checkAnalysisBudgetGate({
      supabase: authResult?.ok ? authResult.supabase : null,
      userId,
      requestedTier: tier,
    });

    if (!gate.allowed) {
      return NextResponse.json(
        {
          error: gate.message || "Budget limit reached for new AI analysis",
          code: "BUDGET_BLOCKED",
          status: gate.status,
          recommendations: gate.recommendations,
        },
        { status: 402 },
      );
    }

    const result = await regenerateListingField({
      field: body.field,
      listingSnapshot: body.listingSnapshot,
      instruction: body.instruction,
      userId,
      productId: body.productId,
      supabase: authResult?.ok ? authResult.supabase : null,
    });

    return NextResponse.json({
      ...result,
      budgetWarning: gate.message,
      disclaimer:
        "Estimated costs only. Partial edit did not re-analyze product images.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Field regeneration failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
