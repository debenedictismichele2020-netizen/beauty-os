# Beauty OS - Report pulizia dati demo/test

Data audit: 17 giugno 2026

## Metodo

Controllo eseguito in sola lettura su:

- `customers`
- `appointments`
- `services`
- `operational_tasks`
- `salon_ai_settings`

Pattern cercati:

- nomi contenenti `test`, `demo`, `prova`, `supabase`
- email contenenti `test`, `demo`, `example`
- servizi contenenti `test supabase`
- task senza `customer_id`
- servizi duplicati
- clienti senza nome reale
- appointments collegati a clienti inesistenti
- record con `salon_id null`

## Stato dataset

| Tabella | Record trovati | Note |
|---|---:|---|
| `customers` | 17 | Dataset misto: clienti demo realistici + alcuni clienti probabilmente manuali. |
| `appointments` | 42 | Visite coerenti, nessun orphan evidente grazie a FK verso `customers`. |
| `services` | 11 | 10 servizi validi + 1 servizio chiaramente test. |
| `operational_tasks` | 0 | Nessun dato da pulire. |
| `salon_ai_settings` | 0 | Nessun dato da pulire. |

## 1. Dati probabilmente demo/test

### Servizi chiaramente test

| Tabella | Identificatore | Valore | Motivo |
|---|---|---|---|
| `services` | `local_service_id = 'test-supabase'` | `name = 'test supabase'` | Nome esplicitamente tecnico/test. Da eliminare. |

### Clienti demo realistici

Questi clienti hanno email con dominio `demo@beautyos.it`. Sono dati demo realistici e utili per test UI, quindi non vanno eliminati automaticamente.

| Cliente | Email | Azione consigliata |
|---|---|---|
| Valentina Ferrari | `valentina.ferrari.demo@beautyos.it` | Tenere se il database è demo. Eliminare solo se si passa a dati reali. |
| Alessandro Conti | `alessandro.conti.demo@beautyos.it` | Tenere se il database è demo. |
| Chiara Moretti | `chiara.moretti.demo@beautyos.it` | Tenere se il database è demo. |
| Marta Serra | `marta.serra.demo@beautyos.it` | Tenere se il database è demo. |
| Riccardo Pellegrini | `riccardo.pellegrini.demo@beautyos.it` | Tenere se il database è demo. |
| Federico Marini | `federico.marini.demo@beautyos.it` | Tenere se il database è demo. |
| Elena Rinaldi | `elena.rinaldi.demo@beautyos.it` | Tenere se il database è demo. |
| Sara Galli | `sara.galli.demo@beautyos.it` | Tenere se il database è demo. |
| Davide Lombardi | `davide.lombardi.demo@beautyos.it` | Tenere se il database è demo. |
| Noemi De Luca | `noemi.deluca.demo@beautyos.it` | Tenere se il database è demo. |

## 2. Dati duplicati

### Servizi

Non risultano duplicati esatti nei servizi attivi, escluso il record tecnico `test supabase`.

Da monitorare:

- `Trattamento viso` nel catalogo
- visite con nomi simili/non normalizzati: `Trattamento Viso`, `Trattamento viso`, `viso`

Questi non sono duplicati di catalogo, ma indicano storico visite con nomi servizio non standardizzati.

### Appointments

Non risultano duplicati tecnici certi. Alcune visite di Noemi De Luca sembrano molto simili per servizio/importo, ma hanno date diverse e quindi non vanno eliminate automaticamente.

## 3. Dati incompleti

### `salon_id null`

Tutti i record attuali in `services` hanno `salon_id null`.

Questo è atteso nella fase pre-login/multi-salone. Non va corretto finché non esiste una tabella saloni/account e un `salon_id` reale.

### `operational_tasks`

Nessun record presente.

### `salon_ai_settings`

Nessun record presente. Alla prima configurazione, l'app può creare il record con valori default.

## 4. Dati da tenere

Da tenere:

- Tutti i clienti con nome/cognome realistico.
- Tutte le visite collegate a clienti esistenti.
- I 10 servizi base del catalogo:
  - Trattamento viso
  - Pulizia viso
  - Laminazione ciglia
  - Trattamento corpo
  - Massaggio relax
  - Manicure
  - Pedicure
  - Barba / grooming uomo
  - Pacchetto sposa
  - Check-up beauty

## 5. Dati da eliminare

Eliminazione sicura proposta:

| Tabella | Condizione precisa |
|---|---|
| `services` | `lower(trim(name)) = 'test supabase'` oppure `local_service_id = 'test-supabase'` |

Non sono state rilevate altre eliminazioni sicure senza conferma umana.

## 6. Dati da correggere

Correzioni consigliate, non distruttive:

| Area | Problema | Correzione consigliata |
|---|---|---|
| `appointments.service_name` | Nomi servizio non standardizzati (`viso`, `Trattamento Viso`, `mani`) | Mappare progressivamente a servizi catalogo, senza riscrivere lo storico alla cieca. |
| `services.salon_id` | Tutti null | Popolare solo dopo introduzione tabella saloni/account. |
| `customers.email` | Alcune email demo | Tenere nel dataset demo. Sostituire solo in produzione reale. |
| `salon_ai_settings` | Nessun record | Inserire default solo quando si decide configurazione salone. |

## Raccomandazione finale

Eseguire automaticamente solo lo script `beauty_os_cleanup_demo_data.sql`, che elimina il servizio chiaramente test.

Non eliminare clienti demo realistici senza conferma, perché sono utili per testare:

- Agenda AI
- Opportunità AI
- Campagne AI
- Profilo Cliente
- Catalogo servizi
- KPI dashboard
