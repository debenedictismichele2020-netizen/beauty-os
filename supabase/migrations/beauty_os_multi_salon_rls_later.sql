-- Beauty OS - Multi-salone fase 2: RLS restrittiva
-- NON applicare ora.
-- Applicare solo dopo:
-- 1. schema multi-salone applicato
-- 2. utenti Auth creati
-- 3. salon_members popolata
-- 4. backfill salon_id completato
-- 5. app aggiornata per inviare currentSalonId

alter table public.salons enable row level security;
alter table public.salon_members enable row level security;
alter table public.customers enable row level security;
alter table public.appointments enable row level security;
alter table public.services enable row level security;
alter table public.operational_tasks enable row level security;
alter table public.salon_ai_settings enable row level security;

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
