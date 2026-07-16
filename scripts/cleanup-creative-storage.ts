/**
 * List storage buckets; remove obvious creative/studio leftovers.
 * Keeps product-images + don-baraton-images.
 *
 * npx tsx --env-file=.env.local scripts/cleanup-creative-storage.ts
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const KEEP = new Set(["product-images", "don-baraton-images"]);

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function listAllFiles(bucket: string, prefix = ""): Promise<string[]> {
  const { data, error } = await admin.storage.from(bucket).list(prefix, {
    limit: 1000,
    sortBy: { column: "name", order: "asc" },
  });
  if (error || !data) return [];
  const paths: string[] = [];
  for (const item of data) {
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    // folders have id null and no metadata typically
    if (item.id === null && !item.metadata) {
      paths.push(...(await listAllFiles(bucket, path)));
    } else {
      paths.push(path);
    }
  }
  return paths;
}

async function main() {
  const { data: buckets, error } = await admin.storage.listBuckets();
  if (error) throw error;

  console.log("Buckets:");
  for (const b of buckets ?? []) {
    const keep = KEEP.has(b.name);
    console.log(`  ${keep ? "KEEP" : "CHECK"}  ${b.name} (public=${b.public})`);
  }

  for (const b of buckets ?? []) {
    if (KEEP.has(b.name)) continue;
    if (!/creative|studio|gen|ai-image|generated/i.test(b.name)) {
      console.log(`\nSkipping bucket (not creative-named): ${b.name}`);
      continue;
    }
    console.log(`\nEmptying creative-named bucket: ${b.name}`);
    const files = await listAllFiles(b.name);
    console.log(`  ${files.length} files`);
    for (let i = 0; i < files.length; i += 100) {
      const chunk = files.slice(i, i + 100);
      const { error: remErr } = await admin.storage.from(b.name).remove(chunk);
      if (remErr) console.log(`  remove error: ${remErr.message}`);
    }
    const { error: delErr } = await admin.storage.deleteBucket(b.name);
    if (delErr) console.log(`  delete bucket: ${delErr.message} (empty it in dashboard if needed)`);
    else console.log(`  deleted bucket ${b.name}`);
  }

  console.log("\nDone. Kept:", [...KEEP].join(", "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
