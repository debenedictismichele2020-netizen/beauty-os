-- Beauty OS - Backfill controllato primo salone
-- NON eseguire senza sostituire il placeholder.
--
-- 1. Crea o recupera il SALON_UUID da public.salons.
-- 2. Sostituisci sotto:
--    SALON_UUID = '00000000-0000-0000-0000-000000000000'
--    con l'id reale del salone.
-- 3. Lo script aggiorna solo record dove salon_id is null.

do $$
declare
  target_salon_id uuid := '00000000-0000-0000-0000-000000000000'::uuid; -- TODO: sostituisci con SALON_UUID reale
begin
  if target_salon_id = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'Sostituisci il placeholder SALON_UUID prima di eseguire questo backfill.';
  end if;

  if not exists (select 1 from public.salons where id = target_salon_id) then
    raise exception 'Il salone % non esiste in public.salons.', target_salon_id;
  end if;

  update public.customers
  set salon_id = target_salon_id
  where salon_id is null;

  update public.appointments
  set salon_id = target_salon_id
  where salon_id is null;

  update public.services
  set salon_id = target_salon_id
  where salon_id is null;

  update public.operational_tasks
  set salon_id = target_salon_id
  where salon_id is null;

  update public.salon_ai_settings
  set salon_id = target_salon_id
  where salon_id is null;
end $$;
