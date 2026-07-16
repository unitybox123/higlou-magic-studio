import { randomUUID } from "crypto";
import {
  resolveMarketplaceCategorySlug,
  slugifyListingTitle,
} from "@/lib/marketplace/categories";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PublishToDonBaratonInput = {
  productId: string;
  userId: string;
};

type DbProductRef = {
  id: string;
  slug: string;
  published_at: string;
};

/** Public listing shape shared with Don Baraton storefront / sync API. */
export type PublicMarketplaceListingPayload = {
  id: string;
  slug: string;
  productId: string;
  title: string;
  subtitle: string;
  brand: string;
  sku: string;
  ebayCategoryId: string;
  leafCategoryName: string;
  categorySlug: string;
  categoryName: string;
  condition: string;
  price: number;
  currency: string;
  quantity: number;
  descriptionSummary: string;
  descriptionHtml: string;
  itemSpecifics: unknown;
  features: string[];
  colors: string[];
  materials: string[];
  size: string;
  productType: string;
  primaryImageUrl: string;
  imageUrls: string[];
  freeShipping: boolean;
  shippingCost: number | null;
  itemLocation: string;
  postalCode: string;
  publishedAt: string;
};

/** @deprecated Use PublicMarketplaceListingPayload — kept for list API mappers */
export type DonBaratonListingRow = {
  id: string;
  product_id: string;
  seller_id?: string;
  slug: string;
  title: string;
  subtitle: string;
  brand: string;
  sku: string;
  category_slug: string;
  category_name: string;
  ebay_category_id: string;
  leaf_category_name?: string;
  condition: string;
  condition_id?: string;
  price: number;
  compare_at_price?: number | null;
  currency: string;
  quantity: number;
  description_html: string;
  description_summary: string;
  item_specifics: unknown;
  features: unknown;
  colors: unknown;
  materials: unknown;
  size: string;
  product_type: string;
  primary_image_url: string;
  image_urls: string[];
  free_shipping: boolean;
  shipping_cost: number | null;
  item_location: string;
  postal_code: string;
  status: string;
  published_at: string;
  higlou_product_id?: string | null;
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v));
}

async function replaceDbProductImages(
  supabase: SupabaseClient,
  productId: string,
  urls: string[],
) {
  await supabase.from("db_product_images").delete().eq("product_id", productId);
  const unique = [...new Set(urls.map((u) => u.trim()).filter(Boolean))];
  if (!unique.length) return;
  const rows = unique.map((url, index) => ({
    product_id: productId,
    url,
    storage_path: "",
    sort_order: index,
    is_primary: index === 0,
  }));
  const { error } = await supabase.from("db_product_images").insert(rows);
  if (error) throw new Error(error.message);
}

/**
 * Publish a Higlou product into Don Baraton (`db_products` + images)
 * and mirror to the local storefront sync API.
 */
export async function publishProductToDonBaraton(
  supabase: SupabaseClient,
  input: PublishToDonBaratonInput,
): Promise<PublicMarketplaceListingPayload> {
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("*")
    .eq("id", input.productId)
    .eq("user_id", input.userId)
    .single();

  if (productError || !product) {
    throw new Error("Product not found or access denied");
  }

  const { data: images, error: imagesError } = await supabase
    .from("product_images")
    .select("public_url, sort_order, is_primary")
    .eq("product_id", input.productId)
    .order("sort_order", { ascending: true });

  if (imagesError) {
    throw new Error("Failed to load product images");
  }

  const imageUrls = (images ?? [])
    .map((img) => img.public_url as string)
    .filter(Boolean);
  const primary =
    images?.find((img) => img.is_primary)?.public_url ||
    imageUrls[0] ||
    "";

  if (!primary) {
    throw new Error("Add at least one photo before publishing to Don Baraton");
  }

  if (product.price == null || Number(product.price) <= 0) {
    throw new Error("Set a price before publishing to Don Baraton");
  }

  const category = resolveMarketplaceCategorySlug({
    categoryId: product.category_id,
    categoryName: product.category_name,
    productType: product.product_type,
    title: product.title,
  });

  let existing: DbProductRef | null = null;

  {
    const byHiglou = await supabase
      .from("db_products")
      .select("id, slug, published_at")
      .eq("higlou_product_id", input.productId)
      .maybeSingle();
    if (byHiglou.data) existing = byHiglou.data;
  }

  // Prefer updating a CSV-imported row with the same SKU / title (avoid unique sku clash).
  if (!existing && product.sku) {
    const bySku = await supabase
      .from("db_products")
      .select("id, slug, published_at")
      .ilike("sku", String(product.sku))
      .maybeSingle();
    if (bySku.data) existing = bySku.data;
  }
  if (!existing && product.title) {
    const byTitle = await supabase
      .from("db_products")
      .select("id, slug, published_at")
      .ilike("title", String(product.title))
      .limit(1)
      .maybeSingle();
    if (byTitle.data) existing = byTitle.data;
  }

  const dbId = existing?.id || randomUUID();
  const slug =
    existing?.slug ||
    slugifyListingTitle(product.title || "listing", input.productId);
  const publishedAt = existing?.published_at || new Date().toISOString();

  const row = {
    id: dbId,
    higlou_product_id: input.productId,
    slug,
    title: product.title,
    subtitle: product.subtitle ?? "",
    brand: product.brand ?? "",
    sku: product.sku ?? "",
    ebay_category_id: product.category_id ?? "",
    leaf_category_name:
      category.leafName || product.category_name || "",
    category_slug: category.slug,
    category_name: category.name,
    condition: product.condition ?? "New",
    price: Number(product.price),
    currency: "USD",
    quantity: product.quantity ?? 1,
    description_html: product.description_html ?? "",
    description_summary: product.description_summary ?? "",
    item_specifics: product.item_specifics ?? [],
    features: product.features ?? [],
    colors: product.colors ?? [],
    materials: product.materials ?? [],
    size: product.size ?? "",
    product_type: product.product_type ?? "",
    free_shipping: false,
    shipping_cost: null,
    item_location: product.item_location ?? "",
    postal_code: product.postal_code ?? "",
    status: "active",
    published_at: publishedAt,
    updated_at: new Date().toISOString(),
  };

  const { data: saved, error: upsertError } = await supabase
    .from("db_products")
    .upsert(row, { onConflict: "id" })
    .select("*")
    .single();

  if (upsertError || !saved) {
    throw new Error(upsertError?.message || "Failed to publish listing");
  }

  await replaceDbProductImages(supabase, dbId, imageUrls);

  await supabase
    .from("products")
    .update({
      status: "Published",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.productId)
    .eq("user_id", input.userId);

  const listing: PublicMarketplaceListingPayload = {
    id: dbId,
    slug,
    productId: input.productId,
    title: String(saved.title),
    subtitle: String(saved.subtitle ?? ""),
    brand: String(saved.brand ?? ""),
    sku: String(saved.sku ?? ""),
    ebayCategoryId: String(saved.ebay_category_id ?? ""),
    leafCategoryName: String(saved.leaf_category_name ?? ""),
    categorySlug: String(saved.category_slug),
    categoryName: String(saved.category_name),
    condition: String(saved.condition ?? "New"),
    price: Number(saved.price),
    currency: String(saved.currency ?? "USD"),
    quantity: Number(saved.quantity ?? 1),
    descriptionSummary: String(saved.description_summary ?? ""),
    descriptionHtml: String(saved.description_html ?? ""),
    itemSpecifics: saved.item_specifics ?? [],
    features: asStringArray(saved.features),
    colors: asStringArray(saved.colors),
    materials: asStringArray(saved.materials),
    size: String(saved.size ?? ""),
    productType: String(saved.product_type ?? ""),
    primaryImageUrl: primary,
    imageUrls,
    freeShipping: Boolean(saved.free_shipping),
    shippingCost:
      saved.shipping_cost == null ? null : Number(saved.shipping_cost),
    itemLocation: String(saved.item_location ?? ""),
    postalCode: String(saved.postal_code ?? ""),
    publishedAt: String(saved.published_at ?? publishedAt),
  };

  // Best-effort mirror into Don Baraton next app (local or remote)
  await mirrorListingToDonBaratonStorefront(listing);

  return listing;
}

async function mirrorListingToDonBaratonStorefront(
  listing: PublicMarketplaceListingPayload,
) {
  const base =
    process.env.DON_BARATON_URL ||
    process.env.NEXT_PUBLIC_DON_BARATON_URL ||
    "http://localhost:3001";
  const token =
    process.env.DON_BARATON_SYNC_TOKEN ||
    process.env.DON_BARATON_ADMIN_PASSWORD ||
    "higlou-admin";

  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/sync/listing`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-don-baraton-sync-token": token,
      },
      body: JSON.stringify({ listing }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      console.warn(
        "[don-baraton sync]",
        body?.error || `HTTP ${res.status}`,
      );
    }
  } catch (error) {
    console.warn(
      "[don-baraton sync] storefront offline",
      error instanceof Error ? error.message : error,
    );
  }
}

export function mapDonBaratonRowToPublicListing(
  row: DonBaratonListingRow,
  extras?: { leafCategoryName?: string },
): PublicMarketplaceListingPayload {
  return {
    id: row.id,
    slug: row.slug,
    productId: row.higlou_product_id || row.product_id,
    title: row.title,
    subtitle: row.subtitle,
    brand: row.brand,
    sku: row.sku,
    ebayCategoryId: row.ebay_category_id,
    leafCategoryName:
      extras?.leafCategoryName || row.leaf_category_name || "",
    categorySlug: row.category_slug,
    categoryName: row.category_name,
    condition: row.condition,
    price: Number(row.price),
    currency: row.currency,
    quantity: row.quantity,
    descriptionSummary: row.description_summary,
    descriptionHtml: row.description_html,
    itemSpecifics: row.item_specifics,
    features: asStringArray(row.features),
    colors: asStringArray(row.colors),
    materials: asStringArray(row.materials),
    size: row.size,
    productType: row.product_type,
    primaryImageUrl: row.primary_image_url,
    imageUrls: Array.isArray(row.image_urls) ? row.image_urls : [],
    freeShipping: row.free_shipping,
    shippingCost: row.shipping_cost,
    itemLocation: row.item_location,
    postalCode: row.postal_code,
    publishedAt: row.published_at,
  };
}

/** Map a `db_products` row (+ image urls) for the Higlou marketplace list API. */
export function mapDbProductRowToPublicListing(
  row: Record<string, unknown>,
  imageUrls: string[] = [],
): PublicMarketplaceListingPayload {
  const primary = imageUrls[0] || "";
  return {
    id: String(row.id),
    slug: String(row.slug),
    productId: String(row.higlou_product_id || row.id),
    title: String(row.title),
    subtitle: String(row.subtitle ?? ""),
    brand: String(row.brand ?? ""),
    sku: String(row.sku ?? ""),
    ebayCategoryId: String(row.ebay_category_id ?? ""),
    leafCategoryName: String(row.leaf_category_name ?? ""),
    categorySlug: String(row.category_slug ?? "more"),
    categoryName: String(row.category_name ?? "More"),
    condition: String(row.condition ?? "New"),
    price: Number(row.price),
    currency: String(row.currency ?? "USD"),
    quantity: Number(row.quantity ?? 1),
    descriptionSummary: String(row.description_summary ?? ""),
    descriptionHtml: String(row.description_html ?? ""),
    itemSpecifics: row.item_specifics ?? [],
    features: asStringArray(row.features),
    colors: asStringArray(row.colors),
    materials: asStringArray(row.materials),
    size: String(row.size ?? ""),
    productType: String(row.product_type ?? ""),
    primaryImageUrl: primary,
    imageUrls,
    freeShipping: Boolean(row.free_shipping),
    shippingCost:
      row.shipping_cost == null ? null : Number(row.shipping_cost),
    itemLocation: String(row.item_location ?? ""),
    postalCode: String(row.postal_code ?? ""),
    publishedAt: String(row.published_at ?? new Date().toISOString()),
  };
}
