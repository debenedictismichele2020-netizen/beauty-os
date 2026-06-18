create extension if not exists "pgcrypto";

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  phone text,
  email text,
  birth_date date,
  gender text not null default 'Non specificato'
    check (gender in ('Uomo', 'Donna', 'Non specificato')),
  ai_status text not null default 'Fedele'
    check (ai_status in ('VIP', 'Fedele', 'A rischio', 'Perso')),
  retention_score integer not null default 72
    check (retention_score >= 0 and retention_score <= 100),
  recovery_probability integer not null default 50
    check (recovery_probability >= 0 and recovery_probability <= 100),
  total_spent numeric(12, 2) not null default 0
    check (total_spent >= 0),
  average_visit_frequency_days integer not null default 30
    check (average_visit_frequency_days > 0),
  last_visit_date date,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.customers enable row level security;

alter table public.customers
add column if not exists birth_date date;

create policy "customers_read_anon"
on public.customers
for select
to anon
using (true);

create policy "customers_read_authenticated"
on public.customers
for select
to authenticated
using (true);

create policy "customers_update_anon"
on public.customers
for update
to anon
using (true)
with check (true);

create policy "customers_update_authenticated"
on public.customers
for update
to authenticated
using (true)
with check (true);

create index if not exists customers_created_at_idx
on public.customers (created_at desc);

create index if not exists customers_ai_status_idx
on public.customers (ai_status);
