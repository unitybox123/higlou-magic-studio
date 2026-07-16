/**
 * One-shot Supabase bootstrap: admin user + public product-images bucket.
 * Requires schema.sql already applied in the SQL editor.
 *
 * Usage: npx tsx scripts/setup-supabase.ts
 */
import { createClient } from "@supabase/supabase-js";
import { ACCEPTED_UPLOAD_MIME_TYPES } from "../config/supported-image-formats";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_PRODUCT_IMAGES_BUCKET || "product-images";
const email = process.env.HIGLOU_ADMIN_EMAIL || "admin@ebaygen.com";
const password = process.env.HIGLOU_ADMIN_PASSWORD;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!password) {
  console.error("Missing HIGLOU_ADMIN_PASSWORD env for bootstrap");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function ensureBucket() {
  const { data: buckets, error: listError } = await admin.storage.listBuckets();
  if (listError) throw listError;
  const exists = (buckets ?? []).some((b) => b.name === bucket);
  if (exists) {
    console.log(`Bucket already exists: ${bucket}`);
    return;
  }
  const { error } = await admin.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: 8 * 1024 * 1024,
    allowedMimeTypes: [...ACCEPTED_UPLOAD_MIME_TYPES],
  });
  if (error) throw error;
  console.log(`Created public bucket: ${bucket}`);
}

async function ensureAdminUser() {
  const { data: listed, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listError) throw listError;

  const existing = listed.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );

  let userId = existing?.id;
  if (!existing) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Higlou Admin" },
    });
    if (error) throw error;
    userId = data.user?.id;
    console.log(`Created auth user: ${email}`);
  } else {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (error) throw error;
    console.log(`Updated existing auth user password: ${email}`);
  }

  if (!userId) throw new Error("No user id after create/update");

  const { error: profileError } = await admin.from("users").upsert(
    {
      id: userId,
      email,
      full_name: "Higlou Admin",
    },
    { onConflict: "id" },
  );

  if (profileError) {
    console.error(
      "Profile upsert failed. Apply supabase/schema.sql first:",
      profileError.message,
    );
    process.exit(2);
  }

  console.log(`Profile ready for ${email} (${userId})`);
}

async function main() {
  await ensureBucket();
  await ensureAdminUser();
  console.log("Supabase bootstrap complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
