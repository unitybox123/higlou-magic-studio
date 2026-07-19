/**
 * Don Baratón storefront sync (www.donbaraton.shop).
 * Contract: same eBay Seller Hub / Create Drafts CSV as Admin → Importar eBay.
 */

export type DonBaratonConfig = {
  apiUrl: string;
  importToken: string;
  enabled: boolean;
};

export function getDonBaratonConfig(): DonBaratonConfig {
  const apiUrl = (
    process.env.DON_BARATON_API_URL ||
    process.env.DON_BARATON_URL ||
    process.env.NEXT_PUBLIC_DON_BARATON_URL ||
    ""
  )
    .trim()
    .replace(/\/$/, "");

  const importToken = (
    process.env.DON_BARATON_IMPORT_TOKEN ||
    process.env.DON_BARATON_SYNC_TOKEN ||
    ""
  ).trim();

  const flag = (process.env.DON_BARATON_SYNC_ENABLED || "true").trim().toLowerCase();
  const enabled = flag !== "0" && flag !== "false" && flag !== "off";

  return {
    apiUrl,
    importToken,
    enabled: enabled && Boolean(apiUrl && importToken),
  };
}
