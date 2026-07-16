-- Don Baraton marketplace ops (orders + shipments)
-- Run AFTER 20260715_db_products.sql
-- Does NOT require don_baraton_listings

create table if not exists public.don_baraton_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  status text not null default 'new'
    check (status in (
      'new',
      'confirmed',
      'packed',
      'shipped',
      'delivered',
      'cancelled',
      'refunded'
    )),
  buyer_name text not null default '',
  buyer_email text not null default '',
  buyer_phone text not null default '',
  ship_address_line1 text not null default '',
  ship_address_line2 text not null default '',
  ship_city text not null default '',
  ship_state text not null default '',
  ship_postal text not null default '',
  ship_country text not null default 'US',
  subtotal numeric(12, 2) not null default 0,
  shipping_cost numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  currency text not null default 'USD',
  notes text not null default '',
  source text not null default 'storefront',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.don_baraton_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.don_baraton_orders (id) on delete cascade,
  product_id uuid references public.db_products (id) on delete set null,
  title text not null,
  sku text not null default '',
  unit_price numeric(12, 2) not null,
  quantity integer not null check (quantity > 0),
  image_url text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists don_baraton_order_items_order_idx
  on public.don_baraton_order_items (order_id);

create table if not exists public.don_baraton_shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.don_baraton_orders (id) on delete cascade,
  carrier text not null default '',
  tracking_number text not null default '',
  tracking_url text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'label_created', 'in_transit', 'delivered', 'exception')),
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists don_baraton_orders_status_idx
  on public.don_baraton_orders (status, created_at desc);

alter table public.don_baraton_orders enable row level security;
alter table public.don_baraton_order_items enable row level security;
alter table public.don_baraton_shipments enable row level security;

drop policy if exists don_baraton_orders_service on public.don_baraton_orders;
create policy don_baraton_orders_service on public.don_baraton_orders
  for all using (true) with check (true);

drop policy if exists don_baraton_order_items_service on public.don_baraton_order_items;
create policy don_baraton_order_items_service on public.don_baraton_order_items
  for all using (true) with check (true);

drop policy if exists don_baraton_shipments_service on public.don_baraton_shipments;
create policy don_baraton_shipments_service on public.don_baraton_shipments
  for all using (true) with check (true);
