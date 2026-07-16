export type EvidenceSource =
  | "user"
  | "barcode"
  | "ocr"
  | "openai"
  | "category_resolver"
  | "default";

export type ConfidenceStatus = "confirmed" | "review" | "empty";

export type ConfidentField<T> = {
  value: T | null;
  confidence: number;
  status: ConfidenceStatus;
  sources: EvidenceSource[];
  evidence?: string[];
  reason?: string;
};

export function getConfidenceStatus(confidence: number): ConfidenceStatus {
  if (confidence < 0.6) return "empty";
  if (confidence < 0.8) return "review";
  return "confirmed";
}

export function confidentField<T>(
  value: T | null | undefined,
  confidence: number,
  sources: EvidenceSource[],
  options?: { evidence?: string[]; reason?: string; identityField?: boolean },
): ConfidentField<T> {
  const empty =
    value === null ||
    value === undefined ||
    (typeof value === "string" && !String(value).trim());

  // Identity fields inferred by OpenAI alone must never invent confirmation
  let conf = empty ? 0 : Math.max(0, Math.min(1, confidence));
  if (
    options?.identityField &&
    sources.length === 1 &&
    sources[0] === "openai" &&
    !empty
  ) {
    conf = Math.min(conf, 0.74);
  }
  if (sources.includes("default") && !sources.includes("user")) {
    conf = Math.min(conf, 0.4);
  }

  const status = empty ? "empty" : getConfidenceStatus(conf);
  return {
    value: status === "empty" ? null : (value as T),
    confidence: status === "empty" ? 0 : conf,
    status,
    sources,
    evidence: options?.evidence,
    reason: options?.reason,
  };
}

export function confirmFieldAsUser<T>(
  previous: ConfidentField<T> | null | undefined,
  value: T,
): ConfidentField<T> {
  return {
    value,
    confidence: 1,
    status: "confirmed",
    sources: ["user"],
    evidence: previous?.evidence,
    reason: "user_confirmed",
  };
}

export function mapLegacySource(
  source: string | undefined,
): EvidenceSource {
  switch (source) {
    case "user":
    case "user_input":
      return "user";
    case "barcode":
    case "zxing_barcode":
      return "barcode";
    case "ocr":
    case "google_vision_ocr":
    case "image":
      return "ocr";
    case "category_resolver":
    case "catalog":
    case "ai_fallback":
      return "category_resolver";
    case "default":
    case "settings_default":
    case "derived":
      return "default";
    default:
      return "openai";
  }
}

export function applyConflictPenalty(
  confidence: number,
  conflicted: boolean,
): number {
  if (!conflicted) return confidence;
  return Math.max(0, confidence - 0.25);
}

export function overallConfidence(
  fields: Array<{ confidence: number; status: ConfidenceStatus }>,
): number {
  const usable = fields.filter((f) => f.status !== "empty");
  if (!usable.length) return 0;
  const sum = usable.reduce((s, f) => s + f.confidence, 0);
  return Number((sum / usable.length).toFixed(3));
}
