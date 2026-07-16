import { resolveCategorySpecifics } from "@/config/category-specifics";

/** Merge listing fields into C:* columns so required specifics export when possible. */
export function enrichItemSpecificsForExport(input: {
  categoryId: string;
  itemSpecifics: Array<{ key: string; value: string }>;
  brand?: string;
  size?: string;
  model?: string;
  mpn?: string;
}): Record<string, string> {
  const columns: Record<string, string> = {};

  for (const specific of input.itemSpecifics) {
    if (!specific.key.startsWith("C:")) continue;
    const value = specific.value.trim();
    if (!value) continue;
    columns[specific.key] = value;
  }

  const family = resolveCategorySpecifics(input.categoryId);
  const derived: Record<string, string | undefined> = {
    brand: input.brand?.trim(),
    size: input.size?.trim(),
    model: input.model?.trim(),
    mpn: input.mpn?.trim(),
  };

  for (const field of family.fields) {
    const column = field.csvColumn.startsWith("C:")
      ? field.csvColumn
      : `C:${field.csvColumn}`;
    if (columns[column]?.trim()) continue;

    const fromListing = derived[field.key]?.trim();
    if (fromListing) {
      columns[column] = fromListing;
      continue;
    }

    // eBay often accepts Unbranded when brand is required but unknown.
    if (field.required && field.key === "brand") {
      columns[column] = "Unbranded";
    }
  }

  return columns;
}
