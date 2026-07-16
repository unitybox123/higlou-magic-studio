import { NextResponse } from "next/server";
import { mapDbProductRowToPublicListing } from "@/lib/marketplace/publish-listing";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";
import { DEMO_MARKETPLACE_LISTINGS } from "@/lib/marketplace/demo-listings";

async function fetchImagesByProductIds(
  supabase: ReturnType<typeof createAdminClient>,
  productIds: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (!productIds.length) return map;
  const { data, error } = await supabase
    .from("db_product_images")
    .select("product_id, url, sort_order")
    .in("product_id", productIds)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  for (const row of data || []) {
    const id = String(row.product_id);
    const list = map.get(id) || [];
    if (row.url) list.push(String(row.url));
    map.set(id, list);
  }
  return map;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const q = searchParams.get("q")?.trim();
  const limit = Math.min(Number(searchParams.get("limit") || 24), 48);
  const slug = searchParams.get("slug");

  if (!isSupabaseConfigured()) {
    let items = DEMO_MARKETPLACE_LISTINGS;
    if (slug) {
      const one = items.find((l) => l.slug === slug);
      return NextResponse.json({ listing: one ?? null, source: "demo" });
    }
    if (category && category !== "all") {
      items = items.filter((l) => l.categorySlug === category);
    }
    if (q) {
      const lower = q.toLowerCase();
      items = items.filter(
        (l) =>
          l.title.toLowerCase().includes(lower) ||
          l.brand.toLowerCase().includes(lower),
      );
    }
    return NextResponse.json({
      listings: items.slice(0, limit),
      total: items.length,
      source: "demo",
    });
  }

  const supabase = createAdminClient();

  if (slug) {
    const { data, error } = await supabase
      .from("db_products")
      .select("*")
      .eq("slug", slug)
      .eq("status", "active")
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ listing: null, source: "database" });
    }
    const images = await fetchImagesByProductIds(supabase, [String(data.id)]);
    return NextResponse.json({
      listing: mapDbProductRowToPublicListing(
        data as Record<string, unknown>,
        images.get(String(data.id)) || [],
      ),
      source: "database",
    });
  }

  let query = supabase
    .from("db_products")
    .select("*", { count: "exact" })
    .eq("status", "active")
    .order("published_at", { ascending: false })
    .limit(limit);

  if (category && category !== "all" && category !== "deals") {
    query = query.eq("category_slug", category);
  }

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let rows = (data ?? []) as Record<string, unknown>[];
  if (q) {
    const lower = q.toLowerCase();
    rows = rows.filter((row) => {
      const title = String(row.title || "").toLowerCase();
      const brand = String(row.brand || "").toLowerCase();
      const summary = String(row.description_summary || "").toLowerCase();
      return (
        title.includes(lower) || brand.includes(lower) || summary.includes(lower)
      );
    });
  }

  const ids = rows.map((r) => String(r.id));
  const images = await fetchImagesByProductIds(supabase, ids);

  return NextResponse.json({
    listings: rows.map((row) =>
      mapDbProductRowToPublicListing(row, images.get(String(row.id)) || []),
    ),
    total: q ? rows.length : count ?? rows.length,
    source: "database",
  });
}
