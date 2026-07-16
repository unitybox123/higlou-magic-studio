-- Don Baraton marketplace listings (public storefront synced from Higlou products)

create table if not exists public.don_baraton_listings (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null unique references public.products (id) on delete cascade,
  seller_id uuid not null references public.users (id) on delete cascade,
  slug text not null unique,
  title text not null,
  subtitle text not null default '',
  brand text not null default '',
  sku text not null default '',
  category_slug text not null default 'general',
  category_name text not null default 'General',
  ebay_category_id text not null default '',
  condition text not null default 'New',
  condition_id text not null default 'NEW',
  price numeric(12, 2) not null,
  compare_at_price numeric(12, 2),
  currency text not null default 'USD',
  quantity integer not null default 1,
  description_html text not null default '',
  description_summary text not null default '',
  item_specifics jsonb not null default '[]'::jsonb,
  features jsonb not null default '[]'::jsonb,
  colors jsonb not null default '[]'::jsonb,
  materials jsonb not null default '[]'::jsonb,
  size text not null default '',
  product_type text not null default '',
  primary_image_url text not null,
  image_urls jsonb not null default '[]'::jsonb,
  free_shipping boolean not null default false,
  shipping_cost numeric(12, 2),
  item_location text not null default '',
  postal_code text not null default '',
  status text not null default 'active' check (status in ('draft', 'active', 'sold', 'hidden')),
  view_count integer not null default 0,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists don_baraton_listings_category_idx
  on public.don_baraton_listings (category_slug, status);

create index if not exists don_baraton_listings_published_idx
  on public.don_baraton_listings (published_at desc)
  where status = 'active';

create index if not exists don_baraton_listings_search_idx
  on public.don_baraton_listings using gin (
    to_tsvector(
      'english',
      coalesce(title, '') || ' ' || coalesce(brand, '') || ' ' || coalesce(description_summary, '')
    )
  );

alter table public.don_baraton_listings enable row level security;

-- Sellers manage their own listings
create policy don_baraton_seller_all on public.don_baraton_listings
  for all
  using (auth.uid() = seller_id)
  with check (auth.uid() = seller_id);

-- Public read active listings (storefront)
create policy don_baraton_public_read on public.don_baraton_listings
  for select
  using (status = 'active');
