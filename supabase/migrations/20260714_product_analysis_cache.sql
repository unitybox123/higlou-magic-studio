-- Phase A: product-level smart cache (fingerprint keyed)

create table if not exists public.product_analysis_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  product_fingerprint text not null,
  normalized_product_json jsonb not null default '{}'::jsonb,
  confidence_json jsonb not null default '{}'::jsonb,
  cost_json jsonb not null default '{}'::jsonb,
  analysis_payload jsonb not null default '{}'::jsonb,
  pipeline_version text not null default 'higlou-pipeline-v2a',
  prompt_version text not null default 'higlou-prompt-v2a',
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  hit_count integer not null default 1,
  unique (user_id, product_fingerprint, pipeline_version, prompt_version)
);

create index if not exists product_analysis_cache_user_fp_idx
  on public.product_analysis_cache (user_id, product_fingerprint);

alter table public.product_analysis_cache enable row level security;

drop policy if exists product_analysis_cache_owner on public.product_analysis_cache;
create policy product_analysis_cache_owner on public.product_analysis_cache
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
