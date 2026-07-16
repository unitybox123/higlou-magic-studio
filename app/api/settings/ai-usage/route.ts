import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      visionCalls: 0,
      openaiCalls: 0,
      products: 0,
    });
  }

  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);

  const { data, error } = await auth.supabase
    .from("ai_usage_events")
    .select("provider, request_count, image_count")
    .eq("user_id", auth.user.id)
    .gte("created_at", start.toISOString());

  if (error) {
    return NextResponse.json({
      visionCalls: 0,
      openaiCalls: 0,
      products: 0,
      warning: error.message,
    });
  }

  const rows = data ?? [];
  const visionCalls = rows
    .filter((r) => r.provider === "google_vision")
    .reduce((sum, r) => sum + Number(r.request_count || 0), 0);
  const openaiCalls = rows
    .filter((r) => r.provider === "openai")
    .reduce((sum, r) => sum + Number(r.request_count || 0), 0);

  return NextResponse.json({
    visionCalls,
    openaiCalls,
    products: openaiCalls,
  });
}
