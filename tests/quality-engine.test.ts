import { describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import {
  assessImageQuality,
  describeQualityBlock,
  gateImagesForAnalysis,
  isWebp,
  sniffImageMime,
} from "@/lib/images/quality-engine";

function makePng(width: number, height: number): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (width * y + x) << 2;
      const on = (x + y) % 8 < 4;
      png.data[i] = on ? 240 : 20;
      png.data[i + 1] = on ? 240 : 20;
      png.data[i + 2] = on ? 240 : 20;
      png.data[i + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

function makeFakeWebp(): Buffer {
  const buf = Buffer.alloc(24);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(16, 4);
  buf.write("WEBP", 8);
  buf.write("VP8 ", 12);
  return buf;
}

describe("quality-engine", () => {
  it("sniffs webp and soft-passes when normalize was skipped", () => {
    const webp = makeFakeWebp();
    expect(isWebp(webp)).toBe(true);
    expect(sniffImageMime(webp)).toBe("image/webp");

    const result = assessImageQuality(webp);
    expect(result.passed).toBe(true);
    expect(result.issues).toContain("unsupported_format");

    const gate = gateImagesForAnalysis([webp]);
    expect(gate.blocked).toBe(false);
  });

  it("allows sharp-but-under-800 photos with a warning", () => {
    const smallSharp = makePng(640, 640);
    const result = assessImageQuality(smallSharp);
    expect(result.issues).toContain("too_small");
    expect(result.passed).toBe(true);
  });

  it("maps hard blocks to IMAGE_* codes, never identify-product copy", () => {
    const tiny = makePng(64, 64);
    const gate = gateImagesForAnalysis([tiny]);
    expect(gate.blocked).toBe(true);
    const block = describeQualityBlock(gate);
    expect(block.code).toBe("IMAGE_TOO_SMALL");
    expect(block.message.toLowerCase()).not.toContain("can't identify");
    expect(block.message.toLowerCase()).not.toContain("cannot identify");
  });
});
