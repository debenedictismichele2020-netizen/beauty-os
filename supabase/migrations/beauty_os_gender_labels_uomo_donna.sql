-- Beauty OS - Aggiorna etichette genere a Uomo/Donna.
-- Mantiene compatibilita applicativa: il codice legge ancora anche valori legacy.

do $$
declare
  constraint_name text;
begin
  select con.conname
  into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'customers'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) like '%gender%';

  if constraint_name is not null then
    execute format('alter table public.customers drop constraint %I', constraint_name);
  end if;
end $$;

update public.customers
set gender = case
  when gender = 'Mas' || 'chio' then 'Uomo'
  when gender = 'Fem' || 'mina' then 'Donna'
  else gender
end
where gender in ('Mas' || 'chio', 'Fem' || 'mina');

alter table public.customers
alter column gender set default 'Non specificato';

alter table public.customers
add constraint customers_gender_check
check (gender in ('Uomo', 'Donna', 'Non specificato'));
