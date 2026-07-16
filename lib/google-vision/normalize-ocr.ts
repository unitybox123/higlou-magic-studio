export function normalizeOcrText(raw: string): string {
  return raw
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractLikelyBrand(text: string): string | null {
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const branded = lines.find(
    (line) =>
      /^[A-Z][A-Za-z0-9 &.'-]{1,40}$/.test(line) &&
      !/^(SIZE|COLOR|MADE|CARE|WARNING|UPC|EAN)/i.test(line),
  );
  return branded || null;
}

export function extractLikelySize(text: string): string | null {
  const match = text.match(
    /\b(Twin|Twin XL|Full|Queen|King|California King|Cal King|XS|S|M|L|XL|XXL|\d+(\.\d+)?\s?(in|inch|cm|mm))\b/i,
  );
  return match?.[0] ?? null;
}

export function extractLikelyUpc(text: string): string | null {
  const candidates = text.match(/\b\d{8,14}\b/g) ?? [];
  return candidates[0] ?? null;
}

export function extractLikelyModel(text: string): string | null {
  const labeled = text.match(
    /\b(?:Model|Item(?:\s*#| Number)?|SKU|MPN)\s*[:#-]?\s*([A-Z0-9][A-Z0-9\-_/]{2,})\b/i,
  );
  if (labeled?.[1]) return labeled[1];
  return null;
}
