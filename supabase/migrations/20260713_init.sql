-- Higlou eBay Listing Generator schema
-- Apply in Supabase SQL editor or via CLI migrations.

create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now()
);

create type public.product_status as enum (
  'Uploaded',
  'Analyzing',
  'Needs Review',
  'Ready',
  'CSV Generated',
  'Published'
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  title text not null default '',
  subtitle text not null default '',
  brand text not null default '',
  collection text not null default '',
  model text not null default '',
  sku text not null default '',
  upc text not null default '',
  mpn text not null default '',
  category_id text not null default '',
  category_name text not null default '',
  condition text not null default '',
  condition_id text not null default '',
  condition_description text not null default '',
  price numeric(12,2),
  quantity integer not null default 1,
  listing_format text not null default 'FixedPrice',
  description_html text not null default '',
  description_summary text not null default '',
  item_specifics jsonb not null default '[]'::jsonb,
  features jsonb not null default '[]'::jsonb,
  set_includes jsonb not null default '[]'::jsonb,
  colors jsonb not null default '[]'::jsonb,
  materials jsonb not null default '[]'::jsonb,
  size text not null default '',
  product_type text not null default '',
  shipping_policy_id text not null default '',
  return_policy_id text not null default '',
  payment_policy_id text not null default '',
  handling_time integer not null default 1,
  item_location text not null default '',
  postal_code text not null default '',
  country text not null default 'US',
  status public.product_status not null default 'Uploaded',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  public_url text not null,
  storage_path text not null,
  file_name text not null,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  mime_type text not null default 'image/jpeg',
  size_bytes bigint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.product_item_specifics (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  csv_column text not null,
  label text not null,
  value text not null default '',
  required boolean not null default false,
  confidence numeric(4,3),
  is_custom boolean not null default false
);

create type public.ebay_template_type as enum (
  'draft_listing',
  'new_listing',
  'unknown'
);

create table if not exists public.ebay_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  file_name text not null,
  storage_path text,
  raw_content text not null,
  sha256 text not null,
  info_line text not null,
  template_type public.ebay_template_type not null default 'unknown',
  headers jsonb not null default '[]'::jsonb,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.ebay_policy_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  payment_policy_id text not null default '',
  return_policy_id text not null default '',
  shipping_policy_id text not null default '',
  default_item_location text not null default '',
  default_postal_code text not null default '',
  default_handling_time integer not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists public.store_branding (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  store_name text not null default 'Higlou Store',
  store_name_display text not null default 'HIGLOU STORE',
  slogan text not null default 'Quality Products • Reliable Service • Shop With Confidence',
  thank_you_message text not null default 'Thank You for Shopping With Higlou Store',
  thank_you_subtext text not null default '',
  shipping_information text not null default '',
  return_policy_text text not null default '',
  warranty_information text not null default '',
  footer_text text not null default '',
  logo_url text not null default '',
  colors jsonb not null default '{"headerBackground":"#111111","headerText":"#ffffff","bodyText":"#1d1d1f","accent":"#f4c928","panelBackground":"#f7f7f7","border":"#e5e5e5"}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.generated_csv_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  file_name text not null,
  content text not null,
  template_sha256 text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.analysis_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  request_meta jsonb not null default '{}'::jsonb,
  response_json jsonb,
  status text not null default 'completed',
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_item_specifics enable row level security;
alter table public.ebay_templates enable row level security;
alter table public.ebay_policy_settings enable row level security;
alter table public.store_branding enable row level security;
alter table public.generated_csv_files enable row level security;
alter table public.analysis_history enable row level security;

create policy users_self on public.users
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy products_owner on public.products
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy product_images_owner on public.product_images
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy product_item_specifics_owner on public.product_item_specifics
  for all using (
    exists (
      select 1 from public.products p
      where p.id = product_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_id and p.user_id = auth.uid()
    )
  );

create policy ebay_templates_owner on public.ebay_templates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy ebay_policy_settings_owner on public.ebay_policy_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy store_branding_owner on public.store_branding
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy generated_csv_files_owner on public.generated_csv_files
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy analysis_history_owner on public.analysis_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
