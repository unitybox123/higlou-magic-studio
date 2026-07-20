const { loadEnvConfig } = require("@next/env");
const fs = require("fs");
const path = require("path");

loadEnvConfig(process.cwd());

const keys = [
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "OPENAI_ECONOMY_MODEL",
  "OPENAI_ADVANCED_MODEL",
  "MONTHLY_PRODUCT_TARGET",
  "MONTHLY_BUDGET_WARNING_USD",
  "MONTHLY_BUDGET_LIMIT_USD",
  "OPENAI_INPUT_PRICE_PER_MILLION",
  "OPENAI_CACHED_INPUT_PRICE_PER_MILLION",
  "OPENAI_OUTPUT_PRICE_PER_MILLION",
  "OPENAI_ECONOMY_INPUT_PRICE_PER_MILLION",
  "OPENAI_ECONOMY_CACHED_INPUT_PRICE_PER_MILLION",
  "OPENAI_ECONOMY_OUTPUT_PRICE_PER_MILLION",
  "GOOGLE_VISION_FREE_UNITS_MONTHLY",
  "GOOGLE_VISION_PRICE_PER_1000_UNITS",
  "SUPABASE_MONTHLY_BASE_COST",
  "VERCEL_MONTHLY_BASE_COST",
  "DOMAIN_MISC_MONTHLY_COST",
  "DEFAULT_IMAGES_PER_PRODUCT",
  "MAX_IMAGES_PER_PRODUCT",
  "GOOGLE_VISION_MAX_IMAGES_PER_PRODUCT",
  "MAX_RETRIES_PER_ANALYSIS",
  "GOOGLE_CLOUD_PROJECT_ID",
  "GOOGLE_CLOUD_CLIENT_EMAIL",
  "GOOGLE_CLOUD_PRIVATE_KEY",
  "GOOGLE_VISION_ENABLED",
  "GOOGLE_VISION_MODE",
  "GOOGLE_VISION_MAX_IMAGES",
  "MAX_ANALYSIS_IMAGES",
  "MAX_IMAGE_SIZE_MB",
  "ENABLE_BARCODE_SCANNING",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_PRODUCT_IMAGES_BUCKET",
  "NEXT_PUBLIC_APP_URL",
  "DON_BARATON_API_URL",
  "DON_BARATON_IMPORT_TOKEN",
  "DON_BARATON_SYNC_ENABLED",
  "NEXT_PUBLIC_DON_BARATON_URL",
  "DON_BARATON_URL",
  "DON_BARATON_SYNC_TOKEN",
];

const defaults = {
  MONTHLY_PRODUCT_TARGET: "500",
  MONTHLY_BUDGET_WARNING_USD: "75",
  MONTHLY_BUDGET_LIMIT_USD: "100",
  OPENAI_INPUT_PRICE_PER_MILLION: "1",
  OPENAI_CACHED_INPUT_PRICE_PER_MILLION: "0.5",
  OPENAI_OUTPUT_PRICE_PER_MILLION: "6",
  OPENAI_ECONOMY_INPUT_PRICE_PER_MILLION: "0.15",
  OPENAI_ECONOMY_CACHED_INPUT_PRICE_PER_MILLION: "0.075",
  OPENAI_ECONOMY_OUTPUT_PRICE_PER_MILLION: "0.6",
  GOOGLE_VISION_FREE_UNITS_MONTHLY: "1000",
  GOOGLE_VISION_PRICE_PER_1000_UNITS: "1.50",
  SUPABASE_MONTHLY_BASE_COST: "25",
  VERCEL_MONTHLY_BASE_COST: "20",
  DOMAIN_MISC_MONTHLY_COST: "3",
  DEFAULT_IMAGES_PER_PRODUCT: "8",
  MAX_IMAGES_PER_PRODUCT: "12",
  GOOGLE_VISION_MAX_IMAGES_PER_PRODUCT: "4",
  MAX_RETRIES_PER_ANALYSIS: "2",
  DON_BARATON_API_URL: "https://www.donbaraton.shop",
  NEXT_PUBLIC_DON_BARATON_URL: "https://www.donbaraton.shop",
  DON_BARATON_SYNC_ENABLED: "true",
  DON_BARATON_URL: "https://www.donbaraton.shop",
};

const lines = [];

for (const key of keys) {
  let value = process.env[key];
  if ((value == null || value === "") && defaults[key] != null) {
    value = defaults[key];
  }
  if (value == null || value === "") continue;

  if (key === "NEXT_PUBLIC_APP_URL") {
    value = "https://higlou-magic-studio.vercel.app";
  }

  if (
    (key === "DON_BARATON_URL" || key === "DON_BARATON_API_URL") &&
    /localhost|market-place-outlet/i.test(value)
  ) {
    value = "https://www.donbaraton.shop";
  }

  if (key === "GOOGLE_CLOUD_PRIVATE_KEY") {
    value = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    if (!value.includes("\\n")) {
      value = value.replace(/\n/g, "\\n");
    }
    lines.push(`${key}="${value}"`);
    continue;
  }

  if (/[\s#"']/.test(value)) {
    lines.push(`${key}=${JSON.stringify(value)}`);
  } else {
    lines.push(`${key}=${value}`);
  }
}

const outPath = path.join(process.cwd(), ".env.vercel");
fs.writeFileSync(outPath, `${lines.join("\n")}\n`, "utf8");
console.log(
  JSON.stringify(
    {
      wrote: outPath,
      count: lines.length,
      keys: lines.map((line) => line.split("=")[0]),
    },
    null,
    2,
  ),
);
