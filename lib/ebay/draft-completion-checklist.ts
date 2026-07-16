import { DEFAULT_VALUES } from "@/config/default-values";
import { findShippingServiceOption } from "@/config/shipping-services";
import { resolveCategorySpecifics } from "@/config/category-specifics";

export type EbayDraftManualStep = {
  id: string;
  label: string;
  value: string;
  reason: string;
};

/** Fields eBay Create Drafts CSV cannot pre-fill — user completes in Seller Hub. */
export function buildEbayDraftManualSteps(input: {
  itemLocation?: string;
  postalCode?: string;
  shippingService?: string;
  packageWeightLbs?: number;
  packageWeightOz?: number;
  packageDims?: string;
  categoryId?: string;
  itemSpecifics?: Array<{ key: string; label?: string; value?: string }>;
}): EbayDraftManualStep[] {
  const location = input.itemLocation?.trim() || DEFAULT_VALUES.itemLocation;
  const postal = input.postalCode?.trim() || DEFAULT_VALUES.postalCode;
  const serviceOption = findShippingServiceOption(input.shippingService);
  const serviceLabel =
    serviceOption?.label ||
    (input.shippingService?.trim() ? input.shippingService.trim() : "USPS Ground Advantage");

  const weight =
    input.packageWeightLbs != null
      ? `${input.packageWeightLbs} lb${input.packageWeightOz ? ` ${input.packageWeightOz} oz` : ""}`
      : null;

  const missingRequiredSpecifics: string[] = [];
  if (input.categoryId) {
    const family = resolveCategorySpecifics(input.categoryId);
    const filled = new Set(
      (input.itemSpecifics ?? [])
        .filter((f) => f.value?.trim())
        .map((f) => f.key),
    );
    for (const field of family.fields) {
      if (!field.required) continue;
      const col = field.csvColumn.startsWith("C:")
        ? field.csvColumn
        : `C:${field.csvColumn}`;
      if (!filled.has(col) && !filled.has(field.csvColumn)) {
        missingRequiredSpecifics.push(field.label);
      }
    }
  }

  const specificsValue =
    missingRequiredSpecifics.length > 0
      ? `Fill required: ${missingRequiredSpecifics.join(", ")}`
      : "Confirm all required fields for this category";

  return [
    {
      id: "location",
      label: "Item location",
      value: `${location} · ${postal}`,
      reason: "Not supported on Create Drafts CSV",
    },
    {
      id: "shipping",
      label: "Shipping service",
      value: [
        serviceLabel,
        weight ? `Package ${weight}` : null,
        input.packageDims ? `Dims ${input.packageDims}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      reason: "Not supported on Create Drafts CSV",
    },
    {
      id: "returns",
      label: "Domestic return policy",
      value: "Choose your return policy when completing the draft",
      reason: "Not supported on Create Drafts CSV",
    },
    {
      id: "specifics",
      label: "Item specifics",
      value: specificsValue,
      reason: "Some required fields may still need review on eBay",
    },
  ];
}

export const EBAY_CREATE_DRAFTS_INCLUDES = [
  "Title, category, price, quantity",
  "Photos and HTML description",
  "Condition and listing format",
  "Item specifics (C: columns when filled)",
] as const;
