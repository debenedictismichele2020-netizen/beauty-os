import fs from "node:fs";

import { createClient } from "@supabase/supabase-js";

for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);

  if (match) {
    process.env[match[1]] = match[2];
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Configurazione Supabase mancante.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
  },
});

const demoCustomers = [
  {
    first_name: "Valentina",
    last_name: "Ferrari",
    phone: "393471234501",
    email: "valentina.ferrari.demo@beautyos.it",
    gender: "Donna",
    total_spent: 1840,
    average_visit_frequency_days: 18,
    last_visit_date: "2026-05-24",
    retention_score: 96,
    ai_status: "VIP",
    recovery_probability: 85,
    notes:
      "Cliente molto costante. Preferisce trattamenti viso anti-age e manicure semipermanente.",
  },
  {
    first_name: "Alessandro",
    last_name: "Conti",
    phone: "393291234502",
    email: "alessandro.conti.demo@beautyos.it",
    gender: "Uomo",
    total_spent: 1325,
    average_visit_frequency_days: 21,
    last_visit_date: "2026-05-18",
    retention_score: 92,
    ai_status: "VIP",
    recovery_probability: 82,
    notes:
      "Prenota regolarmente trattamenti barba, skincare uomo e pulizia viso mensile.",
  },
  {
    first_name: "Chiara",
    last_name: "Moretti",
    phone: "393481234503",
    email: "chiara.moretti.demo@beautyos.it",
    gender: "Donna",
    total_spent: 760,
    average_visit_frequency_days: 28,
    last_visit_date: "2026-05-10",
    retention_score: 84,
    ai_status: "Fedele",
    recovery_probability: 75,
    notes:
      "Cliente regolare per colore sopracciglia, laminazione ciglia e trattamenti corpo.",
  },
  {
    first_name: "Federico",
    last_name: "Marini",
    phone: "393331234504",
    email: "federico.marini.demo@beautyos.it",
    gender: "Uomo",
    total_spent: 610,
    average_visit_frequency_days: 30,
    last_visit_date: "2026-05-04",
    retention_score: 78,
    ai_status: "Fedele",
    recovery_probability: 70,
    notes:
      "Visite abbastanza regolari. Interessato a pacchetti grooming e trattamenti cute.",
  },
  {
    first_name: "Elena",
    last_name: "Rinaldi",
    phone: "393461234505",
    email: "elena.rinaldi.demo@beautyos.it",
    gender: "Donna",
    total_spent: 540,
    average_visit_frequency_days: 35,
    last_visit_date: "2026-04-28",
    retention_score: 72,
    ai_status: "Fedele",
    recovery_probability: 68,
    notes:
      "Cliente affezionata ai trattamenti mani. Risponde bene ai promemoria soft.",
  },
  {
    first_name: "Sara",
    last_name: "Galli",
    phone: "393401234506",
    email: "sara.galli.demo@beautyos.it",
    gender: "Donna",
    total_spent: 690,
    average_visit_frequency_days: 25,
    last_visit_date: "2026-03-18",
    retention_score: 64,
    ai_status: "A rischio",
    recovery_probability: 62,
    notes:
      "In ritardo rispetto al ritmo abituale. Buona candidata per proposta trattamento viso stagionale.",
  },
  {
    first_name: "Davide",
    last_name: "Lombardi",
    phone: "393351234507",
    email: "davide.lombardi.demo@beautyos.it",
    gender: "Uomo",
    total_spent: 430,
    average_visit_frequency_days: 30,
    last_visit_date: "2026-02-26",
    retention_score: 52,
    ai_status: "A rischio",
    recovery_probability: 55,
    notes:
      "Ha saltato l'ultimo ciclo di mantenimento. Consigliato messaggio diretto ma non commerciale.",
  },
  {
    first_name: "Noemi",
    last_name: "De Luca",
    phone: "393491234508",
    email: "noemi.deluca.demo@beautyos.it",
    gender: "Donna",
    total_spent: 380,
    average_visit_frequency_days: 24,
    last_visit_date: "2026-02-14",
    retention_score: 45,
    ai_status: "A rischio",
    recovery_probability: 50,
    notes:
      "Cliente sensibile alle offerte su manicure e pedicure. Ultima visita oltre la frequenza media.",
  },
  {
    first_name: "Marta",
    last_name: "Serra",
    phone: "393421234509",
    email: "marta.serra.demo@beautyos.it",
    gender: "Donna",
    total_spent: 520,
    average_visit_frequency_days: 30,
    last_visit_date: "2025-10-12",
    retention_score: 28,
    ai_status: "Perso",
    recovery_probability: 30,
    notes:
      "Assente da molti mesi. Recupero possibile con invito personale e trattamento di rientro.",
  },
  {
    first_name: "Riccardo",
    last_name: "Pellegrini",
    phone: "393361234510",
    email: "riccardo.pellegrini.demo@beautyos.it",
    gender: "Uomo",
    total_spent: 260,
    average_visit_frequency_days: 45,
    last_visit_date: "2025-07-08",
    retention_score: 18,
    ai_status: "Perso",
    recovery_probability: 22,
    notes:
      "Non torna da quasi un anno. Usare tono gentile e proposta semplice per riattivazione.",
  },
];

const { data, error } = await supabase
  .from("customers")
  .insert(demoCustomers)
  .select("id,first_name,last_name,ai_status,retention_score,total_spent");

if (error) {
  console.error("Errore inserimento clienti demo:", error);
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      inserted: data?.length ?? 0,
      customers: data,
    },
    null,
    2,
  ),
);
