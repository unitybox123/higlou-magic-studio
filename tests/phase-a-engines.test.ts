import { describe, expect, it } from "vitest";
import { assessImageQuality, gateImagesForAnalysis } from "@/lib/images/quality-engine";
import {
  createProductFingerprint,
  PIPELINE_VERSION,
  PROMPT_VERSION,
} from "@/lib/cache/product-fingerprint";
import {
  confidentField,
  confirmFieldAsUser,
  getConfidenceStatus,
} from "@/lib/ai/confidence-engine";
import { buildAnalysisPlan } from "@/lib/ai/cost-optimizer";
import jpeg from "jpeg-js";

function makeSolidJpeg(width: number, height: number, gray = 120): Buffer {
  const frameData = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    const o = i * 4;
    // checker pattern for some contrast/blur signal
    const v = ((i % 17) + (Math.floor(i / width) % 13)) % 2 === 0 ? gray : gray + 40;
    frameData[o] = v;
    frameData[o + 1] = v;
    frameData[o + 2] = v;
    frameData[o + 3] = 255;
  }
  const encoded = jpeg.encode({ data: frameData, width, height }, 80);
  return Buffer.from(encoded.data);
}

describe("Image Quality Engine", () => {
  it("rejects tiny images", () => {
    const buf = makeSolidJpeg(100, 100);
    const result = assessImageQuality(buf);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain("too_small");
  });

  it("passes reasonably large images", () => {
    const buf = makeSolidJpeg(1000, 1000, 110);
    const result = assessImageQuality(buf);
    expect(result.metrics.width).toBe(1000);
    expect(result.score).toBeGreaterThan(0);
  });

  it("blocks analysis when all images fail", () => {
    const gate = gateImagesForAnalysis([
      makeSolidJpeg(50, 50),
      makeSolidJpeg(60, 60),
    ]);
    expect(gate.blocked).toBe(true);
    expect(gate.usableIndexes).toHaveLength(0);
  });

  it("keeps good images when mixed with bad ones", () => {
    const gate = gateImagesForAnalysis([
      makeSolidJpeg(50, 50),
      makeSolidJpeg(1200, 1200, 100),
    ]);
    expect(gate.blocked).toBe(false);
    expect(gate.usableIndexes).toContain(1);
  });
});

describe("Product fingerprint", () => {
  it("is stable for same sorted hashes", () => {
    const a = createProductFingerprint({
      imageHashes: ["bbb", "aaa"],
      analysisMode: "economy",
    });
    const b = createProductFingerprint({
      imageHashes: ["aaa", "bbb"],
      analysisMode: "economy",
    });
    expect(a).toBe(b);
  });

  it("changes when an image hash changes", () => {
    const a = createProductFingerprint({
      imageHashes: ["aaa"],
      analysisMode: "economy",
    });
    const b = createProductFingerprint({
      imageHashes: ["ccc"],
      analysisMode: "economy",
    });
    expect(a).not.toBe(b);
  });

  it("changes when prompt version would change (via input)", () => {
    const a = createProductFingerprint({
      imageHashes: ["aaa"],
      analysisMode: "economy",
      promptVersion: PROMPT_VERSION,
    });
    const b = createProductFingerprint({
      imageHashes: ["aaa"],
      analysisMode: "economy",
      promptVersion: "other",
    });
    expect(a).not.toBe(b);
    expect(PIPELINE_VERSION).toBeTruthy();
  });
});

describe("Confidence engine", () => {
  it("maps thresholds correctly", () => {
    expect(getConfidenceStatus(0.9)).toBe("confirmed");
    expect(getConfidenceStatus(0.7)).toBe("review");
    expect(getConfidenceStatus(0.4)).toBe("empty");
  });

  it("empties low-confidence identity fields", () => {
    const field = confidentField("Nike", 0.5, ["openai"], {
      identityField: true,
    });
    expect(field.status).toBe("empty");
    expect(field.value).toBeNull();
  });

  it("caps OpenAI-only identity confidence", () => {
    const field = confidentField("Nike", 0.95, ["openai"], {
      identityField: true,
    });
    expect(field.confidence).toBeLessThanOrEqual(0.74);
    expect(field.status).toBe("review");
  });

  it("user confirm sets confidence 1", () => {
    const prev = confidentField("Nike", 0.7, ["openai"]);
    const next = confirmFieldAsUser(prev, "Nike");
    expect(next.status).toBe("confirmed");
    expect(next.confidence).toBe(1);
    expect(next.sources).toEqual(["user"]);
  });
});

describe("Cost optimizer", () => {
  it("limits OpenAI images when UPC barcode is present", () => {
    const plan = buildAnalysisPlan({
      usableIndexes: [0, 1, 2, 3, 4, 5],
      barcodes: [
        {
          format: "UPC_A",
          value: "012345678905",
          checksumValid: true,
          confidence: 0.98,
          sourceImageId: "1",
          rawValue: "012345678905",
          symbologyHint: "UPC",
        } as never,
      ],
    });
    expect(plan.openAiImageIndexes.length).toBeLessThanOrEqual(3);
    expect(plan.ocrImageIndexes.length).toBeLessThanOrEqual(2);
  });

  it("never skips OpenAI when enabled and images exist", () => {
    const plan = buildAnalysisPlan({
      usableIndexes: [0, 1],
      openaiEnabled: true,
      ocrTextSignalsStrong: true,
    });
    expect(plan.runOpenAiVision).toBe(true);
  });
});
