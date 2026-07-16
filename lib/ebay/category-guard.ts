/**
 * Detect when a model-supplied eBay category clearly disagrees with the product.
 * Used to stop trusting numeric IDs like Fishing (179985) for bottled water.
 */

const FISHING_CATEGORY_IDS = new Set([
  "179985", // Fishing Equipment
  "1492",
  "1497",
  "261980",
]);

const FISHING_NAME =
  /\b(fish(?:ing)?|tackle|lure|bait|rod\b|reel\b|angler|fly\s*fishing|spinning)\b/i;

const BEVERAGE_PRODUCT =
  /\b(aquafina|dasani|fiji|evian|smartwater|poland\s*spring|bottled\s*water|purified\s*water|spring\s*water|soft\s*drink|soda|cola|beverage|juice|energy\s*drink|sports\s*drink|sparkling\s*water|mineral\s*water|fl\s*oz|fluid\s*ounce)\b/i;

const REUSABLE_BOTTLE =
  /\b(tumbler|hydro\s*flask|yeti\s*rambler|stanley\s*cup|insulated\s*(bottle|mug)|reusable\s*water\s*bottle|drinkware|hydration\s*flask|thermos)\b/i;

const SHOE_PRODUCT =
  /\b(sneaker|shoe|trainer|jordan|dunk|loafer|boot|sandal)\b/i;

const BEDDING_PRODUCT =
  /\b(comforter|duvet|bedding|sheet\s*set|pillowcase|quilt)\b/i;

export function productCategoryHaystack(input: {
  categoryName?: string | null;
  productType?: string | null;
  title?: string | null;
  brand?: string | null;
  materials?: string[] | null;
  features?: string[] | null;
}): string {
  return [
    input.categoryName,
    input.productType,
    input.title,
    input.brand,
    ...(input.materials ?? []),
    ...(input.features ?? []),
  ]
    .filter(Boolean)
    .join(" ");
}

/** True when the proposed category should be discarded and re-resolved. */
export function isCategoryProductMismatch(input: {
  categoryId?: string | null;
  categoryName?: string | null;
  productType?: string | null;
  title?: string | null;
  brand?: string | null;
  materials?: string[] | null;
  features?: string[] | null;
}): boolean {
  const id = String(input.categoryId ?? "").trim();
  const name = String(input.categoryName ?? "");
  // Product signals only (exclude the suspect categoryName itself).
  const product = [
    input.productType,
    input.title,
    input.brand,
    ...(input.materials ?? []),
    ...(input.features ?? []),
  ]
    .filter(Boolean)
    .join(" ");

  if (!id && !name) return false;

  const fishingSignal =
    FISHING_CATEGORY_IDS.has(id) || FISHING_NAME.test(name);
  const beverage = BEVERAGE_PRODUCT.test(product);
  const reusable = REUSABLE_BOTTLE.test(product);

  if (fishingSignal && (beverage || reusable)) return true;

  // Soft drinks category is wrong for empty reusable bottles/tumblers.
  if (id === "185035" && reusable && !beverage) return true;

  // Camping bottle leaf for grocery beverages is wrong.
  if (
    (id === "181408" || /canteen|hydration|camping/i.test(name)) &&
    beverage &&
    !reusable
  ) {
    return true;
  }

  // Apparel leaf for shoes when signals are clearly shoes is ok; reverse is mismatch later.
  if (/fish|tackle/i.test(name) && (SHOE_PRODUCT.test(product) || BEDDING_PRODUCT.test(product))) {
    return true;
  }

  // Name says something totally unrelated while product is clearly a beverage.
  if (beverage && name && FISHING_NAME.test(name)) return true;

  return false;
}
