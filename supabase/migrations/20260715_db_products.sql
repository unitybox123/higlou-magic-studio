-- Don Baraton catalog: products + images (independent of Higlou products FK)
-- Same Supabase project as Higlou; Don Baraton app reads/writes via service role.

create table if not exists public.db_products (
  id uuid primary key default gen_random_uuid(),
  higlou_product_id uuid references public.products (id) on delete set null,
  slug text not null unique,
  title text not null,
  subtitle text not null default '',
  brand text not null default '',
  sku text not null default '',
  ebay_category_id text not null default '',
  leaf_category_name text not null default '',
  category_slug text not null default 'more',
  category_name text not null default 'More',
  condition text not null default 'New',
  price numeric(12, 2) not null check (price > 0),
  currency text not null default 'USD',
  quantity integer not null default 1 check (quantity >= 0),
  description_html text not null default '',
  description_summary text not null default '',
  item_specifics jsonb not null default '[]'::jsonb,
  features jsonb not null default '[]'::jsonb,
  colors jsonb not null default '[]'::jsonb,
  materials jsonb not null default '[]'::jsonb,
  size text not null default '',
  product_type text not null default '',
  free_shipping boolean not null default false,
  shipping_cost numeric(12, 2),
  item_location text not null default '',
  postal_code text not null default '',
  status text not null default 'active'
    check (status in ('draft', 'active', 'sold', 'hidden')),
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists db_products_sku_unique
  on public.db_products (lower(sku))
  where sku <> '';

create index if not exists db_products_category_idx
  on public.db_products (category_slug, status);

create index if not exists db_products_published_idx
  on public.db_products (published_at desc)
  where status = 'active';

create index if not exists db_products_search_idx
  on public.db_products using gin (
    to_tsvector(
      'english',
      coalesce(title, '') || ' ' || coalesce(brand, '') || ' ' || coalesce(description_summary, '')
    )
  );

create table if not exists public.db_product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.db_products (id) on delete cascade,
  url text not null,
  storage_path text not null default '',
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists db_product_images_product_idx
  on public.db_product_images (product_id, sort_order);

-- Keep only one primary per product (soft via unique partial index)
create unique index if not exists db_product_images_one_primary
  on public.db_product_images (product_id)
  where is_primary = true;

alter table public.db_products enable row level security;
alter table public.db_product_images enable row level security;

-- Public storefront: read active products
drop policy if exists db_products_public_read on public.db_products;
create policy db_products_public_read on public.db_products
  for select
  using (status = 'active');

drop policy if exists db_product_images_public_read on public.db_product_images;
create policy db_product_images_public_read on public.db_product_images
  for select
  using (
    exists (
      select 1 from public.db_products p
      where p.id = product_id and p.status = 'active'
    )
  );

-- Authenticated sellers can manage (Higlou users); service role bypasses RLS
drop policy if exists db_products_authenticated_all on public.db_products;
create policy db_products_authenticated_all on public.db_products
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists db_product_images_authenticated_all on public.db_product_images;
create policy db_product_images_authenticated_all on public.db_product_images
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Storage bucket for Don Baraton images (public read)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'don-baraton-images',
  'don-baraton-images',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set public = excluded.public;

drop policy if exists don_baraton_images_public_read on storage.objects;
create policy don_baraton_images_public_read on storage.objects
  for select
  using (bucket_id = 'don-baraton-images');

drop policy if exists don_baraton_images_auth_write on storage.objects;
create policy don_baraton_images_auth_write on storage.objects
  for insert
  with check (
    bucket_id = 'don-baraton-images'
    and auth.role() in ('authenticated', 'service_role')
  );

drop policy if exists don_baraton_images_auth_update on storage.objects;
create policy don_baraton_images_auth_update on storage.objects
  for update
  using (
    bucket_id = 'don-baraton-images'
    and auth.role() in ('authenticated', 'service_role')
  );

drop policy if exists don_baraton_images_auth_delete on storage.objects;
create policy don_baraton_images_auth_delete on storage.objects
  for delete
  using (
    bucket_id = 'don-baraton-images'
    and auth.role() in ('authenticated', 'service_role')
  );
