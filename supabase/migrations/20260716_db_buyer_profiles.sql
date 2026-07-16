-- Buyer profiles for Don Baraton storefront (linked to Supabase Auth shoppers)

create table if not exists public.db_buyer_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  buyer_name text not null default '',
  buyer_email text not null default '',
  buyer_phone text not null default '',
  ship_address_line1 text not null default '',
  ship_address_line2 text not null default '',
  ship_city text not null default '',
  ship_state text not null default '',
  ship_postal text not null default '',
  ship_country text not null default 'US',
  preferred_payment text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.db_buyer_profiles enable row level security;

drop policy if exists "buyer_profiles_select_own" on public.db_buyer_profiles;
create policy "buyer_profiles_select_own"
  on public.db_buyer_profiles for select
  using (auth.uid() = user_id);

drop policy if exists "buyer_profiles_insert_own" on public.db_buyer_profiles;
create policy "buyer_profiles_insert_own"
  on public.db_buyer_profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "buyer_profiles_update_own" on public.db_buyer_profiles;
create policy "buyer_profiles_update_own"
  on public.db_buyer_profiles for update
  using (auth.uid() = user_id);
