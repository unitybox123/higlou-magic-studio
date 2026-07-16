-- SUPERSEDED: Creative Engine removed. See 20260716_drop_creative_engine.sql
-- Higlou AI Creative Engine — Phase 1 foundation
-- Source images, packs, assets, jobs, approvals, truth records

create table if not exists public.creative_source_images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  original_url text not null,
  normalized_url text,
  thumb_url text,
  storage_path text,
  file_name text,
  mime_type text,
  size_bytes integer,
  width integer,
  height integer,
  sha256 text not null,
  phash text,
  quality_score numeric(5,2),
  quality_json jsonb not null default '{}'::jsonb,
  role text not null default 'unknown',
  role_confidence numeric(4,3),
  role_source text not null default 'auto',
  status text not null default 'ready',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creative_source_images_user_product_idx
  on public.creative_source_images (user_id, product_id);
create index if not exists creative_source_images_sha_idx
  on public.creative_source_images (user_id, sha256);

create table if not exists public.product_truth_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  version integer not null default 1,
  confirmed_json jsonb not null default '{}'::jsonb,
  uncertain_json jsonb not null default '{}'::jsonb,
  source_image_ids uuid[] not null default '{}',
  pipeline_version text not null default 'creative-v1',
  created_at timestamptz not null default now(),
  unique (user_id, product_id, version)
);

create table if not exists public.creative_packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  status text not null default 'draft',
  mode text not null default 'economy',
  estimate_json jsonb not null default '{}'::jsonb,
  actual_cost numeric(12, 6) not null default 0,
  truth_record_id uuid references public.product_truth_records (id) on delete set null,
  phase text not null default 'foundation',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creative_packs_user_product_idx
  on public.creative_packs (user_id, product_id);

create table if not exists public.creative_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  pack_id uuid not null references public.creative_packs (id) on delete cascade,
  slot text not null,
  method text not null default 'BLOCKED',
  status text not null default 'planned',
  recipe_version text,
  provider text,
  model text,
  url text,
  sort_order integer not null default 0,
  scores_json jsonb not null default '{}'::jsonb,
  cost numeric(12, 6) not null default 0,
  block_reason text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pack_id, slot)
);

create index if not exists creative_assets_pack_idx
  on public.creative_assets (pack_id);

create table if not exists public.creative_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  pack_id uuid not null references public.creative_packs (id) on delete cascade,
  asset_id uuid references public.creative_assets (id) on delete set null,
  kind text not null,
  status text not null default 'queued',
  attempts integer not null default 0,
  last_error text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create table if not exists public.creative_approval_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  asset_id uuid not null references public.creative_assets (id) on delete cascade,
  action text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.creative_source_images enable row level security;
alter table public.product_truth_records enable row level security;
alter table public.creative_packs enable row level security;
alter table public.creative_assets enable row level security;
alter table public.creative_jobs enable row level security;
alter table public.creative_approval_events enable row level security;

drop policy if exists creative_source_images_owner on public.creative_source_images;
create policy creative_source_images_owner on public.creative_source_images
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists product_truth_records_owner on public.product_truth_records;
create policy product_truth_records_owner on public.product_truth_records
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists creative_packs_owner on public.creative_packs;
create policy creative_packs_owner on public.creative_packs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists creative_assets_owner on public.creative_assets;
create policy creative_assets_owner on public.creative_assets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists creative_jobs_owner on public.creative_jobs;
create policy creative_jobs_owner on public.creative_jobs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists creative_approval_events_owner on public.creative_approval_events;
create policy creative_approval_events_owner on public.creative_approval_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
