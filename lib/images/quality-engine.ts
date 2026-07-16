import jpeg from "jpeg-js";
import { PNG } from "pngjs";
import {
  isJpegBuffer,
  isPngBuffer,
  isWebpBuffer,
  sniffImageMime,
} from "@/config/supported-image-formats";
import {
  messageForAnalysisFailure,
  type AnalysisFailureCode,
} from "@/types/analysis-failures";

export type ImageQualityIssue =
  | "too_small"
  | "blurry"
  | "too_dark"
  | "overexposed"
  | "low_contrast"
  | "unsupported_format"
  | "corrupted";

export type ImageQualityResult = {
  passed: boolean;
  score: number;
  issues: ImageQualityIssue[];
  metrics: {
    width: number;
    height: number;
    megapixels: number;
    blurScore: number;
    brightnessScore: number;
    contrastScore: number;
  };
};

export const QUALITY_THRESHOLDS = {
  minWidth: 800,
  minHeight: 800,
  /** Soft floor — below this we still allow analysis with a warning when visuals look sharp */
  softMinWidth: 400,
  softMinHeight: 400,
  minMegapixels: 0.64,
  minScoreToAnalyze: 55,
  warningScore: 70,
} as const;

type DecodedImage = {
  width: number;
  height: number;
  data: Uint8Array; // RGBA
};

/** @deprecated Prefer sniffImageMime from config/supported-image-formats */
export { sniffImageMime, isWebpBuffer as isWebp };

function decodeImageBuffer(buffer: Buffer): DecodedImage {
  if (buffer.length < 8) {
    throw new Error("corrupted");
  }

  if (isPngBuffer(buffer)) {
    const png = PNG.sync.read(buffer);
    return { width: png.width, height: png.height, data: png.data };
  }

  if (isJpegBuffer(buffer)) {
    const decoded = jpeg.decode(buffer, { useTArray: true, formatAsRGBA: true });
    return {
      width: decoded.width,
      height: decoded.height,
      data: decoded.data as Uint8Array,
    };
  }

  // After normalizeImageForAnalysis, buffers should already be JPEG/PNG.
  // Keep a soft path for any leftover WebP that skipped normalization.
  if (isWebpBuffer(buffer)) {
    throw new Error("unsupported_format");
  }

  throw new Error("unsupported_format");
}

function sampleMetrics(decoded: DecodedImage) {
  const { width, height, data } = decoded;
  const step = Math.max(1, Math.floor(Math.min(width, height) / 96));
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  let laplacian = 0;
  let lapN = 0;

  const grayAt = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  };

  for (let y = step; y < height - step; y += step) {
    for (let x = step; x < width - step; x += step) {
      const g = grayAt(x, y);
      sum += g;
      sumSq += g * g;
      n += 1;
      const lap = Math.abs(
        4 * g -
          grayAt(x - step, y) -
          grayAt(x + step, y) -
          grayAt(x, y - step) -
          grayAt(x, y + step),
      );
      laplacian += lap;
      lapN += 1;
    }
  }

  const mean = n ? sum / n : 0;
  const variance = n ? Math.max(0, sumSq / n - mean * mean) : 0;
  const contrastScore = Math.min(100, Math.sqrt(variance) * 2.2);
  const brightnessScore = Math.min(100, (mean / 255) * 100);
  const blurScore = lapN ? Math.min(100, (laplacian / lapN) * 1.8) : 0;

  return { brightnessScore, contrastScore, blurScore };
}

/**
 * Local image quality gate — no paid APIs.
 * Prefer running on buffers already passed through normalizeImageForAnalysis.
 */
export function assessImageQuality(buffer: Buffer): ImageQualityResult {
  try {
    const decoded = decodeImageBuffer(buffer);
    const { width, height } = decoded;
    const megapixels = (width * height) / 1_000_000;
    const metricsSample = sampleMetrics(decoded);
    const issues: ImageQualityIssue[] = [];

    if (
      width < QUALITY_THRESHOLDS.minWidth ||
      height < QUALITY_THRESHOLDS.minHeight ||
      megapixels < QUALITY_THRESHOLDS.minMegapixels
    ) {
      issues.push("too_small");
    }
    if (metricsSample.blurScore < 18) issues.push("blurry");
    if (metricsSample.brightnessScore < 18) issues.push("too_dark");
    if (metricsSample.brightnessScore > 92) issues.push("overexposed");
    if (metricsSample.contrastScore < 12) issues.push("low_contrast");

    let score = 100;
    if (issues.includes("too_small")) score -= 25;
    if (issues.includes("blurry")) score -= 30;
    if (issues.includes("too_dark") || issues.includes("overexposed"))
      score -= 22;
    if (issues.includes("low_contrast")) score -= 15;
    if (!issues.includes("too_small")) {
      score += Math.min(10, megapixels * 4);
    }
    score = Math.max(0, Math.min(100, Math.round(score)));

    const belowSoftFloor =
      width < QUALITY_THRESHOLDS.softMinWidth ||
      height < QUALITY_THRESHOLDS.softMinHeight;
    const visualOk =
      !issues.includes("blurry") &&
      !issues.includes("too_dark") &&
      !issues.includes("overexposed") &&
      !issues.includes("low_contrast");
    const softPass =
      issues.includes("too_small") && visualOk && !belowSoftFloor;

    return {
      passed:
        !belowSoftFloor &&
        (score >= QUALITY_THRESHOLDS.minScoreToAnalyze || softPass),
      score,
      issues,
      metrics: {
        width,
        height,
        megapixels: Number(megapixels.toFixed(3)),
        blurScore: Number(metricsSample.blurScore.toFixed(1)),
        brightnessScore: Number(metricsSample.brightnessScore.toFixed(1)),
        contrastScore: Number(metricsSample.contrastScore.toFixed(1)),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "corrupted";
    if (message === "unsupported_format" || isWebpBuffer(buffer)) {
      // Should be rare after normalize — do not treat as "product unrecognized".
      return {
        passed: true,
        score: 65,
        issues: ["unsupported_format"],
        metrics: {
          width: 0,
          height: 0,
          megapixels: 0,
          blurScore: 0,
          brightnessScore: 0,
          contrastScore: 0,
        },
      };
    }
    return {
      passed: false,
      score: 0,
      issues: ["corrupted"],
      metrics: {
        width: 0,
        height: 0,
        megapixels: 0,
        blurScore: 0,
        brightnessScore: 0,
        contrastScore: 0,
      },
    };
  }
}

export type GateDecision = {
  usableIndexes: number[];
  blocked: boolean;
  warnings: string[];
  results: Array<ImageQualityResult & { index: number }>;
  failureCode?: AnalysisFailureCode;
};

export function gateImagesForAnalysis(buffers: Buffer[]): GateDecision {
  const results = buffers.map((buffer, index) => ({
    index,
    ...assessImageQuality(buffer),
  }));
  const usableIndexes = results.filter((r) => r.passed).map((r) => r.index);
  const warnings: string[] = [];

  for (const r of results) {
    if (!r.passed) {
      warnings.push(
        `Image ${r.index + 1} excluded (score ${r.score}): ${r.issues.join(", ") || "quality"}`,
      );
    } else if (r.issues.includes("unsupported_format")) {
      warnings.push(
        `Image ${r.index + 1}: format not locally measurable — continuing AI analysis.`,
      );
    } else if (r.issues.includes("too_small")) {
      warnings.push(
        `Image ${r.index + 1} is below recommended ${QUALITY_THRESHOLDS.minWidth}×${QUALITY_THRESHOLDS.minHeight} — continuing with a quality warning.`,
      );
    } else if (r.score < QUALITY_THRESHOLDS.warningScore) {
      warnings.push(
        `Image ${r.index + 1} is marginal (score ${r.score}) — analysis may be less accurate.`,
      );
    }
  }

  const blocked = usableIndexes.length === 0;
  return {
    usableIndexes,
    blocked,
    warnings,
    results,
    failureCode: blocked ? resolveQualityFailureCode(results) : undefined,
  };
}

export function resolveQualityFailureCode(
  results: Array<{ issues: ImageQualityIssue[] }>,
): AnalysisFailureCode {
  const issues = new Set(results.flatMap((r) => r.issues));
  if (issues.has("corrupted")) return "IMAGE_DECODE_FAILED";
  if (issues.has("unsupported_format")) return "UNSUPPORTED_INPUT_FORMAT";
  if (issues.has("too_small")) return "IMAGE_TOO_SMALL";
  return "IMAGE_TOO_SMALL";
}

/** User-facing copy for a hard photo-quality block — never "can't identify product". */
export function describeQualityBlock(gate: GateDecision): {
  code: AnalysisFailureCode;
  message: string;
} {
  const code = gate.failureCode ?? resolveQualityFailureCode(gate.results);
  return {
    code,
    message: messageForAnalysisFailure(code),
  };
}
