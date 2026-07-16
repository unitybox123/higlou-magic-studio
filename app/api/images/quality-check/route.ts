import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { fetchProductImageBuffer } from "@/lib/images/storage";
import {
  assessImageQuality,
  gateImagesForAnalysis,
} from "@/lib/images/quality-engine";
import { hashImageBuffer } from "@/lib/google-vision/extract-text";

export const runtime = "nodejs";

const bodySchema = z.object({
  imageUrls: z.array(z.string().url()).min(1).max(12),
});

export async function POST(request: Request) {
  if (isSupabaseConfigured()) {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
  }

  try {
    const json = await request.json();
    const body = bodySchema.parse(json);
    const buffers = await Promise.all(
      body.imageUrls.map(async (url) => {
        const buffer = await fetchProductImageBuffer({ url });
        return { url, buffer, hash: hashImageBuffer(buffer) };
      }),
    );
    const perImage = buffers.map((item) => ({
      url: item.url,
      hash: item.hash,
      ...assessImageQuality(item.buffer),
    }));
    const gate = gateImagesForAnalysis(buffers.map((b) => b.buffer));

    return NextResponse.json({
      images: perImage,
      usableIndexes: gate.usableIndexes,
      blocked: gate.blocked,
      warnings: gate.warnings,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Quality check failed",
      },
      { status: 400 },
    );
  }
}
