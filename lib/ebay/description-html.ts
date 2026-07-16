import {
  STORE_BRANDING_DEFAULTS,
  type StoreBranding,
} from "@/config/store-branding";

export interface DescriptionSpec {
  label: string;
  value: string;
}

export interface DescriptionContent {
  productTitle: string;
  productIntroduction: string;
  features: string[];
  itemCondition: string;
  packageContents: string[];
  shippingInformation?: string;
  /** @deprecated Returns are not shown — Higlou Store has no return policy copy yet. */
  returnAndWarrantyInformation?: string;
  specs?: DescriptionSpec[];
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function listItems(items: string[], emptyFallback: string): string {
  if (!items.length) {
    return `<li style="margin:0 0 8px 0;color:#444444;">${escapeHtml(emptyFallback)}</li>`;
  }
  return items
    .map(
      (item) =>
        `<li style="margin:0 0 8px 0;color:#333333;">${escapeHtml(item)}</li>`,
    )
    .join("");
}

function buildSpecsTable(specs: DescriptionSpec[]): string {
  const rows = specs
    .filter((s) => s.label.trim() && s.value.trim())
    .slice(0, 10);
  if (!rows.length) return "";

  const cells = rows
    .map(
      (spec, index) => {
        const bg = index % 2 === 0 ? "#fafafa" : "#ffffff";
        return `<tr>
        <td style="padding:10px 14px;border-bottom:1px solid #eeeeee;background:${bg};width:38%;font-size:13px;font-weight:700;color:#666666;text-transform:uppercase;letter-spacing:0.4px;">${escapeHtml(spec.label)}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #eeeeee;background:${bg};font-size:14px;color:#111111;font-weight:600;">${escapeHtml(spec.value)}</td>
      </tr>`;
      },
    )
    .join("");

  return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;margin:0 0 26px 0;border:1px solid #ececec;">
  <tr>
    <td colspan="2" style="padding:12px 14px;background:#111111;color:#ffffff;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Product Details</td>
  </tr>
  ${cells}
</table>`;
}

/**
 * Official Higlou Store eBay description HTML.
 * Inline styles only (Seller Hub safe). No Returns section — store has none configured.
 */
export function buildHiglouDescriptionHtml(
  content: DescriptionContent,
  branding: StoreBranding = STORE_BRANDING_DEFAULTS,
): string {
  const storeName = branding.storeName || STORE_BRANDING_DEFAULTS.storeName;
  const storeDisplay =
    branding.storeNameDisplay || storeName.toUpperCase();
  const slogan = branding.slogan || STORE_BRANDING_DEFAULTS.slogan;
  const thankYou =
    branding.thankYouMessage ||
    `Thank You for Shopping With ${storeName}`;
  const thankYouSub =
    branding.thankYouSubtext || STORE_BRANDING_DEFAULTS.thankYouSubtext;
  const shipping =
    content.shippingInformation ||
    branding.shippingInformation ||
    STORE_BRANDING_DEFAULTS.shippingInformation;
  const colors = branding.colors || STORE_BRANDING_DEFAULTS.colors;
  const accent = colors.accent || "#f4c928";
  const specsHtml = buildSpecsTable(content.specs ?? []);

  return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:880px;width:100%;margin:0 auto;font-family:Arial,Helvetica,sans-serif;color:${colors.bodyText};line-height:1.55;background:#ffffff;border:1px solid ${colors.border};">
  <tr>
    <td style="height:5px;line-height:5px;font-size:0;background:${accent};">&nbsp;</td>
  </tr>
  <tr>
    <td style="background:${colors.headerBackground};padding:28px 32px;text-align:center;">
      <div style="font-size:28px;font-weight:700;letter-spacing:3px;color:${colors.headerText};">${escapeHtml(storeDisplay)}</div>
      <div style="margin:10px auto 0 auto;width:48px;height:3px;background:${accent};"></div>
      <div style="font-size:13px;margin-top:12px;color:#cfcfcf;letter-spacing:0.3px;">${escapeHtml(slogan)}</div>
    </td>
  </tr>
  <tr>
    <td style="padding:32px 30px 10px 30px;">
      <h1 style="font-size:24px;line-height:1.3;margin:0 0 14px 0;color:#111111;font-weight:700;">${escapeHtml(content.productTitle)}</h1>
      <p style="font-size:15px;margin:0 0 24px 0;color:#444444;">${escapeHtml(content.productIntroduction)}</p>
      ${specsHtml}
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;margin:0 0 26px 0;border-collapse:collapse;">
        <tr>
          <td style="width:4px;background:${accent};"></td>
          <td style="background:#f8f8f8;padding:18px 20px;">
            <div style="font-size:14px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#111111;margin:0 0 10px 0;">Product Highlights</div>
            <ul style="margin:0;padding-left:18px;">${listItems(content.features, "See photos and details for key features.")}</ul>
          </td>
        </tr>
      </table>
      <div style="font-size:14px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#111111;margin:0 0 8px 0;padding-bottom:6px;border-bottom:2px solid ${accent};display:inline-block;">Condition</div>
      <p style="font-size:14px;margin:10px 0 22px 0;color:#333333;">${escapeHtml(content.itemCondition || "See condition details in the listing.")}</p>
      <div style="font-size:14px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#111111;margin:0 0 8px 0;padding-bottom:6px;border-bottom:2px solid ${accent};display:inline-block;">What&#39;s Included</div>
      <ul style="margin:10px 0 22px 0;padding-left:18px;">${listItems(content.packageContents, "See listing photos for package contents.")}</ul>
      <div style="font-size:14px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#111111;margin:0 0 8px 0;padding-bottom:6px;border-bottom:2px solid ${accent};display:inline-block;">Shipping &amp; Service</div>
      <p style="font-size:14px;margin:10px 0 8px 0;color:#333333;">${escapeHtml(shipping)}</p>
      <p style="font-size:13px;margin:0 0 8px 0;color:#777777;">Please review photos carefully — what you see is what you receive.</p>
    </td>
  </tr>
  <tr>
    <td style="padding:0 30px 30px 30px;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="height:3px;line-height:3px;font-size:0;background:${accent};">&nbsp;</td>
        </tr>
        <tr>
          <td style="background:${colors.headerBackground};padding:24px 22px;text-align:center;">
            <div style="font-size:18px;font-weight:700;color:${colors.headerText};">${escapeHtml(thankYou)}</div>
            <div style="font-size:13px;margin-top:8px;color:#d0d0d0;">${escapeHtml(thankYouSub)}</div>
            <div style="font-size:12px;margin-top:12px;color:${accent};letter-spacing:1px;text-transform:uppercase;">${escapeHtml(storeDisplay)}</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}
