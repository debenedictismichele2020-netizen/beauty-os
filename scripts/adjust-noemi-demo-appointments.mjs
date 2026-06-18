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

function getBenchmark(customers) {
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

const { data: customer, error: customerError } = await supabase
  .from("customers")
  .select("id,email")
  .eq("email", "noemi.deluca.demo@beautyos.it")
  .single();

if (customerError) {
  console.error("Errore lettura Noemi:", customerError);
  process.exit(1);
}

const { error: deleteError } = await supabase
  .from("appointments")
  .delete()
  .eq("customer_id", customer.id);

if (deleteError) {
  console.error("Errore pulizia visite Noemi:", deleteError);
  process.exit(1);
}

const appointments = [
  {
    customer_id: customer.id,
    service_name: "Manicure semipermanente",
    appointment_date: "2026-02-05",
    amount: 120,
    notes: "Cliente sensibile a reminder WhatsApp.",
  },
  {
    customer_id: customer.id,
    service_name: "Pedicure estetico",
    appointment_date: "2026-03-01",
    amount: 125,
    notes: "Preferisce appuntamenti nel pomeriggio.",
  },
  {
    customer_id: customer.id,
    service_name: "Manicure e nail care",
    appointment_date: "2026-03-25",
    amount: 135,
    notes: "In ritardo, ma ancora recuperabile con messaggio mirato.",
  },
];

const { error: insertError } = await supabase
  .from("appointments")
  .insert(appointments);

if (insertError) {
  console.error("Errore inserimento visite Noemi:", insertError);
  process.exit(1);
}

const { data: allCustomers, error: allCustomersError } = await supabase
  .from("customers")
  .select("total_spent,average_visit_frequency_days,last_visit_date");

if (allCustomersError) {
  console.error("Errore benchmark clienti:", allCustomersError);
  process.exit(1);
}

const { data: visits, error: visitsError } = await supabase
  .from("appointments")
  .select("appointment_date,amount")
  .eq("customer_id", customer.id)
  .order("appointment_date", { ascending: true });

if (visitsError) {
  console.error("Errore rilettura visite Noemi:", visitsError);
  process.exit(1);
}

const benchmark = getBenchmark(allCustomers ?? []);
const totalSpent = visits.reduce((total, visit) => {
  const amount = Number(visit.amount ?? 0);

  return total + (Number.isFinite(amount) ? amount : 0);
}, 0);
const averageVisitFrequencyDays = calculateAverageVisitFrequencyDays(visits);
const lastVisitDate = visits[visits.length - 1].appointment_date;
const daysSinceLastVisit = differenceInDays(
  new Date(`${lastVisitDate}T00:00:00`),
  new Date(),
);
const retentionScore = calculateRetentionScore({
  averageVisitFrequencyDays,
  benchmark,
  daysSinceLastVisit,
  totalSpent,
});
const aiStatus = getAiStatusFromRetentionScore(retentionScore);
const recoveryProbability = calculateRecoveryProbability({
  aiStatus,
  averageVisitFrequencyDays,
  appointmentCount: visits.length,
  daysSinceLastVisit,
  totalSpent,
});
const metrics = {
  total_spent: totalSpent,
  average_visit_frequency_days: averageVisitFrequencyDays,
  retention_score: retentionScore,
  ai_status: aiStatus,
  recovery_probability: recoveryProbability,
  last_visit_date: lastVisitDate,
};

const { data, error } = await supabase
  .from("customers")
  .update(metrics)
  .eq("id", customer.id)
  .select("id,total_spent,average_visit_frequency_days,last_visit_date,retention_score,ai_status,recovery_probability")
  .single();

if (error) {
  console.error("Errore aggiornamento Noemi:", error);
  process.exit(1);
}

console.log(JSON.stringify(data, null, 2));
