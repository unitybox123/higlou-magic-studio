const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const { ImageAnnotatorClient } = require("@google-cloud/vision");

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) throw new Error(".env.local missing");
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    value = value.replace(/\\n/g, "\n");
    if (!process.env[key]) process.env[key] = value;
  }
}

function ok(label, detail) {
  console.log(`PASS  ${label}${detail ? ` — ${detail}` : ""}`);
}
function fail(label, detail) {
  console.error(`FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  loadEnvLocal();
  let failures = 0;

  // OpenAI
  try {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY missing");
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const count = Array.isArray(data.data) ? data.data.length : 0;
    ok("OpenAI API", `${count} models reachable`);
  } catch (e) {
    failures += 1;
    fail("OpenAI API", e.message);
  }

  // Google Vision Service Account
  try {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const clientEmail = process.env.GOOGLE_CLOUD_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY;
    if (!projectId || !clientEmail || !privateKey) {
      throw new Error("Vision Service Account env incomplete");
    }
    const client = new ImageAnnotatorClient({
      projectId,
      credentials: { client_email: clientEmail, private_key: privateKey },
    });
    // Tiny 1x1 PNG
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const [result] = await client.textDetection({
      image: { content: png.toString("base64") },
    });
    ok(
      "Google Vision API",
      `Service Account auth ok (annotations=${result.textAnnotations?.length ?? 0})`,
    );
  } catch (e) {
    failures += 1;
    fail("Google Vision API", e.message);
  }

  // Supabase Auth/DB + Storage
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const bucket = process.env.SUPABASE_PRODUCT_IMAGES_BUCKET || "product-images";
    if (!url || !anon || !service) throw new Error("Supabase env incomplete");

    const admin = createClient(url, service, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: buckets, error: listError } = await admin.storage.listBuckets();
    if (listError) throw listError;
    const found = (buckets || []).find((b) => b.name === bucket);
    if (!found) throw new Error(`Bucket ${bucket} not found`);
    if (!found.public) throw new Error(`Bucket ${bucket} is not public`);

    const probePath = `health-check/${Date.now()}.txt`;
    const upload = await admin.storage
      .from(bucket)
      .upload(probePath, Buffer.from("higlou-ok"), {
        contentType: "text/plain",
        upsert: true,
      });
    if (upload.error) throw upload.error;

    const publicUrl = `${url.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${probePath}`;
    const fetchRes = await fetch(publicUrl);
    if (!fetchRes.ok) {
      throw new Error(`Public URL fetch failed HTTP ${fetchRes.status}`);
    }
    await admin.storage.from(bucket).remove([probePath]);

    // Core tables
    for (const table of [
      "users",
      "products",
      "ai_usage_events",
      "image_analysis_cache",
      "budget_settings",
      "provider_pricing_settings",
    ]) {
      const { error } = await admin.from(table).select("*").limit(1);
      if (error) throw new Error(`Table ${table}: ${error.message}`);
    }

    ok("Supabase + Storage", `public bucket ${bucket} + core tables`);
  } catch (e) {
    failures += 1;
    fail("Supabase + Storage", e.message);
  }

  // Template seed
  try {
    const templatePath = path.join(
      process.cwd(),
      "templates",
      "ebay-draft-listing-template.csv",
    );
    if (!fs.existsSync(templatePath)) throw new Error("template file missing");
    const raw = fs.readFileSync(templatePath, "utf8");
    if (!raw.includes("#INFO") || !raw.includes("Template=")) {
      throw new Error("template looks incomplete");
    }
    ok("CSV Template", "official draft seed present");
  } catch (e) {
    failures += 1;
    fail("CSV Template", e.message);
  }

  // Local app health if running
  try {
    const res = await fetch("http://localhost:3000/api/health", {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    ok("Local /api/health", body.service || "ok");
  } catch (e) {
    console.log(`SKIP  Local /api/health — ${e.message}`);
  }

  console.log("");
  if (failures) {
    console.log(`RESULT: ${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("RESULT: all critical checks passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
