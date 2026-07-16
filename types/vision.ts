import { z } from "zod";

export const ocrImageResultSchema = z.object({
  imageId: z.string(),
  imageUrl: z.string().url().optional(),
  fullText: z.string(),
  normalizedText: z.string(),
  provider: z.literal("google_vision"),
  confidence: z.number().min(0).max(1).nullable(),
  feature: z.enum(["TEXT_DETECTION", "DOCUMENT_TEXT_DETECTION"]),
});

export type OCRImageResult = z.infer<typeof ocrImageResultSchema>;

export type GoogleVisionMode = "off" | "fallback" | "always";
