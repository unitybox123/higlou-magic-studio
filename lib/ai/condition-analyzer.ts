import { resolveConditionId } from "@/config/condition-map";
import { confidentField, type ConfidentField } from "@/lib/ai/confidence-engine";

export type ConditionType =
  | "new"
  | "open_box"
  | "used"
  | "for_parts"
  | "unknown";

export type ConditionAnalysis = {
  conditionLabel: string;
  conditionId: string;
  type: ConditionType;
  notes: string;
  defects: string[];
  confidence: number;
  evidence: string[];
  warnings: string[];
};

const DEFECT_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\bscratch(es|ed)?\b/i, label: "Cosmetic scratches" },
  { re: /\bscuff(s|ed)?\b/i, label: "Scuffs" },
  { re: /\bdent(s|ed)?\b/i, label: "Dents" },
  { re: /\bcrack(s|ed)?\b/i, label: "Cracks" },
  { re: /\bchip(s|ped)?\b/i, label: "Chips" },
  { re: /\bstain(s|ed)?\b/i, label: "Stains" },
  { re: /\btear(s|ed|n)?\b/i, label: "Tears" },
  { re: /\bwear\b|\bworn\b/i, label: "Visible wear" },
  { re: /\brust(y|ed)?\b|\boxidat/i, label: "Rust / oxidation" },
  { re: /\bmissing\b/i, label: "Missing parts noted" },
  { re: /\bbroken\b|\bnot working\b|\bdoes not work\b/i, label: "Not fully functional" },
  { re: /\bopen(ed)?\s+box\b|\bseal\s+broken\b/i, label: "Opened packaging" },
];

function inferType(label: string, defects: string[]): ConditionType {
  const c = label.toLowerCase();
  if (c.includes("parts") || c.includes("not working") || c.includes("for parts"))
    return "for_parts";
  if (c.includes("open box") || c.includes("open-box") || c.includes("nwot"))
    return "open_box";
  if (
    (c.includes("new") && !c.includes("open")) ||
    c === "nwt" ||
    c.includes("new with tags")
  )
    return "new";
  if (c.includes("used") || c.includes("pre-owned") || c.includes("refurbished"))
    return "used";
  if (defects.some((d) => /not fully functional|missing parts/i.test(d)))
    return defects.some((d) => /not fully functional/i.test(d))
      ? "for_parts"
      : "used";
  return "unknown";
}

function pickLabel(input: {
  condition?: string;
  detectedText?: string[];
  features?: string[];
  ocrText?: string;
}): { label: string; evidence: string[] } {
  const evidence: string[] = [];
  const raw = (input.condition || "").trim();
  const hay = [
    raw,
    ...(input.features ?? []),
    ...(input.detectedText ?? []),
    input.ocrText ?? "",
  ]
    .join("\n")
    .toLowerCase();

  if (/\bfor parts\b|\bnot working\b|\bas[- ]is\b/.test(hay)) {
    evidence.push("Text suggests not working / for parts");
    return { label: "For parts or not working", evidence };
  }
  if (/\bopen[- ]?box\b|\bseal broken\b|\bopened\b/.test(hay)) {
    evidence.push("Packaging appears opened");
    return { label: "Open box", evidence };
  }
  if (/\bpre-?owned\b|\bused\b|\bwear\b|\bscuff\b|\bscratch\b/.test(hay)) {
    evidence.push("Wear / cosmetic cues detected");
    return { label: raw && !/new/i.test(raw) ? raw : "Used", evidence };
  }
  if (raw) {
    evidence.push("Model-reported condition");
    return { label: raw, evidence };
  }
  evidence.push("No strong condition evidence — defaulting cautiously");
  return { label: "Used", evidence };
}

/**
 * Condition Analyzer — visual/OCR cues → eBay condition + notes + defects.
 * Never claims "New" when defects/wear evidence exists.
 */
export function analyzeCondition(input: {
  condition?: string;
  conditionId?: string;
  conditionNotes?: string;
  defects?: string[];
  detectedText?: string[];
  features?: string[];
  ocrText?: string;
  categoryFamily?: string;
  userCondition?: string;
}): ConditionAnalysis {
  const warnings: string[] = [];
  const defectSet = new Set<string>();

  for (const d of input.defects ?? []) {
    if (d.trim()) defectSet.add(d.trim());
  }

  const scanText = [
    input.conditionNotes,
    ...(input.features ?? []),
    ...(input.detectedText ?? []),
    input.ocrText ?? "",
  ].join("\n");

  for (const pattern of DEFECT_PATTERNS) {
    if (pattern.re.test(scanText)) defectSet.add(pattern.label);
  }

  const defects = [...defectSet];

  let { label, evidence } = pickLabel(input);

  if (input.userCondition?.trim()) {
    label = input.userCondition.trim();
    evidence = ["User-provided condition"];
  }

  // Never keep New if defects imply used/open
  if (
    /new/i.test(label) &&
    defects.some((d) =>
      /scratch|scuff|wear|stain|dent|rust|tear|opened packaging|not fully/i.test(
        d,
      ),
    )
  ) {
    label = defects.some((d) => /opened packaging/i.test(d))
      ? "Open box"
      : "Used";
    warnings.push(
      "Condition adjusted from New because cosmetic/wear evidence was detected.",
    );
    evidence.push("Overrode New due to defect cues");
  }

  const type = inferType(label, defects);
  let conditionId =
    input.conditionId?.trim() ||
    resolveConditionId(label, input.categoryFamily) ||
    "";

  if (!conditionId) {
    if (type === "new") conditionId = "NEW";
    else if (type === "open_box") conditionId = "1500";
    else if (type === "for_parts") conditionId = "7000";
    else if (type === "used") conditionId = "3000";
    else conditionId = "3000";
  }

  const notes =
    input.conditionNotes?.trim() ||
    buildDefaultNotes({ label, type, defects });

  let confidence = 0.72;
  if (input.userCondition) confidence = 1;
  else if (evidence.includes("Model-reported condition") && defects.length === 0)
    confidence = 0.8;
  else if (type === "unknown") confidence = 0.45;
  else if (defects.length) confidence = 0.78;

  return {
    conditionLabel: label,
    conditionId,
    type,
    notes,
    defects,
    confidence,
    evidence,
    warnings,
  };
}

function buildDefaultNotes(input: {
  label: string;
  type: ConditionType;
  defects: string[];
}): string {
  if (input.type === "new" && !input.defects.length) {
    return "Appears new. Inspect photos carefully for packaging and seals.";
  }
  if (input.type === "open_box") {
    return [
      "Open box / packaging may have been opened.",
      input.defects.length
        ? `Noted: ${input.defects.join("; ")}.`
        : "See photos for exact cosmetic condition.",
    ].join(" ");
  }
  if (input.type === "for_parts") {
    return "Listed for parts or not working. See photos and description for issues.";
  }
  if (input.defects.length) {
    return `${input.label}. ${input.defects.join("; ")}. See photos for details.`;
  }
  return `${input.label}. Please review all photos for exact condition.`;
}

export function conditionToConfidentFields(analysis: ConditionAnalysis): {
  type: ConfidentField<ConditionType>;
  notes: ConfidentField<string>;
  defects: Array<ConfidentField<string>>;
  conditionId: ConfidentField<string>;
} {
  return {
    type: confidentField(
      analysis.type === "unknown" ? null : analysis.type,
      analysis.confidence,
      analysis.evidence.some((e) => /User/i.test(e)) ? ["user"] : ["openai"],
      { evidence: analysis.evidence },
    ),
    notes: confidentField(analysis.notes, analysis.confidence, ["openai"]),
    defects: analysis.defects.map((d) =>
      confidentField(d, 0.75, ["openai", "ocr"]),
    ),
    conditionId: confidentField(
      analysis.conditionId,
      analysis.confidence,
      ["openai"],
    ),
  };
}
