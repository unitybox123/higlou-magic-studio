import { getDonBaratonConfig } from "@/lib/don-baraton/config";

export type DonBaratonImportResult =
  | {
      status: "ok";
      batchId?: string;
      summary?: Record<string, number>;
      message?: string;
    }
  | { status: "skipped"; reason: string }
  | { status: "error"; message: string; httpStatus?: number };

/**
 * Push the exact eBay Create Drafts CSV to Don Baratón.
 * Never throws — callers must not block eBay export on failure.
 */
export async function pushEbayCsvToDonBaraton(
  csv: string,
  fileName: string,
): Promise<DonBaratonImportResult> {
  const config = getDonBaratonConfig();
  if (!config.enabled) {
    return {
      status: "skipped",
      reason: !config.apiUrl
        ? "DON_BARATON_API_URL not set"
        : !config.importToken
          ? "DON_BARATON_IMPORT_TOKEN not set"
          : "DON_BARATON_SYNC_ENABLED is off",
    };
  }

  const endpoint = `${config.apiUrl}/api/admin/import/ebay-csv`;
  const form = new FormData();
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  form.append("file", blob, fileName.endsWith(".csv") ? fileName : `${fileName}.csv`);
  form.append("autoApply", "true");
  form.append("source", "higlou");

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.importToken}`,
      },
      body: form,
    });

    const body = (await res.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
      batchId?: string;
      summary?: Record<string, number>;
      message?: string;
    } | null;

    if (!res.ok) {
      const message =
        body?.error || body?.message || `Don Baratón HTTP ${res.status}`;
      console.error("[don-baraton import]", message);
      return { status: "error", message, httpStatus: res.status };
    }

    return {
      status: "ok",
      batchId: body?.batchId,
      summary: body?.summary,
      message: body?.message,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Don Baratón unreachable";
    console.error("[don-baraton import]", message);
    return { status: "error", message };
  }
}
