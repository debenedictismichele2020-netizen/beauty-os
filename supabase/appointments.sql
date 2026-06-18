create extension if not exists "pgcrypto";

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  service_name text not null,
  service_price numeric(12, 2) not null default 0
    check (service_price >= 0),
  appointment_date date not null,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.appointments
add column if not exists service_price numeric(12, 2) not null default 0
  check (service_price >= 0);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'appointments'
      and column_name = 'amount'
  ) then
    execute 'update public.appointments set service_price = amount where service_price = 0 and amount is not null';
  end if;
end $$;

alter table public.appointments enable row level security;

create policy "appointments_read_anon"
on public.appointments
for select
to anon
using (true);

create policy "appointments_read_authenticated"
on public.appointments
for select
to authenticated
using (true);

create policy "appointments_insert_anon"
on public.appointments
for insert
to anon
with check (true);

create policy "appointments_insert_authenticated"
on public.appointments
for insert
to authenticated
with check (true);

create policy "appointments_update_anon"
on public.appointments
for update
to anon
using (true)
with check (true);

create policy "appointments_update_authenticated"
on public.appointments
for update
to authenticated
using (true)
with check (true);

create policy "appointments_delete_anon"
on public.appointments
for delete
to anon
using (true);

create policy "appointments_delete_authenticated"
on public.appointments
for delete
to authenticated
using (true);

create index if not exists appointments_customer_date_idx
on public.appointments (customer_id, appointment_date desc);

create index if not exists appointments_created_at_idx
on public.appointments (created_at desc);
