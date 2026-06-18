-- Beauty OS - Pulizia controllata dati demo/test
-- NON eseguire senza aver letto docs/data-cleanup-report.md.
-- Questo script elimina solo record chiaramente test o orfani tecnici.
-- Non cancella clienti reali o clienti demo realistici senza conferma umana.

begin;

-- 1. Servizio chiaramente creato per test Supabase.
delete from public.services
where lower(trim(name)) = 'test supabase'
   or local_service_id = 'test-supabase';

-- 2. Appointments orfani.
-- Con il vincolo FK attuale non dovrebbero esistere, ma la query è precisa
-- e sicura se il database è passato da versioni precedenti.
delete from public.appointments appointment
where not exists (
  select 1
  from public.customers customer
  where customer.id = appointment.customer_id
);

-- 3. Task operativi senza cliente.
-- Non cancelliamo tutti i task senza customer_id perché in futuro potrebbero
-- esistere task di tipo campaign/data_quality senza cliente.
-- Eliminiamo solo task senza cliente e chiaramente test/tecnici.
delete from public.operational_tasks task
where task.customer_id is null
  and (
    lower(coalesce(task.title, '')) like '%test%'
    or lower(coalesce(task.title, '')) like '%demo%'
    or lower(coalesce(task.title, '')) like '%prova%'
    or lower(coalesce(task.reason, '')) like '%test%'
    or lower(coalesce(task.reason, '')) like '%demo%'
    or lower(coalesce(task.reason, '')) like '%prova%'
    or lower(coalesce(task.local_task_id, '')) like '%test%'
    or lower(coalesce(task.local_task_id, '')) like '%demo%'
  );

-- 4. Clienti chiaramente test.
-- Nota: non elimina clienti con email demo@beautyos.it perché sono dataset demo realistici.
delete from public.customers customer
where (
    lower(trim(customer.first_name)) in ('test', 'demo', 'prova', 'supabase')
    or lower(trim(customer.last_name)) in ('test', 'demo', 'prova', 'supabase')
    or lower(coalesce(customer.email, '')) like '%test%'
    or lower(coalesce(customer.email, '')) like '%example%'
  )
  and lower(coalesce(customer.email, '')) not like '%demo@beautyos.it';

-- 5. Servizi duplicati esatti.
-- Mantiene il record più recente non eliminato per ogni nome normalizzato.
-- Non tocca servizi con nomi simili ma non identici.
with ranked_services as (
  select
    id,
    row_number() over (
      partition by lower(trim(name))
      order by
        case when deleted_at is null then 0 else 1 end,
        updated_at desc nulls last,
        created_at desc nulls last
    ) as service_rank
  from public.services
  where deleted_at is null
)
update public.services service
set
  active = false,
  deleted_at = now(),
  updated_at = now()
from ranked_services ranked
where service.id = ranked.id
  and ranked.service_rank > 1;

commit;
