"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  buildFinalWhatsAppMessage,
  buildWhatsAppUrl,
  cleanWhatsAppPhone as normalizeWhatsAppPhone,
  isMobileDevice,
} from "@/lib/whatsapp";
import {
  getActiveServices,
  readServiceCatalog,
  type ServiceCatalogItem,
} from "@/lib/serviceCatalog";
import {
  defaultAiSettings,
  readAiSettings,
  type AiGenerationSettings,
} from "@/lib/aiSettings";
import {
  generateAiCampaign,
  getCampaignSelectedCustomers,
  type CampaignCustomerPreview,
  type CampaignSegmentStatus,
  type CampaignSelectedCustomer,
  type GenerateCampaignResult,
} from "./actions";
import { isAgeCampaignSegmentStatus } from "./ageSegments";
import {
  formatBirthdayDate,
  isBirthdayCampaignSegmentStatus,
} from "./birthdaySegments";

type CampaignModalProps = {
  averageAge?: number | null;
  customerCount: number;
  objective: string;
  potentialValue: number;
  segmentLabel: string;
  segmentStatus: CampaignSegmentStatus;
};

const contactedCustomersStorageKey = "beauty_os_contacted_campaign_customers";

const emptyCampaign: GenerateCampaignResult = {
  success: false,
  campaignName: "",
  customers: [],
  objective: "",
  message: "",
  error: "",
};

function cleanWhatsAppPhone(phone: string) {
  const digits = normalizeWhatsAppPhone(phone);

  if (!digits) {
    return "";
  }

  return digits;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(date: string) {
  if (!date) {
    return "Ultima visita non disponibile";
  }

  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

function getContactedCustomerKey(
  segmentStatus: CampaignSegmentStatus,
  customerId: string,
) {
  return `${segmentStatus}:${customerId}`;
}

function readContactedCustomers() {
  try {
    const storedValue = window.localStorage.getItem(contactedCustomersStorageKey);

    if (!storedValue) {
      return new Set<string>();
    }

    const parsedValue = JSON.parse(storedValue);

    if (!Array.isArray(parsedValue)) {
      return new Set<string>();
    }

    return new Set(
      parsedValue.filter((customerKey): customerKey is string =>
        typeof customerKey === "string",
      ),
    );
  } catch {
    return new Set<string>();
  }
}

function saveContactedCustomers(customerKeys: Set<string>) {
  window.localStorage.setItem(
    contactedCustomersStorageKey,
    JSON.stringify([...customerKeys]),
  );
}

function getOpportunityText(
  segmentStatus: CampaignSegmentStatus,
  customerCount: number,
  potentialValue: number,
  averageAge?: number | null,
) {
  if (isAgeCampaignSegmentStatus(segmentStatus)) {
    const averageAgeText = averageAge === null || averageAge === undefined
      ? ""
      : ` Età media: ${averageAge} anni.`;

    return `${customerCount} clienti in questa fascia con ${formatCurrency(potentialValue)} di valore storico complessivo.${averageAgeText} Questa campagna aiuta a proporre trattamenti coerenti con routine, bisogni e tono di comunicazione.`;
  }

  if (isBirthdayCampaignSegmentStatus(segmentStatus)) {
    const averageAgeText = averageAge === null || averageAge === undefined
      ? ""
      : ` Età media: ${averageAge} anni.`;

    return `${customerCount} clienti hanno un compleanno in questa campagna con ${formatCurrency(potentialValue)} di valore storico complessivo.${averageAgeText} Beauty OS prepara un augurio personalizzato e una proposta beauty delicata.`;
  }

  if (segmentStatus === "Perso") {
    return `${customerCount} clienti non tornano da oltre 45 giorni. Questa campagna può recuperare fino a ${formatCurrency(potentialValue)} di valore storico.`;
  }

  if (segmentStatus === "A rischio") {
    return `${customerCount} clienti stanno rallentando il ritmo di visita. Questa campagna aiuta a intervenire prima che il valore potenziale di ${formatCurrency(potentialValue)} venga perso.`;
  }

  return `${customerCount} clienti ad alto valore meritano un contatto prioritario. Questa campagna può trasformare ${formatCurrency(potentialValue)} di valore storico in nuove prenotazioni curate.`;
}

function getAverageRecoveryProbability(customers: CampaignSelectedCustomer[]) {
  const probabilities = customers
    .map((customer) => customer.recoveryProbability)
    .filter((probability): probability is number => probability !== null);

  if (probabilities.length === 0) {
    return null;
  }

  return Math.round(
    probabilities.reduce((total, probability) => total + probability, 0) /
      probabilities.length,
  );
}

function CustomerMessageCard({
  campaignType,
  customer,
  isContacted,
  onContact,
  onCopy,
  onOpenWhatsApp,
  onRestore,
  selectedServices,
  settings,
}: {
  campaignType: string;
  customer: CampaignCustomerPreview;
  isContacted: boolean;
  onContact: () => void;
  onCopy: () => void;
  onOpenWhatsApp: (finalMessage: string) => void;
  onRestore: () => void;
  selectedServices: string[];
  settings: AiGenerationSettings;
}) {
  const canOpenWhatsApp = Boolean(cleanWhatsAppPhone(customer.phone));
  const finalMessage = buildFinalWhatsAppMessage(
    customer.message,
    campaignType,
    selectedServices,
    { emojiStyle: settings.emojiStyle },
  );

  return (
    <article
      className={`rounded-[1rem] border p-4 transition ${
        isContacted
          ? "border-black/10 bg-zinc-50 text-zinc-500"
          : "border-black/10 bg-white text-black shadow-[0_18px_55px_rgba(0,0,0,0.06)]"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p
              className={`font-semibold tracking-tight ${
                isContacted ? "text-zinc-500" : "text-black"
              }`}
            >
              {customer.name}
            </p>
            {isContacted ? (
              <span className="rounded-full bg-black px-2.5 py-1 text-xs font-semibold text-white">
                Contattato
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            {customer.birthdayDate
              ? `Compleanno ${formatBirthdayDate(customer.birthdayDate)}`
              : formatDate(customer.lastVisitDate)}
            {customer.birthdayAge !== null
              ? ` · compie ${customer.birthdayAge} anni`
              : customer.age !== null
                ? ` · ${customer.age} anni`
                : ""}
            {customer.phone ? ` · ${customer.phone}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <span className="rounded-full border border-black/10 bg-[#f7f7f5] px-2.5 py-1 text-xs font-semibold text-zinc-700">
            {customer.status}
          </span>
          <span className="rounded-full border border-black/10 bg-[#f7f7f5] px-2.5 py-1 text-xs font-semibold text-zinc-700">
            {formatCurrency(customer.totalSpent)}
          </span>
        </div>
      </div>

      <p className="mt-3.5 max-h-36 overflow-y-auto whitespace-pre-wrap rounded-[0.85rem] border border-black/10 bg-[#f7f7f5] p-3.5 text-sm leading-7 text-zinc-800">
        {finalMessage}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2.5 pb-0.5">
        <button
          className="rounded-full border border-black/10 bg-white px-3.5 py-1.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50"
          onClick={onCopy}
          type="button"
        >
          Copia
        </button>
        <button
          className="rounded-full bg-black px-3.5 py-1.5 text-sm font-medium text-white shadow-[0_14px_35px_rgba(0,0,0,0.18)] transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
          disabled={!canOpenWhatsApp}
          onClick={() => onOpenWhatsApp(finalMessage)}
          type="button"
        >
          Invia su WhatsApp →
        </button>
        <button
          className={`rounded-full border px-3.5 py-1.5 text-sm font-medium shadow-sm transition ${
            isContacted
              ? "border-black/10 bg-zinc-100 text-zinc-500"
              : "border-black/10 bg-white text-zinc-700 hover:bg-zinc-50"
          }`}
          disabled={isContacted}
          onClick={onContact}
          type="button"
        >
          {isContacted ? "Contattato" : "Segna contattato"}
        </button>
        {isContacted ? (
          <button
            className="rounded-full border border-black/10 bg-white px-3.5 py-1.5 text-sm font-medium text-zinc-600 shadow-sm transition hover:bg-zinc-50"
            onClick={onRestore}
            type="button"
          >
            Ripristina
          </button>
        ) : null}
      </div>
    </article>
  );
}

export default function CampaignModal({
  averageAge = null,
  customerCount,
  objective,
  potentialValue,
  segmentLabel,
  segmentStatus,
}: CampaignModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [campaign, setCampaign] = useState(emptyCampaign);
  const [selectedCustomers, setSelectedCustomers] = useState<
    CampaignSelectedCustomer[]
  >([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [contactedCustomers, setContactedCustomers] = useState<Set<string>>(
    () => new Set(),
  );
  const [copyMessage, setCopyMessage] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [serviceCatalog, setServiceCatalog] = useState<ServiceCatalogItem[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [generatedServices, setGeneratedServices] = useState<ServiceCatalogItem[]>([]);
  const [aiSettings, setAiSettings] =
    useState<AiGenerationSettings>(defaultAiSettings);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setContactedCustomers(readContactedCustomers());
      setServiceCatalog(readServiceCatalog());
      setAiSettings(readAiSettings());
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const progressCustomers = campaign.success && campaign.customers.length > 0
    ? campaign.customers
    : selectedCustomers;
  const progressTotal = progressCustomers.length || customerCount;
  const contactedCount = progressCustomers.filter((customer) =>
    contactedCustomers.has(getContactedCustomerKey(segmentStatus, customer.id)),
  ).length;
  const isCampaignCompleted = progressTotal > 0 && contactedCount === progressTotal;
  const progressPercentage =
    progressTotal > 0 ? Math.round((contactedCount / progressTotal) * 100) : 0;
  const recoveredValue = progressCustomers.reduce((total, customer) => {
    const customerKey = getContactedCustomerKey(segmentStatus, customer.id);

    if (!contactedCustomers.has(customerKey)) {
      return total;
    }

    return total + customer.totalSpent;
  }, 0);
  const averageRecoveryProbability = useMemo(
    () => getAverageRecoveryProbability(selectedCustomers),
    [selectedCustomers],
  );
  const isAgeCampaign = isAgeCampaignSegmentStatus(segmentStatus);
  const isBirthdayCampaign = isBirthdayCampaignSegmentStatus(segmentStatus);
  const activeServices = useMemo(
    () => getActiveServices(serviceCatalog),
    [serviceCatalog],
  );
  const selectedServiceItems = useMemo(
    () =>
      activeServices.filter((service) => selectedServiceIds.includes(service.id)),
    [activeServices, selectedServiceIds],
  );
  const generatedServiceNames = generatedServices.map((service) => service.name);
  const shouldDisableGeneration =
    customerCount === 0 ||
    isGenerating ||
    (isAgeCampaign && selectedServiceItems.length === 0);

  const messageGroups = useMemo(() => {
    const toContact: CampaignCustomerPreview[] = [];
    const contacted: CampaignCustomerPreview[] = [];

    campaign.customers.forEach((customer) => {
      const customerKey = getContactedCustomerKey(segmentStatus, customer.id);

      if (contactedCustomers.has(customerKey)) {
        contacted.push(customer);
      } else {
        toContact.push(customer);
      }
    });

    return { contacted, toContact };
  }, [campaign.customers, contactedCustomers, segmentStatus]);

  async function loadSelectedCustomers() {
    const result = await getCampaignSelectedCustomers(segmentStatus);

    setSelectedCustomers(result.customers);
  }

  function openCampaign() {
    setIsOpen(true);
    setCopyMessage("");
    setPhoneError("");

    if (selectedCustomers.length === 0 && customerCount > 0) {
      void loadSelectedCustomers();
    }
  }

  async function generateCampaign() {
    if (isAgeCampaign && selectedServiceItems.length === 0) {
      return;
    }

    setCampaign(emptyCampaign);
    setCopyMessage("");
    setPhoneError("");
    setIsGenerating(true);
    setGeneratedServices(selectedServiceItems);

    const result = await generateAiCampaign(
      segmentStatus,
      selectedServiceItems,
      aiSettings,
    );

    setCampaign(result);
    setIsGenerating(false);
  }

  function toggleSelectedService(serviceId: string) {
    setSelectedServiceIds((currentServices) => {
      if (currentServices.includes(serviceId)) {
        return currentServices.filter((item) => item !== serviceId);
      }

      return [...currentServices, serviceId];
    });
  }

  async function copyCustomerMessage(message: string) {
    const safeMessage = buildFinalWhatsAppMessage(
      message,
      segmentStatus,
      generatedServiceNames,
      { emojiStyle: aiSettings.emojiStyle },
    );

    if (!safeMessage) {
      setCopyMessage("Messaggio non disponibile.");
      return;
    }

    await navigator.clipboard.writeText(safeMessage);
    setCopyMessage("Messaggio copiato.");
  }

  function updateContactedCustomer(customerId: string, shouldBeContacted: boolean) {
    const customerKey = getContactedCustomerKey(segmentStatus, customerId);

    setContactedCustomers((currentCustomers) => {
      const nextCustomers = new Set(currentCustomers);

      if (shouldBeContacted) {
        nextCustomers.add(customerKey);
      } else {
        nextCustomers.delete(customerKey);
      }

      saveContactedCustomers(nextCustomers);

      return nextCustomers;
    });
  }

  function openWhatsApp(phone: string, finalMessage: string) {
    const cleanedPhone = cleanWhatsAppPhone(phone);

    if (!cleanedPhone) {
      setPhoneError("Telefono non disponibile per questo cliente.");
      return;
    }

    if (!finalMessage) {
      setPhoneError("Messaggio non disponibile per questo cliente.");
      return;
    }

    setPhoneError("");
    const whatsappUrl = buildWhatsAppUrl({
      phone: cleanedPhone,
      message: finalMessage,
      target: isMobileDevice() ? "mobile" : "web",
    });
    const openedWindow = window.open(
      whatsappUrl,
      "_blank",
      "noopener,noreferrer",
    );

    if (!openedWindow) {
      void navigator.clipboard.writeText(finalMessage);
      setCopyMessage(
        "Il browser ha bloccato WhatsApp. Messaggio copiato negli appunti.",
      );
    }
  }

  return (
    <>
      <button
        className="mt-4 w-full rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white shadow-[0_14px_35px_rgba(0,0,0,0.18)] transition hover:bg-zinc-800"
        onClick={openCampaign}
        type="button"
      >
        Apri campagna
      </button>

      {isOpen ? (
        <div aria-modal="true" className="fixed inset-0 z-50" role="dialog">
          <button
            aria-label="Chiudi campagna"
            className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
            onClick={() => setIsOpen(false)}
            type="button"
          />
          <aside className="absolute inset-y-0 right-0 flex h-screen max-h-screen w-full flex-col overflow-hidden bg-white shadow-[0_30px_100px_rgba(0,0,0,0.24)] sm:w-[640px]">
            <header className="shrink-0 border-b border-black/10 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-500">
                    Campagna WhatsApp
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-black">
                    {segmentLabel}
                  </h2>
                </div>
                <button
                  className="grid size-9 place-items-center rounded-full border border-black/10 bg-white text-lg font-semibold text-black transition hover:border-black/20 hover:bg-zinc-50"
                  onClick={() => setIsOpen(false)}
                  type="button"
                >
                  ×
                </button>
              </div>

              <p className="mt-4 text-sm leading-6 text-zinc-500">{objective}</p>
            </header>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="mt-5 rounded-[1.2rem] border border-black/10 bg-[#f7f7f5] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    Opportunità AI
                  </p>
                  {isCampaignCompleted ? (
                    <p className="rounded-full bg-black px-3 py-1 text-xs font-semibold text-white">
                      Campagna completata
                    </p>
                  ) : null}
                </div>
                <p className="mt-3 text-sm leading-6 text-zinc-700">
                  {getOpportunityText(
                    segmentStatus,
                    customerCount,
                    potentialValue,
                    averageAge,
                  )}
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-zinc-500">Clienti coinvolti</p>
                    <p className="mt-1 text-xl font-semibold tracking-tight text-black">
                      {customerCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Valore recuperabile</p>
                    <p className="mt-1 text-xl font-semibold tracking-tight text-black">
                      {formatCurrency(potentialValue)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">
                      {isAgeCampaignSegmentStatus(segmentStatus)
                        ? "Età media"
                        : isBirthdayCampaignSegmentStatus(segmentStatus)
                          ? "Età media"
                        : "Probabilità media"}
                    </p>
                    <p className="mt-1 text-xl font-semibold tracking-tight text-black">
                      {isAgeCampaignSegmentStatus(segmentStatus)
                        ? averageAge === null
                          ? "N/D"
                          : `${averageAge} anni`
                        : isBirthdayCampaignSegmentStatus(segmentStatus)
                          ? averageAge === null
                            ? "N/D"
                            : `${averageAge} anni`
                        : averageRecoveryProbability === null
                          ? "N/D"
                          : `${averageRecoveryProbability}%`}
                    </p>
                  </div>
                </div>
                <div className="mt-4 border-t border-black/10 pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-black">
                      Campagna: {contactedCount} / {progressTotal} clienti contattati
                    </p>
                    <p className="text-sm font-semibold text-black">
                      Valore recuperato: {formatCurrency(recoveredValue)}
                    </p>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-200">
                    <div
                      className="h-full rounded-full bg-black transition-all duration-300"
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-[1.2rem] border border-black/10 bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                      Servizi da proporre
                    </p>
                    <p className="text-sm leading-6 text-zinc-500">
                      Seleziona i servizi attivi dal Catalogo servizi centrale.
                    </p>
                  </div>
                  <Link
                    className="w-fit rounded-full border border-black/10 bg-[#f7f7f5] px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:border-black/20 hover:bg-white"
                    href="/catalogo"
                  >
                    Apri Catalogo servizi
                  </Link>
                </div>

                {activeServices.length === 0 ? (
                  <div className="mt-4 rounded-[1rem] border border-black/10 bg-[#f7f7f5] p-4">
                    <p className="text-sm font-medium text-zinc-700">
                      Nessun servizio attivo. Aggiungi servizi dal Catalogo servizi.
                    </p>
                    <Link
                      className="mt-3 inline-flex rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
                      href="/catalogo"
                    >
                      Apri Catalogo servizi
                    </Link>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {activeServices.map((service) => {
                      const isSelected = selectedServiceIds.includes(service.id);

                      return (
                        <button
                          className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                          isSelected
                            ? "border-black bg-black text-white shadow-[0_12px_28px_rgba(0,0,0,0.16)]"
                            : "border-black/10 bg-[#f7f7f5] text-zinc-800 hover:border-black/20 hover:bg-white"
                        }`}
                          key={service.id}
                          onClick={() => toggleSelectedService(service.id)}
                          type="button"
                        >
                          <span>{service.name}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              isSelected
                                ? "bg-white/15 text-white"
                                : "bg-white text-zinc-500"
                            }`}
                          >
                            {service.category}
                          </span>
                          {service.averagePrice !== null ? (
                            <span
                              className={
                                isSelected ? "text-white/70" : "text-zinc-500"
                              }
                            >
                              {formatCurrency(service.averagePrice)}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mt-6">
              {customerCount === 0 ? (
                <p className="rounded-[1rem] border border-black/10 bg-[#f7f7f5] p-4 text-sm leading-6 text-zinc-500">
                  Nessun cliente disponibile per questa campagna.
                </p>
              ) : null}

              {isGenerating ? (
                <div className="rounded-[1rem] border border-black/10 bg-[#f7f7f5] p-5 text-sm font-medium text-zinc-600">
                  Sto preparando i messaggi personalizzati...
                </div>
              ) : null}

              {!isGenerating && campaign.error ? (
                <div className="rounded-[1rem] border border-rose-200 bg-rose-50 p-5 text-sm leading-6 text-rose-700">
                  {campaign.error}
                </div>
              ) : null}

              {!isGenerating && campaign.success ? (
                <section>
                  <h3 className="text-lg font-semibold tracking-tight text-black">
                    Messaggi personalizzati
                  </h3>

                  {generatedServices.length > 0 ? (
                    <div className="mt-4 rounded-[1rem] border border-black/10 bg-[#f7f7f5] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                        Servizi proposti
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {generatedServices.map((service) => (
                          <span
                            className="rounded-full bg-black px-3 py-1.5 text-xs font-semibold text-white"
                            key={service.id}
                          >
                            {service.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {campaign.customers.length === 0 ? (
                    <p className="mt-4 rounded-[1rem] border border-black/10 bg-[#f7f7f5] p-4 text-sm leading-6 text-zinc-500">
                      Nessun cliente disponibile per questa campagna.
                    </p>
                  ) : null}

                  {messageGroups.toContact.length > 0 ? (
                    <div className="mt-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                        DA CONTATTARE
                      </p>
                      <div className="mt-4 grid gap-4">
                        {messageGroups.toContact.map((customer) => (
                          <CustomerMessageCard
                            campaignType={segmentStatus}
                            customer={customer}
                            isContacted={false}
                            key={customer.id}
                            onContact={() =>
                              updateContactedCustomer(customer.id, true)
                            }
                            onCopy={() => copyCustomerMessage(customer.message)}
                            onOpenWhatsApp={(finalMessage) =>
                              openWhatsApp(customer.phone, finalMessage)
                            }
                            onRestore={() =>
                              updateContactedCustomer(customer.id, false)
                            }
                            selectedServices={generatedServiceNames}
                            settings={aiSettings}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {messageGroups.contacted.length > 0 ? (
                    <div className="mt-8">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                        CONTATTATI
                      </p>
                      <div className="mt-4 grid gap-4">
                        {messageGroups.contacted.map((customer) => (
                          <CustomerMessageCard
                            campaignType={segmentStatus}
                            customer={customer}
                            isContacted
                            key={customer.id}
                            onContact={() =>
                              updateContactedCustomer(customer.id, true)
                            }
                            onCopy={() => copyCustomerMessage(customer.message)}
                            onOpenWhatsApp={(finalMessage) =>
                              openWhatsApp(customer.phone, finalMessage)
                            }
                            onRestore={() =>
                              updateContactedCustomer(customer.id, false)
                            }
                            selectedServices={generatedServiceNames}
                            settings={aiSettings}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </section>
              ) : null}

              {copyMessage ? (
                <p className="mt-4 text-sm text-emerald-700">{copyMessage}</p>
              ) : null}

              {phoneError ? (
                <p className="mt-4 text-sm text-rose-700">{phoneError}</p>
              ) : null}
              </div>
            </div>
            <footer className="shrink-0 border-t border-black/10 bg-white p-5">
              {isAgeCampaign && selectedServiceItems.length === 0 ? (
                <p className="mb-3 text-sm text-amber-700">
                  {activeServices.length === 0
                    ? "Nessun servizio attivo. Aggiungi servizi dal Catalogo servizi."
                    : "Seleziona almeno un servizio per generare messaggi più mirati."}
                </p>
              ) : null}
              {isBirthdayCampaign && selectedServiceItems.length === 0 ? (
                <p className="mb-3 text-sm text-zinc-500">
                  Puoi selezionare un servizio per rendere l’augurio più mirato.
                </p>
              ) : null}
              <button
                className="w-full rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white shadow-[0_14px_35px_rgba(0,0,0,0.18)] transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
                disabled={shouldDisableGeneration}
                onClick={generateCampaign}
                type="button"
              >
                {isGenerating ? "Generazione..." : "Genera messaggi AI"}
              </button>
            </footer>
          </aside>
        </div>
      ) : null}
    </>
  );
}
