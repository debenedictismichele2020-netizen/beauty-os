-- Beauty OS - Multi-salone fase 1: solo schema sicuro
-- Applicabile ora.
-- NON rimuove policy permissive.
-- NON crea policy RLS restrittive.

create extension if not exists pgcrypto;

create table if not exists public.salons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text null unique,
  owner_user_id uuid null references auth.users(id) on delete set null,
  phone text null,
  email text null,
  address text null,
  city text null,
  country text default 'IT',
  timezone text default 'Europe/Rome',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create table if not exists public.salon_members (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner'
    check (role in ('owner', 'admin', 'staff')),
  created_at timestamptz not null default now(),
  unique (salon_id, user_id)
);

alter table public.customers
add column if not exists salon_id uuid null references public.salons(id) on delete cascade;

alter table public.appointments
add column if not exists salon_id uuid null references public.salons(id) on delete cascade;

alter table public.services
add column if not exists salon_id uuid null references public.salons(id) on delete cascade;

alter table public.operational_tasks
add column if not exists salon_id uuid null references public.salons(id) on delete cascade;

alter table public.salon_ai_settings
add column if not exists salon_id uuid null references public.salons(id) on delete cascade;

create index if not exists salons_owner_user_id_idx
  on public.salons(owner_user_id);

create index if not exists salons_deleted_at_idx
  on public.salons(deleted_at);

create index if not exists salon_members_user_id_idx
  on public.salon_members(user_id);

create index if not exists salon_members_salon_id_idx
  on public.salon_members(salon_id);

create index if not exists customers_salon_id_idx
  on public.customers(salon_id);

create index if not exists customers_salon_status_idx
  on public.customers(salon_id, ai_status);

create index if not exists appointments_salon_id_idx
  on public.appointments(salon_id);

create index if not exists appointments_salon_date_idx
  on public.appointments(salon_id, appointment_date desc);

create index if not exists services_salon_id_idx
  on public.services(salon_id);

create index if not exists services_salon_active_idx
  on public.services(salon_id, active)
  where deleted_at is null;

create index if not exists operational_tasks_salon_id_idx
  on public.operational_tasks(salon_id);

create index if not exists operational_tasks_salon_date_idx
  on public.operational_tasks(salon_id, date);

create index if not exists salon_ai_settings_salon_id_unique_idx
  on public.salon_ai_settings(salon_id)
  where salon_id is not null;

create or replace function public.set_appointment_salon_id_from_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.salon_id is null and new.customer_id is not null then
    select salon_id
    into new.salon_id
    from public.customers
    where id = new.customer_id;
  end if;

  return new;
end;
$$;

drop trigger if exists set_appointment_salon_id_from_customer_trigger
on public.appointments;

create trigger set_appointment_salon_id_from_customer_trigger
before insert or update of customer_id, salon_id
on public.appointments
for each row
execute function public.set_appointment_salon_id_from_customer();

create or replace function public.current_user_has_salon_access(target_salon_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.salon_members member
    where member.salon_id = target_salon_id
      and member.user_id = auth.uid()
  );
$$;

create or replace function public.current_user_has_salon_write_access(target_salon_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.salon_members member
    where member.salon_id = target_salon_id
      and member.user_id = auth.uid()
      and member.role in ('owner', 'admin', 'staff')
  );
$$;
