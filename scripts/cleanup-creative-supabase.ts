/**
 * Probe + empty creative tables via service role (cannot DROP via PostgREST).
 * Prints which leftover creative_* / don_baraton_listings tables still exist.
 *
 * Usage: npx tsx --env-file=.env.local scripts/cleanup-creative-supabase.ts
 *
 * Then run the DROP migration in Supabase SQL Editor:
 *   supabase/migrations/20260716_drop_creative_engine.sql
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TABLES = [
  "creative_usage_events",
  "creative_approval_events",
  "creative_jobs",
  "creative_assets",
  "creative_packs",
  "product_truth_records",
  "creative_source_images",
  "don_baraton_listings",
] as const;

async function tableStatus(name: string) {
  const { count, error } = await admin
    .from(name)
    .select("*", { count: "exact", head: true });
  if (error) {
    const missing =
      /relation|does not exist|Could not find|PGRST/i.test(error.message) ||
      error.code === "42P01" ||
      error.code === "PGRST205";
    return { name, exists: !missing, count: null as number | null, error: error.message };
  }
  return { name, exists: true, count: count ?? 0, error: null as string | null };
}

async function emptyTable(name: string) {
  const { error } = await admin.from(name).delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) {
    // Some tables may use uuid; try delete all with a filter that always matches
    const { error: err2 } = await admin.from(name).delete().gte("created_at", "1970-01-01");
    if (err2) return err2.message;
  }
  return null;
}

async function main() {
  console.log("Scanning leftover creative / legacy tables…\n");
  const statuses = [];
  for (const name of TABLES) {
    statuses.push(await tableStatus(name));
  }

  for (const s of statuses) {
    if (!s.exists) {
      console.log(`✓ ${s.name} — already gone`);
    } else {
      console.log(`• ${s.name} — EXISTS (${s.count ?? "?"} rows)`);
    }
  }

  const present = statuses.filter((s) => s.exists);
  if (!present.length) {
    console.log("\nNothing to clean. Schema is already lean.");
    return;
  }

  console.log("\nEmptying rows (DROP still requires SQL Editor)…");
  for (const s of present) {
    const err = await emptyTable(s.name);
    if (err) console.log(`  ! ${s.name}: ${err}`);
    else console.log(`  emptied ${s.name}`);
  }

  const sqlPath = resolve("supabase/migrations/20260716_drop_creative_engine.sql");
  const sql = readFileSync(sqlPath, "utf8");
  console.log("\n--- Run this in Supabase → SQL Editor to DROP the tables ---\n");
  console.log(sql);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
