import { z } from "zod";
import type { createClient } from "@/lib/supabase/server";

export const productBodySchema = z.object({
  title: z.string().optional().default(""),
  subtitle: z.string().optional().default(""),
  brand: z.string().optional().default(""),
  collection: z.string().optional().default(""),
  model: z.string().optional().default(""),
  sku: z.string().optional().default(""),
  upc: z.string().optional().default(""),
  mpn: z.string().optional().default(""),
  categoryId: z.string().optional().default(""),
  categoryName: z.string().optional().default(""),
  condition: z.string().optional().default(""),
  conditionId: z.string().optional().default(""),
  conditionDescription: z.string().optional().default(""),
  price: z.number().nullable().optional(),
  quantity: z.number().int().positive().optional().default(1),
  listingFormat: z.string().optional().default("FixedPrice"),
  descriptionHtml: z.string().optional().default(""),
  descriptionSummary: z.string().optional().default(""),
  itemSpecifics: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        value: z.string().optional().default(""),
        required: z.boolean().optional(),
        confidence: z.number().nullable().optional(),
        isCustom: z.boolean().optional(),
      }),
    )
    .optional()
    .default([]),
  features: z.array(z.string()).optional().default([]),
  setIncludes: z.array(z.string()).optional().default([]),
  colors: z.array(z.string()).optional().default([]),
  materials: z.array(z.string()).optional().default([]),
  size: z.string().optional().default(""),
  productType: z.string().optional().default(""),
  shippingPolicyId: z.string().optional().default(""),
  returnPolicyId: z.string().optional().default(""),
  paymentPolicyId: z.string().optional().default(""),
  handlingTime: z.number().int().optional().default(1),
  itemLocation: z.string().optional().default(""),
  postalCode: z.string().optional().default(""),
  country: z.string().optional().default("US"),
  status: z
    .enum([
      "Uploaded",
      "Analyzing",
      "Needs Review",
      "Ready",
      "CSV Generated",
      "Published",
    ])
    .optional()
    .default("Uploaded"),
  images: z
    .array(
      z.object({
        publicUrl: z.string().url(),
        storagePath: z.string(),
        fileName: z.string(),
        sortOrder: z.number().int().optional().default(0),
        isPrimary: z.boolean().optional().default(false),
        mimeType: z.string().optional().default("image/jpeg"),
        sizeBytes: z.number().int().optional().default(0),
      }),
    )
    .optional()
    .default([]),
});

export function mapProductRow(
  row: Record<string, unknown>,
  images: Array<Record<string, unknown>> = [],
  specifics: Array<Record<string, unknown>> = [],
) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    subtitle: row.subtitle,
    brand: row.brand,
    collection: row.collection,
    model: row.model,
    sku: row.sku,
    upc: row.upc,
    mpn: row.mpn,
    categoryId: row.category_id,
    categoryName: row.category_name,
    condition: row.condition,
    conditionId: row.condition_id,
    conditionDescription: row.condition_description,
    price:
      row.price === null || row.price === undefined ? null : Number(row.price),
    quantity: row.quantity,
    listingFormat: row.listing_format,
    descriptionHtml: row.description_html,
    descriptionSummary: row.description_summary,
    itemSpecifics: specifics.length
      ? specifics.map((s) => ({
          key: s.csv_column,
          label: s.label,
          value: s.value,
          required: s.required,
          confidence:
            s.confidence === null || s.confidence === undefined
              ? undefined
              : Number(s.confidence),
          isCustom: s.is_custom,
        }))
      : Array.isArray(row.item_specifics)
        ? row.item_specifics
        : [],
    features: row.features,
    setIncludes: row.set_includes,
    colors: row.colors,
    materials: row.materials,
    size: row.size,
    productType: row.product_type,
    shippingPolicyId: row.shipping_policy_id,
    returnPolicyId: row.return_policy_id,
    paymentPolicyId: row.payment_policy_id,
    handlingTime: row.handling_time,
    itemLocation: row.item_location,
    postalCode: row.postal_code,
    country: row.country,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    images: images.map((img) => ({
      id: img.id,
      url: img.public_url,
      storagePath: img.storage_path,
      fileName: img.file_name,
      sortOrder: img.sort_order,
      isPrimary: img.is_primary,
      mimeType: img.mime_type,
      sizeBytes: img.size_bytes,
    })),
  };
}

export function toDbColumns(data: z.infer<typeof productBodySchema>) {
  return {
    title: data.title,
    subtitle: data.subtitle,
    brand: data.brand,
    collection: data.collection,
    model: data.model,
    sku: data.sku,
    upc: data.upc,
    mpn: data.mpn,
    category_id: data.categoryId,
    category_name: data.categoryName,
    condition: data.condition,
    condition_id: data.conditionId,
    condition_description: data.conditionDescription,
    price: data.price,
    quantity: data.quantity,
    listing_format: data.listingFormat,
    description_html: data.descriptionHtml,
    description_summary: data.descriptionSummary,
    item_specifics: data.itemSpecifics,
    features: data.features,
    set_includes: data.setIncludes,
    colors: data.colors,
    materials: data.materials,
    size: data.size,
    product_type: data.productType,
    shipping_policy_id: data.shippingPolicyId,
    return_policy_id: data.returnPolicyId,
    payment_policy_id: data.paymentPolicyId,
    handling_time: data.handlingTime,
    item_location: data.itemLocation,
    postal_code: data.postalCode,
    country: data.country,
    status: data.status,
    updated_at: new Date().toISOString(),
  };
}

export async function syncRelated(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  productId: string,
  data: z.infer<typeof productBodySchema>,
) {
  if (data.images.length) {
    await supabase.from("product_images").delete().eq("product_id", productId);
    const { error: imageError } = await supabase.from("product_images").insert(
      data.images.map((img, index) => ({
        product_id: productId,
        user_id: userId,
        public_url: img.publicUrl,
        storage_path: img.storagePath,
        file_name: img.fileName,
        sort_order: img.sortOrder ?? index,
        is_primary: img.isPrimary ?? index === 0,
        mime_type: img.mimeType,
        size_bytes: img.sizeBytes,
      })),
    );
    if (imageError) throw new Error(imageError.message);
  }

  if (data.itemSpecifics.length) {
    await supabase
      .from("product_item_specifics")
      .delete()
      .eq("product_id", productId);
    const { error: specificError } = await supabase
      .from("product_item_specifics")
      .insert(
        data.itemSpecifics.map((field) => ({
          product_id: productId,
          csv_column: field.key,
          label: field.label,
          value: field.value ?? "",
          required: field.required ?? false,
          confidence: field.confidence ?? null,
          is_custom: field.isCustom ?? false,
        })),
      );
    if (specificError) throw new Error(specificError.message);
  }
}
