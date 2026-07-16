export type EbayTemplateType = "draft_listing" | "new_listing" | "unknown";

export interface EbayTemplateMeta {
  rawInfoLine: string;
  version: string;
  templateName: string;
  templateType: EbayTemplateType;
  headers: string[];
  actionHeader: string;
  sha256: string;
}

export interface EbayCsvGenerationInput {
  action: "Draft" | "Add" | "Revise";
  sku: string;
  categoryId: string;
  title: string;
  upc: string;
  price: number | null;
  quantity: number;
  itemPhotoUrls: string[];
  conditionId: string;
  descriptionHtml: string;
  format: string;
  itemSpecifics: Record<string, string>;
  policyValues: Record<string, string>;
}

export const OFFICIAL_DRAFT_TEMPLATE_HEADERS = [
  "Action(SiteID=US|Country=US|Currency=USD|Version=1193|CC=UTF-8)",
  "Custom label (SKU)",
  "Category ID",
  "Title",
  "UPC",
  "Price",
  "Quantity",
  "Item photo URL",
  "Condition ID",
  "Description",
  "Format",
] as const;

/** Exact official eBay Create New Drafts seed (do not rewrite INFO/header bytes). */
export const EXPECTED_SEED_TEMPLATE_SHA256 =
  "E8840560B3359BAB0825F1BEE48DAD3F4C58D6AF9BC2B412630FB928C4793C3A";

/** Higlou publish-ready Create/Schedule template (shipping + weight + location). */
export const EXPECTED_CREATE_LISTING_TEMPLATE_SHA256 =
  "150C7C5A5B51DB7874FB299F3D5F152CDB3E0D4C633F875A2292AB13450663A5";

export const PUBLISH_READY_TEMPLATE_HEADERS = [
  "Action(SiteID=US|Country=US|Currency=USD|Version=1193|CC=UTF-8)",
  "Custom label (SKU)",
  "Category ID",
  "Title",
  "UPC",
  "Price",
  "Quantity",
  "Item photo URL",
  "Condition ID",
  "Description",
  "Format",
  "Duration",
  "PostalCode",
  "Country",
  "CountryCode",
  "DispatchTimeMax",
  "ShippingType",
  "Shipping service 1 option",
  "Shipping service 1 cost",
  "Shipping service 1 priority",
  "WeightMajor",
  "WeightMinor",
  "WeightUnit",
  "PackageType",
  "MeasurementSystem",
  "PackageLength",
  "PackageWidth",
  "PackageDepth",
  "ReturnsAcceptedOption",
  "Shipping profile name",
  "Return profile name",
  "Payment profile name",
] as const;
