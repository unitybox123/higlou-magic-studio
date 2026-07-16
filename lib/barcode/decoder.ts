/**
 * BarcodeDecoder interface — wraps ZXing (@zxing/library).
 * Encapsulated so the library can be replaced without app-wide changes.
 * Note: the upstream zxing-js repo has limited maintenance.
 */
import {
  BinaryBitmap,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
  BarcodeFormat,
  DecodeHintType,
} from "@zxing/library";
import type { BarcodeDetection } from "@/types/barcode";
import {
  decodeImageBuffer,
  enhanceContrast,
  rotateRaster,
  type DecodedRaster,
} from "@/lib/barcode/preprocess";
import { validateBarcode } from "@/lib/barcode/validators";
import { AI_PROVIDER_DEFAULTS } from "@/config/ai-providers";

export interface BarcodeDecoder {
  decodeFromImageBuffer(
    buffer: Buffer,
    options: {
      sourceImageId: string;
      mimeType?: string;
      tryContrast?: boolean;
      tryRotation?: boolean;
    },
  ): Promise<BarcodeDetection[]>;
}

function mapZxingFormat(format: BarcodeFormat): BarcodeDetection["format"] {
  switch (format) {
    case BarcodeFormat.UPC_A:
      return "UPC_A";
    case BarcodeFormat.UPC_E:
      return "UPC_E";
    case BarcodeFormat.EAN_8:
      return "EAN_8";
    case BarcodeFormat.EAN_13:
      return "EAN_13";
    case BarcodeFormat.CODE_128:
      return "CODE_128";
    case BarcodeFormat.CODE_39:
      return "CODE_39";
    case BarcodeFormat.ITF:
      return "ITF";
    case BarcodeFormat.QR_CODE:
      return "QR_CODE";
    case BarcodeFormat.DATA_MATRIX:
      return "DATA_MATRIX";
    default:
      return "UNKNOWN";
  }
}

function tryDecodeRaster(raster: DecodedRaster): {
  text: string;
  format: BarcodeFormat;
} | null {
  const luminance = new Uint8ClampedArray(raster.width * raster.height);
  for (let i = 0, j = 0; i < raster.data.length; i += 4, j += 1) {
    luminance[j] =
      0.299 * raster.data[i] +
      0.587 * raster.data[i + 1] +
      0.114 * raster.data[i + 2];
  }

  const source = new RGBLuminanceSource(
    luminance,
    raster.width,
    raster.height,
  );
  const bitmap = new BinaryBitmap(new HybridBinarizer(source));
  const reader = new MultiFormatReader();
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.EAN_8,
    BarcodeFormat.EAN_13,
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.ITF,
    BarcodeFormat.QR_CODE,
    BarcodeFormat.DATA_MATRIX,
  ]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  reader.setHints(hints);

  try {
    const result = reader.decode(bitmap);
    return { text: result.getText(), format: result.getBarcodeFormat() };
  } catch {
    return null;
  }
}

export class ZXingBarcodeDecoder implements BarcodeDecoder {
  async decodeFromImageBuffer(
    buffer: Buffer,
    options: {
      sourceImageId: string;
      mimeType?: string;
      tryContrast?: boolean;
      tryRotation?: boolean;
    },
  ): Promise<BarcodeDetection[]> {
    if (!AI_PROVIDER_DEFAULTS.barcodeEnabled) return [];

    const found = new Map<string, BarcodeDetection>();
    const base = await decodeImageBuffer(buffer, options.mimeType);
    const variants: DecodedRaster[] = [base];

    if (options.tryContrast ?? AI_PROVIDER_DEFAULTS.barcodeEnhancedContrast) {
      variants.push(enhanceContrast(base));
    }

    const rotations: Array<0 | 90 | 180 | 270> =
      options.tryRotation ?? AI_PROVIDER_DEFAULTS.barcodeTryRotation
        ? [0, 90, 180, 270]
        : [0];

    for (const raster of variants) {
      for (const degrees of rotations) {
        const rotated = rotateRaster(raster, degrees);
        const decoded = tryDecodeRaster(rotated);
        if (!decoded) continue;

        const validated = validateBarcode(decoded.text, {
          requireChecksum: AI_PROVIDER_DEFAULTS.validateUpcEanChecksum,
        });
        if (!validated.ok) continue;

        const key = validated.value;
        if (found.has(key)) continue;

        found.set(key, {
          value: validated.value,
          format:
            validated.format === "UNKNOWN"
              ? mapZxingFormat(decoded.format)
              : validated.format,
          confidence: validated.checksumValid === true ? 0.98 : 0.8,
          sourceImageId: options.sourceImageId,
          checksumValid: validated.checksumValid,
        });
      }
    }

    return [...found.values()];
  }
}

export function createBarcodeDecoder(): BarcodeDecoder {
  return new ZXingBarcodeDecoder();
}
