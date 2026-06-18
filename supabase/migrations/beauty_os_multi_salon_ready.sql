-- Beauty OS - Preparazione multi-salone
-- SUPERATA: non applicare direttamente in questa fase.
-- Questa migration completa e stata divisa in:
-- 1. supabase/migrations/beauty_os_multi_salon_schema_only.sql
--    Da applicare ora: solo schema, colonne, indici, trigger e helper.
-- 2. supabase/migrations/beauty_os_multi_salon_rls_later.sql
--    Da NON applicare ora: policy RLS restrittive.
-- NON applicare senza aver letto docs/multi-salon-rls-plan.md.
-- Obiettivo: collegare Supabase Auth agli account salone e isolare i dati per salon_id.

create extension if not exists pgcrypto;

-- 1. Saloni / tenant principali.
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

-- 2. Collegamento utenti Supabase Auth -> saloni.
-- Permette owner/staff/admin e in futuro utenti multi-salone.
create table if not exists public.salon_members (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner'
    check (role in ('owner', 'admin', 'staff')),
  created_at timestamptz not null default now(),
  unique (salon_id, user_id)
);

-- 3. Aggiunta salon_id alle tabelle operative.
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

-- 4. Indici multi-tenant.
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

-- 5. Coerenza appointment -> customer salon_id.
-- Da attivare dopo backfill salon_id. Lasciato come trigger sicuro.
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

-- 6. Helper RLS.
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

-- 7. RLS.
alter table public.salons enable row level security;
alter table public.salon_members enable row level security;
alter table public.customers enable row level security;
alter table public.appointments enable row level security;
alter table public.services enable row level security;
alter table public.operational_tasks enable row level security;
alter table public.salon_ai_settings enable row level security;

-- Rimuove policy permissive di sviluppo note. Se esistono policy extra, revisionarle manualmente.
drop policy if exists "customers_read_anon" on public.customers;
drop policy if exists "customers_read_authenticated" on public.customers;
drop policy if exists "customers_update_anon" on public.customers;
drop policy if exists "customers_update_authenticated" on public.customers;

drop policy if exists "appointments_read_anon" on public.appointments;
drop policy if exists "appointments_read_authenticated" on public.appointments;
drop policy if exists "appointments_insert_anon" on public.appointments;
drop policy if exists "appointments_insert_authenticated" on public.appointments;
drop policy if exists "appointments_update_anon" on public.appointments;
drop policy if exists "appointments_update_authenticated" on public.appointments;
drop policy if exists "appointments_delete_anon" on public.appointments;
drop policy if exists "appointments_delete_authenticated" on public.appointments;

drop policy if exists "Temporary development access operational tasks" on public.operational_tasks;
drop policy if exists "Temporary development access services" on public.services;
drop policy if exists "Temporary development access salon ai settings" on public.salon_ai_settings;

-- salons
drop policy if exists "salons_select_members" on public.salons;
create policy "salons_select_members"
on public.salons
for select
to authenticated
using (
  owner_user_id = auth.uid()
  or public.current_user_has_salon_access(id)
);

drop policy if exists "salons_insert_authenticated" on public.salons;
create policy "salons_insert_authenticated"
on public.salons
for insert
to authenticated
with check (owner_user_id = auth.uid());

drop policy if exists "salons_update_owners_admins" on public.salons;
create policy "salons_update_owners_admins"
on public.salons
for update
to authenticated
using (
  owner_user_id = auth.uid()
  or exists (
    select 1
    from public.salon_members member
    where member.salon_id = salons.id
      and member.user_id = auth.uid()
      and member.role in ('owner', 'admin')
  )
)
with check (
  owner_user_id = auth.uid()
  or exists (
    select 1
    from public.salon_members member
    where member.salon_id = salons.id
      and member.user_id = auth.uid()
      and member.role in ('owner', 'admin')
  )
);

-- salon_members
drop policy if exists "salon_members_select_own_salons" on public.salon_members;
create policy "salon_members_select_own_salons"
on public.salon_members
for select
to authenticated
using (
  user_id = auth.uid()
  or public.current_user_has_salon_access(salon_id)
);

drop policy if exists "salon_members_manage_owners_admins" on public.salon_members;
create policy "salon_members_manage_owners_admins"
on public.salon_members
for all
to authenticated
using (
  exists (
    select 1
    from public.salon_members manager
    where manager.salon_id = salon_members.salon_id
      and manager.user_id = auth.uid()
      and manager.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.salon_members manager
    where manager.salon_id = salon_members.salon_id
      and manager.user_id = auth.uid()
      and manager.role in ('owner', 'admin')
  )
);

-- customers
drop policy if exists "customers_select_by_salon" on public.customers;
create policy "customers_select_by_salon"
on public.customers
for select
to authenticated
using (public.current_user_has_salon_access(salon_id));

drop policy if exists "customers_insert_by_salon" on public.customers;
create policy "customers_insert_by_salon"
on public.customers
for insert
to authenticated
with check (public.current_user_has_salon_write_access(salon_id));

drop policy if exists "customers_update_by_salon" on public.customers;
create policy "customers_update_by_salon"
on public.customers
for update
to authenticated
using (public.current_user_has_salon_write_access(salon_id))
with check (public.current_user_has_salon_write_access(salon_id));

drop policy if exists "customers_delete_by_salon" on public.customers;
create policy "customers_delete_by_salon"
on public.customers
for delete
to authenticated
using (public.current_user_has_salon_write_access(salon_id));

-- appointments
drop policy if exists "appointments_select_by_salon" on public.appointments;
create policy "appointments_select_by_salon"
on public.appointments
for select
to authenticated
using (public.current_user_has_salon_access(salon_id));

drop policy if exists "appointments_insert_by_salon" on public.appointments;
create policy "appointments_insert_by_salon"
on public.appointments
for insert
to authenticated
with check (
  public.current_user_has_salon_write_access(salon_id)
  and exists (
    select 1
    from public.customers customer
    where customer.id = appointments.customer_id
      and customer.salon_id = appointments.salon_id
  )
);

drop policy if exists "appointments_update_by_salon" on public.appointments;
create policy "appointments_update_by_salon"
on public.appointments
for update
to authenticated
using (public.current_user_has_salon_write_access(salon_id))
with check (
  public.current_user_has_salon_write_access(salon_id)
  and exists (
    select 1
    from public.customers customer
    where customer.id = appointments.customer_id
      and customer.salon_id = appointments.salon_id
  )
);

drop policy if exists "appointments_delete_by_salon" on public.appointments;
create policy "appointments_delete_by_salon"
on public.appointments
for delete
to authenticated
using (public.current_user_has_salon_write_access(salon_id));

-- services
drop policy if exists "services_select_by_salon" on public.services;
create policy "services_select_by_salon"
on public.services
for select
to authenticated
using (public.current_user_has_salon_access(salon_id));

drop policy if exists "services_write_by_salon" on public.services;
create policy "services_write_by_salon"
on public.services
for all
to authenticated
using (public.current_user_has_salon_write_access(salon_id))
with check (public.current_user_has_salon_write_access(salon_id));

-- operational_tasks
drop policy if exists "operational_tasks_select_by_salon" on public.operational_tasks;
create policy "operational_tasks_select_by_salon"
on public.operational_tasks
for select
to authenticated
using (public.current_user_has_salon_access(salon_id));

drop policy if exists "operational_tasks_write_by_salon" on public.operational_tasks;
create policy "operational_tasks_write_by_salon"
on public.operational_tasks
for all
to authenticated
using (public.current_user_has_salon_write_access(salon_id))
with check (
  public.current_user_has_salon_write_access(salon_id)
  and (
    customer_id is null
    or exists (
      select 1
      from public.customers customer
      where customer.id = operational_tasks.customer_id
        and customer.salon_id = operational_tasks.salon_id
    )
  )
);

-- salon_ai_settings
drop policy if exists "salon_ai_settings_select_by_salon" on public.salon_ai_settings;
create policy "salon_ai_settings_select_by_salon"
on public.salon_ai_settings
for select
to authenticated
using (public.current_user_has_salon_access(salon_id));

drop policy if exists "salon_ai_settings_write_by_salon" on public.salon_ai_settings;
create policy "salon_ai_settings_write_by_salon"
on public.salon_ai_settings
for all
to authenticated
using (public.current_user_has_salon_write_access(salon_id))
with check (public.current_user_has_salon_write_access(salon_id));

-- 8. Nota operativa:
-- Prima di rendere salon_id NOT NULL, creare almeno un salone per i dati esistenti
-- e fare backfill di customers, appointments, services, operational_tasks, salon_ai_settings.
-- Esempio manuale:
-- insert into public.salons (name, slug, owner_user_id) values ('Beauty OS Demo', 'beauty-os-demo', '<AUTH_USER_UUID>');
-- insert into public.salon_members (salon_id, user_id, role) values ('<SALON_UUID>', '<AUTH_USER_UUID>', 'owner');
-- update public.customers set salon_id = '<SALON_UUID>' where salon_id is null;
-- update public.appointments set salon_id = '<SALON_UUID>' where salon_id is null;
-- update public.services set salon_id = '<SALON_UUID>' where salon_id is null;
-- update public.operational_tasks set salon_id = '<SALON_UUID>' where salon_id is null;
-- update public.salon_ai_settings set salon_id = '<SALON_UUID>' where salon_id is null;
