const PRINTED_MATERIAL_PATTERNS: Array<{
  pattern: RegExp;
  value?: string;
  confidence: number;
}> = [
  {
    pattern: /\b(?:material|made\s+of|composition)\s*[:]\s*([A-Za-z][A-Za-z0-9\s/+-]{1,40})/i,
    confidence: 0.88,
  },
  {
    pattern: /\b(stainless\s+steel)\b/i,
    value: "Stainless Steel",
    confidence: 0.9,
  },
  {
    pattern: /\b(die[\s-]?cast(?:\s+(?:aluminum|aluminium|metal|zinc))?)\b/i,
    value: "Die-cast Metal",
    confidence: 0.86,
  },
  {
    pattern: /\b(cast\s+(?:aluminum|aluminium|iron|metal))\b/i,
    confidence: 0.86,
  },
  {
    pattern: /\b(100\s*%?\s*cotton)\b/i,
    value: "Cotton",
    confidence: 0.9,
  },
  {
    pattern: /\b(100\s*%?\s*polyester)\b/i,
    value: "Polyester",
    confidence: 0.9,
  },
  {
    pattern: /\b(?:\d+\s*%?\s*)?(cotton|polyester|wool|leather|nylon|spandex|linen|silk|rayon|acrylic|microfiber)\b/i,
    confidence: 0.82,
  },
  {
    pattern: /\b(aluminum|aluminium|steel|metal|plastic|glass|rubber|wood|ceramic|resin|vinyl|brass|copper|zinc)\b/i,
    confidence: 0.8,
  },
];

const METAL_FINISH_COLORS =
  /\b(bronze|brass|chrome|nickel|pewter|gunmetal|metallic|steel|copper|iron|aluminum|aluminium)\b/i;

const PRODUCT_TYPE_MATERIAL_HINTS: Array<{
  pattern: RegExp;
  materials: string[];
  confidence: number;
  reason: string;
}> = [
  {
    pattern:
      /\b(flood\s*light|spot\s*light|spotlight|security\s*light|outdoor\s*light|wall\s*pack|sconce|track\s*light|path\s*light)\b/i,
    materials: ["Metal"],
    confidence: 0.64,
    reason: "lighting_fixture_housing",
  },
  {
    pattern: /\b(comforter|sheet|pillowcase|duvet|blanket|bedding|curtain)\b/i,
    materials: ["Fabric"],
    confidence: 0.62,
    reason: "textile_product_type",
  },
  {
    pattern: /\b(bottle|canteen|tumbler|mug|flask)\b/i,
    materials: ["Plastic"],
    confidence: 0.6,
    reason: "drinkware_default",
  },
  {
    pattern: /\b(stainless|vacuum|thermos)\b/i,
    materials: ["Stainless Steel"],
    confidence: 0.68,
    reason: "stainless_drinkware",
  },
];

function normalizeMaterialToken(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  return trimmed
    .split(" ")
    .map((word) => {
      const lower = word.toLowerCase();
      if (lower === "aluminium") return "Aluminum";
      if (lower === "stainless" && trimmed.toLowerCase().includes("steel"))
        return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function uniqueMaterials(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const normalized = normalizeMaterialToken(value);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
}

export function extractMaterialsFromOcrText(text: string): {
  materials: string[];
  confidence: number;
  reason: string;
} | null {
  const blob = text.replace(/\s+/g, " ");
  for (const rule of PRINTED_MATERIAL_PATTERNS) {
    const match = blob.match(rule.pattern);
    if (!match) continue;
    const raw = rule.value ?? match[1] ?? match[0];
    const materials = uniqueMaterials([raw]);
    if (!materials.length) continue;
    return {
      materials,
      confidence: rule.confidence,
      reason: "printed_on_packaging",
    };
  }
  return null;
}

export function inferMaterialsFromContext(input: {
  colors?: string[];
  productType?: string;
  categoryName?: string;
  title?: string;
  features?: string[];
}): {
  materials: string[];
  confidence: number;
  reason: string;
} | null {
  const context = [
    input.title,
    input.productType,
    input.categoryName,
    ...(input.features ?? []),
    ...(input.colors ?? []),
  ]
    .filter(Boolean)
    .join(" ");

  for (const hint of PRODUCT_TYPE_MATERIAL_HINTS) {
    if (!hint.pattern.test(context)) continue;
    return {
      materials: hint.materials,
      confidence: hint.confidence,
      reason: hint.reason,
    };
  }

  const colorBlob = (input.colors ?? []).join(" ");
  if (METAL_FINISH_COLORS.test(colorBlob)) {
    return {
      materials: ["Metal"],
      confidence: 0.62,
      reason: "metal_finish_color",
    };
  }

  return null;
}

export type MaterialEvidence = {
  materials: string[];
  confidence: number;
  source: "google_vision_ocr" | "openai_visual" | "derived";
  needsReview: boolean;
  reason?: string;
};

/** Pick best material evidence: printed OCR > AI vision > contextual inference. */
export function resolveMaterialEvidence(input: {
  openaiMaterials?: string[];
  openaiMaterialConfidence?: number;
  openaiMaterialNeedsReview?: boolean;
  ocrText?: string;
  colors?: string[];
  productType?: string;
  categoryName?: string;
  title?: string;
  features?: string[];
}): MaterialEvidence {
  const fromOcr = input.ocrText
    ? extractMaterialsFromOcrText(input.ocrText)
    : null;
  if (fromOcr) {
    return {
      materials: fromOcr.materials,
      confidence: fromOcr.confidence,
      source: "google_vision_ocr",
      needsReview: false,
      reason: fromOcr.reason,
    };
  }

  const fromOpenAi = uniqueMaterials(input.openaiMaterials ?? []);
  if (fromOpenAi.length) {
    const confidence = input.openaiMaterialConfidence ?? 0.72;
    return {
      materials: fromOpenAi,
      confidence,
      source: "openai_visual",
      needsReview: input.openaiMaterialNeedsReview ?? confidence < 0.8,
      reason: input.openaiMaterialNeedsReview
        ? "openai_visual_estimate"
        : "openai_visual",
    };
  }

  const inferred = inferMaterialsFromContext({
    colors: input.colors,
    productType: input.productType,
    categoryName: input.categoryName,
    title: input.title,
    features: input.features,
  });
  if (inferred) {
    return {
      materials: inferred.materials,
      confidence: inferred.confidence,
      source: "derived",
      needsReview: true,
      reason: inferred.reason,
    };
  }

  return {
    materials: [],
    confidence: 0,
    source: "derived",
    needsReview: true,
    reason: "no_material_evidence",
  };
}
