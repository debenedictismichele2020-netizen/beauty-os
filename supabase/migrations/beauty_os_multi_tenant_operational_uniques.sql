-- Multi-tenant conflict targets for browser-synced operational data.
-- These indexes make local identifiers unique only inside the owning salon.

alter table public.services
  drop constraint if exists services_local_service_id_key;

drop index if exists public.services_local_service_id_key;

create unique index if not exists services_salon_local_service_id_unique_idx
  on public.services (salon_id, local_service_id);

alter table public.operational_tasks
  drop constraint if exists operational_tasks_local_task_id_key;

drop index if exists public.operational_tasks_local_task_id_key;

create unique index if not exists operational_tasks_salon_local_task_id_unique_idx
  on public.operational_tasks (salon_id, local_task_id);
