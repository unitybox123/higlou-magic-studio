import { confidentField, type ConfidentField } from "@/lib/ai/confidence-engine";

export type PackageContentsResult = {
  included: string[];
  missing: string[];
  confidence: number;
  warnings: string[];
};

const LIKELY_ACCESSORIES = [
  "manual",
  "user guide",
  "power cable",
  "charger",
  "power cord",
  "remote",
  "box",
  "original box",
  "packaging",
  "warranty card",
  "adapters",
  "adapter",
  "usb cable",
  "earbuds",
  "case",
  "stand",
  "mount",
];

/**
 * Missing Parts / Includes detector.
 * Prefers explicit AI lists; supplements with OCR "includes/missing" phrases.
 */
export function analyzePackageContents(input: {
  setIncludes?: string[];
  missingItems?: string[];
  features?: string[];
  detectedText?: string[];
  ocrText?: string;
  descriptionSummary?: string;
}): PackageContentsResult {
  const warnings: string[] = [];
  const included = new Set<string>();
  const missing = new Set<string>();

  for (const item of input.setIncludes ?? []) {
    if (item.trim()) included.add(cleanItem(item));
  }
  for (const item of input.missingItems ?? []) {
    if (item.trim()) missing.add(cleanItem(item));
  }

  const corpus = [
    ...(input.features ?? []),
    ...(input.detectedText ?? []),
    input.ocrText ?? "",
    input.descriptionSummary ?? "",
  ].join("\n");

  // Explicit "includes: a, b" / "missing: c"
  const includesMatch = corpus.match(
    /includes?\s*[:\-]\s*([^\n.]+)/i,
  );
  if (includesMatch?.[1]) {
    for (const part of splitList(includesMatch[1])) included.add(part);
  }

  const missingMatch = corpus.match(
    /missing\s*[:\-]\s*([^\n.]+)/i,
  );
  if (missingMatch?.[1]) {
    for (const part of splitList(missingMatch[1])) missing.add(part);
  }

  // "no manual" / "without charger"
  for (const accessory of LIKELY_ACCESSORIES) {
    const noRe = new RegExp(
      `\\b(no|without|missing)\\s+${accessory.replace(/\s+/g, "\\s+")}\\b`,
      "i",
    );
    if (noRe.test(corpus)) {
      missing.add(titleCase(accessory));
      included.delete(titleCase(accessory));
    }
  }

  // Don't claim accessories not evidenced
  if (!included.size && !missing.size) {
    warnings.push(
      "Package contents not clearly visible — review photos before publishing.",
    );
  }

  // Remove overlaps (missing wins)
  for (const m of missing) included.delete(m);

  const confidence =
    included.size || missing.size
      ? input.setIncludes?.length || input.missingItems?.length
        ? 0.8
        : 0.62
      : 0.35;

  return {
    included: [...included],
    missing: [...missing],
    confidence,
    warnings,
  };
}

export function packageToConfidentFields(result: PackageContentsResult): {
  includedItems: Array<ConfidentField<string>>;
  missingItems: Array<ConfidentField<string>>;
} {
  return {
    includedItems: result.included.map((item) =>
      confidentField(item, result.confidence, ["openai", "ocr"]),
    ),
    missingItems: result.missing.map((item) =>
      confidentField(item, Math.max(0.65, result.confidence), ["openai", "ocr"]),
    ),
  };
}

function splitList(raw: string): string[] {
  return raw
    .split(/,|;|\band\b/i)
    .map(cleanItem)
    .filter(Boolean);
}

function cleanItem(value: string): string {
  return titleCase(value.replace(/^[\s•\-]+/, "").trim());
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
