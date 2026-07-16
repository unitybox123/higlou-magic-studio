-- SUPERSEDED: Creative Engine removed. See 20260716_drop_creative_engine.sql
-- Higlou AI Creative Engine — Phase 9 costs / budget / cache metrics

alter table public.creative_packs
  add column if not exists input_fingerprint text;

create index if not exists creative_packs_user_fingerprint_idx
  on public.creative_packs (user_id, input_fingerprint);

create table if not exists public.creative_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  pack_id uuid references public.creative_packs (id) on delete set null,
  asset_id uuid references public.creative_assets (id) on delete set null,
  job_id uuid references public.creative_jobs (id) on delete set null,
  provider text not null,
  model text,
  operation text not null,
  method text,
  pack_mode text,
  estimated_cost numeric(12, 6) not null default 0,
  cache_hit boolean not null default false,
  retry_count integer not null default 0,
  duration_ms integer not null default 0,
  status text not null default 'ok',
  error_code text,
  pipeline_version text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists creative_usage_events_user_created_idx
  on public.creative_usage_events (user_id, created_at desc);

create index if not exists creative_usage_events_pack_idx
  on public.creative_usage_events (pack_id);

alter table public.creative_usage_events enable row level security;

drop policy if exists creative_usage_events_owner on public.creative_usage_events;
create policy creative_usage_events_owner on public.creative_usage_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
