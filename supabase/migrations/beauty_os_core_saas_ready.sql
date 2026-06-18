-- Beauty OS core SaaS readiness.
-- Adds persistent tables for operational tasks, service catalog and AI settings.
-- Temporary permissive RLS policies are intentional for development parity with the current app.

create extension if not exists pgcrypto;

create table if not exists public.operational_tasks (
  id uuid primary key default gen_random_uuid(),
  local_task_id text null unique,
  salon_id uuid null,
  customer_id uuid null references public.customers(id) on delete cascade,
  type text not null default 'recovery',
  date date not null,
  status text not null default 'pending',
  title text null,
  reason text null,
  priority text null,
  estimated_value numeric default 0,
  recovery_probability numeric default 0,
  days_since_last_visit integer null,
  last_visit_date date null,
  phone_snapshot text null,
  profile_href text null,
  completed_at timestamptz null,
  snoozed_from_date date null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  local_service_id text null unique,
  salon_id uuid null,
  name text not null,
  category text default 'Altro',
  average_price numeric default 0,
  average_duration_minutes integer default 0,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz null
);

create table if not exists public.salon_ai_settings (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid null,
  tone text default 'Elegante',
  message_length text default 'Media',
  emoji_style text default 'Emoji leggere',
  creativity text default 'Bilanciata',
  business_signature text default 'Studio Beauty',
  preferences jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists operational_tasks_customer_id_idx
  on public.operational_tasks(customer_id);

create index if not exists operational_tasks_date_idx
  on public.operational_tasks(date);

create index if not exists operational_tasks_status_idx
  on public.operational_tasks(status);

create index if not exists services_active_idx
  on public.services(active);

create index if not exists services_deleted_at_idx
  on public.services(deleted_at);

create index if not exists salon_ai_settings_salon_id_idx
  on public.salon_ai_settings(salon_id);

alter table public.operational_tasks enable row level security;
alter table public.services enable row level security;
alter table public.salon_ai_settings enable row level security;

drop policy if exists "Temporary development access operational tasks" on public.operational_tasks;
create policy "Temporary development access operational tasks"
  on public.operational_tasks
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "Temporary development access services" on public.services;
create policy "Temporary development access services"
  on public.services
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "Temporary development access salon ai settings" on public.salon_ai_settings;
create policy "Temporary development access salon ai settings"
  on public.salon_ai_settings
  for all
  to anon, authenticated
  using (true)
  with check (true);
