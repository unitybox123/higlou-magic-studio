import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { createBarcodeDecoder } from "@/lib/barcode/decoder";

export const runtime = "nodejs";

const schema = z.object({
  imageUrl: z.string().url().optional(),
  imageBase64: z.string().optional(),
  sourceImageId: z.string().default("upload"),
});

export async function POST(request: Request) {
  if (isSupabaseConfigured()) {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
  }

  try {
    const body = schema.parse(await request.json());
    let buffer: Buffer | null = null;

    if (body.imageBase64) {
      const raw = body.imageBase64.replace(/^data:[^;]+;base64,/, "");
      buffer = Buffer.from(raw, "base64");
    } else if (body.imageUrl && /^https:\/\//i.test(body.imageUrl)) {
      const res = await fetch(body.imageUrl);
      if (!res.ok) throw new Error("Failed to fetch image");
      buffer = Buffer.from(await res.arrayBuffer());
    }

    if (!buffer) {
      return NextResponse.json(
        { error: "Provide imageUrl or imageBase64" },
        { status: 400 },
      );
    }

    const decoder = createBarcodeDecoder();
    const detections = await decoder.decodeFromImageBuffer(buffer, {
      sourceImageId: body.sourceImageId,
    });

    return NextResponse.json({ detections });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Barcode decode failed",
      },
      { status: 400 },
    );
  }
}
