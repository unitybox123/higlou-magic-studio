import { ACCEPTED_UPLOAD_MIME_TYPES } from "@/config/supported-image-formats";

export const DEFAULT_VALUES = {
  quantity: 1,
  listingFormat: "FixedPrice" as const,
  currency: "USD",
  condition: "New",
  conditionId: "NEW",
  /** Higlou warehouse — always used for publish-ready drafts until multi-warehouse exists. */
  itemLocation: "Logansport, IN",
  postalCode: "46947",
  country: "US",
  handlingTime: 1,
  returnPolicyId: "",
  shippingPolicyId: "",
  paymentPolicyId: "",
  maxImages: 12,
  /** Keep room for listing-quality originals (no client downscale). */
  maxImageSizeMb: 20,
  /** Single source of truth: config/supported-image-formats.ts */
  acceptedImageTypes: ACCEPTED_UPLOAD_MIME_TYPES,
  titleMaxLength: 80,
} as const;
