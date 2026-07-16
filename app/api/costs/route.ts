import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { buildCostDashboard } from "@/lib/costs/dashboard";

export async function GET() {
  if (!isSupabaseConfigured()) {
    const dashboard = await buildCostDashboard(null);
    return NextResponse.json(dashboard);
  }

  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const dashboard = await buildCostDashboard(auth.supabase, auth.user.id);
  return NextResponse.json(dashboard);
}
