-- Beauty OS - Protezione idempotenza provisioning salone
-- Obiettivo: un utente può possedere un solo salone e avere una sola membership owner.
-- Non modifica customers/services/appointments/operational_tasks/salon_ai_settings.
-- Prima normalizza eventuali duplicati già creati dal provisioning concorrente.

with ranked_owner_memberships as (
  select
    id,
    row_number() over (
      partition by user_id
      order by created_at asc, id asc
    ) as owner_rank
  from public.salon_members
  where role = 'owner'
)
delete from public.salon_members member
using ranked_owner_memberships ranked
where member.id = ranked.id
  and ranked.owner_rank > 1;

with ranked_owned_salons as (
  select
    id,
    row_number() over (
      partition by owner_user_id
      order by created_at asc, id asc
    ) as salon_rank
  from public.salons
  where owner_user_id is not null
    and deleted_at is null
)
update public.salons salon
set
  owner_user_id = null,
  deleted_at = coalesce(salon.deleted_at, now()),
  updated_at = now()
from ranked_owned_salons ranked
where salon.id = ranked.id
  and ranked.salon_rank > 1
  and not exists (
    select 1
    from public.customers customer
    where customer.salon_id = salon.id
  )
  and not exists (
    select 1
    from public.appointments appointment
    where appointment.salon_id = salon.id
  )
  and not exists (
    select 1
    from public.services service
    where service.salon_id = salon.id
  )
  and not exists (
    select 1
    from public.operational_tasks task
    where task.salon_id = salon.id
  )
  and not exists (
    select 1
    from public.salon_ai_settings settings
    where settings.salon_id = salon.id
  );

with ranked_owned_salons as (
  select
    id,
    row_number() over (
      partition by owner_user_id
      order by created_at asc, id asc
    ) as salon_rank
  from public.salons
  where owner_user_id is not null
    and deleted_at is null
)
update public.salons salon
set
  owner_user_id = null,
  updated_at = now()
from ranked_owned_salons ranked
where salon.id = ranked.id
  and ranked.salon_rank > 1;

create unique index if not exists salon_members_one_owner_per_user_idx
on public.salon_members(user_id)
where role = 'owner';

create unique index if not exists salons_one_active_owned_salon_per_user_idx
on public.salons(owner_user_id)
where owner_user_id is not null
  and deleted_at is null;
