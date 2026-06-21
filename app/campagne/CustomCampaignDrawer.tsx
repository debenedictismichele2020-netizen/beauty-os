"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  buildFinalWhatsAppMessage,
  buildWhatsAppUrl,
  cleanWhatsAppPhone,
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
  generateCustomAiCampaign,
  getCustomCampaignSelectedCustomers,
  type CampaignCustomerPreview,
  type CampaignSelectedCustomer,
  type CustomCampaignInput,
  type CustomCampaignSegment,
  type GenerateCampaignResult,
} from "./actions";

type CustomCampaignDraft = {
  channel?: "WhatsApp";
  createdAt: string;
  objective?: string;
  segment?: string;
  selectedCustomerIds?: string[];
  selectedServices: Array<{
    category: string;
    duration: number | null;
    name: string;
    price: number | null;
  }>;
  source:
    | "catalog_unused_services"
    | "overview_birthdays"
    | "overview_lost_customers"
    | "overview_unused_services";
  title: string;
};

const customCampaignDraftStorageKey = "beauty_os_custom_campaign_draft";
const contactedCustomersStorageKey = "beauty_os_contacted_campaign_customers";

const emptyCampaign: GenerateCampaignResult = {
  campaignName: "",
  customers: [],
  error: "",
  message: "",
  objective: "",
  success: false,
};

const segments: Array<{ label: string; value: CustomCampaignSegment }> = [
  { label: "Tutti", value: "all" },
  { label: "Clienti persi", value: "lost" },
  { label: "Clienti a rischio", value: "at-risk" },
  { label: "Clienti VIP", value: "vip" },
  { label: "Clienti per età 18-25", value: "age:18-25" },
  { label: "Clienti per età 26-35", value: "age:26-35" },
  { label: "Clienti per età 36-50", value: "age:36-50" },
  { label: "Clienti 50+", value: "age:50-plus" },
  { label: "Compleanni del mese", value: "birthday:month" },
  { label: "Selezione manuale clienti", value: "manual_customers" },
];

const objectives = [
  "Recuperare clienti",
  "Spingere servizi poco usati",
  "Promuovere nuovo servizio",
  "Compleanni",
  "Fidelizzazione VIP",
  "Promo stagionale",
];

const tones = ["Caldo e amichevole", "Professionale", "Elegante", "Diretto", "Premium"];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("it-IT", {
    currency: "EUR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function readDraft() {
  try {
    const storedValue = window.localStorage.getItem(customCampaignDraftStorageKey);

    if (!storedValue) {
      return null;
    }

    const parsedValue = JSON.parse(storedValue) as Partial<CustomCampaignDraft>;

    if (!Array.isArray(parsedValue.selectedServices)) {
      return null;
    }

    return parsedValue as CustomCampaignDraft;
  } catch {
    return null;
  }
}

function getContactedCustomerKey(campaignName: string, customerId: string) {
  return `custom:${campaignName}:${customerId}`;
}

function readContactedCustomers() {
  try {
    const storedValue = window.localStorage.getItem(contactedCustomersStorageKey);
    const parsedValue = storedValue ? JSON.parse(storedValue) : [];

    return new Set(
      Array.isArray(parsedValue)
        ? parsedValue.filter((item): item is string => typeof item === "string")
        : [],
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

export default function CustomCampaignDrawer() {
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [catalog, setCatalog] = useState<ServiceCatalogItem[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [campaignName, setCampaignName] = useState("Campagna personalizzata");
  const [objective, setObjective] = useState("Spingere servizi poco usati");
  const [segment, setSegment] = useState<CustomCampaignSegment>("all");
  const [messageTone, setMessageTone] = useState("Caldo e amichevole");
  const [settings, setSettings] =
    useState<AiGenerationSettings>(defaultAiSettings);
  const [customers, setCustomers] = useState<CampaignSelectedCustomer[]>([]);
  const [manualCustomerSearch, setManualCustomerSearch] = useState("");
  const [manualCustomers, setManualCustomers] = useState<
    CampaignSelectedCustomer[]
  >([]);
  const [selectedManualCustomerIds, setSelectedManualCustomerIds] = useState<
    string[]
  >([]);
  const [campaign, setCampaign] = useState(emptyCampaign);
  const [isGenerating, setIsGenerating] = useState(false);
  const [info, setInfo] = useState("");
  const [contactedCustomers, setContactedCustomers] = useState<Set<string>>(
    () => new Set(),
  );

  const loadCustomers = useCallback(async (nextSegment: CustomCampaignSegment) => {
    const result = await getCustomCampaignSelectedCustomers(nextSegment);

    if (nextSegment === "manual_customers") {
      setManualCustomers(result.customers);
      setCustomers([]);
      return;
    }

    setCustomers(result.customers);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        const activeCatalog = getActiveServices(readServiceCatalog());
        const draft = readDraft();
        const aiSettings = await readAiSettings();

        setCatalog(activeCatalog);
        setSettings(aiSettings);
        setMessageTone(aiSettings.tone);
        setContactedCustomers(readContactedCustomers());

        if (searchParams.get("new") === "1") {
          setIsOpen(true);
          void loadCustomers("all");
        }

        if (searchParams.get("new") === "1" && draft) {
          const draftServiceNames = new Set(
            draft.selectedServices.map((service) => service.name.toLowerCase()),
          );

          setCampaignName(draft.title || "Campagna personalizzata");
          setObjective(draft.objective || "Spingere servizi poco usati");
          if (draft.selectedCustomerIds && draft.selectedCustomerIds.length > 0) {
            setSegment("manual_customers");
            setSelectedManualCustomerIds(draft.selectedCustomerIds);
            void loadCustomers("manual_customers");
          } else {
            setSegment("all");
          }
          setSelectedServiceIds(
            activeCatalog
              .filter((service) => draftServiceNames.has(service.name.toLowerCase()))
              .map((service) => service.id),
          );
          setInfo(
            draft.source.startsWith("overview_")
              ? "Campagna creata dalla Panoramica. Puoi modificarla prima di generare i messaggi."
              : "Campagna creata dal Catalogo servizi. Puoi modificarla prima di generare i messaggi.",
          );
        }
      })();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadCustomers, searchParams]);

  const selectedServices = useMemo(
    () => catalog.filter((service) => selectedServiceIds.includes(service.id)),
    [catalog, selectedServiceIds],
  );
  const selectedManualCustomers = useMemo(
    () =>
      manualCustomers.filter((customer) =>
        selectedManualCustomerIds.includes(customer.id),
      ),
    [manualCustomers, selectedManualCustomerIds],
  );
  const visibleCustomers =
    segment === "manual_customers" ? selectedManualCustomers : customers;
  const filteredManualCustomers = useMemo(() => {
    const query = manualCustomerSearch.trim().toLowerCase();

    if (!query) {
      return manualCustomers;
    }

    return manualCustomers.filter((customer) =>
      [customer.name, customer.status, customer.phone]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [manualCustomerSearch, manualCustomers]);
  const totalValue = visibleCustomers.reduce(
    (total, customer) => total + customer.totalSpent,
    0,
  );
  const contactedCount = campaign.customers.filter((customer) =>
    contactedCustomers.has(getContactedCustomerKey(campaignName, customer.id)),
  ).length;

  function openDrawer() {
    setIsOpen(true);
    setCampaign(emptyCampaign);
    setInfo("");
    void loadCustomers(segment);
  }

  function closeDrawer() {
    setIsOpen(false);
    window.localStorage.removeItem(customCampaignDraftStorageKey);
  }

  function toggleService(serviceId: string) {
    setSelectedServiceIds((currentIds) =>
      currentIds.includes(serviceId)
        ? currentIds.filter((id) => id !== serviceId)
        : [...currentIds, serviceId],
    );
  }

  function toggleManualCustomer(customerId: string) {
    setSelectedManualCustomerIds((currentIds) =>
      currentIds.includes(customerId)
        ? currentIds.filter((id) => id !== customerId)
        : [...currentIds, customerId],
    );
  }

  async function generateCampaign() {
    const input: CustomCampaignInput = {
      channel: "WhatsApp",
      manualCustomerIds:
        segment === "manual_customers" ? selectedManualCustomerIds : undefined,
      messageTone,
      name: campaignName,
      objective,
      objectiveType: objective,
      segment,
      selectedServices: selectedServices.map((service) => ({
        averageDurationMinutes: service.averageDurationMinutes,
        averagePrice: service.averagePrice,
        category: service.category,
        name: service.name,
      })),
    };

    setIsGenerating(true);
    setCampaign(emptyCampaign);

    const result = await generateCustomAiCampaign(input, {
      ...settings,
      tone: messageTone as AiGenerationSettings["tone"],
    });

    setCampaign(result);
    setIsGenerating(false);
  }

  function updateContacted(customerId: string) {
    const key = getContactedCustomerKey(campaignName, customerId);

    setContactedCustomers((currentKeys) => {
      const nextKeys = new Set(currentKeys);

      nextKeys.add(key);
      saveContactedCustomers(nextKeys);

      return nextKeys;
    });
  }

  async function copyMessage(message: string) {
    await navigator.clipboard.writeText(message);
    setInfo("Messaggio copiato.");
  }

  function openWhatsApp(customer: CampaignCustomerPreview, message: string) {
    const phone = cleanWhatsAppPhone(customer.phone);

    if (!phone) {
      setInfo("Telefono non disponibile per questo cliente.");
      return;
    }

    const url = buildWhatsAppUrl({
      message,
      phone,
      target: isMobileDevice() ? "mobile" : "web",
    });
    const openedWindow = window.open(url, "_blank", "noopener,noreferrer");

    if (!openedWindow) {
      void navigator.clipboard.writeText(message);
      setInfo("Il browser ha bloccato WhatsApp. Messaggio copiato negli appunti.");
    }
  }

  return (
    <>
      <button
        className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-zinc-800"
        onClick={openDrawer}
        type="button"
      >
        + Crea campagna
      </button>

      {isOpen ? (
        <div aria-modal="true" className="fixed inset-0 z-50" role="dialog">
          <button
            aria-label="Chiudi creazione campagna"
            className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
            onClick={closeDrawer}
            type="button"
          />
          <aside className="absolute inset-y-0 right-0 flex h-screen w-full flex-col overflow-hidden bg-white shadow-[0_30px_100px_rgba(0,0,0,0.24)] sm:w-[640px]">
            <header className="shrink-0 border-b border-black/10 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-500">
                    Crea campagna
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-black">
                    Campagna personalizzata
                  </h2>
                </div>
                <button
                  className="grid size-9 place-items-center rounded-full border border-black/10 bg-white text-lg font-semibold text-black transition hover:bg-zinc-50"
                  onClick={closeDrawer}
                  type="button"
                >
                  ×
                </button>
              </div>
              {info ? (
                <p className="mt-4 rounded-[1rem] border border-black/10 bg-[#f7f7f5] p-3 text-sm leading-6 text-zinc-600">
                  {info}
                </p>
              ) : null}
            </header>

            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              <section className="rounded-[1.2rem] border border-black/10 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  Step 1 · Dettagli campagna
                </p>
                <div className="mt-4 grid gap-3">
                  <input
                    className="rounded-full border border-black/10 bg-[#f7f7f5] px-4 py-2.5 text-sm outline-none focus:border-black/30"
                    onChange={(event) => setCampaignName(event.target.value)}
                    value={campaignName}
                  />
                  <select
                    className="rounded-full border border-black/10 bg-[#f7f7f5] px-4 py-2.5 text-sm outline-none focus:border-black/30"
                    onChange={(event) => setObjective(event.target.value)}
                    value={objective}
                  >
                    {objectives.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <select
                    className="rounded-full border border-black/10 bg-[#f7f7f5] px-4 py-2.5 text-sm outline-none focus:border-black/30"
                    onChange={(event) => {
                      const nextSegment = event.target.value as CustomCampaignSegment;
                      setSegment(nextSegment);
                      setCampaign(emptyCampaign);
                      if (nextSegment !== "manual_customers") {
                        setSelectedManualCustomerIds([]);
                        setManualCustomerSearch("");
                      }
                      void loadCustomers(nextSegment);
                    }}
                    value={segment}
                  >
                    {segments.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  {segment === "manual_customers" ? (
                    <div className="rounded-[1rem] border border-black/10 bg-white p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-black">
                            Clienti da includere
                          </p>
                          <p className="mt-1 text-xs font-medium text-zinc-500">
                            {selectedManualCustomerIds.length} clienti selezionati
                          </p>
                        </div>
                        <input
                          className="rounded-full border border-black/10 bg-[#f7f7f5] px-4 py-2 text-sm outline-none focus:border-black/30 sm:w-64"
                          onChange={(event) =>
                            setManualCustomerSearch(event.target.value)
                          }
                          placeholder="Cerca cliente..."
                          type="search"
                          value={manualCustomerSearch}
                        />
                      </div>
                      <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                        {filteredManualCustomers.map((customer) => {
                          const isSelected = selectedManualCustomerIds.includes(
                            customer.id,
                          );

                          return (
                            <button
                              className={`flex w-full items-start justify-between gap-3 rounded-[0.95rem] border p-3 text-left transition ${
                                isSelected
                                  ? "border-black bg-black text-white"
                                  : "border-black/10 bg-[#f7f7f5] text-black hover:bg-white"
                              }`}
                              key={customer.id}
                              onClick={() => toggleManualCustomer(customer.id)}
                              type="button"
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-semibold">
                                  {customer.name}
                                </span>
                                <span
                                  className={`mt-1 block text-xs ${
                                    isSelected ? "text-white/65" : "text-zinc-500"
                                  }`}
                                >
                                  {customer.phone || "Telefono non disponibile"}
                                </span>
                              </span>
                              <span className="flex shrink-0 flex-col items-end gap-1">
                                <span
                                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                    isSelected
                                      ? "bg-white/15 text-white"
                                      : "border border-black/10 bg-white text-zinc-700"
                                  }`}
                                >
                                  {customer.status}
                                </span>
                                <span
                                  className={`text-xs font-semibold ${
                                    isSelected ? "text-white" : "text-zinc-700"
                                  }`}
                                >
                                  {formatCurrency(customer.totalSpent)}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                        {filteredManualCustomers.length === 0 ? (
                          <p className="rounded-[0.95rem] border border-black/10 bg-[#f7f7f5] p-3 text-sm text-zinc-500">
                            Nessun cliente trovato.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  <select
                    className="rounded-full border border-black/10 bg-[#f7f7f5] px-4 py-2.5 text-sm outline-none focus:border-black/30"
                    disabled
                    value="WhatsApp"
                  >
                    <option>WhatsApp</option>
                  </select>
                  <select
                    className="rounded-full border border-black/10 bg-[#f7f7f5] px-4 py-2.5 text-sm outline-none focus:border-black/30"
                    onChange={(event) => setMessageTone(event.target.value)}
                    value={messageTone}
                  >
                    {tones.map((tone) => (
                      <option key={tone} value={tone}>
                        {tone}
                      </option>
                    ))}
                  </select>
                </div>
              </section>

              <section className="rounded-[1.2rem] border border-black/10 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  Step 2 · Servizi
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {catalog.map((service) => {
                    const isSelected = selectedServiceIds.includes(service.id);

                    return (
                      <button
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                          isSelected
                            ? "border-black bg-black text-white"
                            : "border-black/10 bg-[#f7f7f5] text-zinc-700 hover:bg-white"
                        }`}
                        key={service.id}
                        onClick={() => toggleService(service.id)}
                        type="button"
                      >
                        {service.name}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-[1.2rem] border border-black/10 bg-[#f7f7f5] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  Step 3 · Genera
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-zinc-500">Clienti stimati</p>
                    <p className="mt-1 text-2xl font-semibold text-black">
                      {visibleCustomers.length}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Valore storico stimato</p>
                    <p className="mt-1 text-2xl font-semibold text-black">
                      {formatCurrency(totalValue)}
                    </p>
                  </div>
                </div>
              </section>

              {isGenerating ? (
                <p className="rounded-[1rem] border border-black/10 bg-[#f7f7f5] p-4 text-sm text-zinc-600">
                  Sto generando i messaggi AI...
                </p>
              ) : null}
              {campaign.error ? (
                <p className="rounded-[1rem] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                  {campaign.error}
                </p>
              ) : null}
              {campaign.success ? (
                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-black">
                      Messaggi personalizzati
                    </h3>
                    <p className="text-sm text-zinc-500">
                      {contactedCount} / {campaign.customers.length} contattati
                    </p>
                  </div>
                  {campaign.customers.map((customer) => {
                    const finalMessage = buildFinalWhatsAppMessage(
                      customer.message,
                      "custom",
                      selectedServices.map((service) => service.name),
                      { emojiStyle: settings.emojiStyle },
                    );
                    const isContacted = contactedCustomers.has(
                      getContactedCustomerKey(campaignName, customer.id),
                    );

                    return (
                      <article
                        className={`rounded-[1rem] border p-4 ${
                          isContacted
                            ? "border-black/10 bg-zinc-50 text-zinc-500"
                            : "border-black/10 bg-white text-black"
                        }`}
                        key={customer.id}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold">{customer.name}</p>
                          <span className="rounded-full border border-black/10 bg-[#f7f7f5] px-2.5 py-1 text-xs font-semibold text-zinc-700">
                            {formatCurrency(customer.totalSpent)}
                          </span>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap rounded-[0.85rem] border border-black/10 bg-[#f7f7f5] p-3 text-sm leading-7 text-zinc-800">
                          {finalMessage}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700"
                            onClick={() => copyMessage(finalMessage)}
                            type="button"
                          >
                            Copia
                          </button>
                          <button
                            className="rounded-full bg-black px-3 py-1.5 text-sm font-medium text-white disabled:bg-zinc-300"
                            disabled={!cleanWhatsAppPhone(customer.phone)}
                            onClick={() => openWhatsApp(customer, finalMessage)}
                            type="button"
                          >
                            Invia su WhatsApp →
                          </button>
                          <button
                            className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 disabled:bg-zinc-100 disabled:text-zinc-500"
                            disabled={isContacted}
                            onClick={() => updateContacted(customer.id)}
                            type="button"
                          >
                            {isContacted ? "Contattato" : "Segna contattato"}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </section>
              ) : null}
            </div>

            <footer className="shrink-0 border-t border-black/10 bg-white p-5">
              {segment === "manual_customers" &&
              selectedManualCustomerIds.length === 0 ? (
                <p className="mb-3 text-sm text-amber-700">
                  Seleziona almeno un cliente per generare la campagna.
                </p>
              ) : null}
              <button
                className="w-full rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white shadow-[0_14px_35px_rgba(0,0,0,0.18)] transition hover:bg-zinc-800 disabled:bg-zinc-400"
                disabled={isGenerating || visibleCustomers.length === 0}
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
