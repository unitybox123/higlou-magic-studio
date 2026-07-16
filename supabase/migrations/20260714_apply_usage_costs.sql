-- Higlou: apply missing usage + cost tables (SQL Editor)

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  provider text not null,
  operation text not null,
  model text,
  request_id text,
  input_tokens integer not null default 0,
  cached_input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  reasoning_tokens integer not null default 0,
  image_count integer not null default 0,
  ocr_unit_count integer not null default 0,
  request_count integer not null default 1,
  retry_count integer not null default 0,
  cache_hit boolean not null default false,
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

drop policy if exists ai_usage_events_owner on public.ai_usage_events;
create policy ai_usage_events_owner on public.ai_usage_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists image_analysis_cache_owner on public.image_analysis_cache;
create policy image_analysis_cache_owner on public.image_analysis_cache
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.provider_pricing_settings (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  service text not null default 'default',
  model text,
  input_price_per_million numeric(12, 6),
  cached_input_price_per_million numeric(12, 6),
  output_price_per_million numeric(12, 6),
  price_per_1000_units numeric(12, 6),
  free_units_monthly integer,
  currency text not null default 'USD',
  effective_date date not null default current_date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.provider_pricing_settings enable row level security;

drop policy if exists provider_pricing_settings_read on public.provider_pricing_settings;
create policy provider_pricing_settings_read on public.provider_pricing_settings
  for select using (auth.role() = 'authenticated');

insert into public.provider_pricing_settings (
  provider, service, model,
  input_price_per_million, cached_input_price_per_million, output_price_per_million,
  price_per_1000_units, free_units_monthly, is_active
)
select * from (
  values
    ('openai', 'chat', 'economy', 0.15::numeric, 0.075::numeric, 0.60::numeric, null::numeric, null::integer, true),
    ('openai', 'chat', 'advanced', 1.00::numeric, 0.50::numeric, 6.00::numeric, null::numeric, null::integer, true),
    ('google_vision', 'ocr', 'TEXT_DETECTION', null::numeric, null::numeric, null::numeric, 1.50::numeric, 1000, true),
    ('infrastructure', 'supabase', 'pro', null::numeric, null::numeric, null::numeric, null::numeric, null::integer, true),
    ('infrastructure', 'vercel', 'pro', null::numeric, null::numeric, null::numeric, null::numeric, null::integer, true)
) as v(provider, service, model, input_price_per_million, cached_input_price_per_million, output_price_per_million, price_per_1000_units, free_units_monthly, is_active)
where not exists (select 1 from public.provider_pricing_settings limit 1);

create table if not exists public.budget_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  monthly_product_target integer not null default 500,
  monthly_budget_warning_usd numeric(12, 2) not null default 75,
  monthly_budget_limit_usd numeric(12, 2) not null default 100,
  enforcement_mode text not null default 'warn_only',
  default_analysis_tier text not null default 'economy',
  updated_at timestamptz not null default now()
);

alter table public.budget_settings enable row level security;

drop policy if exists budget_settings_owner on public.budget_settings;
create policy budget_settings_owner on public.budget_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
