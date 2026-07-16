import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

export type AuthResult =
  | { ok: true; user: User; supabase: Awaited<ReturnType<typeof createClient>> }
  | { ok: false; response: NextResponse };

/** Ensure public.users row exists for RLS-owned tables. */
export async function ensureUserProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: User,
) {
  const { error } = await supabase.from("users").upsert(
    {
      id: user.id,
      email: user.email ?? null,
      full_name:
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ??
        null,
    },
    { onConflict: "id" },
  );
  if (error) {
    throw new Error(`Failed to ensure user profile: ${error.message}`);
  }
}

/** Require an authenticated Supabase user for API routes. */
export async function requireUser(): Promise<AuthResult> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
        },
        { status: 503 },
      ),
    };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Authentication required" },
          { status: 401 },
        ),
      };
    }

    await ensureUserProfile(supabase, user);
    return { ok: true, user, supabase };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Authentication failed";
    return {
      ok: false,
      response: NextResponse.json({ error: message }, { status: 503 }),
    };
  }
}
