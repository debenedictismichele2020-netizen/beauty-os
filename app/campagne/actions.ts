"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentSalon } from "@/lib/currentSalon";
import {
  defaultAiSettings,
  normalizeAiSettings,
  type AiGenerationSettings,
} from "@/lib/aiSettings";
import { normalizeCustomerGender } from "@/lib/gender";
import { cleanWhatsAppMessage } from "@/lib/whatsapp";
import {
  calculateAge,
  getAgeCampaignSegment,
  getAgeSegmentStatus,
  isAgeCampaignSegmentStatus,
  type AgeCampaignSegmentStatus,
} from "./ageSegments";
import {
  formatBirthdayDate,
  getBirthdayCampaignOccurrence,
  getBirthdayCampaignSegment,
  getBirthdayOccurrence,
  isBirthdayCampaignSegmentStatus,
  matchesBirthdaySegment,
  type BirthdayCampaignSegmentStatus,
} from "./birthdaySegments";

export type AiCampaignSegmentStatus = "VIP" | "A rischio" | "Perso";
export type CampaignSegmentStatus =
  | AiCampaignSegmentStatus
  | AgeCampaignSegmentStatus
  | BirthdayCampaignSegmentStatus;

export type CampaignCustomerPreview = {
  age: number | null;
  birthdayAge: number | null;
  birthdayDate: string;
  id: string;
  lastVisitDate: string;
  name: string;
  phone: string;
  recoveryProbability: number | null;
  status: string;
  totalSpent: number;
  message: string;
};

export type CampaignSelectedCustomer = Omit<CampaignCustomerPreview, "message">;

export type CampaignServiceSuggestion = {
  averageDurationMinutes?: number | null;
  averagePrice?: number | null;
  category?: string;
  name: string;
};

export type CampaignCustomersPreviewResult = {
  customers: CampaignSelectedCustomer[];
  error: string;
  success: boolean;
};

export type GenerateCampaignResult = {
  success: boolean;
  campaignName: string;
  objective: string;
  message: string;
  customers: CampaignCustomerPreview[];
  error: string;
};

export type CustomCampaignSegment =
  | "all"
  | "manual_customers"
  | "lost"
  | "at-risk"
  | "vip"
  | "age:18-25"
  | "age:26-35"
  | "age:36-50"
  | "age:50-plus"
  | "birthday:month";

export type CustomCampaignInput = {
  channel: "WhatsApp";
  messageTone: string;
  name: string;
  objective: string;
  objectiveType: string;
  segment: CustomCampaignSegment;
  manualCustomerIds?: string[];
  selectedServices: Array<string | CampaignServiceSuggestion>;
};

const segmentLabels: Record<CampaignSegmentStatus, string> = {
  VIP: "Clienti VIP",
  "A rischio": "Clienti A rischio",
  Perso: "Clienti Persi",
  "age:18-25": "Clienti 18-25 anni",
  "age:26-35": "Clienti 26-35 anni",
  "age:36-50": "Clienti 36-50 anni",
  "age:50-plus": "Clienti 50+ anni",
  "birthday:today": "Compleanni oggi",
  "birthday:next-7": "Compleanni prossimi 7 giorni",
  "birthday:month": "Compleanni del mese",
};

const customSegmentLabels: Record<CustomCampaignSegment, string> = {
  all: "Tutti i clienti",
  manual_customers: "Selezione manuale clienti",
  lost: "Clienti persi",
  "at-risk": "Clienti a rischio",
  vip: "Clienti VIP",
  "age:18-25": "Clienti 18-25 anni",
  "age:26-35": "Clienti 26-35 anni",
  "age:36-50": "Clienti 36-50 anni",
  "age:50-plus": "Clienti 50+ anni",
  "birthday:month": "Compleanni del mese",
};

const customerSelect =
  "id,first_name,last_name,phone,birth_date,gender,ai_status,average_visit_frequency_days,last_visit_date,total_spent,retention_score";

function normalizeSelectedServices(
  selectedServices: Array<string | CampaignServiceSuggestion> = [],
) {
  const seenServices = new Set<string>();
  const normalizedServices: CampaignServiceSuggestion[] = [];

  selectedServices.forEach((service) => {
    const serviceName =
      typeof service === "string" ? service.trim() : service.name.trim();
    const serviceKey = serviceName.toLowerCase();

    if (!serviceName || seenServices.has(serviceKey)) {
      return;
    }

    seenServices.add(serviceKey);
    normalizedServices.push(
      typeof service === "string"
        ? { name: serviceName }
        : {
            averageDurationMinutes: service.averageDurationMinutes ?? null,
            averagePrice: service.averagePrice ?? null,
            category: service.category?.trim() || "Altro",
            name: serviceName,
          },
    );
  });

  return normalizedServices.slice(0, 12);
}

function getSelectedServiceNames(services: CampaignServiceSuggestion[]) {
  return services.map((service) => service.name);
}

function formatServicesForPrompt(services: CampaignServiceSuggestion[]) {
  return services
    .map((service) => {
      const details = [
        service.category ? `categoria ${service.category}` : "",
        service.averagePrice ? `prezzo medio ${service.averagePrice}€` : "",
        service.averageDurationMinutes
          ? `durata ${service.averageDurationMinutes} minuti`
          : "",
      ].filter(Boolean);

      return details.length > 0
        ? `${service.name} (${details.join(", ")})`
        : service.name;
    })
    .join("; ");
}

function formatAiSettingsForPrompt(settings: AiGenerationSettings) {
  const creativityRule = {
    Bilanciata: "naturale, personalizzato, con variazione moderata.",
    Conservativa: "testo diretto, professionale, con poca variazione.",
    Creativa:
      "più variazione, angoli comunicativi diversi, senza esagerare.",
  }[settings.creativity];
  const activePreferences = [
    settings.preferences.neverMentionAge
      ? "Non citare mai l’età del cliente nel messaggio."
      : "",
    settings.preferences.avoidCommercialTone
      ? "Evita un tono troppo commerciale o aggressivo."
      : "",
    settings.preferences.alwaysSuggestAvailability
      ? "Proponi sempre una disponibilità o un contatto per scegliere un orario."
      : "",
    settings.preferences.personalizeByService
      ? "Personalizza il messaggio in base al servizio scelto."
      : "",
    settings.preferences.personalizeByVisitHistory
      ? "Personalizza il messaggio in base allo storico visite quando disponibile."
      : "",
  ].filter(Boolean);

  return [
    `Tono richiesto: ${settings.tone}.`,
    `Lunghezza richiesta: ${settings.messageLength}.`,
    `Creatività AI: ${settings.creativity}. Regola: ${creativityRule}`,
    settings.businessSignature
      ? `Firma attività: ${settings.businessSignature}. Usala in modo naturale, al massimo una volta, senza allungare troppo il messaggio.`
      : "Firma attività non impostata: non aggiungere firme inventate.",
    `Stile emoji richiesto: ${settings.emojiStyle}. Non generare emoji direttamente: il frontend applica eventuali emoji sicure.`,
    activePreferences.length > 0
      ? `Preferenze operative: ${activePreferences.join(" ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
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

function parseCampaignText(text: string) {
  const fallback = {
    campaignName: "Campagna WhatsApp AI",
    objective: "Generare un contatto mirato per il segmento selezionato.",
    message: text,
    customers: [] as CampaignCustomerPreview[],
  };

  try {
    const parsed = JSON.parse(text) as Partial<{
      campaignName: string;
      customers: Array<{
        id?: string;
        message?: string;
      }>;
      objective: string;
      message: string;
    }>;

    return {
      campaignName: parsed.campaignName?.trim() || fallback.campaignName,
      customers: [],
      objective: parsed.objective?.trim() || fallback.objective,
      message: parsed.message?.trim() || fallback.message,
      rawCustomers: Array.isArray(parsed.customers) ? parsed.customers : [],
    };
  } catch {
    return fallback;
  }
}

function formatCustomerForPrompt(customer: {
  average_visit_frequency_days: number | null;
  birth_date: string | null | undefined;
  first_name: string;
  gender: string | null;
  id: string;
  last_name: string;
  last_visit_date: string | null;
  phone: string | null;
  total_spent: number | null;
  ai_status: string | null;
}, recentServices: string[] = [], segmentStatus?: CampaignSegmentStatus) {
  const birthdayOccurrence = segmentStatus && isBirthdayCampaignSegmentStatus(segmentStatus)
    ? getBirthdayCampaignOccurrence(customer.birth_date, segmentStatus)
    : getBirthdayOccurrence(customer.birth_date);

  return {
    id: customer.id,
    nome: customer.first_name,
    cognome: customer.last_name,
    eta: calculateAge(customer.birth_date),
    telefono: customer.phone ?? "",
    genere: normalizeCustomerGender(customer.gender).toLowerCase(),
    stato: customer.ai_status ?? "Non disponibile",
    frequenza_media_giorni: customer.average_visit_frequency_days ?? 30,
    ultima_visita: customer.last_visit_date ?? "Non disponibile",
    ultimi_servizi: recentServices,
    compleanno: birthdayOccurrence
      ? formatBirthdayDate(birthdayOccurrence.dateKey)
      : "Non disponibile",
    eta_che_compie: birthdayOccurrence?.ageTurning ?? null,
    spesa_totale: customer.total_spent ?? 0,
  };
}

async function getRecentServicesByCustomerId(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  salonId: string,
  customerIds: string[],
) {
  if (customerIds.length === 0) {
    return new Map<string, string[]>();
  }

  const { data, error } = await supabase
    .from("appointments")
    .select("customer_id,service_name,appointment_date")
    .eq("salon_id", salonId)
    .in("customer_id", customerIds)
    .order("appointment_date", { ascending: false });

  if (error) {
    console.error("Errore Supabase servizi recenti campagna:", error);

    return new Map<string, string[]>();
  }

  return (data ?? []).reduce((servicesByCustomer, appointment) => {
    const customerServices = servicesByCustomer.get(appointment.customer_id) ?? [];

    if (
      appointment.service_name &&
      !customerServices.includes(appointment.service_name) &&
      customerServices.length < 3
    ) {
      customerServices.push(appointment.service_name);
    }

    servicesByCustomer.set(appointment.customer_id, customerServices);

    return servicesByCustomer;
  }, new Map<string, string[]>());
}

function createFallbackCustomerMessage(customer: {
  ai_status: string | null;
  birth_date?: string | null | undefined;
  first_name: string;
  last_visit_date: string | null;
}, segmentStatus?: CampaignSegmentStatus, selectedServices: string[] = []) {
  const firstName = customer.first_name;
  const [primaryService] = selectedServices;

  if (segmentStatus && isBirthdayCampaignSegmentStatus(segmentStatus)) {
    if (primaryService) {
      return `Ciao ${firstName}, tanti auguri! Per festeggiare, abbiamo pensato a ${primaryService.toLowerCase()} come piccola coccola beauty dedicata a te. Ti va se ti proponiamo qualche disponibilita nei prossimi giorni?`;
    }

    return `Ciao ${firstName}, tanti auguri! Per festeggiare, abbiamo pensato a una piccola coccola beauty dedicata a te. Ti va se ti proponiamo qualche disponibilita nei prossimi giorni?`;
  }

  if (segmentStatus && isAgeCampaignSegmentStatus(segmentStatus)) {
    if (primaryService === "Massaggio relax") {
      return `Ciao ${firstName}, abbiamo pensato a un momento di relax dedicato a te. Se ti va, possiamo proporti un massaggio rilassante nei prossimi giorni.`;
    }

    if (primaryService === "Trattamento viso" || primaryService === "Pulizia viso") {
      return `Ciao ${firstName}, abbiamo pensato a un trattamento viso personalizzato per valorizzare la tua routine beauty nei prossimi giorni. Ti va se ti proponiamo qualche disponibilita?`;
    }

    if (primaryService === "Laminazione ciglia") {
      return `Ciao ${firstName}, abbiamo pensato a una laminazione ciglia per dare piu luce allo sguardo in modo naturale e curato. Ti va se ti proponiamo qualche disponibilita?`;
    }

    if (primaryService === "Trattamento corpo") {
      return `Ciao ${firstName}, abbiamo pensato a un trattamento corpo mirato per regalarti un momento di cura e benessere nei prossimi giorni.`;
    }

    if (primaryService === "Manicure" || primaryService === "Pedicure") {
      return `Ciao ${firstName}, abbiamo pensato a una proposta ${primaryService.toLowerCase()} curata e facile da inserire nella tua settimana. Ti va se ti proponiamo qualche orario?`;
    }

    if (primaryService === "Barba / grooming uomo") {
      return `Ciao ${firstName}, abbiamo pensato a un servizio grooming curato per rinfrescare il look nei prossimi giorni. Ti va se ti proponiamo qualche disponibilita?`;
    }

    if (primaryService === "Pacchetto sposa") {
      return `Ciao ${firstName}, abbiamo pensato a un percorso beauty elegante e personalizzato per preparare ogni dettaglio con calma e cura.`;
    }

    if (primaryService === "Check-up beauty") {
      return `Ciao ${firstName}, abbiamo pensato a un check-up beauty per capire insieme il trattamento piu adatto alla tua routine nei prossimi giorni.`;
    }

    if (primaryService) {
      return `Ciao ${firstName}, abbiamo pensato a ${primaryService.toLowerCase()} come proposta beauty dedicata per i prossimi giorni. Ti va se ti proponiamo qualche disponibilita?`;
    }

    if (segmentStatus === "age:18-25") {
      return `Ciao ${firstName}, abbiamo pensato a un trattamento beauty leggero e luminoso per dare nuova energia alla tua routine. Se ti va, ti proponiamo qualche disponibilita nei prossimi giorni.`;
    }

    if (segmentStatus === "age:26-35") {
      return `Ciao ${firstName}, abbiamo pensato a un trattamento curato e semplice da inserire nella tua settimana, perfetto per mantenere la tua routine beauty al meglio.`;
    }

    if (segmentStatus === "age:36-50") {
      return `Ciao ${firstName}, abbiamo pensato a un trattamento viso/corpo mirato per valorizzare la tua routine beauty e regalarti un momento di benessere.`;
    }

    return `Ciao ${firstName}, ci farebbe piacere riservarti un trattamento premium dedicato al benessere e alla cura personale, con tutta l'attenzione che meriti.`;
  }

  if (primaryService) {
    return `Ciao ${firstName}, abbiamo pensato a ${primaryService.toLowerCase()} come proposta beauty su misura per te. Se ti va, possiamo proporti qualche disponibilita nei prossimi giorni.`;
  }

  if (customer.ai_status === "VIP") {
    return `Ciao ${firstName}, ci farebbe piacere riservarti una nuova esperienza beauty su misura. Abbiamo conservato le note dei tuoi trattamenti preferiti e possiamo proporti una fascia comoda nei prossimi giorni.`;
  }

  if (customer.ai_status === "A rischio") {
    return `Ciao ${firstName}, abbiamo notato che e passato un po' dall'ultima visita. Se ti fa piacere, possiamo aiutarti a riprendere il tuo percorso beauty con un appuntamento tranquillo nei prossimi giorni.`;
  }

  return `Ciao ${firstName}, ci farebbe piacere rivederti in salone. Possiamo preparare un trattamento di rientro curato sulle tue esigenze e proporti alcuni orari disponibili questa settimana.`;
}

function toSelectedCampaignCustomer(customer: {
  ai_status: string | null;
  birth_date: string | null | undefined;
  first_name: string;
  id: string;
  last_name: string;
  last_visit_date: string | null;
  phone: string | null;
  retention_score: number | null;
  total_spent: number | null;
}, segmentStatus: CampaignSegmentStatus): CampaignSelectedCustomer {
  const totalSpent = Number(customer.total_spent ?? 0);
  const recoveryProbability = Number(customer.retention_score);
  const age = calculateAge(customer.birth_date);
  const birthdayOccurrence = isBirthdayCampaignSegmentStatus(segmentStatus)
    ? getBirthdayCampaignOccurrence(customer.birth_date, segmentStatus)
    : getBirthdayOccurrence(customer.birth_date);

  return {
    age,
    birthdayAge: birthdayOccurrence?.ageTurning ?? null,
    birthdayDate: birthdayOccurrence?.dateKey ?? "",
    id: customer.id,
    lastVisitDate: customer.last_visit_date ?? "",
    name: `${customer.first_name} ${customer.last_name}`.trim(),
    phone: customer.phone ?? "",
    recoveryProbability: Number.isFinite(recoveryProbability)
      ? Math.max(0, Math.min(100, Math.round(recoveryProbability)))
      : null,
    status:
      isAgeCampaignSegmentStatus(segmentStatus) ||
      isBirthdayCampaignSegmentStatus(segmentStatus)
        ? segmentLabels[segmentStatus]
        : segmentStatus,
    totalSpent: Number.isFinite(totalSpent) ? totalSpent : 0,
  };
}

function filterCustomersBySegment<
  CustomerItem extends {
    ai_status: string | null;
    birth_date: string | null | undefined;
  },
>(customers: CustomerItem[], segmentStatus: CampaignSegmentStatus) {
  if (isAgeCampaignSegmentStatus(segmentStatus)) {
    return customers.filter((customer) => {
      const age = calculateAge(customer.birth_date);

      return getAgeSegmentStatus(age) === segmentStatus;
    });
  }

  if (isBirthdayCampaignSegmentStatus(segmentStatus)) {
    return customers.filter((customer) =>
      matchesBirthdaySegment(customer.birth_date, segmentStatus),
    );
  }

  return customers.filter((customer) => customer.ai_status === segmentStatus);
}

function filterCustomersByCustomSegment<
  CustomerItem extends {
    ai_status: string | null;
    birth_date: string | null | undefined;
  },
>(customers: CustomerItem[], segment: CustomCampaignSegment) {
  if (segment === "all" || segment === "manual_customers") {
    return customers;
  }

  if (segment === "lost") {
    return customers.filter((customer) => customer.ai_status === "Perso");
  }

  if (segment === "at-risk") {
    return customers.filter((customer) => customer.ai_status === "A rischio");
  }

  if (segment === "vip") {
    return customers.filter((customer) => customer.ai_status === "VIP");
  }

  if (segment === "birthday:month") {
    return customers.filter((customer) =>
      matchesBirthdaySegment(customer.birth_date, "birthday:month"),
    );
  }

  return customers.filter((customer) => {
    const age = calculateAge(customer.birth_date);

    return getAgeSegmentStatus(age) === segment;
  });
}

export async function getCampaignSelectedCustomers(
  segmentStatus: CampaignSegmentStatus,
): Promise<CampaignCustomersPreviewResult> {
  if (!segmentLabels[segmentStatus]) {
    return {
      customers: [],
      error: "Segmento campagna non valido.",
      success: false,
    };
  }

  const supabase = await createSupabaseServerClient();
  const currentSalon = await getCurrentSalon();

  if (!supabase || !currentSalon) {
    return {
      customers: [],
      error: "Configurazione dati non disponibile.",
      success: false,
    };
  }

  const { data, error } = await supabase
    .from("customers")
    .select(customerSelect)
    .eq("salon_id", currentSalon.id)
    .order("total_spent", { ascending: false });

  if (error) {
    console.error("Errore Supabase getCampaignSelectedCustomers:", error);

    return {
      customers: [],
      error: "Non riesco a caricare i clienti selezionati in questo momento.",
      success: false,
    };
  }

  const selectedCustomers = filterCustomersBySegment(data, segmentStatus);

  return {
    customers: selectedCustomers.map((customer) =>
      toSelectedCampaignCustomer(customer, segmentStatus),
    ),
    error: "",
    success: true,
  };
}

export async function getCustomCampaignSelectedCustomers(
  segment: CustomCampaignSegment,
): Promise<CampaignCustomersPreviewResult> {
  if (!customSegmentLabels[segment]) {
    return {
      customers: [],
      error: "Segmento campagna non valido.",
      success: false,
    };
  }

  const supabase = await createSupabaseServerClient();
  const currentSalon = await getCurrentSalon();

  if (!supabase || !currentSalon) {
    return {
      customers: [],
      error: "Configurazione dati non disponibile.",
      success: false,
    };
  }

  const { data, error } = await supabase
    .from("customers")
    .select(customerSelect)
    .eq("salon_id", currentSalon.id)
    .order("total_spent", { ascending: false });

  if (error) {
    console.error("Errore Supabase getCustomCampaignSelectedCustomers:", error);

    return {
      customers: [],
      error: "Non riesco a caricare i clienti selezionati in questo momento.",
      success: false,
    };
  }

  const selectedCustomers = filterCustomersByCustomSegment(data, segment);

  return {
    customers: selectedCustomers.map((customer) =>
      toSelectedCampaignCustomer(customer, "VIP"),
    ).map((customer) => ({
      ...customer,
      status: customSegmentLabels[segment],
    })),
    error: "",
    success: true,
  };
}

export async function generateAiCampaign(
  segmentStatus: CampaignSegmentStatus,
  selectedServices: Array<string | CampaignServiceSuggestion> = [],
  aiSettings: AiGenerationSettings = defaultAiSettings,
): Promise<GenerateCampaignResult> {
  if (!segmentLabels[segmentStatus]) {
    return {
      success: false,
      campaignName: "",
      customers: [],
      objective: "",
      message: "",
      error: "Segmento campagna non valido.",
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      campaignName: "",
      customers: [],
      objective: "",
      message: "",
      error: "Non riesco a generare i messaggi in questo momento. Riprova tra poco.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const currentSalon = await getCurrentSalon();

  if (!supabase || !currentSalon) {
    return {
      success: false,
      campaignName: "",
      customers: [],
      objective: "",
      message: "",
      error: "Configurazione Supabase non valida. Controlla le variabili ambiente.",
    };
  }

  const { data, error } = await supabase
    .from("customers")
    .select(customerSelect)
    .eq("salon_id", currentSalon.id);

  if (error) {
    console.error("Errore Supabase generateAiCampaign:", error);

    return {
      success: false,
      campaignName: "",
      customers: [],
      objective: "",
      message: "",
      error: `Campagna non generata: ${error.message}`,
    };
  }

  const selectedCustomers = filterCustomersBySegment(data, segmentStatus);
  const recentServicesByCustomerId = await getRecentServicesByCustomerId(
    supabase,
    currentSalon.id,
    selectedCustomers.map((customer) => customer.id),
  );
  const normalizedServices = normalizeSelectedServices(selectedServices);
  const normalizedAiSettings = normalizeAiSettings(aiSettings);
  const selectedServiceNames = getSelectedServiceNames(normalizedServices);
  const ageSegment = isAgeCampaignSegmentStatus(segmentStatus)
    ? getAgeCampaignSegment(segmentStatus)
    : null;
  const birthdaySegment = isBirthdayCampaignSegmentStatus(segmentStatus)
    ? getBirthdayCampaignSegment(segmentStatus)
    : null;
  const customerCount = selectedCustomers.length;
  const totalRevenue = selectedCustomers.reduce((total, customer) => {
    const amount = Number(customer.total_spent ?? 0);

    return total + (Number.isFinite(amount) ? amount : 0);
  }, 0);
  const prompt = `Sei un assistente CRM per saloni beauty, centri estetici, barber shop e nail studio.

Genera una campagna WhatsApp AI in italiano professionale e naturale, con un messaggio personalizzato per ogni cliente.

Segmento: ${segmentLabels[segmentStatus]}
${ageSegment ? `Fascia eta: ${ageSegment.title}` : ""}
${birthdaySegment ? `Campagna compleanno: ${birthdaySegment.title}` : ""}
${!ageSegment && !birthdaySegment ? `Stato AI Supabase: ${segmentStatus}` : ""}
Numero clienti: ${customerCount}
Fatturato storico segmento: ${totalRevenue}€
${ageSegment ? `Tono richiesto: ${ageSegment.tone}` : ""}
${ageSegment ? `Obiettivo fascia eta: ${ageSegment.objective}` : ""}
${birthdaySegment ? `Obiettivo compleanno: ${birthdaySegment.objective}` : ""}
${normalizedServices.length > 0 ? `Servizi selezionati da proporre: ${formatServicesForPrompt(normalizedServices)}` : ""}
${formatAiSettingsForPrompt(normalizedAiSettings)}

Clienti:
${JSON.stringify(
  selectedCustomers.map((customer) =>
    formatCustomerForPrompt(
      customer,
      recentServicesByCustomerId.get(customer.id) ?? [],
      segmentStatus,
    ),
  ),
  null,
  2,
)}

Regole:
- Non promettere sconti se non richiesto.
- Non essere aggressivo.
- Ogni messaggio deve essere breve, caldo e adatto a WhatsApp.
- Usa il nome reale del cliente, non il placeholder.
- Non usare emoji nel testo generato. Genera solo testo italiano pulito.
- Rispetta la grammatica italiana in base al genere: uomo, donna o non specificato.
- Personalizza ogni messaggio usando stato AI, frequenza media, ultima visita e spesa totale.
- Se la campagna e per fascia eta, adatta tono e proposta alla fascia indicata senza citare mai eta o anni nel messaggio.
- Se la campagna e compleanno, usa un tono caldo di auguri e proponi una piccola coccola beauty senza promettere sconti automatici.
- Se sono presenti servizi selezionati, costruisci il messaggio attorno a quei servizi usando anche categoria e prezzo medio quando disponibili, senza sembrare una vendita forzata.
- Non dire che il messaggio è generato da AI.

Rispondi solo con JSON valido in questo formato:
{
  "campaignName": "Nome breve della campagna",
  "objective": "Obiettivo della campagna",
  "message": "Messaggio WhatsApp tipo",
  "customers": [
    {
      "id": "id cliente",
      "message": "Messaggio personalizzato WhatsApp"
    }
  ]
}`;

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
        max_output_tokens: 900,
      }),
    });
    const payload: unknown = await response.json();

    if (!response.ok) {
      console.error("OPENAI CAMPAIGN ERROR:", payload);

      return {
        success: false,
        campaignName: "",
        customers: [],
        objective: "",
        message: "",
        error:
          process.env.NODE_ENV === "development"
            ? "Non riesco a generare i messaggi in questo momento. Riprova tra poco."
            : "Non riesco a generare i messaggi in questo momento. Riprova tra poco.",
      };
    }

    const text = extractOpenAiText(payload);

    if (!text) {
      return {
        success: false,
        campaignName: "",
        customers: [],
        objective: "",
        message: "",
        error: "Non riesco a generare i messaggi in questo momento. Riprova tra poco.",
      };
    }

    const parsedCampaign = parseCampaignText(text);
    const personalizedCustomers = selectedCustomers.map((customer) => {
      const aiCustomer = "rawCustomers" in parsedCampaign
        ? parsedCampaign.rawCustomers.find((item) => item.id === customer.id)
        : undefined;

      return {
        ...toSelectedCampaignCustomer(customer, segmentStatus),
        message: cleanWhatsAppMessage(
          aiCustomer?.message?.trim() ||
            createFallbackCustomerMessage(
              customer,
              segmentStatus,
              selectedServiceNames,
            ),
        ),
      };
    });

    return {
      success: true,
      error: "",
      campaignName: parsedCampaign.campaignName,
      customers: personalizedCustomers,
      objective: parsedCampaign.objective,
      message: cleanWhatsAppMessage(parsedCampaign.message),
    };
  } catch (openAiError) {
    console.error("OPENAI CAMPAIGN ERROR:", openAiError);

    return {
      success: false,
      campaignName: "",
      customers: [],
      objective: "",
      message: "",
      error:
        process.env.NODE_ENV === "development"
          ? "Non riesco a generare i messaggi in questo momento. Riprova tra poco."
          : "Non riesco a generare i messaggi in questo momento. Riprova tra poco.",
    };
  }
}

export async function generateCustomAiCampaign(
  input: CustomCampaignInput,
  aiSettings: AiGenerationSettings = defaultAiSettings,
): Promise<GenerateCampaignResult> {
  if (!customSegmentLabels[input.segment]) {
    return {
      success: false,
      campaignName: "",
      customers: [],
      objective: "",
      message: "",
      error: "Segmento campagna non valido.",
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      campaignName: "",
      customers: [],
      objective: "",
      message: "",
      error: "Non riesco a generare i messaggi in questo momento. Riprova tra poco.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const currentSalon = await getCurrentSalon();

  if (!supabase || !currentSalon) {
    return {
      success: false,
      campaignName: "",
      customers: [],
      objective: "",
      message: "",
      error: "Configurazione Supabase non valida. Controlla le variabili ambiente.",
    };
  }

  const { data, error } = await supabase
    .from("customers")
    .select(customerSelect)
    .eq("salon_id", currentSalon.id);

  if (error) {
    console.error("Errore Supabase generateCustomAiCampaign:", error);

    return {
      success: false,
      campaignName: "",
      customers: [],
      objective: "",
      message: "",
      error: `Campagna non generata: ${error.message}`,
    };
  }

  const selectedCustomers =
    input.segment === "manual_customers"
      ? data.filter((customer) =>
          new Set(input.manualCustomerIds ?? []).has(customer.id),
        )
      : filterCustomersByCustomSegment(data, input.segment);
  const recentServicesByCustomerId = await getRecentServicesByCustomerId(
    supabase,
    currentSalon.id,
    selectedCustomers.map((customer) => customer.id),
  );
  const normalizedServices = normalizeSelectedServices(input.selectedServices);
  const normalizedAiSettings = normalizeAiSettings(aiSettings);
  const selectedServiceNames = getSelectedServiceNames(normalizedServices);
  const customerCount = selectedCustomers.length;
  const totalRevenue = selectedCustomers.reduce((total, customer) => {
    const amount = Number(customer.total_spent ?? 0);

    return total + (Number.isFinite(amount) ? amount : 0);
  }, 0);
  const prompt = `Sei un assistente CRM per saloni beauty, centri estetici, barber shop e nail studio.

Genera una campagna WhatsApp AI personalizzata in italiano, professionale e naturale.

Nome campagna: ${input.name}
Obiettivo campagna: ${input.objective}
Tipo obiettivo: ${input.objectiveType}
Segmento clienti: ${customSegmentLabels[input.segment]}
Canale: ${input.channel}
Tono richiesto dal titolare: ${input.messageTone}
Numero clienti stimati: ${customerCount}
Valore storico stimato: ${totalRevenue}€
${normalizedServices.length > 0 ? `Servizi selezionati da proporre: ${formatServicesForPrompt(normalizedServices)}` : ""}
${formatAiSettingsForPrompt(normalizedAiSettings)}

Clienti:
${JSON.stringify(
  selectedCustomers.map((customer) =>
    formatCustomerForPrompt(
      customer,
      recentServicesByCustomerId.get(customer.id) ?? [],
      input.segment === "birthday:month" ? "birthday:month" : undefined,
    ),
  ),
  null,
  2,
)}

Regole:
- Non promettere sconti se non richiesto.
- Ogni messaggio deve essere breve, caldo e adatto a WhatsApp.
- Usa il nome reale del cliente.
- Non usare emoji nel testo generato. Genera solo testo italiano pulito.
- Se sono presenti servizi selezionati, proponili in modo naturale, senza sembrare una vendita forzata.
- Non citare direttamente l'età del cliente.
- Non dire che il messaggio è generato da AI.

Rispondi solo con JSON valido in questo formato:
{
  "campaignName": "Nome breve della campagna",
  "objective": "Obiettivo della campagna",
  "message": "Messaggio WhatsApp tipo",
  "customers": [
    {
      "id": "id cliente",
      "message": "Messaggio personalizzato WhatsApp"
    }
  ]
}`;

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
        max_output_tokens: 900,
      }),
    });
    const payload: unknown = await response.json();

    if (!response.ok) {
      console.error("OPENAI CUSTOM CAMPAIGN ERROR:", payload);

      return {
        success: false,
        campaignName: "",
        customers: [],
        objective: "",
        message: "",
        error: "Non riesco a generare i messaggi in questo momento. Riprova tra poco.",
      };
    }

    const text = extractOpenAiText(payload);

    if (!text) {
      return {
        success: false,
        campaignName: "",
        customers: [],
        objective: "",
        message: "",
        error: "Non riesco a generare i messaggi in questo momento. Riprova tra poco.",
      };
    }

    const parsedCampaign = parseCampaignText(text);
    const personalizedCustomers = selectedCustomers.map((customer) => {
      const aiCustomer = "rawCustomers" in parsedCampaign
        ? parsedCampaign.rawCustomers.find((item) => item.id === customer.id)
        : undefined;

      return {
        ...toSelectedCampaignCustomer(customer, "VIP"),
        message: cleanWhatsAppMessage(
          aiCustomer?.message?.trim() ||
            createFallbackCustomerMessage(customer, undefined, selectedServiceNames),
        ),
        status: customSegmentLabels[input.segment],
      };
    });

    return {
      success: true,
      error: "",
      campaignName: parsedCampaign.campaignName || input.name,
      customers: personalizedCustomers,
      objective: parsedCampaign.objective || input.objective,
      message: cleanWhatsAppMessage(parsedCampaign.message),
    };
  } catch (openAiError) {
    console.error("OPENAI CUSTOM CAMPAIGN ERROR:", openAiError);

    return {
      success: false,
      campaignName: "",
      customers: [],
      objective: "",
      message: "",
      error: "Non riesco a generare i messaggi in questo momento. Riprova tra poco.",
    };
  }
}
