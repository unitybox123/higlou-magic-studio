import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { requireUser } from "@/lib/auth/require-user";
import {
  createAdminClient,
  isSupabaseConfigured,
} from "@/lib/supabase/admin";
import { isGoogleVisionConfigured } from "@/lib/google-vision/client";
import { STORE_BRANDING_DEFAULTS } from "@/config/store-branding";

export const runtime = "nodejs";

type CheckStatus = "ok" | "warn" | "fail";

type HealthCheck = {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
};

function envPresent(name: string) {
  const value = process.env[name];
  return Boolean(value && value.trim().length > 0);
}

export async function GET() {
  if (isSupabaseConfigured()) {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
  }

  const checks: HealthCheck[] = [];

  // OpenAI
  if (envPresent("OPENAI_API_KEY")) {
    try {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        cache: "no-store",
      });
      checks.push({
        id: "openai",
        label: "OpenAI",
        status: res.ok ? "ok" : "fail",
        detail: res.ok
          ? "Connected and responding"
          : `API responded with ${res.status}`,
      });
    } catch {
      checks.push({
        id: "openai",
        label: "OpenAI",
        status: "fail",
        detail: "Could not reach OpenAI",
      });
    }
  } else {
    checks.push({
      id: "openai",
      label: "OpenAI",
      status: "fail",
      detail: "API key is missing",
    });
  }

  // Google Vision (Service Account only — never API key)
  checks.push({
    id: "google_vision",
    label: "Text Recognition",
    status: isGoogleVisionConfigured() ? "ok" : "warn",
    detail: isGoogleVisionConfigured()
      ? "Service Account configured"
      : "Optional — not configured yet",
  });

  // Supabase
  const supabaseOk = isSupabaseConfigured();
  checks.push({
    id: "supabase",
    label: "Database & Auth",
    status: supabaseOk ? "ok" : "fail",
    detail: supabaseOk ? "Connected" : "Supabase URL or key missing",
  });

  // Storage bucket
  let storageOk = false;
  let storageDetail = "Storage not checked";
  if (supabaseOk && envPresent("SUPABASE_SERVICE_ROLE_KEY")) {
    try {
      const admin = createAdminClient();
      const bucket =
        process.env.SUPABASE_PRODUCT_IMAGES_BUCKET || "product-images";
      const { data, error } = await admin.storage.getBucket(bucket);
      storageOk = Boolean(data) && !error;
      storageDetail = storageOk
        ? `Bucket “${bucket}” ready`
        : error?.message || "Bucket missing";
    } catch (error) {
      storageDetail =
        error instanceof Error ? error.message : "Storage check failed";
    }
  } else {
    storageDetail = "Service role key required for storage check";
  }
  checks.push({
    id: "storage",
    label: "Image Storage",
    status: storageOk ? "ok" : "warn",
    detail: storageDetail,
  });

  // CSV template seed
  const templatePath = path.join(
    process.cwd(),
    "templates",
    "ebay-draft-listing-template.csv",
  );
  let templateOk = existsSync(templatePath);
  let templateDetail = templateOk
    ? "Official draft template loaded"
    : "Seed template file missing";
  if (templateOk) {
    try {
      const raw = readFileSync(templatePath, "utf8");
      if (!raw.includes("#INFO") || !raw.includes("Template=")) {
        templateOk = false;
        templateDetail = "Template file looks incomplete";
      }
    } catch {
      templateOk = false;
      templateDetail = "Could not read template file";
    }
  }
  checks.push({
    id: "template",
    label: "CSV Template",
    status: templateOk ? "ok" : "fail",
    detail: templateDetail,
  });

  // Store branding
  const brandingOk = Boolean(STORE_BRANDING_DEFAULTS.storeName);
  checks.push({
    id: "branding",
    label: "Store Branding",
    status: brandingOk ? "ok" : "warn",
    detail: brandingOk
      ? `${STORE_BRANDING_DEFAULTS.storeName} ready`
      : "Branding defaults missing",
  });

  // Environment essentials
  const requiredEnv = [
    "OPENAI_API_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ];
  const missing = requiredEnv.filter((name) => !envPresent(name));
  checks.push({
    id: "env",
    label: "Environment",
    status: missing.length === 0 ? "ok" : "fail",
    detail:
      missing.length === 0
        ? "Required variables present"
        : `Missing: ${missing.join(", ")}`,
  });

  // Barcode is local — always ready in app build
  checks.push({
    id: "barcode",
    label: "Barcode Scanner",
    status: "ok",
    detail: "Ready on this server",
  });

  const allOk = checks.every((c) => c.status === "ok");
  const hasFail = checks.some((c) => c.status === "fail");

  return NextResponse.json({
    ok: allOk,
    summary: allOk
      ? "Everything is working correctly."
      : hasFail
        ? "Some required systems need attention."
        : "Core systems are ready. Optional services can be improved.",
    checkedAt: new Date().toISOString(),
    checks,
  });
}
