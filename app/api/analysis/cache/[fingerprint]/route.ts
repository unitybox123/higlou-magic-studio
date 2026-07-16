import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { loadProductAnalysisCache } from "@/lib/cache/analysis-cache";
import {
  PIPELINE_VERSION,
  PROMPT_VERSION,
} from "@/lib/cache/product-fingerprint";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ fingerprint: string }> },
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 503 },
    );
  }

  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { fingerprint } = await context.params;
  if (!fingerprint || fingerprint.length < 16) {
    return NextResponse.json({ error: "Invalid fingerprint" }, { status: 400 });
  }

  const cached = await loadProductAnalysisCache(
    auth.supabase,
    auth.user.id,
    fingerprint,
  );

  if (!cached) {
    return NextResponse.json({ hit: false }, { status: 404 });
  }

  return NextResponse.json({
    hit: true,
    pipelineVersion: PIPELINE_VERSION,
    promptVersion: PROMPT_VERSION,
    normalizedProduct: cached.normalizedProduct,
    analysis: cached.analysisResult,
    cost: cached.costJson,
  });
}
