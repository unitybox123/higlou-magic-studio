import {
  CATEGORY_SPECIFICS,
  resolveCategorySpecifics,
  type CategorySpecificConfig,
} from "@/config/category-specifics";
import type { AnalysisResult } from "@/types/analysis";
import { confidentField, type ConfidentField } from "@/lib/ai/confidence-engine";

export type BuiltItemSpecific = {
  key: string;
  label: string;
  value: string;
  confidence: number;
  required?: boolean;
  source: "analysis" | "derived" | "empty";
};

/**
 * Build C:* item specifics for the resolved eBay category.
 * Required empty fields stay empty (never invent) but are listed for review.
 */
export function buildItemSpecificsForCategory(input: {
  categoryId: string;
  analysis: AnalysisResult;
}): {
  itemSpecifics: BuiltItemSpecific[];
  missingRequired: string[];
  family: CategorySpecificConfig;
  asConfidentRecord: Record<string, ConfidentField<string>>;
} {
  const family = resolveCategorySpecificsSmart(input.categoryId);
  const a = input.analysis;
  const existing = new Map(
    (a.itemSpecifics ?? []).map((s) => [
      normalizeKey(s.key),
      {
        key: s.key.startsWith("C:") ? s.key : `C:${s.key}`,
        label: s.label || s.key.replace(/^C:/, ""),
        value: s.value?.trim() || "",
        confidence: s.confidence ?? 0.65,
      },
    ]),
  );

  const derivedValues: Record<string, string> = {
    brand: a.brand,
    model: a.model,
    mpn: a.mpn,
    upc: a.upc,
    size: a.size,
    type: a.type || a.categoryName,
    color: a.colors?.join("|") || "",
    material: a.materials?.join("|") || "",
    pattern: a.pattern,
    style: a.style,
    department: a.department,
    room: a.room,
    setIncludes: a.setIncludes?.join("|") || "",
    numberOfItems:
      a.numberOfItems != null ? String(a.numberOfItems) : "",
    features: a.features?.join("|") || "",
    careInstructions: a.careInstructions?.join("|") || "",
    countryOfManufacture: a.countryOfManufacture,
  };

  const built: BuiltItemSpecific[] = [];
  const missingRequired: string[] = [];
  const seen = new Set<string>();

  for (const field of family.fields) {
    const csv = field.csvColumn.startsWith("C:")
      ? field.csvColumn
      : `C:${field.csvColumn}`;
    const nk = normalizeKey(csv);
    seen.add(nk);

    const fromAi = existing.get(nk);
    let value = fromAi?.value || "";
    let confidence = fromAi?.confidence ?? 0;
    let source: BuiltItemSpecific["source"] = fromAi?.value
      ? "analysis"
      : "empty";

    if (!value && derivedValues[field.key]) {
      value = derivedValues[field.key];
      confidence = value ? 0.7 : 0;
      source = value ? "derived" : "empty";
    }

    // Never invent required identity for apparel size, etc.
    if (!value && field.required) {
      missingRequired.push(field.label);
      confidence = 0;
      source = "empty";
    }

    built.push({
      key: csv,
      label: field.label,
      value,
      confidence,
      required: field.required,
      source,
    });
  }

  // Keep extra AI specifics not in the family template
  for (const [nk, spec] of existing) {
    if (seen.has(nk) || !spec.value) continue;
    built.push({
      key: spec.key,
      label: spec.label,
      value: spec.value,
      confidence: spec.confidence,
      source: "analysis",
    });
  }

  const asConfidentRecord: Record<string, ConfidentField<string>> = {};
  for (const row of built) {
    asConfidentRecord[row.key] = confidentField(
      row.value || null,
      row.confidence,
      row.source === "empty" ? ["default"] : ["openai"],
    );
  }

  return {
    itemSpecifics: built,
    missingRequired,
    family,
    asConfidentRecord,
  };
}

function normalizeKey(key: string): string {
  return key.replace(/^C:/i, "").trim().toLowerCase();
}

/** Prefer matching family; unknown IDs → generic electronics-like defaults, NOT bedding. */
export function resolveCategorySpecificsSmart(
  categoryId: string,
): CategorySpecificConfig {
  const exact = CATEGORY_SPECIFICS.find((cfg) =>
    cfg.categoryIds.includes(categoryId),
  );
  if (exact) return exact;

  const id = categoryId.trim();
  // Footwear / apparel ranges (heuristic)
  if (["15709", "95672", "24087", "3034", "11483", "57988", "11554"].includes(id)) {
    return CATEGORY_SPECIFICS.find((c) => c.id === "apparel")!;
  }
  if (["177019", "20440", "47140", "131583"].includes(id)) {
    return CATEGORY_SPECIFICS.find((c) => c.id === "bedding")!;
  }

  return (
    CATEGORY_SPECIFICS.find((c) => c.id === "generic") ||
    CATEGORY_SPECIFICS.find((c) => c.id === "electronics") ||
    CATEGORY_SPECIFICS[CATEGORY_SPECIFICS.length - 1]
  );
}

// Re-export for callers that still import resolveCategorySpecifics
export { resolveCategorySpecifics };
