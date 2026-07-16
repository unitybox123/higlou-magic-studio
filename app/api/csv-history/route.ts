import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.supabase
    .from("generated_csv_files")
    .select("id, file_name, created_at, product_id")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    files: (data ?? []).map((row) => ({
      id: row.id,
      fileName: row.file_name,
      createdAt: row.created_at,
      productId: row.product_id,
    })),
  });
}
