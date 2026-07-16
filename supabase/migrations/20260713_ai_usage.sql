-- Hybrid AI usage + OCR cache tables

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  provider text not null,
  operation text not null,
  image_count integer not null default 0,
  request_count integer not null default 1,
  estimated_cost numeric(12, 6) not null default 0,
  status text not null default 'ok',
  error_code text,
  created_at timestamptz not null default now()
);

create table if not exists public.image_analysis_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  image_hash text not null,
  provider text not null,
  analysis_version text not null default 'hybrid-v1',
  result_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, image_hash, provider, analysis_version)
);

alter table public.ai_usage_events enable row level security;
alter table public.image_analysis_cache enable row level security;

create policy ai_usage_events_owner on public.ai_usage_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy image_analysis_cache_owner on public.image_analysis_cache
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
