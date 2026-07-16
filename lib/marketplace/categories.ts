import {
  EXTRA_LEAF_NAMES,
  FALLBACK_DEPARTMENT,
  resolveStoreDepartment,
  STORE_DEPARTMENTS,
} from "@/config/store-departments";

export type MarketplaceCategory = {
  slug: string;
  name: string;
  icon: string;
  ebayCategoryIds?: string[];
};

function ebayLeafSlug(categoryId: string, name: string): string {
  const id = String(categoryId).replace(/\D/g, "");
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return base && id ? `${base}-${id}` : id || "more";
}

/** Fallback list (prefer live eBay leaf categories from published listings). */
export const MARKETPLACE_CATEGORIES: MarketplaceCategory[] = [
  { slug: "deals", name: "Deals", icon: "" },
  ...STORE_DEPARTMENTS.map((d) => ({
    slug: d.slug,
    name: d.name,
    icon: "",
    ebayCategoryIds: d.leafIds,
  })),
  {
    slug: FALLBACK_DEPARTMENT.slug,
    name: FALLBACK_DEPARTMENT.name,
    icon: "",
  },
];

/** Browse using eBay leaf Category ID / name (same taxonomy as eBay listings). */
export function resolveMarketplaceCategorySlug(input: {
  categoryId?: string;
  categoryName?: string;
  productType?: string;
  title?: string;
}): { slug: string; name: string; leafName?: string; leafId?: string } {
  const resolved = resolveStoreDepartment({
    categoryId: input.categoryId,
    categoryName: input.categoryName,
    productType: input.productType,
    title: input.title,
  });
  const leafId =
    String(input.categoryId || resolved.leafId || "").replace(/\D/g, "") ||
    resolved.leafId;
  const leafName =
    EXTRA_LEAF_NAMES[leafId] ||
    resolved.leafName ||
    input.categoryName ||
    "General";
  return {
    slug: ebayLeafSlug(leafId, leafName),
    name: leafName,
    leafName,
    leafId,
  };
}

export function slugifyListingTitle(title: string, id: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return base ? `${base}-${id.slice(0, 8)}` : id.slice(0, 12);
}
