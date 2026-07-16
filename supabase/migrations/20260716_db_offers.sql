-- Buyer offers (eBay-style Best Offer) for Don Baraton Outlet
create table if not exists public.db_offers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.db_products (id) on delete set null,
  listing_slug text not null,
  listing_title text not null default '',
  listing_image_url text not null default '',
  list_price numeric(12, 2) not null,
  amount numeric(12, 2) not null,
  currency text not null default 'USD',
  buyer_name text not null,
  buyer_email text not null,
  buyer_phone text not null default '',
  message text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'expired', 'withdrawn')),
  expires_at timestamptz not null,
  admin_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists db_offers_status_idx
  on public.db_offers (status, created_at desc);

create index if not exists db_offers_product_idx
  on public.db_offers (product_id);

alter table public.db_offers enable row level security;

drop policy if exists db_offers_public_insert on public.db_offers;
create policy db_offers_public_insert on public.db_offers
  for insert
  with check (true);

drop policy if exists db_offers_authenticated_all on public.db_offers;
create policy db_offers_authenticated_all on public.db_offers
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
