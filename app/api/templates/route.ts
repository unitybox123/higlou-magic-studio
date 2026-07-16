import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import {
  loadActiveTemplateRaw,
  sha256Hex,
} from "@/lib/ebay/active-template";
import { findHeader, parseEbayTemplate } from "@/lib/csv/ebay-template";

const REQUIRED_HEADER_GROUPS: string[][] = [
  ["Action(SiteID=US|Country=US|Currency=USD|Version=1193|CC=UTF-8)", "Action"],
  ["Category ID"],
  ["Title"],
  ["Price"],
  ["Quantity"],
  ["Item photo URL"],
  ["Condition ID", "Condition"],
  ["Description"],
  ["Format"],
];

function validateOfficialTemplate(raw: string) {
  if (!raw.includes("#INFO") && !raw.includes('"#INFO')) {
    throw new Error("Template must include an official #INFO metadata line");
  }

  const parsed = parseEbayTemplate(raw);
  for (const group of REQUIRED_HEADER_GROUPS) {
    if (!findHeader(parsed.meta.headers, group)) {
      throw new Error(
        `Missing required template header: ${group[0]}${group.length > 1 ? ` (or ${group.slice(1).join(" / ")})` : ""}`,
      );
    }
  }

  return parsed;
}

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const [{ data: templates, error }, active] = await Promise.all([
    auth.supabase
      .from("ebay_templates")
      .select(
        "id, file_name, sha256, info_line, template_type, headers, is_active, created_at",
      )
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false }),
    loadActiveTemplateRaw(auth.user.id),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    templates: templates ?? [],
    active: {
      source: active.source,
      sha256: active.sha256,
      templateType: active.templateType,
      fileName: active.fileName,
      id: active.id ?? null,
    },
  });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Upload a CSV file using multipart field 'file'." },
        { status: 400 },
      );
    }

    const raw = await file.text();
    const parsed = validateOfficialTemplate(raw);
    const sha256 = sha256Hex(raw);

    await auth.supabase
      .from("ebay_templates")
      .update({ is_active: false })
      .eq("user_id", auth.user.id)
      .eq("is_active", true);

    const { data: inserted, error } = await auth.supabase
      .from("ebay_templates")
      .insert({
        user_id: auth.user.id,
        file_name: file.name || "ebay-template.csv",
        raw_content: raw,
        sha256,
        info_line: parsed.meta.rawInfoLine,
        template_type: parsed.meta.templateType,
        headers: parsed.meta.headers,
        is_active: true,
      })
      .select(
        "id, file_name, sha256, info_line, template_type, headers, is_active, created_at",
      )
      .single();

    if (error || !inserted) {
      return NextResponse.json(
        { error: error?.message || "Failed to store template" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        template: inserted,
        active: {
          source: "database",
          sha256: inserted.sha256,
          templateType: inserted.template_type,
          fileName: inserted.file_name,
          id: inserted.id,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Template upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
