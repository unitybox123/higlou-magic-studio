import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { buildAttachmentContentDisposition } from "@/lib/ebay/listing-helpers";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const { data, error } = await auth.supabase
    .from("generated_csv_files")
    .select("file_name, content")
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "CSV file not found" }, { status: 404 });
  }

  return new NextResponse(data.content, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": buildAttachmentContentDisposition(
        data.file_name || "Higlou_Export.csv",
      ),
    },
  });
}
