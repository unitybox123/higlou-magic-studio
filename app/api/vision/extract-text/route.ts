import { NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/auth/require-user";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import {
  isGoogleVisionConfigured,
  isGoogleVisionEnabled,
} from "@/lib/google-vision/client";
import { extractTextFromImage } from "@/lib/google-vision/extract-text";

export const runtime = "nodejs";

const schema = z.object({
  imageUrl: z.string().url(),
  imageId: z.string().default("img"),
  useDocumentFallback: z.boolean().optional(),
});

export async function POST(request: Request) {
  let userId: string | undefined;
  let supabase: SupabaseClient | null = null;

  if (isSupabaseConfigured()) {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    userId = auth.user.id;
    supabase = auth.supabase;
  }

  if (!isGoogleVisionEnabled() || !isGoogleVisionConfigured()) {
    return NextResponse.json(
      {
        error: "Google Vision is not configured or disabled",
        code: "MISSING_GOOGLE_VISION",
      },
      { status: 503 },
    );
  }

  try {
    const body = schema.parse(await request.json());
    if (!/^https:\/\//i.test(body.imageUrl)) {
      return NextResponse.json(
        { error: "HTTPS image URL required" },
        { status: 400 },
      );
    }

    const ocr = await extractTextFromImage({
      imageId: body.imageId,
      imageUrl: body.imageUrl,
      imageUrlFetch: body.imageUrl,
      useDocumentFallback: body.useDocumentFallback,
      userId,
      supabase,
    });

    return NextResponse.json({
      ocr,
      disclaimer:
        "OCR results are server-side only. Credentials are never sent to the browser.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "OCR failed",
      },
      { status: 400 },
    );
  }
}
