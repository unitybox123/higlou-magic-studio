import { z } from "zod";

export const barcodeFormatSchema = z.enum([
  "UPC_A",
  "UPC_E",
  "EAN_8",
  "EAN_13",
  "CODE_128",
  "CODE_39",
  "ITF",
  "QR_CODE",
  "DATA_MATRIX",
  "UNKNOWN",
]);

export type BarcodeFormat = z.infer<typeof barcodeFormatSchema>;

export const barcodeDetectionSchema = z.object({
  value: stringTrimmed(),
  format: barcodeFormatSchema,
  confidence: z.number().min(0).max(1),
  sourceImageId: z.string(),
  checksumValid: z.boolean().nullable(),
});

export type BarcodeDetection = z.infer<typeof barcodeDetectionSchema>;

function stringTrimmed() {
  return z.string().transform((v) => v.trim());
}
