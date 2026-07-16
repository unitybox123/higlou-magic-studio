import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  isSupportedImageMime,
  resolveImageMime,
  SUPPORTED_IMAGE_MIME_TYPES,
} from "@/config/supported-image-formats";
import { normalizeImageForAnalysis } from "@/lib/images/normalize-image";
import { gateImagesForAnalysis } from "@/lib/images/quality-engine";
import { buildAnalysisPipelineStages } from "@/lib/ai/analysis-stages";
import { humanizeAnalysisFailure } from "@/lib/ai/analysis-failure-ui";
import { messageForAnalysisFailure } from "@/types/analysis-failures";

async function makeWebp(width = 900, height = 900): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 30, g: 120, b: 220 },
    },
  })
    .webp({ quality: 90 })
    .toBuffer();
}

describe("supported image formats (single source of truth)", () => {
  it("includes jpeg/png/webp/heic/heif", () => {
    expect([...SUPPORTED_IMAGE_MIME_TYPES]).toEqual([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
    ]);
  });

  it("resolves WebP by magic bytes even if claim differs", async () => {
    const webp = await makeWebp();
    const resolved = resolveImageMime(webp, "image/jpeg");
    expect(resolved.mime).toBe("image/webp");
    expect(resolved.source).toBe("magic");
    expect(isSupportedImageMime(resolved.mime)).toBe(true);
  });
});

describe("normalizeImageForAnalysis", () => {
  it("WebP upload → decoded → normalized → quality gate → ready for recognition", async () => {
    const webp = await makeWebp(960, 960);
    const normalized = await normalizeImageForAnalysis(webp, {
      claimedMime: "image/webp",
    });

    expect(normalized.originalMimeType).toBe("image/webp");
    expect(normalized.normalizedMimeType).toBe("image/jpeg");
    expect(normalized.width).toBeGreaterThanOrEqual(900);
    expect(normalized.height).toBeGreaterThanOrEqual(900);
    expect(normalized.buffer[0]).toBe(0xff);
    expect(normalized.buffer[1]).toBe(0xd8);

    const gate = gateImagesForAnalysis([normalized.buffer]);
    expect(gate.blocked).toBe(false);
    expect(gate.usableIndexes).toEqual([0]);
  });

  it("preserves alpha as PNG (no white flatten)", async () => {
    const png = await sharp({
      create: {
        width: 512,
        height: 512,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .png()
      .toBuffer();

    const normalized = await normalizeImageForAnalysis(png);
    expect(normalized.hadAlpha).toBe(true);
    expect(normalized.normalizedMimeType).toBe("image/png");
  });
});

describe("recognition independence", () => {
  it("keeps recognition success when barcode/category/listing are incomplete", () => {
    const stages = buildAnalysisPipelineStages({
      analysis: {
        brand: "Aquafina",
        type: "bottled water",
        size: "16.9 fl oz / 500 mL",
        title: "Aquafina Purified Water 500mL",
        categoryId: "",
        categoryName: "",
        confidence: { brand: 0.99, category: 0.2, size: 0.95 },
      },
      barcodeCount: 0,
      ocrImageCount: 1,
      ocrWeak: false,
      categoryMissing: true,
      categoryFailed: true,
      listingFailed: false,
    });

    expect(stages.recognition.status).toBe("success");
    expect(stages.recognition.brand).toBe("Aquafina");
    expect(stages.recognition.productType).toBe("bottled water");
    expect(stages.recognition.size).toMatch(/500/);
    expect(stages.extraction.barcode).toBe("missing");
    expect(stages.classification.status).toBe("failed");
    expect(stages.classification.message).toMatch(/Product identified/i);
  });

  it("never maps format failures to identify-product copy", () => {
    expect(messageForAnalysisFailure("UNSUPPORTED_INPUT_FORMAT")).not.toMatch(
      /identify/i,
    );
    expect(humanizeAnalysisFailure("UNSUPPORTED_INPUT_FORMAT")).toBe(
      "We couldn’t process this image format.",
    );
    expect(
      humanizeAnalysisFailure(
        null,
        "We can't identify this product from the photos.",
      ),
    ).not.toMatch(/can't identify this product/i);
  });
});
