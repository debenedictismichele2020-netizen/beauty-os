import { cleanWhatsAppMessage } from "@/lib/whatsapp";
import {
  normalizeCustomerGender,
  type CustomerGender,
} from "@/lib/gender";

export { isCustomerProfileIncomplete } from "./profileCompleteness";

export type AiStatus = "VIP" | "Loyal" | "At Risk" | "Lost";
export type Visit = {
  date: string;
  service: string;
  spend: string;
  note: string;
};

export type Customer = {
  id: string;
  age: number | null;
  birth_date: string;
  birthDate: string;
  createdAt: string;
  firstName: string;
  lastName: string;
  name: string;
  phone: string;
  email: string;
  gender: CustomerGender;
  lastVisit: string;
  lastVisitDate: string;
  frequency: string;
  expectedFrequencyDays: number;
  totalSpent: string;
  totalSpentValue: number;
  recoveryProbability: number;
  status: AiStatus;
  retentionScore: number;
  notes: string;
  visits: Visit[];
};

export type CustomerRow = {
  id: string;
  salon_id?: string | null;
  birth_date?: string | null;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  gender: string | null;
  ai_status: string | null;
  retention_score: number | null;
  recovery_probability?: number | null;
  total_spent: number | null;
  average_visit_frequency_days: number | null;
  last_visit_date: string | null;
  notes: string | null;
  created_at: string;
};

export type AppointmentRow = {
  id: string;
  salon_id?: string | null;
  customer_id: string;
  service_name: string;
  service_price: number | string | null;
  amount?: number | string | null;
  appointment_date: string;
  notes: string | null;
  created_at: string;
};

export type Appointment = {
  id: string;
  customerId: string;
  serviceName: string;
  appointmentDate: string;
  formattedDate: string;
  amount: string;
  amountValue: number;
  notes: string;
};

export type CustomerKpis = {
  totalCustomers: number;
  vipCount: number;
  vipValue: number;
  atRiskCount: number;
  lostCount: number;
};

export type EconomicDashboardKpis = {
  recoverableRevenue: number;
  lostRevenue: number;
  atRiskRevenue: number;
  averageRecoveryProbability: number;
  recoverableCustomerCount: number;
};

export type RetentionHealth = "Healthy" | "At Risk" | "Lost";

export type RecoveryOpportunity = {
  estimatedRevenue: string;
  probability: string;
  recommendedAction: string;
};

export type RetentionAnalysis = {
  status: AiStatus;
  score: number;
  health: RetentionHealth;
  healthStyles: string;
  scoreExplanation: string;
  daysSinceLastVisit: number;
  expectedFrequencyDays: number;
  recoveryOpportunity: RecoveryOpportunity;
  insights: string[];
};

export type ProfileDataQuality = {
  completionScore: number;
  completedChecks: number;
  isComplete: boolean;
  totalChecks: number;
  warnings: string[];
};

export const statusStyles: Record<AiStatus, string> = {
  VIP: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Loyal: "border-sky-200 bg-sky-50 text-sky-700",
  "At Risk": "border-amber-200 bg-amber-50 text-amber-800",
  Lost: "border-rose-200 bg-rose-50 text-rose-700",
};

export const statusLabels: Record<AiStatus, string> = {
  VIP: "VIP",
  Loyal: "Fedele",
  "At Risk": "A rischio",
  Lost: "Perso",
};

export const healthLabels: Record<RetentionHealth, string> = {
  Healthy: "In salute",
  "At Risk": "A rischio",
  Lost: "Perso",
};

export const analysisDate = new Date();

function formatDate(value: string | null) {
  if (!value) {
    return "Nessuna visita registrata";
  }

  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function addDays(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T00:00:00`);

  date.setDate(date.getDate() + days);

  return date.toISOString().slice(0, 10);
}

export function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
    notation: value >= 1000 ? "compact" : "standard",
  }).format(value);
}

function formatFrequency(days: number) {
  if (days % 7 === 0) {
    const weeks = days / 7;
    return weeks === 1 ? "Ogni settimana" : `Ogni ${weeks} settimane`;
  }

  return days === 1 ? "Ogni giorno" : `Ogni ${days} giorni`;
}

function normalizeStatus(value: string | null): AiStatus {
  if (value === "VIP" || value === "Loyal" || value === "At Risk" || value === "Lost") {
    return value;
  }

  if (value === "Fedele") {
    return "Loyal";
  }

  if (value === "A rischio") {
    return "At Risk";
  }

  if (value === "Perso") {
    return "Lost";
  }

  return "Loyal";
}

function normalizeGender(value: string | null): CustomerGender {
  return normalizeCustomerGender(value);
}

function calculateAge(birthDate: string | null | undefined) {
  if (!birthDate) {
    return null;
  }

  const parsedBirthDate = new Date(`${birthDate}T00:00:00`);

  if (Number.isNaN(parsedBirthDate.getTime())) {
    return null;
  }

  const today = analysisDate;
  let age = today.getFullYear() - parsedBirthDate.getFullYear();
  const hasBirthdayPassed =
    today.getMonth() > parsedBirthDate.getMonth() ||
    (today.getMonth() === parsedBirthDate.getMonth() &&
      today.getDate() >= parsedBirthDate.getDate());

  if (!hasBirthdayPassed) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

function getCustomerGrammar(gender: CustomerGender) {
  if (gender === "Donna") {
    return {
      article: "Questa",
      noun: "cliente",
      inactive: "inattiva",
      returns: "La cliente torna",
      shows: "Questa cliente",
      instruction:
        "Usa grammatica femminile quando ti riferisci alla cliente.",
    };
  }

  if (gender === "Uomo") {
    return {
      article: "Questo",
      noun: "cliente",
      inactive: "inattivo",
      returns: "Il cliente torna",
      shows: "Questo cliente",
      instruction:
        "Usa grammatica maschile quando ti riferisci al cliente.",
    };
  }

  return {
    article: "Questo",
    noun: "profilo cliente",
    inactive: "inattivo",
    returns: "Questo profilo cliente torna",
    shows: "Questo profilo cliente",
    instruction:
      "Usa formulazioni neutre come profilo cliente quando ti riferisci alla persona.",
  };
}

export function getCustomerGenderGrammar(gender: CustomerGender) {
  return getCustomerGrammar(gender);
}

export function getProfileDataQuality(
  customer: Customer,
  appointmentCount: number,
): ProfileDataQuality {
  const checks = [
    {
      isComplete: appointmentCount > 0,
      warning: "Nessuna visita registrata nello storico cliente.",
    },
    {
      isComplete: customer.totalSpentValue > 0,
      warning: "Spesa totale pari a 0: il valore economico non è affidabile.",
    },
    {
      isComplete: customer.gender !== "Non specificato",
      warning: "Genere non specificato: la grammatica AI potrebbe essere generica.",
    },
    {
      isComplete: Boolean(customer.lastVisitDate),
      warning: "Ultima visita mancante: il rischio di abbandono non è calcolabile.",
    },
  ];
  const completedChecks = checks.filter((check) => check.isComplete).length;
  const completionScore = Math.round((completedChecks / checks.length) * 100);
  const warnings = checks
    .filter((check) => !check.isComplete)
    .map((check) => check.warning);

  return {
    completionScore,
    completedChecks,
    isComplete: warnings.length === 0,
    totalChecks: checks.length,
    warnings,
  };
}

export function toSupabaseStatusLabel(status: AiStatus) {
  if (status === "Loyal") {
    return "Fedele";
  }

  if (status === "At Risk") {
    return "A rischio";
  }

  if (status === "Lost") {
    return "Perso";
  }

  return "VIP";
}

export function mapCustomer(row: CustomerRow): Customer {
  const totalSpent = row.total_spent ?? 0;
  const frequencyDays = row.average_visit_frequency_days ?? 30;
  const lastVisit = formatDate(row.last_visit_date);
  const name = `${row.first_name} ${row.last_name}`.trim();
  const birthDate = row.birth_date ?? "";

  return {
    id: row.id,
    age: calculateAge(birthDate),
    birth_date: birthDate,
    birthDate,
    createdAt: row.created_at,
    firstName: row.first_name,
    lastName: row.last_name,
    name,
    phone: row.phone ?? "Telefono non inserito",
    email: row.email ?? "Email non inserita",
    gender: normalizeGender(row.gender),
    lastVisit,
    lastVisitDate: row.last_visit_date ?? "",
    frequency: formatFrequency(frequencyDays),
    expectedFrequencyDays: frequencyDays,
    totalSpent: formatCurrency(totalSpent),
    totalSpentValue: totalSpent,
    recoveryProbability: row.recovery_probability ?? 0,
    status: normalizeStatus(row.ai_status),
    retentionScore: row.retention_score ?? 72,
    notes: row.notes ?? "Nessuna nota cliente inserita.",
    visits: [
      {
        date: lastVisit,
        service: "Ultimo appuntamento registrato",
        spend: formatCurrency(totalSpent),
        note: row.notes ?? "Profilo importato dal CRM Beauty OS.",
      },
    ],
  };
}

export function mapAppointment(row: AppointmentRow): Appointment {
  const amount = Number(row.service_price ?? row.amount ?? 0);
  const normalizedAmount = Number.isFinite(amount) ? amount : 0;

  return {
    id: row.id,
    customerId: row.customer_id,
    serviceName: row.service_name,
    appointmentDate: row.appointment_date,
    formattedDate: formatDate(row.appointment_date),
    amount: formatCurrency(normalizedAmount),
    amountValue: normalizedAmount,
    notes: row.notes ?? "Nessuna nota inserita per questa visita.",
  };
}

export function getDaysSinceLastVisit(customer: Customer) {
  if (!customer.lastVisitDate) {
    return 0;
  }

  const lastVisit = new Date(`${customer.lastVisitDate}T00:00:00`);
  const difference = analysisDate.getTime() - lastVisit.getTime();

  return Math.max(0, Math.round(difference / 86_400_000));
}

export function classifyCustomer(customer: Customer): AiStatus {
  if (customer.retentionScore >= 90) {
    return "VIP";
  }

  if (customer.retentionScore >= 70) {
    return "Loyal";
  }

  if (customer.retentionScore >= 40) {
    return "At Risk";
  }

  return "Lost";
}

export function analyzeRetention(customer: Customer): RetentionAnalysis {
  const totalSpent = customer.totalSpentValue;
  const expectedFrequencyDays = customer.expectedFrequencyDays;
  const daysSinceLastVisit = getDaysSinceLastVisit(customer);
  const overdueDays = daysSinceLastVisit - expectedFrequencyDays;
  const expectedReturnDate = customer.lastVisitDate
    ? addDays(customer.lastVisitDate, expectedFrequencyDays)
    : "";
  const status = classifyCustomer(customer);
  const score = Math.max(0, Math.min(100, customer.retentionScore));
  const health: RetentionHealth =
    status === "Lost" ? "Lost" : status === "At Risk" ? "At Risk" : "Healthy";
  const healthStyles =
    health === "Healthy"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : health === "At Risk"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-rose-200 bg-rose-50 text-rose-700";
  const averageVisitValue = Math.max(
    120,
    Math.round(totalSpent / Math.max(1, customer.visits.length)),
  );
  const probability =
    status === "VIP"
      ? "82%"
      : status === "Loyal"
        ? "74%"
        : status === "At Risk"
          ? "58%"
          : "31%";
  const recommendedAction =
    status === "VIP"
      ? "Proporre una prenotazione prioritaria con extra premium riservato per 48 ore."
      : status === "Loyal"
        ? "Inviare un promemoria caldo con due opzioni di appuntamento."
        : status === "At Risk"
          ? "Inviare un messaggio di recupero entro la settimana legato al trattamento abituale."
          : "Usare un invito di rientro delicato con un motivo chiaro per tornare.";
  const scoreExplanation =
    overdueDays <= 0
      ? `In linea con la cadenza: ritorno previsto entro ${formatDate(expectedReturnDate)}, ultima visita ${daysSinceLastVisit} giorni fa.`
      : `In ritardo di ${overdueDays} giorni rispetto al ritorno previsto del ${formatDate(expectedReturnDate)}.`;
  const grammar = getCustomerGrammar(customer.gender);
  const insights = [
    `${grammar.returns} normalmente ogni ${expectedFrequencyDays} giorni ma e ${grammar.inactive} da ${daysSinceLastVisit} giorni.`,
  ];

  if (status === "VIP" && totalSpent >= 1000) {
    insights.push("Cliente VIP con elevato valore storico.");
  }

  if (status === "VIP" && daysSinceLastVisit > expectedFrequencyDays * 0.85) {
    insights.push(`${grammar.shows} VIP mostra segnali iniziali di abbandono.`);
  }

  if (status === "At Risk" || (status === "Lost" && totalSpent >= 1200)) {
    insights.push(`${grammar.shows} ha un alto potenziale di recupero.`);
  }

  if (status === "Lost" || (status === "At Risk" && overdueDays > expectedFrequencyDays)) {
    insights.push("Cliente in forte rischio di abbandono.");
  }

  if (totalSpent >= 4000) {
    insights.push("Il valore storico elevato rende prioritario un contatto personalizzato.");
  }

  return {
    status,
    score,
    health,
    healthStyles,
    scoreExplanation,
    daysSinceLastVisit,
    expectedFrequencyDays,
    recoveryOpportunity: {
      estimatedRevenue: formatCurrency(averageVisitValue),
      probability,
      recommendedAction,
    },
    insights,
  };
}

export function generateRecoveryMessage(
  customer: Customer,
  analysis: RetentionAnalysis,
) {
  const firstName = customer.name.split(" ")[0];

  if (analysis.status === "VIP") {
    return cleanWhatsAppMessage(`Ciao ${firstName}, abbiamo gia pronte le note dei tuoi trattamenti preferiti e possiamo riservarti una fascia prioritaria per la prossima visita. Visto il tuo ritmo abituale, possiamo preparare anche un extra premium su misura. Vuoi che blocchiamo uno slot privato questa settimana?`);
  }

  if (analysis.status === "Loyal") {
    return cleanWhatsAppMessage(`Ciao ${firstName}, e il momento ideale per il tuo prossimo trattamento di mantenimento. Possiamo preparare il protocollo abituale e proporti due orari comodi questa settimana. Preferisci una sera feriale o il weekend?`);
  }

  if (analysis.status === "At Risk") {
    return cleanWhatsAppMessage(`Ciao ${firstName}, abbiamo notato che sono passati ${analysis.daysSinceLastVisit} giorni dall'ultima visita, un po' piu del tuo ritmo abituale di ${analysis.expectedFrequencyDays} giorni. Ci piacerebbe aiutarti a riprendere il percorso con il tuo trattamento regolare. Possiamo riservarti un appuntamento tranquillo questa settimana?`);
  }

  return cleanWhatsAppMessage(`Ciao ${firstName}, ci farebbe piacere rivederti in salone. Possiamo accoglierti con un trattamento di rientro personalizzato sulle note precedenti e questo mese abbiamo alcune disponibilita dedicate. Vuoi che ti inviamo gli orari migliori?`);
}
