import fs from "fs";

const src = fs.readFileSync("config/ebay-categories.ts", "utf8");
const blocks = [...src.matchAll(/\{\s*id:\s*"(\d+)"\s*,\s*name:\s*"([^"]+)"/g)];
const map = new Map();
for (const m of blocks) map.set(m[1], m[2]);
const entries = [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));

const lines = entries
  .map(([id, name]) => `  "${id}": ${JSON.stringify(name)},`)
  .join("\n");

const out = `/** Auto-synced eBay leaf category IDs → names (from Higlou config). */
export const EBAY_CATEGORY_BY_ID: Record<string, string> = {
${lines}
};

export function lookupEbayCategoryName(categoryId: string): string | null {
  const id = String(categoryId || "").replace(/\\D/g, "");
  return id ? EBAY_CATEGORY_BY_ID[id] ?? null : null;
}
`;

fs.writeFileSync("don-baraton/lib/ebay-category-catalog.ts", out);
console.log("wrote", entries.length, "categories");
