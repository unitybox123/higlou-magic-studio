import { createHash } from "crypto";

/** Bump when pipeline steps/behavior change in a cache-breaking way. */
export const PIPELINE_VERSION = "higlou-pipeline-v2b";

/** Bump when OpenAI analysis / category prompts change meaningfully. */
export const PROMPT_VERSION = "higlou-prompt-v2b1";

export type AnalysisMode = "economy" | "standard" | "advanced";

export type ProductFingerprintInput = {
  imageHashes: string[];
  pipelineVersion?: string;
  promptVersion?: string;
  analysisMode: AnalysisMode;
};

/** Stable product fingerprint — sorted hashes + versions + mode. */
export function createProductFingerprint(
  input: ProductFingerprintInput,
): string {
  const sorted = [...input.imageHashes].map((h) => h.trim()).filter(Boolean).sort();
  const payload = [
    sorted.join("|"),
    input.pipelineVersion || PIPELINE_VERSION,
    input.promptVersion || PROMPT_VERSION,
    input.analysisMode,
  ].join("::");
  return createHash("sha256").update(payload).digest("hex");
}

export function hashNormalizedImageContent(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function mapTierToAnalysisMode(
  tier: "economy" | "advanced" | undefined,
  forceDeep?: boolean,
): AnalysisMode {
  if (forceDeep || tier === "advanced") return "advanced";
  return "economy";
}
