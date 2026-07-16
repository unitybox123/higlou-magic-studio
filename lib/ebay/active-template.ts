import { createHash } from "crypto";
import {
  loadSeedTemplateRaw,
  parseEbayTemplate,
} from "@/lib/csv/ebay-template";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ActiveTemplateSource = "database" | "seed";

export type ActiveTemplateResult = {
  raw: string;
  source: ActiveTemplateSource;
  sha256: string;
  templateType: string;
  fileName: string;
  id?: string;
};

/**
 * Load the active eBay CSV template for a user.
 * Prefers the active DB row; falls back to the official seed file.
 */
export async function loadActiveTemplateRaw(
  userId?: string,
): Promise<ActiveTemplateResult> {
  if (userId && isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("ebay_templates")
        .select("id, file_name, raw_content, sha256, template_type, is_active")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data?.raw_content) {
        const parsed = parseEbayTemplate(data.raw_content);
        return {
          raw: data.raw_content,
          source: "database",
          sha256: data.sha256 || parsed.meta.sha256,
          templateType: data.template_type || parsed.meta.templateType,
          fileName: data.file_name,
          id: data.id,
        };
      }
    } catch {
      // Fall through to seed template.
    }
  }

  const raw = loadSeedTemplateRaw();
  const parsed = parseEbayTemplate(raw);
  return {
    raw,
    source: "seed",
    sha256: parsed.meta.sha256,
    templateType: parsed.meta.templateType,
    fileName: "ebay-draft-listing-template.csv",
  };
}

export function sha256Hex(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex").toUpperCase();
}
