import { NextResponse } from "next/server";
import { z } from "zod";
import { buildAnalysisPlan } from "@/lib/ai/cost-optimizer";

export const runtime = "nodejs";

const bodySchema = z.object({
  usableIndexes: z.array(z.number().int().min(0)).min(1),
  barcodes: z
    .array(
      z.object({
        format: z.string(),
        value: z.string(),
        checksumValid: z.boolean().nullable().optional(),
        confidence: z.number().optional(),
        sourceImageId: z.string().optional(),
      }),
    )
    .optional(),
  barcodeEnabled: z.boolean().optional(),
  visionEnabled: z.boolean().optional(),
  openaiEnabled: z.boolean().optional(),
  forceDeepAnalysis: z.boolean().optional(),
  forceImproveOcr: z.boolean().optional(),
  requestedMode: z.enum(["economy", "standard", "advanced"]).optional(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const body = bodySchema.parse(json);
    const plan = buildAnalysisPlan({
      usableIndexes: body.usableIndexes,
      barcodes: (body.barcodes as never) ?? [],
      barcodeEnabled: body.barcodeEnabled,
      visionEnabled: body.visionEnabled,
      openaiEnabled: body.openaiEnabled,
      forceDeepAnalysis: body.forceDeepAnalysis,
      forceImproveOcr: body.forceImproveOcr,
      requestedMode: body.requestedMode,
    });
    return NextResponse.json({ plan });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Plan failed" },
      { status: 400 },
    );
  }
}
