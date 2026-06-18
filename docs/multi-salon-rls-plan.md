# Beauty OS - Piano multi-salone e RLS

Data: 17 giugno 2026

## Obiettivo

Preparare Beauty OS per login, multi-device e multi-salone, isolando i dati per salone tramite `salon_id` e collegando gli utenti Supabase Auth ai saloni tramite membership.

Nessuna modifica e stata applicata al database. Questo documento accompagna la migration:

- `supabase/migrations/beauty_os_multi_salon_ready.sql`

## Stato attuale tabelle

| Tabella | Stato attuale | Problema multi-salone |
|---|---|---|
| `customers` | Esiste, RLS abilitata, policy permissive `anon/authenticated`, manca `salon_id`. | Tutti i clienti sono globali. |
| `appointments` | Esiste, FK verso `customers`, RLS abilitata, policy permissive, manca `salon_id`. | Tutte le visite sono globali. |
| `services` | Esiste da migration SaaS core, ha gia `salon_id null`. | Serve FK verso `salons` e policy per tenant. |
| `operational_tasks` | Esiste da migration SaaS core, ha gia `salon_id null`. | Serve FK verso `salons` e policy per tenant. |
| `salon_ai_settings` | Esiste da migration SaaS core, ha gia `salon_id null`. | Serve FK verso `salons`, unicita per salone e policy. |

## Nuove tabelle

### `salons`

Tenant principale.

Colonne principali:

- `id uuid primary key`
- `name text`
- `slug text unique`
- `owner_user_id uuid references auth.users(id)`
- `phone text`
- `email text`
- `address text`
- `city text`
- `country text default 'IT'`
- `timezone text default 'Europe/Rome'`
- `created_at`
- `updated_at`
- `deleted_at`

### `salon_members`

Collega Supabase Auth ai saloni.

Colonne:

- `id uuid primary key`
- `salon_id uuid references salons(id) on delete cascade`
- `user_id uuid references auth.users(id) on delete cascade`
- `role text check in ('owner', 'admin', 'staff')`
- `created_at`
- `unique (salon_id, user_id)`

Questa struttura permette:

- un utente con piu saloni
- piu utenti nello stesso salone
- ruoli operativi

## Aggiunta `salon_id`

La migration aggiunge o consolida:

- `customers.salon_id references salons(id) on delete cascade`
- `appointments.salon_id references salons(id) on delete cascade`
- `services.salon_id references salons(id) on delete cascade`
- `operational_tasks.salon_id references salons(id) on delete cascade`
- `salon_ai_settings.salon_id references salons(id) on delete cascade`

Nota: `salon_id` resta inizialmente nullable per non rompere dati esistenti. Dopo backfill e aggiornamento app si potra valutare `not null`.

## Trigger di coerenza

La migration crea:

- `set_appointment_salon_id_from_customer()`

Quando una visita viene creata o aggiornata, se `appointments.salon_id` e null viene copiato da `customers.salon_id`.

Questo evita mismatch frequenti nella fase di transizione.

## Helper RLS

### `current_user_has_salon_access(target_salon_id uuid)`

Ritorna true se `auth.uid()` e membro del salone.

### `current_user_has_salon_write_access(target_salon_id uuid)`

Ritorna true se `auth.uid()` e membro con ruolo:

- `owner`
- `admin`
- `staff`

Per ora tutti i ruoli hanno write access sui dati operativi. In futuro si puo limitare `staff`.

## Piano Row Level Security

### `salons`

| Operazione | Regola |
|---|---|
| select | owner o membro del salone |
| insert | utente autenticato, `owner_user_id = auth.uid()` |
| update | owner o membro `owner/admin` |
| delete | non previsto nella migration, usare soft delete `deleted_at` |

### `salon_members`

| Operazione | Regola |
|---|---|
| select | l'utente vede membership dei propri saloni |
| insert/update/delete | solo owner/admin del salone |

Nota: la creazione del primo owner puo richiedere una RPC o una server action con service role, perche prima non esiste ancora membership.

### `customers`

| Operazione | Regola |
|---|---|
| select | utente membro del `salon_id` |
| insert | utente con write access sul `salon_id` |
| update | utente con write access sul `salon_id` |
| delete | utente con write access sul `salon_id` |

### `appointments`

| Operazione | Regola |
|---|---|
| select | utente membro del `salon_id` |
| insert/update | write access sul `salon_id` e `customer_id` appartenente allo stesso salone |
| delete | write access sul `salon_id` |

### `services`

| Operazione | Regola |
|---|---|
| select | utente membro del `salon_id` |
| all write | write access sul `salon_id` |

### `operational_tasks`

| Operazione | Regola |
|---|---|
| select | utente membro del `salon_id` |
| all write | write access sul `salon_id`; se presente `customer_id`, deve appartenere allo stesso salone |

### `salon_ai_settings`

| Operazione | Regola |
|---|---|
| select | utente membro del `salon_id` |
| all write | write access sul `salon_id` |

## Policy permissive rimosse

La migration rimuove policy note di sviluppo:

- `customers_read_anon`
- `customers_read_authenticated`
- `customers_update_anon`
- `customers_update_authenticated`
- tutte le policy permissive `appointments_*_anon/authenticated`
- `Temporary development access operational tasks`
- `Temporary development access services`
- `Temporary development access salon ai settings`

Se nel database remoto esistono policy aggiuntive non presenti nei file, vanno revisionate manualmente.

## Backfill dati esistenti

Prima di rendere operative le policy restrittive in produzione, serve assegnare i dati esistenti a un salone.

Esempio manuale:

```sql
insert into public.salons (name, slug, owner_user_id)
values ('Beauty OS Demo', 'beauty-os-demo', '<AUTH_USER_UUID>')
returning id;

insert into public.salon_members (salon_id, user_id, role)
values ('<SALON_UUID>', '<AUTH_USER_UUID>', 'owner');

update public.customers
set salon_id = '<SALON_UUID>'
where salon_id is null;

update public.appointments
set salon_id = '<SALON_UUID>'
where salon_id is null;

update public.services
set salon_id = '<SALON_UUID>'
where salon_id is null;

update public.operational_tasks
set salon_id = '<SALON_UUID>'
where salon_id is null;

update public.salon_ai_settings
set salon_id = '<SALON_UUID>'
where salon_id is null;
```

## Indici creati

- `salons_owner_user_id_idx`
- `salons_deleted_at_idx`
- `salon_members_user_id_idx`
- `salon_members_salon_id_idx`
- `customers_salon_id_idx`
- `customers_salon_status_idx`
- `appointments_salon_id_idx`
- `appointments_salon_date_idx`
- `services_salon_id_idx`
- `services_salon_active_idx`
- `operational_tasks_salon_id_idx`
- `operational_tasks_salon_date_idx`
- `salon_ai_settings_salon_id_unique_idx`

## Aggiornamenti applicativi necessari dopo la migration

Il codice attuale usa Supabase con anon key e non ha ancora contesto utente/salone. Dopo aver introdotto Auth, bisogna:

1. Creare sessione Supabase Auth lato client/server.
2. Determinare `currentSalonId` dopo login.
3. Aggiungere `.eq('salon_id', currentSalonId)` alle query server/client dove appropriato.
4. In insert/update valorizzare `salon_id`.
5. Aggiornare sync localStorage -> Supabase per:
   - `operational_tasks`
   - `services`
   - `salon_ai_settings`
6. Creare onboarding:
   - primo login crea `salons`
   - crea membership owner in `salon_members`
   - salva `currentSalonId`

## Ordine consigliato di rollout

1. Applicare migration in ambiente staging.
2. Creare un salone demo e membership owner.
3. Backfill `salon_id` sui dati esistenti.
4. Aggiornare codice app per Auth + `currentSalonId`.
5. Testare:
   - login owner
   - lettura clienti
   - creazione cliente
   - creazione visita
   - Catalogo servizi
   - Agenda AI
   - Campagne AI
6. Solo dopo test, valutare:
   - `customers.salon_id set not null`
   - `appointments.salon_id set not null`
   - `services.salon_id set not null`
   - `operational_tasks.salon_id set not null`
   - `salon_ai_settings.salon_id set not null`

## Rischi principali

- Se si applicano policy restrittive prima del backfill, l'app non vedra piu dati.
- Se l'app non invia `salon_id` in insert, RLS blocchera scritture.
- La creazione del primo salone/membro richiede flusso dedicato.
- Le policy `for all` su `services`, `operational_tasks`, `salon_ai_settings` sono comode, ma in futuro si puo separare per ruolo.

## Conclusione

La migration proposta prepara la struttura multi-tenant, ma va applicata insieme a:

- backfill controllato
- introduzione Auth
- selezione salone corrente
- aggiornamento query applicative

Non e consigliato applicarla direttamente in produzione senza questi passaggi.
