"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentSalon } from "@/lib/currentSalon";
import { normalizeCustomerGender } from "@/lib/gender";
import { cleanWhatsAppMessage } from "@/lib/whatsapp";

export type GenerateOpportunityMessageResult = {
  success: boolean;
  message: string;
  error: string;
};

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

export async function generateOpportunityMessage(
  customerId: string,
): Promise<GenerateOpportunityMessageResult> {
  if (!customerId) {
    return {
      success: false,
      message: "",
      error: "Cliente non valido.",
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      message: "",
      error: "Chiave OpenAI non configurata. Aggiungi OPENAI_API_KEY in .env.local.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const currentSalon = await getCurrentSalon();

  if (!supabase || !currentSalon) {
    return {
      success: false,
      message: "",
      error: "Configurazione Supabase non valida. Controlla le variabili ambiente.",
    };
  }

  const { data: customer, error } = await supabase
    .from("customers")
    .select(
      "first_name,last_name,phone,birth_date,gender,ai_status,last_visit_date,total_spent,retention_score,recovery_probability,average_visit_frequency_days",
    )
    .eq("salon_id", currentSalon.id)
    .eq("id", customerId)
    .single();

  if (error) {
    console.error("Errore Supabase opportunità AI:", error);

    return {
      success: false,
      message: "",
      error: `Messaggio non generato: ${error.message}`,
    };
  }

  if (
    customer.ai_status !== "A rischio" &&
    customer.ai_status !== "Perso"
  ) {
    return {
      success: false,
      message: "",
      error: "Questo cliente non appartiene ai segmenti recuperabili.",
    };
  }

  const prompt = `Sei un assistente CRM per centri estetici, saloni beauty, barber shop e nail studio.

Genera un messaggio WhatsApp breve, naturale e professionale per recuperare un cliente senza essere aggressivo.

Dati cliente:
Nome: ${customer.first_name ?? "Cliente"}
Cognome: ${customer.last_name ?? ""}
Genere: ${normalizeCustomerGender(customer.gender).toLowerCase()}
Stato AI: ${customer.ai_status}
Ultima visita: ${customer.last_visit_date ?? "Non disponibile"}
Spesa totale: ${customer.total_spent ?? 0}€
Punteggio fidelizzazione: ${customer.retention_score ?? "Non disponibile"}
Probabilità recupero: ${customer.recovery_probability ?? 0}%
Frequenza media visite: ${customer.average_visit_frequency_days ?? 30} giorni

Regole:
- Massimo 80 parole.
- Usa italiano professionale e semplice.
- Usa il nome reale del cliente.
- Rispetta la grammatica italiana in base al genere.
- Non usare emoji. Scrivi solo testo italiano pulito.
- Non promettere sconti se non richiesto.
- Non dire che il messaggio è generato da AI.
- Chiudi con una proposta morbida di appuntamento.`;

  try {
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

    if (!response.ok) {
      const openAiErrorMessage = extractOpenAiErrorMessage(payload);

      console.error("OPENAI OPPORTUNITA ERROR:", payload);

      return {
        success: false,
        message: "",
        error:
          process.env.NODE_ENV === "development"
            ? `OpenAI: ${openAiErrorMessage}`
            : "OpenAI non ha generato il messaggio. Controlla la chiave API e riprova.",
      };
    }

    const message = extractOpenAiText(payload);

    if (!message) {
      return {
        success: false,
        message: "",
        error: "OpenAI ha risposto senza testo. Riprova tra qualche istante.",
      };
    }

    return {
      success: true,
      error: "",
      message: cleanWhatsAppMessage(message),
    };
  } catch (openAiError) {
    console.error("OPENAI OPPORTUNITA ERROR:", openAiError);

    return {
      success: false,
      message: "",
      error:
        process.env.NODE_ENV === "development"
          ? `OpenAI: ${
              openAiError instanceof Error
                ? openAiError.message
                : String(openAiError)
            }`
          : "Non riesco a contattare OpenAI in questo momento. Riprova tra poco.",
    };
  }
}
