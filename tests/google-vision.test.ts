import { describe, expect, it, vi, beforeEach } from "vitest";
import { selectOcrImages } from "@/lib/google-vision/select-ocr-images";
import { hashImageBuffer } from "@/lib/google-vision/extract-text";
import {
  getGoogleVisionCredentials,
  isGoogleVisionConfigured,
  resetGoogleVisionClientForTests,
} from "@/lib/google-vision/client";

describe("selectOcrImages", () => {
  const images = [
    {
      id: "1",
      url: "https://example.com/front.jpg",
      fileName: "front.jpg",
      isPrimary: true,
    },
    {
      id: "2",
      url: "https://example.com/label-back.jpg",
      fileName: "label-back.jpg",
    },
    {
      id: "3",
      url: "https://example.com/barcode-upc.jpg",
      fileName: "barcode-upc.jpg",
    },
    {
      id: "4",
      url: "https://example.com/angle.jpg",
      fileName: "angle.jpg",
    },
    {
      id: "5",
      url: "https://example.com/packaging-box.jpg",
      fileName: "packaging-box.jpg",
    },
    {
      id: "6",
      url: "https://example.com/extra.jpg",
      fileName: "extra.jpg",
    },
  ];

  it("returns empty when vision disabled", () => {
    expect(
      selectOcrImages({
        images,
        visionEnabled: false,
        mode: "always",
      }),
    ).toEqual([]);
  });

  it("returns empty when mode is off", () => {
    expect(
      selectOcrImages({
        images,
        mode: "off",
      }),
    ).toEqual([]);
  });

  it("caps at max 4 images", () => {
    const selected = selectOcrImages({
      images,
      mode: "always",
      maxImages: 4,
    });
    expect(selected).toHaveLength(4);
  });

  it("prioritizes barcode/label/packaging over random angles", () => {
    const selected = selectOcrImages({
      images,
      mode: "always",
      maxImages: 3,
    });
    const ids = selected.map((s) => s.id);
    expect(ids).toContain("3");
    expect(ids).toContain("2");
    expect(ids).not.toContain("6");
  });

  it("skips OCR in fallback when barcodes found and no label hints", () => {
    const selected = selectOcrImages({
      images: [
        {
          id: "a",
          url: "https://example.com/a.jpg",
          fileName: "product.jpg",
          isPrimary: true,
        },
      ],
      mode: "fallback",
      barcodesFound: true,
      openaiLowConfidence: false,
      missingCriticalFields: false,
    });
    expect(selected).toEqual([]);
  });

  it("runs OCR in fallback when critical fields missing", () => {
    const selected = selectOcrImages({
      images,
      mode: "fallback",
      barcodesFound: true,
      missingCriticalFields: true,
      maxImages: 2,
    });
    expect(selected.length).toBeGreaterThan(0);
  });

  it("forceImproveOcr overrides off mode", () => {
    const selected = selectOcrImages({
      images,
      mode: "off",
      forceImproveOcr: true,
      maxImages: 2,
    });
    expect(selected).toHaveLength(2);
  });
});

describe("hashImageBuffer", () => {
  it("hashes identical buffers the same way", () => {
    const a = Buffer.from("hello-vision");
    const b = Buffer.from("hello-vision");
    expect(hashImageBuffer(a)).toBe(hashImageBuffer(b));
  });

  it("changes hash when content changes", () => {
    expect(hashImageBuffer(Buffer.from("a"))).not.toBe(
      hashImageBuffer(Buffer.from("b")),
    );
  });
});

describe("google vision client auth shape", () => {
  beforeEach(() => {
    resetGoogleVisionClientForTests();
    vi.unstubAllEnvs();
  });

  it("requires Service Account env vars (no API key)", () => {
    vi.stubEnv("GOOGLE_CLOUD_PROJECT_ID", "");
    vi.stubEnv("GOOGLE_CLOUD_CLIENT_EMAIL", "");
    vi.stubEnv("GOOGLE_CLOUD_PRIVATE_KEY", "");
    expect(isGoogleVisionConfigured()).toBe(false);
    expect(getGoogleVisionCredentials()).toBeNull();
  });

  it("normalizes private key newlines from env", () => {
    vi.stubEnv("GOOGLE_CLOUD_PROJECT_ID", "demo-project");
    vi.stubEnv("GOOGLE_CLOUD_CLIENT_EMAIL", "sa@demo.iam.gserviceaccount.com");
    vi.stubEnv(
      "GOOGLE_CLOUD_PRIVATE_KEY",
      "-----BEGIN PRIVATE KEY-----\\nABC\\n-----END PRIVATE KEY-----\\n",
    );
    const creds = getGoogleVisionCredentials();
    expect(creds?.projectId).toBe("demo-project");
    expect(creds?.credentials.private_key).toContain("\nABC\n");
    expect(creds?.credentials.private_key).not.toContain("\\n");
  });
});
