const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

const env = fs.readFileSync(".env.local", "utf8");
for (const line of env.split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 0) continue;
  let k = t.slice(0, i).trim();
  let v = t.slice(i + 1).trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  if (!process.env[k]) process.env[k] = v;
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const tables = [
  "users",
  "products",
  "product_images",
  "ai_usage_events",
  "image_analysis_cache",
  "budget_settings",
  "provider_pricing_settings",
  "analysis_history",
  "generated_csv_files",
  "ebay_templates",
  "store_branding",
];

(async () => {
  for (const table of tables) {
    const { error } = await admin.from(table).select("*").limit(1);
    console.log(`${table}: ${error ? `MISSING — ${error.message}` : "OK"}`);
  }
})();
