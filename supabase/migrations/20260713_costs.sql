-- Cost control schema: pricing settings + expanded usage events

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

-- Authenticated users can read active pricing (estimates only).
create policy provider_pricing_settings_read on public.provider_pricing_settings
  for select using (auth.role() = 'authenticated');

-- Insert seed rows if empty
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

-- Expand ai_usage_events columns if table exists
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'ai_usage_events'
  ) then
    alter table public.ai_usage_events add column if not exists model text;
    alter table public.ai_usage_events add column if not exists request_id text;
    alter table public.ai_usage_events add column if not exists input_tokens integer not null default 0;
    alter table public.ai_usage_events add column if not exists cached_input_tokens integer not null default 0;
    alter table public.ai_usage_events add column if not exists output_tokens integer not null default 0;
    alter table public.ai_usage_events add column if not exists reasoning_tokens integer not null default 0;
    alter table public.ai_usage_events add column if not exists ocr_unit_count integer not null default 0;
    alter table public.ai_usage_events add column if not exists retry_count integer not null default 0;
    alter table public.ai_usage_events add column if not exists cache_hit boolean not null default false;
  end if;
end $$;

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

create policy budget_settings_owner on public.budget_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
