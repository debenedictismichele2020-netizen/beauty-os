"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentSalon } from "@/lib/currentSalon";
import {
  normalizeCustomerGender,
  type CustomerGender,
  toLegacyCustomerGenderValue,
} from "@/lib/gender";
import { cleanWhatsAppMessage } from "@/lib/whatsapp";
import { getCustomerGenderGrammar } from "./data";

export type AddCustomerState = {
  success: boolean;
  message: string;
};

export type EditCustomerState = {
  success: boolean;
  message: string;
};

export type DeleteCustomerState = {
  success: boolean;
  message: string;
};

export type AddAppointmentState = {
  success: boolean;
  message: string;
};

export type EditAppointmentState = {
  success: boolean;
  message: string;
};

export type DeleteAppointmentState = {
  success: boolean;
  message: string;
};

export type GenerateRecoveryMessageResult = {
  success: boolean;
  message: string;
};

type AppointmentKpiRow = {
  appointment_date: string;
  service_price: number | string | null;
  amount?: number | string | null;
};

type CustomerKpiUpdate = {
  total_spent: number;
  average_visit_frequency_days: number;
  retention_score: number;
  ai_status: "VIP" | "Fedele" | "A rischio" | "Perso";
  recovery_probability: number;
  last_visit_date: string | null;
};

type RetentionBenchmark = {
  averageTotalSpent: number;
  averageFrequencyDays: number;
  averageDaysSinceLastVisit: number;
};

function getText(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function getNumber(formData: FormData, key: string) {
  const value = Number(getText(formData, key));

  return Number.isFinite(value) ? value : null;
}

function getGender(formData: FormData): CustomerGender {
  const gender = getText(formData, "gender");

  return normalizeCustomerGender(gender);
}

function shouldRetryWithLegacyGender(error: { message?: string } | null) {
  return Boolean(
    error?.message?.toLowerCase().includes("gender") ||
      error?.message?.toLowerCase().includes("check"),
  );
}

function getOptionalDate(formData: FormData, key: string) {
  const value = getText(formData, key);

  if (!value) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  const isValidDate =
    parsedDate.getUTCFullYear() === year &&
    parsedDate.getUTCMonth() === month - 1 &&
    parsedDate.getUTCDate() === day;

  if (!isValidDate) {
    return null;
  }

  return value;
}

function differenceInDays(fromDate: Date, toDate: Date) {
  return Math.max(
    0,
    Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000),
  );
}

function calculateAverageVisitFrequencyDays(visits: AppointmentKpiRow[]) {
  if (visits.length < 2) {
    return 30;
  }

  const sortedDates = visits
    .map((visit) => new Date(`${visit.appointment_date}T00:00:00`))
    .sort((firstDate, secondDate) => firstDate.getTime() - secondDate.getTime());
  const intervals = sortedDates.slice(1).map((date, index) => {
    return differenceInDays(sortedDates[index], date);
  });
  const validIntervals = intervals.filter((days) => days > 0);

  if (validIntervals.length === 0) {
    return 30;
  }

  const totalDays = validIntervals.reduce((total, days) => total + days, 0);

  return Math.max(1, Math.round(totalDays / validIntervals.length));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function average(values: number[], fallback: number) {
  const validValues = values.filter((value) => Number.isFinite(value) && value > 0);

  if (validValues.length === 0) {
    return fallback;
  }

  return (
    validValues.reduce((total, value) => total + value, 0) / validValues.length
  );
}

async function getRetentionBenchmark(
  supabase: NonNullable<ReturnType<typeof createSupabaseServerClient>>,
  salonId: string,
): Promise<RetentionBenchmark> {
  const { data, error } = await supabase
    .from("customers")
    .select("birth_date,total_spent,average_visit_frequency_days,last_visit_date")
    .eq("salon_id", salonId);

  if (error) {
    console.error("Errore benchmark retention:", error);

    return {
      averageTotalSpent: 500,
      averageFrequencyDays: 30,
      averageDaysSinceLastVisit: 30,
    };
  }

  const today = new Date();
  const averageFrequencyDays = average(
    (data ?? []).map((customer) =>
      Number(customer.average_visit_frequency_days ?? 0),
    ),
    30,
  );
  const averageTotalSpent = average(
    (data ?? []).map((customer) => Number(customer.total_spent ?? 0)),
    500,
  );
  const averageDaysSinceLastVisit = average(
    (data ?? [])
      .map((customer) => customer.last_visit_date)
      .filter((lastVisitDate): lastVisitDate is string => Boolean(lastVisitDate))
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
}: {
  averageVisitFrequencyDays: number;
  benchmark: RetentionBenchmark;
  daysSinceLastVisit: number;
  totalSpent: number;
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

function calculateRecoveryProbability({
  aiStatus,
  averageVisitFrequencyDays,
  appointmentCount,
  daysSinceLastVisit,
  totalSpent,
}: {
  aiStatus: CustomerKpiUpdate["ai_status"];
  averageVisitFrequencyDays: number;
  appointmentCount: number;
  daysSinceLastVisit: number;
  totalSpent: number;
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
  const probability =
    baseProbability + valueBonus + historyBonus - longDelayPenalty;

  return Math.max(0, Math.min(100, probability));
}

function getAiStatusFromRetentionScore(score: number) {
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

function isMissingServicePriceError(error: { details?: string | null; message: string }) {
  return (
    error.message.includes("service_price") ||
    Boolean(error.details?.includes("service_price"))
  );
}

async function getAppointmentKpiRows(
  supabase: NonNullable<ReturnType<typeof createSupabaseServerClient>>,
  customerId: string,
  salonId: string,
) {
  const { data, error } = await supabase
    .from("appointments")
    .select("appointment_date,service_price")
    .eq("salon_id", salonId)
    .eq("customer_id", customerId)
    .order("appointment_date", { ascending: true });

  if (!error) {
    return {
      data: data as AppointmentKpiRow[] | null,
      error: null,
    };
  }

  if (!isMissingServicePriceError(error)) {
    return {
      data: null,
      error,
    };
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .from("appointments")
    .select("appointment_date,amount")
    .eq("salon_id", salonId)
    .eq("customer_id", customerId)
    .order("appointment_date", { ascending: true });

  return {
    data: fallbackData
      ? fallbackData.map((visit) => ({
          appointment_date: visit.appointment_date,
          service_price: visit.amount ?? 0,
          amount: visit.amount,
        }))
      : null,
    error: fallbackError,
  };
}

async function insertAppointment(
  supabase: NonNullable<ReturnType<typeof createSupabaseServerClient>>,
  appointment: {
    appointment_date: string;
    customer_id: string;
    notes: string | null;
    salon_id: string;
    service_name: string;
    service_price: number;
  },
) {
  const { error } = await supabase.from("appointments").insert(appointment);

  if (!error || !isMissingServicePriceError(error)) {
    return error;
  }

  const { error: fallbackError } = await supabase.from("appointments").insert({
    appointment_date: appointment.appointment_date,
    amount: appointment.service_price,
    customer_id: appointment.customer_id,
    notes: appointment.notes,
    salon_id: appointment.salon_id,
    service_name: appointment.service_name,
  });

  return fallbackError;
}

async function updateAppointmentRow(
  supabase: NonNullable<ReturnType<typeof createSupabaseServerClient>>,
  appointment: {
    appointmentDate: string;
    appointmentId: string;
    customerId: string;
    notes: string | null;
    salonId: string;
    serviceName: string;
    servicePrice: number;
  },
) {
  const { error } = await supabase
    .from("appointments")
    .update({
      service_name: appointment.serviceName,
      appointment_date: appointment.appointmentDate,
      service_price: appointment.servicePrice,
      notes: appointment.notes,
    })
    .eq("id", appointment.appointmentId)
    .eq("salon_id", appointment.salonId)
    .eq("customer_id", appointment.customerId);

  if (!error || !isMissingServicePriceError(error)) {
    return error;
  }

  const { error: fallbackError } = await supabase
    .from("appointments")
    .update({
      service_name: appointment.serviceName,
      appointment_date: appointment.appointmentDate,
      amount: appointment.servicePrice,
      notes: appointment.notes,
    })
    .eq("id", appointment.appointmentId)
    .eq("salon_id", appointment.salonId)
    .eq("customer_id", appointment.customerId);

  return fallbackError;
}

function revalidateCustomerViews(customerId: string) {
  revalidatePath("/");
  revalidatePath("/clients");
  revalidatePath("/agenda-ai");
  revalidatePath("/fidelizzazione");
  revalidatePath("/fatturato");
  revalidatePath("/opportunita-ai");
  revalidatePath("/campagne");
  revalidatePath("/impostazioni-ai");
  revalidatePath(`/clients/${customerId}`);
}

function logCustomerKpiRecalculation({
  aiStatus,
  averageVisitFrequencyDays,
  appointmentCount,
  customerId,
  lastVisitDate,
  recoveryProbability,
  retentionScore,
  totalSpent,
}: {
  aiStatus: CustomerKpiUpdate["ai_status"];
  averageVisitFrequencyDays: number;
  appointmentCount: number;
  customerId: string;
  lastVisitDate: string | null;
  recoveryProbability: number;
  retentionScore: number;
  totalSpent: number;
}) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.log("customerId:", customerId);
  console.log("appointment count:", appointmentCount);
  console.log("calculated total_spent:", totalSpent);
  console.log("calculated last_visit_date:", lastVisitDate);
  console.log(
    "calculated average_visit_frequency_days:",
    averageVisitFrequencyDays,
  );
  console.log("calculated retention_score:", retentionScore);
  console.log("calculated ai_status:", aiStatus);
  console.log("calculated recovery_probability:", recoveryProbability);
}

async function updateCustomerKpisFromAppointments(
  supabase: NonNullable<ReturnType<typeof createSupabaseServerClient>>,
  customerId: string,
  salonId: string,
  kpis: CustomerKpiUpdate,
) {
  console.log("RECALC UPDATE PAYLOAD", { customerId, kpis });

  const { data, error } = await supabase
    .from("customers")
    .update(kpis)
    .eq("salon_id", salonId)
    .eq("id", customerId)
    .select("id,birth_date,total_spent,average_visit_frequency_days,retention_score,ai_status,last_visit_date")
    .single();

  console.log("RECALC UPDATE RESULT", data);

  if (error) {
    const missingRecoveryProbability =
      error.message.includes("recovery_probability") ||
      error.details?.includes("recovery_probability");

    if (missingRecoveryProbability) {
      const compatibleKpis = {
        total_spent: kpis.total_spent,
        average_visit_frequency_days: kpis.average_visit_frequency_days,
        retention_score: kpis.retention_score,
        ai_status: kpis.ai_status,
        last_visit_date: kpis.last_visit_date,
      };
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("customers")
        .update(compatibleKpis)
        .eq("salon_id", salonId)
        .eq("id", customerId)
        .select("id,birth_date,total_spent,average_visit_frequency_days,retention_score,ai_status,last_visit_date")
        .single();

      console.log("RECALC UPDATE FALLBACK RESULT", fallbackData);

      if (!fallbackError && fallbackData) {
        return {
          success: true,
          message: "",
        };
      }

      if (fallbackError) {
        console.error("RECALC UPDATE FALLBACK ERROR", fallbackError);
      }
    }

    console.error("RECALC UPDATE ERROR", error);
    console.error("Errore Supabase aggiornamento KPI cliente:", error);

    return {
      success: false,
      message: `KPI cliente non aggiornati: ${error.message}${
        error.details ? ` Dettagli: ${error.details}` : ""
      }${error.hint ? ` Suggerimento: ${error.hint}` : ""}${
        error.code ? ` Codice: ${error.code}` : ""
      }`,
    };
  }

  if (!data) {
    return {
      success: false,
      message:
        "KPI cliente non aggiornati: nessun record cliente modificato. Controlla le policy RLS di Supabase.",
    };
  }

  return {
    success: true,
    message: "",
  };
}

export async function recalculateCustomerMetrics(
  customerId: string,
) {
  console.log("RECALC START", customerId);

  const supabase = createSupabaseServerClient();
  const currentSalon = await getCurrentSalon();

  if (!supabase || !currentSalon) {
    return {
      success: false,
      message: "Configurazione Supabase non valida. Controlla le variabili ambiente.",
    };
  }

  const { data: visits, error: visitsError } = await getAppointmentKpiRows(
    supabase,
    customerId,
    currentSalon.id,
  );

  console.log("RECALC APPOINTMENTS FOUND", visits);

  if (visitsError) {
    console.error("Errore Supabase ricalcolo visite:", visitsError);

    return {
      success: false,
      message: `KPI cliente non aggiornati: ${visitsError.message}`,
    };
  }

  if (!visits || visits.length === 0) {
    const emptyMetrics: CustomerKpiUpdate = {
      total_spent: 0,
      average_visit_frequency_days: 30,
      retention_score: 0,
      ai_status: "Perso",
      recovery_probability: 0,
      last_visit_date: null,
    };
    const recalculation = await updateCustomerKpisFromAppointments(
      supabase,
      customerId,
      currentSalon.id,
      emptyMetrics,
    );

    console.log("RECALC CALCULATED TOTAL", emptyMetrics.total_spent);

    if (!recalculation.success) {
      return recalculation;
    }

    logCustomerKpiRecalculation({
      aiStatus: emptyMetrics.ai_status,
      averageVisitFrequencyDays: emptyMetrics.average_visit_frequency_days,
      appointmentCount: 0,
      customerId,
      lastVisitDate: emptyMetrics.last_visit_date,
      recoveryProbability: emptyMetrics.recovery_probability,
      retentionScore: emptyMetrics.retention_score,
      totalSpent: emptyMetrics.total_spent,
    });

    return {
      success: true,
      message: "",
    };
  }

  const totalSpent = visits.reduce((total, visit) => {
    const visitAmount = Number(visit.service_price ?? 0);

    return total + (Number.isFinite(visitAmount) ? visitAmount : 0);
  }, 0);
  const averageVisitFrequencyDays = calculateAverageVisitFrequencyDays(visits);
  const lastVisitDate = visits[visits.length - 1].appointment_date;
  const daysSinceLastVisit = differenceInDays(
    new Date(`${lastVisitDate}T00:00:00`),
    new Date(),
  );
  const benchmark = await getRetentionBenchmark(supabase, currentSalon.id);
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
  const metrics: CustomerKpiUpdate = {
    total_spent: totalSpent,
    average_visit_frequency_days: averageVisitFrequencyDays,
    retention_score: retentionScore,
    ai_status: aiStatus,
    recovery_probability: recoveryProbability,
    last_visit_date: lastVisitDate,
  };

  console.log("RECALC CALCULATED TOTAL", totalSpent);

  const recalculation = await updateCustomerKpisFromAppointments(
    supabase,
    customerId,
    currentSalon.id,
    metrics,
  );

  if (!recalculation.success) {
    return recalculation;
  }

  logCustomerKpiRecalculation({
    aiStatus: metrics.ai_status,
    averageVisitFrequencyDays: metrics.average_visit_frequency_days,
    appointmentCount: visits.length,
    customerId,
    lastVisitDate: metrics.last_visit_date,
    recoveryProbability: metrics.recovery_probability,
    retentionScore: metrics.retention_score,
    totalSpent: metrics.total_spent,
  });

  return {
    success: true,
    message: "",
  };
}

function extractOpenAiText(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "output_text" in payload &&
    typeof payload.output_text === "string"
  ) {
    return payload.output_text.trim();
  }

  if (!payload || typeof payload !== "object" || !("output" in payload)) {
    return "";
  }

  const output = payload.output;

  if (!Array.isArray(output)) {
    return "";
  }

  return output
    .flatMap((item) => {
      if (!item || typeof item !== "object" || !("content" in item)) {
        return [];
      }

      const content = item.content;

      if (!Array.isArray(content)) {
        return [];
      }

      return content.flatMap((part) => {
        if (!part || typeof part !== "object" || !("text" in part)) {
          return [];
        }

        return typeof part.text === "string" ? [part.text] : [];
      });
    })
    .join("\n")
    .trim();
}

function extractOpenAiErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "Errore OpenAI sconosciuto.";
  }

  if ("error" in payload) {
    const error = payload.error;

    if (error && typeof error === "object" && "message" in error) {
      return typeof error.message === "string"
        ? error.message
        : JSON.stringify(error.message);
    }

    if (typeof error === "string") {
      return error;
    }
  }

  if ("message" in payload && typeof payload.message === "string") {
    return payload.message;
  }

  return JSON.stringify(payload);
}

export async function generateAiRecoveryMessage(
  customerId: string,
): Promise<GenerateRecoveryMessageResult> {
  if (!customerId) {
    return {
      success: false,
      message: "Cliente non valido. Riapri il profilo e riprova.",
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const hasOpenAiApiKey = Boolean(apiKey);

  console.log("OPENAI_API_KEY exists:", hasOpenAiApiKey);

  if (!apiKey) {
    return {
      success: false,
      message: "Chiave OpenAI non configurata. Aggiungi OPENAI_API_KEY in .env.local.",
    };
  }

  const supabase = createSupabaseServerClient();
  const currentSalon = await getCurrentSalon();

  if (!supabase || !currentSalon) {
    return {
      success: false,
      message: "Configurazione Supabase non valida. Controlla le variabili ambiente.",
    };
  }

  const { data: customer, error } = await supabase
    .from("customers")
    .select(
      "first_name,birth_date,gender,ai_status,last_visit_date,total_spent,retention_score,average_visit_frequency_days",
    )
    .eq("salon_id", currentSalon.id)
    .eq("id", customerId)
    .maybeSingle();

  if (error) {
    console.error("Errore Supabase generateAiRecoveryMessage:", error);

    return {
      success: false,
      message: `Messaggio non generato: ${error.message}`,
    };
  }

  if (!customer) {
    return {
      success: false,
      message: "Cliente non trovato. Aggiorna la pagina e riprova.",
    };
  }

  const gender = normalizeCustomerGender(customer.gender);
  const grammar = getCustomerGenderGrammar(gender);
  const prompt = `Sei un assistente CRM per centri estetici e saloni beauty.

Genera un messaggio WhatsApp breve, naturale e professionale.

Dati cliente:
Nome: ${customer.first_name}
Genere: ${gender.toLowerCase()}
Stato: ${customer.ai_status ?? "Non disponibile"}
Ultima visita: ${customer.last_visit_date ?? "Non disponibile"}
Spesa totale: ${customer.total_spent ?? 0}€
Punteggio fidelizzazione: ${customer.retention_score ?? "Non disponibile"}
Frequenza media visite: ${
    customer.average_visit_frequency_days ?? "Non disponibile"
  } giorni

Obiettivo:
Riportare il cliente in salone senza essere aggressivi.

Regole grammaticali:
${grammar.instruction}
Scrivi in italiano naturale e professionale.
Non usare emoji. Scrivi solo testo italiano pulito.

Massimo 80 parole.`;

  try {
    console.log("OpenAI API call executed:", true);

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-5.4-nano",
        input: prompt,
        max_output_tokens: 180,
      }),
    });

    const payload: unknown = await response.json();

    console.log("OpenAI response status:", response.status);

    if (!response.ok) {
      const openAiErrorMessage = extractOpenAiErrorMessage(payload);

      console.error("Exact OpenAI error message:", openAiErrorMessage);
      console.error("OPENAI ERROR:", payload);

      return {
        success: false,
        message:
          process.env.NODE_ENV === "development"
            ? `OpenAI: ${openAiErrorMessage}`
            : "OpenAI non ha generato il messaggio. Controlla la chiave API e riprova.",
      };
    }

    const message = extractOpenAiText(payload);

    if (!message) {
      return {
        success: false,
        message: "OpenAI ha risposto senza testo. Riprova tra qualche istante.",
      };
    }

    return {
      success: true,
      message: cleanWhatsAppMessage(message),
    };
  } catch (openAiError) {
    const openAiErrorMessage =
      openAiError instanceof Error
        ? openAiError.message
        : String(openAiError);

    console.error("Exact OpenAI error message:", openAiErrorMessage);
    console.error("OPENAI ERROR:", openAiError);

    return {
      success: false,
      message:
        process.env.NODE_ENV === "development"
          ? `OpenAI: ${openAiErrorMessage}`
          : "Non riesco a contattare OpenAI in questo momento. Riprova tra poco.",
    };
  }
}

export async function addAppointment(
  customerId: string,
  _previousState: AddAppointmentState,
  formData: FormData,
): Promise<AddAppointmentState> {
  const serviceName = getText(formData, "service_name");
  const appointmentDate = getText(formData, "appointment_date");
  const servicePrice = getNumber(formData, "service_price");
  const notes = getText(formData, "notes");

  if (!customerId) {
    return {
      success: false,
      message: "Cliente non valido. Riapri il profilo e riprova.",
    };
  }

  if (!serviceName) {
    return {
      success: false,
      message: "Inserisci il nome del servizio.",
    };
  }

  if (!appointmentDate) {
    return {
      success: false,
      message: "Inserisci la data della visita.",
    };
  }

  if (servicePrice === null || servicePrice < 0) {
    return {
      success: false,
      message: "Inserisci un prezzo valido.",
    };
  }

  const supabase = createSupabaseServerClient();
  const currentSalon = await getCurrentSalon();

  if (!supabase || !currentSalon) {
    return {
      success: false,
      message: "Configurazione Supabase non valida. Controlla le variabili ambiente.",
    };
  }

  const error = await insertAppointment(supabase, {
    customer_id: customerId,
    salon_id: currentSalon.id,
    service_name: serviceName,
    appointment_date: appointmentDate,
    service_price: servicePrice,
    notes: notes || null,
  });

  if (error) {
    console.error("Errore Supabase addAppointment:", error);

    return {
      success: false,
      message: `Visita non salvata: ${error.message}`,
    };
  }

  const recalculation = await recalculateCustomerMetrics(customerId);

  if (!recalculation.success) {
    return {
      success: false,
      message: `Visita salvata, ma ${recalculation.message}`,
    };
  }

  revalidateCustomerViews(customerId);

  return {
    success: true,
    message: "Visita aggiunta e KPI cliente aggiornati con successo.",
  };
}

export async function updateAppointment(
  customerId: string,
  appointmentId: string,
  _previousState: EditAppointmentState,
  formData: FormData,
): Promise<EditAppointmentState> {
  const serviceName = getText(formData, "service_name");
  const appointmentDate = getText(formData, "appointment_date");
  const servicePrice = getNumber(formData, "service_price");
  const notes = getText(formData, "notes");

  if (!customerId || !appointmentId) {
    return {
      success: false,
      message: "Visita non valida. Aggiorna il profilo e riprova.",
    };
  }

  if (!serviceName) {
    return {
      success: false,
      message: "Inserisci il nome del servizio.",
    };
  }

  if (!appointmentDate) {
    return {
      success: false,
      message: "Inserisci la data della visita.",
    };
  }

  if (servicePrice === null || servicePrice < 0) {
    return {
      success: false,
      message: "Inserisci un prezzo valido.",
    };
  }

  const supabase = createSupabaseServerClient();
  const currentSalon = await getCurrentSalon();

  if (!supabase || !currentSalon) {
    return {
      success: false,
      message: "Configurazione Supabase non valida. Controlla le variabili ambiente.",
    };
  }

  const error = await updateAppointmentRow(supabase, {
    appointmentDate,
    appointmentId,
    customerId,
    notes: notes || null,
    salonId: currentSalon.id,
    serviceName,
    servicePrice,
  });

  if (error) {
    console.error("Errore Supabase updateAppointment:", error);

    return {
      success: false,
      message: `Visita non aggiornata: ${error.message}`,
    };
  }

  const recalculation = await recalculateCustomerMetrics(customerId);

  if (!recalculation.success) {
    return {
      success: false,
      message: `Visita aggiornata, ma ${recalculation.message}`,
    };
  }

  revalidateCustomerViews(customerId);

  return {
    success: true,
    message: "Visita aggiornata e KPI cliente ricalcolati con successo.",
  };
}

export async function deleteAppointment(
  customerId: string,
  appointmentId: string,
  previousState: DeleteAppointmentState,
): Promise<DeleteAppointmentState> {
  void previousState;

  if (!customerId || !appointmentId) {
    return {
      success: false,
      message: "Visita non valida. Aggiorna il profilo e riprova.",
    };
  }

  const supabase = createSupabaseServerClient();
  const currentSalon = await getCurrentSalon();

  if (!supabase || !currentSalon) {
    return {
      success: false,
      message: "Configurazione Supabase non valida. Controlla le variabili ambiente.",
    };
  }

  const { error } = await supabase
    .from("appointments")
    .delete()
    .eq("id", appointmentId)
    .eq("salon_id", currentSalon.id)
    .eq("customer_id", customerId);

  if (error) {
    console.error("Errore Supabase deleteAppointment:", error);

    return {
      success: false,
      message: `Visita non eliminata: ${error.message}`,
    };
  }

  const recalculation = await recalculateCustomerMetrics(customerId);

  if (!recalculation.success) {
    return {
      success: false,
      message: `Visita eliminata, ma ${recalculation.message}`,
    };
  }

  revalidateCustomerViews(customerId);

  return {
    success: true,
    message: "Visita eliminata e KPI cliente ricalcolati con successo.",
  };
}

export async function addCustomer(
  _previousState: AddCustomerState,
  formData: FormData,
): Promise<AddCustomerState> {
  const firstName = getText(formData, "first_name");
  const lastName = getText(formData, "last_name");
  const phone = getText(formData, "phone");
  const email = getText(formData, "email");
  const birthDate = getOptionalDate(formData, "birth_date");
  const gender = getGender(formData);
  const notes = getText(formData, "notes");

  if (!firstName || !lastName) {
    return {
      success: false,
      message: "Inserisci nome e cognome del cliente.",
    };
  }

  if (!phone && !email) {
    return {
      success: false,
      message: "Inserisci almeno un contatto: telefono o email.",
    };
  }

  const supabase = createSupabaseServerClient();
  const currentSalon = await getCurrentSalon();

  if (!supabase || !currentSalon) {
    return {
      success: false,
      message: "Configurazione Supabase non valida. Controlla le variabili ambiente.",
    };
  }

  const customerPayload = {
    first_name: firstName,
    last_name: lastName,
    phone: phone || null,
    email: email || null,
    birth_date: birthDate,
    gender,
    ai_status: "Perso",
    retention_score: 0,
    total_spent: 0,
    average_visit_frequency_days: 30,
    last_visit_date: null,
    notes: notes || null,
    salon_id: currentSalon.id,
  };
  let { error } = await supabase.from("customers").insert(customerPayload);

  if (error && shouldRetryWithLegacyGender(error)) {
    const fallback = await supabase.from("customers").insert({
      ...customerPayload,
      gender: toLegacyCustomerGenderValue(gender),
    });

    error = fallback.error;
  }

  if (error) {
    console.error("Errore Supabase addCustomer:", error);

    return {
      success: false,
      message: `Cliente non salvato: ${error.message}`,
    };
  }

  revalidatePath("/");
  revalidatePath("/clients");
  revalidatePath("/agenda-ai");
  revalidatePath("/fidelizzazione");

  return {
    success: true,
    message: "Cliente aggiunto con successo.",
  };
}

export async function updateCustomer(
  customerId: string,
  _previousState: EditCustomerState,
  formData: FormData,
): Promise<EditCustomerState> {
  const firstName = getText(formData, "first_name");
  const lastName = getText(formData, "last_name");
  const phone = getText(formData, "phone");
  const email = getText(formData, "email");
  const birthDate = getOptionalDate(formData, "birth_date");
  const gender = getGender(formData);
  const notes = getText(formData, "notes");

  if (!customerId) {
    return {
      success: false,
      message: "Cliente non valido. Riapri il profilo e riprova.",
    };
  }

  if (!firstName || !lastName) {
    return {
      success: false,
      message: "Inserisci nome e cognome del cliente.",
    };
  }

  if (!phone && !email) {
    return {
      success: false,
      message: "Inserisci almeno un contatto: telefono o email.",
    };
  }

  const supabase = createSupabaseServerClient();
  const currentSalon = await getCurrentSalon();

  if (!supabase || !currentSalon) {
    return {
      success: false,
      message: "Configurazione Supabase non valida. Controlla le variabili ambiente.",
    };
  }

  const customerPayload = {
    first_name: firstName,
    last_name: lastName,
    phone: phone || null,
    email: email || null,
    birth_date: birthDate,
    gender,
    notes: notes || null,
  };
  let { data: updatedCustomer, error } = await supabase
    .from("customers")
    .update(customerPayload)
    .eq("salon_id", currentSalon.id)
    .eq("id", customerId)
    .select("id,birth_date")
    .single();

  if (error && shouldRetryWithLegacyGender(error)) {
    const fallback = await supabase
      .from("customers")
      .update({
        ...customerPayload,
        gender: toLegacyCustomerGenderValue(gender),
      })
      .eq("salon_id", currentSalon.id)
      .eq("id", customerId)
      .select("id,birth_date")
      .single();

    updatedCustomer = fallback.data;
    error = fallback.error;
  }

  if (error) {
    console.error("Errore Supabase updateCustomer:", error);

    return {
      success: false,
      message: `Cliente non aggiornato: ${error.message}`,
    };
  }

  if (!updatedCustomer) {
    return {
      success: false,
      message: "Cliente non aggiornato: nessun profilo trovato con questo ID.",
    };
  }

  const recalculation = await recalculateCustomerMetrics(customerId);

  if (!recalculation.success) {
    return {
      success: false,
      message: `Cliente aggiornato, ma ${recalculation.message}`,
    };
  }

  revalidateCustomerViews(customerId);

  return {
    success: true,
    message: "Cliente aggiornato con successo",
  };
}

export async function deleteCustomer(
  customerId: string,
  previousState: DeleteCustomerState,
): Promise<DeleteCustomerState> {
  void previousState;

  if (!customerId) {
    return {
      success: false,
      message: "Cliente non valido. Riapri il profilo e riprova.",
    };
  }

  const supabase = createSupabaseServerClient();
  const currentSalon = await getCurrentSalon();

  if (!supabase || !currentSalon) {
    return {
      success: false,
      message: "Configurazione Supabase non valida. Controlla le variabili ambiente.",
    };
  }

  const { error } = await supabase
    .from("customers")
    .delete()
    .eq("salon_id", currentSalon.id)
    .eq("id", customerId);

  if (error) {
    console.error("Errore Supabase deleteCustomer:", error);

    return {
      success: false,
      message: `Cliente non eliminato: ${error.message}`,
    };
  }

  revalidatePath("/");
  revalidatePath("/clients");
  revalidatePath("/fidelizzazione");
  revalidatePath(`/clients/${customerId}`);
  redirect("/clients?deleted=1");
}
