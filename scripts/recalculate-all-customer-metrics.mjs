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

  return Math.max(
    0,
    Math.min(100, baseProbability + valueBonus + historyBonus - longDelayPenalty),
  );
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

const { data: customers, error: customersError } = await supabase
  .from("customers")
  .select("id,first_name,last_name,total_spent,average_visit_frequency_days,last_visit_date")
  .order("created_at", { ascending: false });

if (customersError) {
  console.error("Errore lettura clienti:", customersError.message);
  process.exit(1);
}

let updated = 0;
let skipped = 0;
const benchmark = getRetentionBenchmark(customers ?? []);

console.log("Benchmark retention:", JSON.stringify(benchmark));

for (const customer of customers) {
  const { data: visits, error: visitsError } = await supabase
    .from("appointments")
    .select("appointment_date,amount")
    .eq("customer_id", customer.id)
    .order("appointment_date", { ascending: true });

  if (visitsError) {
    console.error(`Cliente ${customer.id}: ${visitsError.message}`);
    skipped += 1;
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
    console.error(`Cliente ${customer.id}: ${error.message}`);
    skipped += 1;
    continue;
  }

  updated += 1;
  console.log(
    `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim(),
    JSON.stringify(metrics),
  );
}

console.log(JSON.stringify({ updated, skipped }, null, 2));
