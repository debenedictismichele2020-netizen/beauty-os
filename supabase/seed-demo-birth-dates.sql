-- SOLO PER DEMO/TEST. NON USARE SU DATABASE REALE.
-- Popola date di nascita fittizie diverse solo per clienti senza birth_date.
-- Da copiare e lanciare manualmente in Supabase SQL Editor su ambienti demo/test.

update public.customers
set birth_date = '1988-06-05'
where first_name = 'Alessandro'
  and last_name = 'Conti'
  and birth_date is null;

update public.customers
set birth_date = '1994-06-12'
where first_name = 'Chiara'
  and last_name = 'Moretti'
  and birth_date is null;

update public.customers
set birth_date = '1979-07-21'
where first_name = 'Valentina'
  and last_name = 'Ferrari'
  and birth_date is null;

update public.customers
set birth_date = '1991-08-03'
where first_name = 'Federico'
  and last_name = 'Marini'
  and birth_date is null;

update public.customers
set birth_date = '1985-09-18'
where first_name = 'Elena'
  and last_name = 'Rinaldi'
  and birth_date is null;

update public.customers
set birth_date = '1997-06-08'
where first_name = 'Sara'
  and last_name = 'Galli'
  and birth_date is null;

update public.customers
set birth_date = '1982-06-18'
where first_name = 'Davide'
  and last_name = 'Lombardi'
  and birth_date is null;

update public.customers
set birth_date = '1990-06-29'
where first_name = 'Marta'
  and last_name = 'Serra'
  and birth_date is null;

update public.customers
set birth_date = '1976-10-14'
where first_name = 'Riccardo'
  and last_name = 'Pellegrini'
  and birth_date is null;

update public.customers
set birth_date = '1998-11-02'
where first_name = 'Noemi'
  and last_name = 'De Luca'
  and birth_date is null;

update public.customers
set birth_date = '1989-12-09'
where first_name = 'Giulia'
  and last_name = 'Bianchi'
  and birth_date is null;

update public.customers
set birth_date = '1993-01-25'
where first_name = 'Martina'
  and last_name = 'Nalenni'
  and birth_date is null;

update public.customers
set birth_date = '1984-02-17'
where first_name = 'Arianna'
  and last_name = 'Spada'
  and birth_date is null;

update public.customers
set birth_date = '1996-03-06'
where first_name = 'Biagio'
  and last_name = 'Vespa'
  and birth_date is null;

update public.customers
set birth_date = '1987-04-11'
where first_name = 'Michele'
  and last_name = 'De Benedictis'
  and birth_date is null;

update public.customers
set birth_date = '1992-05-23'
where first_name = 'Mario'
  and last_name = 'Rossi'
  and birth_date is null;

update public.customers
set birth_date = '1980-06-30'
where first_name = 'Luca'
  and last_name = 'Verdi'
  and birth_date is null;
