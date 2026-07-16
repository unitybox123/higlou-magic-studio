import fs from "fs";
import path from "path";

const root = process.cwd();

// --- 1) Sync eBay leaf catalog from config/ebay-categories.ts ---
const ebaySrc = fs.readFileSync(
  path.join(root, "config/ebay-categories.ts"),
  "utf8",
);
const leafMap = new Map();
for (const m of ebaySrc.matchAll(/\{\s*id:\s*"(\d+)"\s*,\s*name:\s*"([^"]+)"/g)) {
  leafMap.set(m[1], m[2]);
}

// Extra leaves from store-departments
const deptSrc = fs.readFileSync(
  path.join(root, "config/store-departments.ts"),
  "utf8",
);
for (const m of deptSrc.matchAll(/"(\d+)":\s*"([^"]+)"/g)) {
  if (!leafMap.has(m[1])) leafMap.set(m[1], m[2]);
}

const leafEntries = [...leafMap.entries()].sort((a, b) =>
  a[1].localeCompare(b[1]),
);
const leafOut = `/** Auto-synced eBay leaf category IDs → names (from Higlou config). */
export const EBAY_CATEGORY_BY_ID: Record<string, string> = {
${leafEntries.map(([id, name]) => `  "${id}": ${JSON.stringify(name)},`).join("\n")}
};

export function lookupEbayCategoryName(categoryId: string): string | null {
  const id = String(categoryId || "").replace(/\\D/g, "");
  return id ? EBAY_CATEGORY_BY_ID[id] ?? null : null;
}
`;
fs.writeFileSync(
  path.join(root, "don-baraton/lib/ebay-category-catalog.ts"),
  leafOut,
);

// --- 2) Sync store taxonomy module ---
const taxonomyOut = `/**
 * AUTO-GENERATED from Higlou config/store-departments.ts
 * Run: node scripts/sync-store-taxonomy.mjs
 * Do not edit by hand — edit config/store-departments.ts instead.
 */

${deptSrc
  .replace(/^\/\*\*[\s\S]*?\*\//, "/** Synced store departments (Higlou → Don Baraton). */")
  .replace(
    /Keep in sync with Don Baraton via:.*\n/,
    "Source of truth: config/store-departments.ts\n",
  )}
`;

// The file already has full content - just copy it with a header
const copied = `/**
 * AUTO-GENERATED from Higlou \`config/store-departments.ts\`
 * Run from repo root: \`node scripts/sync-store-taxonomy.mjs\`
 */
${deptSrc.replace(/^\/\*\*[\s\S]*?\*\/\n\n/, "")}
`;

fs.writeFileSync(
  path.join(root, "don-baraton/lib/store-taxonomy.ts"),
  copied,
);

console.log(
  `Synced ${leafEntries.length} leaf categories + store departments → don-baraton/lib/`,
);
