import type { ValidationItem } from "@/components/validation/validation-checklist";
import type { ProductListing } from "@/types/product";
import type { AnalysisCostEstimate } from "@/components/listing/analysis-cost-panel";

export type WorkspacePhase =
  | "uploading"
  | "analyzing"
  | "analysisComplete"
  | "reviewing";

export type ReviewFieldId =
  | "title"
  | "price"
  | "category"
  | "condition"
  | "quantity";

export type AttentionField = {
  id: ReviewFieldId;
  label: string;
  reason: string;
};

export const PHOTO_ROLE_LABELS = [
  "Main",
  "Front",
  "Back",
  "Material",
  "Accessories",
  "Lifestyle",
  "Package",
] as const;

export const TITLE_HELPER_ACTIONS = [
  {
    label: "SEO",
    instruction:
      "Make the title more SEO friendly for eBay search without inventing facts",
  },
  {
    label: "Premium",
    instruction:
      "Make the title sound more premium and upscale without inventing facts",
  },
  {
    label: "Short",
    instruction:
      "Shorten the title while keeping the most important selling points, max 80 characters",
  },
  {
    label: "Clickable",
    instruction:
      "Make the title more clickable and compelling without inventing facts",
  },
] as const;

export function getPhotoRoleLabel(index: number, isPrimary: boolean): string {
  if (isPrimary || index === 0) return "Main";
  const role = PHOTO_ROLE_LABELS[Math.min(index, PHOTO_ROLE_LABELS.length - 1)];
  if (index >= PHOTO_ROLE_LABELS.length) return `Photo ${index + 1}`;
  return role;
}

export function getAttentionFields(listing: ProductListing): AttentionField[] {
  const fields: AttentionField[] = [];

  if (!listing.title.trim()) {
    fields.push({ id: "title", label: "Title", reason: "Required" });
  } else if (listing.title.length > 80) {
    fields.push({ id: "title", label: "Title", reason: "Over 80 characters" });
  }

  if (!(typeof listing.price === "number" && listing.price > 0)) {
    fields.push({ id: "price", label: "Price", reason: "Required" });
  }

  if (!/^\d{3,8}$/.test(String(listing.categoryId || "").trim())) {
    fields.push({
      id: "category",
      label: "Category",
      reason: "Needs a valid eBay leaf ID",
    });
  }

  if (!listing.condition || !listing.conditionId) {
    fields.push({ id: "condition", label: "Condition", reason: "Required" });
  }

  if (!(Number.isInteger(listing.quantity) && listing.quantity >= 1)) {
    fields.push({ id: "quantity", label: "Quantity", reason: "Required" });
  }

  return fields;
}

export function getIssueSummaries(
  validationItems: ValidationItem[],
): string[] {
  return validationItems
    .filter((item) => !item.ok)
    .map((item) => item.label)
    .slice(0, 6);
}

export function formatCostEstimate(
  estimate: AnalysisCostEstimate | null,
): string | null {
  if (!estimate) return null;
  if (estimate.cacheHit) return "$0 (cache)";
  if (typeof estimate.openai === "number") {
    return `~$${estimate.openai.toFixed(3)}`;
  }
  return null;
}

export function estimateAnalysisMinutes(imageCount: number): string {
  if (imageCount <= 2) return "~30 sec";
  if (imageCount <= 5) return "~1 min";
  return "~2 min";
}

export function isCategoryPerfectMatch(listing: ProductListing): boolean {
  return /^\d{3,8}$/.test(String(listing.categoryId || "").trim()) &&
    Boolean(listing.categoryName?.trim());
}
