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

const demoAppointmentsByEmail = {
  "valentina.ferrari.demo@beautyos.it": [
    {
      service_name: "Percorso viso premium anti-age",
      appointment_date: "2026-04-18",
      amount: 620,
      notes: "Trattamento viso avanzato con radiofrequenza e skincare personalizzata.",
    },
    {
      service_name: "Manicure luxury e trattamento mani",
      appointment_date: "2026-05-06",
      amount: 420,
      notes: "Servizio ricorrente con finish naturale elegante.",
    },
    {
      service_name: "Pacchetto viso e corpo",
      appointment_date: "2026-05-24",
      amount: 800,
      notes: "Cliente VIP, alta propensione a percorsi completi.",
    },
  ],
  "alessandro.conti.demo@beautyos.it": [
    {
      service_name: "Skincare uomo e definizione barba",
      appointment_date: "2026-04-06",
      amount: 430,
      notes: "Routine grooming completa.",
    },
    {
      service_name: "Trattamento cute e barba premium",
      appointment_date: "2026-04-27",
      amount: 440,
      notes: "Ottima risposta ai trattamenti di mantenimento.",
    },
    {
      service_name: "Pulizia viso uomo e barba",
      appointment_date: "2026-05-18",
      amount: 455,
      notes: "Visita regolare, cliente molto puntuale.",
    },
  ],
  "chiara.moretti.demo@beautyos.it": [
    {
      service_name: "Laminazione ciglia",
      appointment_date: "2026-03-15",
      amount: 240,
      notes: "Preferisce risultati naturali e duraturi.",
    },
    {
      service_name: "Colore sopracciglia e trattamento viso",
      appointment_date: "2026-04-12",
      amount: 260,
      notes: "Cliente regolare, interessata a pacchetti stagionali.",
    },
    {
      service_name: "Trattamento corpo drenante",
      appointment_date: "2026-05-10",
      amount: 260,
      notes: "Buona continuita di visita.",
    },
  ],
  "federico.marini.demo@beautyos.it": [
    {
      service_name: "Trattamento cute uomo",
      appointment_date: "2026-03-05",
      amount: 190,
      notes: "Ha richiesto consigli per mantenimento a casa.",
    },
    {
      service_name: "Grooming completo",
      appointment_date: "2026-04-04",
      amount: 205,
      notes: "Prenotazione ricorrente.",
    },
    {
      service_name: "Pulizia viso uomo",
      appointment_date: "2026-05-04",
      amount: 215,
      notes: "Cliente stabile, buon potenziale pacchetto.",
    },
  ],
  "elena.rinaldi.demo@beautyos.it": [
    {
      service_name: "Manicure semipermanente",
      appointment_date: "2026-02-17",
      amount: 170,
      notes: "Preferisce colori nude e finiture luminose.",
    },
    {
      service_name: "Pedicure estetico",
      appointment_date: "2026-03-23",
      amount: 180,
      notes: "Cliente affezionata ai servizi mani e piedi.",
    },
    {
      service_name: "Manicure e trattamento rinforzante",
      appointment_date: "2026-04-28",
      amount: 190,
      notes: "Ritmo di visita regolare.",
    },
  ],
  "sara.galli.demo@beautyos.it": [
    {
      service_name: "Trattamento viso illuminante",
      appointment_date: "2026-01-27",
      amount: 220,
      notes: "Ha apprezzato il protocollo luminosita.",
    },
    {
      service_name: "Massaggio drenante",
      appointment_date: "2026-02-21",
      amount: 230,
      notes: "Da richiamare con proposta stagionale.",
    },
    {
      service_name: "Pulizia viso profonda",
      appointment_date: "2026-03-18",
      amount: 240,
      notes: "In ritardo rispetto al ciclo abituale.",
    },
  ],
  "davide.lombardi.demo@beautyos.it": [
    {
      service_name: "Barba e trattamento cute",
      appointment_date: "2025-12-28",
      amount: 130,
      notes: "Cliente interessato a mantenimento mensile.",
    },
    {
      service_name: "Pulizia viso uomo",
      appointment_date: "2026-01-27",
      amount: 145,
      notes: "Buona esperienza, nessuna prenotazione successiva.",
    },
    {
      service_name: "Grooming completo",
      appointment_date: "2026-02-26",
      amount: 155,
      notes: "Cliente ora in ritardo rispetto alla frequenza media.",
    },
  ],
  "noemi.deluca.demo@beautyos.it": [
    {
      service_name: "Manicure semipermanente",
      appointment_date: "2025-12-28",
      amount: 120,
      notes: "Cliente sensibile a reminder WhatsApp.",
    },
    {
      service_name: "Pedicure estetico",
      appointment_date: "2026-01-21",
      amount: 125,
      notes: "Preferisce appuntamenti nel pomeriggio.",
    },
    {
      service_name: "Manicure e nail care",
      appointment_date: "2026-02-14",
      amount: 135,
      notes: "Ultima visita oltre il ritmo abituale.",
    },
  ],
  "marta.serra.demo@beautyos.it": [
    {
      service_name: "Trattamento corpo rimodellante",
      appointment_date: "2025-08-13",
      amount: 170,
      notes: "Aveva iniziato un percorso corpo.",
    },
    {
      service_name: "Pulizia viso e skincare",
      appointment_date: "2025-09-12",
      amount: 170,
      notes: "Buona soddisfazione, poi nessuna nuova prenotazione.",
    },
    {
      service_name: "Massaggio drenante",
      appointment_date: "2025-10-12",
      amount: 180,
      notes: "Cliente assente da diversi mesi.",
    },
  ],
  "riccardo.pellegrini.demo@beautyos.it": [
    {
      service_name: "Pulizia viso uomo",
      appointment_date: "2025-04-09",
      amount: 125,
      notes: "Prima visita positiva.",
    },
    {
      service_name: "Trattamento barba e cute",
      appointment_date: "2025-05-24",
      amount: 135,
      notes: "Non ha piu prenotato dopo il secondo appuntamento.",
    },
  ],
};

function differenceInDays(fromDate, toDate) {
  return Math.max(
    0,
    Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000),
  );
}

function calculateAverageVisitFrequencyDays(visits) {
  if (visits.length < 2) {
    return 30;
  }

  const sortedDates = visits
    .map((visit) => new Date(`${visit.appointment_date}T00:00:00`))
    .sort((firstDate, secondDate) => firstDate.getTime() - secondDate.getTime());
  const intervals = sortedDates
    .slice(1)
    .map((date, index) => differenceInDays(sortedDates[index], date))
    .filter((days) => days > 0);

  if (intervals.length === 0) {
    return 30;
  }

  return Math.max(
    1,
    Math.round(intervals.reduce((total, days) => total + days, 0) / intervals.length),
  );
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function average(values, fallback) {
  const validValues = values.filter((value) => Number.isFinite(value) && value > 0);

  if (validValues.length === 0) {
    return fallback;
  }

  return validValues.reduce((total, value) => total + value, 0) / validValues.length;
}

function getRetentionBenchmark(customers) {
  const today = new Date();
  const averageFrequencyDays = average(
    customers.map((customer) => Number(customer.average_visit_frequency_days ?? 0)),
    30,
  );
  const averageTotalSpent = average(
    customers.map((customer) => Number(customer.total_spent ?? 0)),
    500,
  );
  const averageDaysSinceLastVisit = average(
    customers
      .map((customer) => customer.last_visit_date)
      .filter(Boolean)
      .map((lastVisitDate) =>
        differenceInDays(new Date(`${lastVisitDate}T00:00:00`), today),
      ),
    averageFrequencyDays,
  );

  return {
    averageTotalSpent,
    averageFrequencyDays,
    averageDaysSinceLastVisit,
  };
}

function calculateRetentionScore({
  averageVisitFrequencyDays,
  benchmark,
  daysSinceLastVisit,
  totalSpent,
}) {
  const missedCycles =
    daysSinceLastVisit / Math.max(1, averageVisitFrequencyDays);
  const valueRatio = totalSpent / Math.max(1, benchmark.averageTotalSpent);
  const recencyBaseline = Math.max(
    1,
    benchmark.averageDaysSinceLastVisit,
    benchmark.averageFrequencyDays,
  );
  const recencyRatio = daysSinceLastVisit / recencyBaseline;

  const frequencyComponent =
    40 * clamp(1 - Math.max(0, missedCycles - 1) / 3, 0, 1);
  const valueComponent = 40 * clamp(valueRatio / 2, 0, 1);
  const recencyComponent =
    20 * clamp(1 - Math.max(0, recencyRatio - 0.75) / 2.25, 0, 1);

  let score = Math.round(
    frequencyComponent + valueComponent + recencyComponent,
  );

  if (missedCycles >= 5) {
    score = Math.min(score, 39);
  } else if (missedCycles >= 3) {
    score = Math.min(score, 69);
  } else if (missedCycles >= 1.75) {
    score = Math.min(score, 89);
  }

  if (valueRatio < 1.5 || missedCycles > 1) {
    score = Math.min(score, 89);
  }

  return clamp(score, 0, 100);
}

function getAiStatusFromRetentionScore(score) {
  if (score >= 90) {
    return "VIP";
  }

  if (score >= 70) {
    return "Fedele";
  }

  if (score >= 40) {
    return "A rischio";
  }

  return "Perso";
}

function calculateRecoveryProbability({
  aiStatus,
  averageVisitFrequencyDays,
  appointmentCount,
  daysSinceLastVisit,
  totalSpent,
}) {
  const baseProbability =
    aiStatus === "VIP"
      ? 75
      : aiStatus === "Fedele"
        ? 65
        : aiStatus === "A rischio"
          ? 55
          : 25;
  const valueBonus = totalSpent > 1000 ? 10 : 0;
  const historyBonus = appointmentCount >= 3 ? 10 : 0;
  const longDelayPenalty =
    daysSinceLastVisit > averageVisitFrequencyDays * 4 ? 15 : 0;

  return clamp(baseProbability + valueBonus + historyBonus - longDelayPenalty, 0, 100);
}

async function updateCustomer(customerId, metrics) {
  const { data, error } = await supabase
    .from("customers")
    .update(metrics)
    .eq("id", customerId)
    .select("id,total_spent,average_visit_frequency_days,retention_score,ai_status,recovery_probability,last_visit_date")
    .single();

  if (!error) {
    return { data, error: null };
  }

  const missingRecoveryProbability =
    error.message.includes("recovery_probability") ||
    error.details?.includes("recovery_probability");

  if (!missingRecoveryProbability) {
    return { data: null, error };
  }

  const compatibleMetrics = {
    total_spent: metrics.total_spent,
    average_visit_frequency_days: metrics.average_visit_frequency_days,
    retention_score: metrics.retention_score,
    ai_status: metrics.ai_status,
    last_visit_date: metrics.last_visit_date,
  };

  return supabase
    .from("customers")
    .update(compatibleMetrics)
    .eq("id", customerId)
    .select("id,total_spent,average_visit_frequency_days,retention_score,ai_status,last_visit_date")
    .single();
}

const emails = Object.keys(demoAppointmentsByEmail);
const { data: customers, error: customersError } = await supabase
  .from("customers")
  .select("id,first_name,last_name,email,total_spent,average_visit_frequency_days,last_visit_date")
  .in("email", emails);

if (customersError) {
  console.error("Errore lettura clienti demo:", customersError);
  process.exit(1);
}

const { data: allCustomers, error: allCustomersError } = await supabase
  .from("customers")
  .select("total_spent,average_visit_frequency_days,last_visit_date");

if (allCustomersError) {
  console.error("Errore benchmark clienti:", allCustomersError);
  process.exit(1);
}

const benchmark = getRetentionBenchmark(allCustomers ?? []);
let insertedAppointments = 0;
let updatedCustomers = 0;
let skippedCustomers = 0;

for (const customer of customers ?? []) {
  const { count, error: countError } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", customer.id);

  if (countError) {
    console.error(`Errore controllo visite ${customer.email}:`, countError);
    skippedCustomers += 1;
    continue;
  }

  if ((count ?? 0) > 0) {
    console.log(`Visite gia presenti per ${customer.email}, cliente saltato.`);
    skippedCustomers += 1;
    continue;
  }

  const appointments = demoAppointmentsByEmail[customer.email].map((appointment) => ({
    ...appointment,
    customer_id: customer.id,
  }));
  const { error: insertError } = await supabase
    .from("appointments")
    .insert(appointments);

  if (insertError) {
    console.error(`Errore inserimento visite ${customer.email}:`, insertError);
    skippedCustomers += 1;
    continue;
  }

  insertedAppointments += appointments.length;

  const { data: visits, error: visitsError } = await supabase
    .from("appointments")
    .select("appointment_date,amount")
    .eq("customer_id", customer.id)
    .order("appointment_date", { ascending: true });

  if (visitsError) {
    console.error(`Errore rilettura visite ${customer.email}:`, visitsError);
    skippedCustomers += 1;
    continue;
  }

  const totalSpent = visits.reduce((total, visit) => {
    const amount = Number(visit.amount ?? 0);

    return total + (Number.isFinite(amount) ? amount : 0);
  }, 0);
  const averageVisitFrequencyDays = calculateAverageVisitFrequencyDays(visits);
  const lastVisitDate = visits.length
    ? visits[visits.length - 1].appointment_date
    : null;
  const daysSinceLastVisit = lastVisitDate
    ? differenceInDays(new Date(`${lastVisitDate}T00:00:00`), new Date())
    : 0;
  const retentionScore = lastVisitDate
    ? calculateRetentionScore({
        averageVisitFrequencyDays,
        benchmark,
        daysSinceLastVisit,
        totalSpent,
      })
    : 0;
  const aiStatus = getAiStatusFromRetentionScore(retentionScore);
  const recoveryProbability = lastVisitDate
    ? calculateRecoveryProbability({
        aiStatus,
        averageVisitFrequencyDays,
        appointmentCount: visits.length,
        daysSinceLastVisit,
        totalSpent,
      })
    : 0;
  const metrics = {
    total_spent: totalSpent,
    average_visit_frequency_days: averageVisitFrequencyDays,
    retention_score: retentionScore,
    ai_status: aiStatus,
    recovery_probability: recoveryProbability,
    last_visit_date: lastVisitDate,
  };
  const { error } = await updateCustomer(customer.id, metrics);

  if (error) {
    console.error(`Errore aggiornamento cliente ${customer.email}:`, error);
    skippedCustomers += 1;
    continue;
  }

  updatedCustomers += 1;
  console.log(
    `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim(),
    JSON.stringify({
      appointments: visits.length,
      ...metrics,
    }),
  );
}

console.log(
  JSON.stringify(
    {
      insertedAppointments,
      updatedCustomers,
      skippedCustomers,
    },
    null,
    2,
  ),
);
