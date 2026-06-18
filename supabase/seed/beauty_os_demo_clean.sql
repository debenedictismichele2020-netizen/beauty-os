-- Beauty OS - Demo dataset pulito
-- Dataset realistico per un salone beauty italiano.
-- Non contiene clienti/servizi chiamati test, demo, prova o supabase.
-- Esecuzione consigliata su database vuoto o ambiente demo.

begin;

insert into public.services (
  id,
  local_service_id,
  name,
  category,
  average_price,
  average_duration_minutes,
  active,
  updated_at,
  deleted_at
) values
  ('10000000-0000-4000-8000-000000000001', 'trattamento-viso', 'Trattamento viso', 'Viso', 75, 60, true, now(), null),
  ('10000000-0000-4000-8000-000000000002', 'pulizia-viso', 'Pulizia viso', 'Viso', 55, 45, true, now(), null),
  ('10000000-0000-4000-8000-000000000003', 'laminazione-ciglia', 'Laminazione ciglia', 'Viso', 60, 60, true, now(), null),
  ('10000000-0000-4000-8000-000000000004', 'trattamento-corpo', 'Trattamento corpo', 'Corpo', 85, 75, true, now(), null),
  ('10000000-0000-4000-8000-000000000005', 'massaggio-relax', 'Massaggio relax', 'Relax', 70, 60, true, now(), null),
  ('10000000-0000-4000-8000-000000000006', 'manicure', 'Manicure', 'Nails', 35, 45, true, now(), null),
  ('10000000-0000-4000-8000-000000000007', 'pedicure', 'Pedicure', 'Nails', 45, 50, true, now(), null),
  ('10000000-0000-4000-8000-000000000008', 'barba-grooming-uomo', 'Barba / grooming uomo', 'Barber', 30, 30, true, now(), null),
  ('10000000-0000-4000-8000-000000000009', 'pacchetto-sposa', 'Pacchetto sposa', 'Evento', 250, 180, true, now(), null),
  ('10000000-0000-4000-8000-000000000010', 'check-up-beauty', 'Check-up beauty', 'Altro', 40, 30, true, now(), null)
on conflict (id) do update set
  local_service_id = excluded.local_service_id,
  name = excluded.name,
  category = excluded.category,
  average_price = excluded.average_price,
  average_duration_minutes = excluded.average_duration_minutes,
  active = excluded.active,
  updated_at = now(),
  deleted_at = null;

insert into public.customers (
  id,
  first_name,
  last_name,
  phone,
  email,
  birth_date,
  gender,
  ai_status,
  retention_score,
  recovery_probability,
  total_spent,
  average_visit_frequency_days,
  last_visit_date,
  notes,
  created_at
) values
  ('20000000-0000-4000-8000-000000000001', 'Alessandro', 'Conti', '393291234501', 'alessandro.conti@beautyos.it', '1988-06-05', 'Uomo', 'Fedele', 82, 70, 430, 28, '2026-05-20', 'Cliente regolare per grooming uomo e pulizia viso.', '2026-01-12T09:00:00+00'),
  ('20000000-0000-4000-8000-000000000002', 'Chiara', 'Moretti', '393481234502', 'chiara.moretti@beautyos.it', '1994-06-12', 'Donna', 'VIP', 91, 85, 680, 21, '2026-06-03', 'Preferisce trattamenti viso luminosità e laminazione ciglia.', '2026-01-18T09:00:00+00'),
  ('20000000-0000-4000-8000-000000000003', 'Valentina', 'Ferrari', '393471234503', 'valentina.ferrari@beautyos.it', '1979-07-21', 'Donna', 'VIP', 88, 80, 760, 24, '2026-05-28', 'Cliente ad alto valore, interessata a percorsi viso e corpo.', '2026-01-22T09:00:00+00'),
  ('20000000-0000-4000-8000-000000000004', 'Federico', 'Marini', '393331234504', 'federico.marini@beautyos.it', '1991-08-03', 'Uomo', 'Fedele', 73, 65, 260, 30, '2026-05-15', 'Prenota grooming uomo e trattamenti cute.', '2026-01-25T09:00:00+00'),
  ('20000000-0000-4000-8000-000000000005', 'Elena', 'Rinaldi', '393461234505', 'elena.rinaldi@beautyos.it', '1985-09-18', 'Donna', 'Fedele', 76, 68, 315, 28, '2026-05-22', 'Risponde bene a reminder soft per manicure.', '2026-02-01T09:00:00+00'),
  ('20000000-0000-4000-8000-000000000006', 'Sara', 'Galli', '393401234506', 'sara.galli@beautyos.it', '1997-06-08', 'Donna', 'A rischio', 49, 65, 470, 25, '2026-03-28', 'In ritardo rispetto alla frequenza abituale.', '2026-02-05T09:00:00+00'),
  ('20000000-0000-4000-8000-000000000007', 'Davide', 'Lombardi', '393351234507', 'davide.lombardi@beautyos.it', '1982-06-18', 'Uomo', 'Perso', 34, 35, 300, 30, '2026-02-20', 'Cliente da riattivare con proposta semplice.', '2026-02-08T09:00:00+00'),
  ('20000000-0000-4000-8000-000000000008', 'Marta', 'Serra', '393421234508', 'marta.serra@beautyos.it', '1990-06-29', 'Donna', 'Perso', 22, 25, 340, 35, '2025-12-18', 'Assente da mesi, preferiva trattamenti corpo.', '2026-02-10T09:00:00+00'),
  ('20000000-0000-4000-8000-000000000009', 'Riccardo', 'Pellegrini', '393361234509', 'riccardo.pellegrini@beautyos.it', '1976-10-14', 'Uomo', 'Perso', 18, 20, 210, 45, '2025-11-04', 'Non prenota da molto tempo.', '2026-02-12T09:00:00+00'),
  ('20000000-0000-4000-8000-000000000010', 'Noemi', 'De Luca', '393491234510', 'noemi.deluca@beautyos.it', '1998-11-02', 'Donna', 'A rischio', 52, 55, 390, 21, '2026-04-01', 'Interessata a manicure e pedicure.', '2026-02-14T09:00:00+00'),
  ('20000000-0000-4000-8000-000000000011', 'Giulia', 'Bianchi', '393451234511', 'giulia.bianchi@beautyos.it', '1989-12-09', 'Donna', 'Fedele', 70, 60, 180, 30, '2026-06-01', 'Cliente recente, buon potenziale mantenimento.', '2026-03-01T09:00:00+00'),
  ('20000000-0000-4000-8000-000000000012', 'Martina', 'Nalenni', '393441234512', 'martina.nalenni@beautyos.it', '1993-01-25', 'Donna', 'A rischio', 58, 55, 220, 30, '2026-04-30', 'Da richiamare con tono caldo.', '2026-03-03T09:00:00+00'),
  ('20000000-0000-4000-8000-000000000013', 'Arianna', 'Spada', '393431234513', 'arianna.spada@beautyos.it', '1984-02-17', 'Donna', 'VIP', 84, 78, 590, 22, '2026-05-30', 'Ama pacchetti completi e trattamenti premium.', '2026-03-05T09:00:00+00'),
  ('20000000-0000-4000-8000-000000000014', 'Biagio', 'Vespa', '393391234514', 'biagio.vespa@beautyos.it', '1996-03-06', 'Uomo', 'Fedele', 74, 66, 250, 30, '2026-05-26', 'Cliente grooming ricorrente.', '2026-03-08T09:00:00+00'),
  ('20000000-0000-4000-8000-000000000015', 'Michele', 'De Benedictis', '393891234515', 'michele.debenedictis@beautyos.it', '1987-04-11', 'Uomo', 'A rischio', 62, 58, 360, 18, '2026-04-18', 'Buon potenziale recupero su trattamenti viso.', '2026-03-10T09:00:00+00')
on conflict (id) do update set
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  phone = excluded.phone,
  email = excluded.email,
  birth_date = excluded.birth_date,
  gender = excluded.gender,
  ai_status = excluded.ai_status,
  retention_score = excluded.retention_score,
  recovery_probability = excluded.recovery_probability,
  total_spent = excluded.total_spent,
  average_visit_frequency_days = excluded.average_visit_frequency_days,
  last_visit_date = excluded.last_visit_date,
  notes = excluded.notes;

insert into public.appointments (
  id,
  customer_id,
  service_name,
  service_price,
  appointment_date,
  notes,
  created_at
) values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Barba / grooming uomo', 30, '2026-04-24', 'Routine grooming mensile.', '2026-04-24T10:00:00+00'),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'Pulizia viso', 55, '2026-05-20', 'Pulizia viso uomo.', '2026-05-20T10:00:00+00'),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', 'Laminazione ciglia', 60, '2026-05-13', 'Risultato naturale.', '2026-05-13T10:00:00+00'),
  ('30000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000002', 'Trattamento viso', 75, '2026-06-03', 'Glow treatment.', '2026-06-03T10:00:00+00'),
  ('30000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000003', 'Trattamento corpo', 85, '2026-05-04', 'Percorso corpo.', '2026-05-04T10:00:00+00'),
  ('30000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000003', 'Pacchetto sposa', 250, '2026-05-28', 'Pacchetto premium.', '2026-05-28T10:00:00+00'),
  ('30000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000004', 'Barba / grooming uomo', 30, '2026-05-15', 'Mantenimento barba.', '2026-05-15T10:00:00+00'),
  ('30000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000005', 'Manicure', 35, '2026-05-22', 'Manicure nude.', '2026-05-22T10:00:00+00'),
  ('30000000-0000-4000-8000-000000000009', '20000000-0000-4000-8000-000000000006', 'Trattamento viso', 75, '2026-03-28', 'Da richiamare.', '2026-03-28T10:00:00+00'),
  ('30000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000007', 'Pulizia viso', 55, '2026-02-20', 'Ultima visita prima inattività.', '2026-02-20T10:00:00+00'),
  ('30000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000008', 'Trattamento corpo', 85, '2025-12-18', 'Percorso interrotto.', '2025-12-18T10:00:00+00'),
  ('30000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000009', 'Barba / grooming uomo', 30, '2025-11-04', 'Non tornato.', '2025-11-04T10:00:00+00'),
  ('30000000-0000-4000-8000-000000000013', '20000000-0000-4000-8000-000000000010', 'Manicure', 35, '2026-03-11', 'Reminder utile.', '2026-03-11T10:00:00+00'),
  ('30000000-0000-4000-8000-000000000014', '20000000-0000-4000-8000-000000000010', 'Pedicure', 45, '2026-04-01', 'Pedicure estetico.', '2026-04-01T10:00:00+00'),
  ('30000000-0000-4000-8000-000000000015', '20000000-0000-4000-8000-000000000011', 'Pulizia viso', 55, '2026-06-01', 'Prima visita positiva.', '2026-06-01T10:00:00+00'),
  ('30000000-0000-4000-8000-000000000016', '20000000-0000-4000-8000-000000000012', 'Massaggio relax', 70, '2026-04-30', 'Da proporre nuovo appuntamento.', '2026-04-30T10:00:00+00'),
  ('30000000-0000-4000-8000-000000000017', '20000000-0000-4000-8000-000000000013', 'Trattamento viso', 75, '2026-05-08', 'Percorso viso.', '2026-05-08T10:00:00+00'),
  ('30000000-0000-4000-8000-000000000018', '20000000-0000-4000-8000-000000000013', 'Trattamento corpo', 85, '2026-05-30', 'Trattamento corpo premium.', '2026-05-30T10:00:00+00'),
  ('30000000-0000-4000-8000-000000000019', '20000000-0000-4000-8000-000000000014', 'Barba / grooming uomo', 30, '2026-05-26', 'Grooming ricorrente.', '2026-05-26T10:00:00+00'),
  ('30000000-0000-4000-8000-000000000020', '20000000-0000-4000-8000-000000000015', 'Pulizia viso', 55, '2026-04-18', 'Da recuperare con follow-up.', '2026-04-18T10:00:00+00')
on conflict (id) do update set
  customer_id = excluded.customer_id,
  service_name = excluded.service_name,
  service_price = excluded.service_price,
  appointment_date = excluded.appointment_date,
  notes = excluded.notes;

insert into public.salon_ai_settings (
  id,
  tone,
  message_length,
  emoji_style,
  creativity,
  business_signature,
  preferences,
  updated_at
) values (
  '40000000-0000-4000-8000-000000000001',
  'Elegante',
  'Media',
  'Emoji leggere',
  'Bilanciata',
  'Studio Beauty',
  '{"neverMentionAge": true, "avoidCommercialTone": true, "alwaysSuggestAvailability": true, "personalizeByService": true, "personalizeByVisitHistory": true}'::jsonb,
  now()
)
on conflict (id) do update set
  tone = excluded.tone,
  message_length = excluded.message_length,
  emoji_style = excluded.emoji_style,
  creativity = excluded.creativity,
  business_signature = excluded.business_signature,
  preferences = excluded.preferences,
  updated_at = now();

commit;
