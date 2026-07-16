-- Cleanup: remove AI Creative Engine (generated images) + legacy marketplace table.
-- Higlou no longer generates creative packs / studio images.
-- Keep: products, product_images (upload), analysis caches, ai_usage, db_products, orders.

-- Drop dependent creative tables first
drop table if exists public.creative_usage_events cascade;
drop table if exists public.creative_approval_events cascade;
drop table if exists public.creative_jobs cascade;
drop table if exists public.creative_assets cascade;
drop table if exists public.creative_packs cascade;
drop table if exists public.product_truth_records cascade;
drop table if exists public.creative_source_images cascade;

-- Legacy storefront table (replaced by db_products / db_product_images)
drop table if exists public.don_baraton_listings cascade;

-- Optional: clear orphaned creative cost rows already gone with tables above.
-- Storage: keep buckets `product-images` and `don-baraton-images` (real uploads).
-- If you created a separate creative/studio bucket, delete it in Storage dashboard.
