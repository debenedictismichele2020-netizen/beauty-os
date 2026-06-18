"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";

import type { CatalogAppointmentUsage } from "./page";
import {
  createServiceId,
  defaultServiceCatalog,
  normalizeServiceName,
  readServiceCatalog,
  saveServiceCatalog,
  serviceCategories,
  type ServiceCatalogItem,
  type ServiceCategory,
} from "@/lib/serviceCatalog";

const newServiceId = "__new_service__";
const prefilledCampaignServiceStorageKey = "beauty_os_prefilled_campaign_service";
const customCampaignDraftStorageKey = "beauty_os_custom_campaign_draft";

const emptyForm = {
  active: true,
  averageDurationMinutes: "",
  averagePrice: "",
  category: "Altro" as ServiceCategory,
  name: "",
};

type ServiceFormState = typeof emptyForm;
type StatusFilter = "all" | "active" | "inactive";
type ServiceUsageStats = {
  averageTicket: number;
  lastSale: string;
  revenue: number;
  visits: number;
};

function formatPrice(value: number | null) {
  if (value === null) {
    return "Non impostato";
  }

  return new Intl.NumberFormat("it-IT", {
    currency: "EUR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function formatDuration(value: number | null) {
  return value === null ? "Non impostata" : `${value} min`;
}

function formatShortDate(value: string) {
  if (!value) {
    return "Non disponibile";
  }

  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function normalizeUsageKey(value: string) {
  return normalizeServiceName(value).toLowerCase();
}

function formatUsage(value: number) {
  return value === 1 ? "1 visita" : `${value} visite`;
}

function formatDescriptiveUsage(value: number) {
  if (value <= 0) {
    return "Mai usato";
  }

  return formatUsage(value);
}

function toFormState(service: ServiceCatalogItem): ServiceFormState {
  return {
    active: service.active,
    averageDurationMinutes: service.averageDurationMinutes?.toString() ?? "",
    averagePrice: service.averagePrice?.toString() ?? "",
    category: service.category,
    name: service.name,
  };
}

function toCatalogItem(form: ServiceFormState, id?: string): ServiceCatalogItem {
  return {
    active: form.active,
    averageDurationMinutes: form.averageDurationMinutes
      ? Number(form.averageDurationMinutes)
      : null,
    averagePrice: form.averagePrice ? Number(form.averagePrice) : null,
    category: form.category,
    id: id || createServiceId(form.name),
    name: normalizeServiceName(form.name),
  };
}

function StatusButton({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition hover:-translate-y-0.5 ${
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-black/10 bg-zinc-100 text-zinc-500"
      }`}
      onClick={onClick}
      type="button"
    >
      {active ? <Check aria-hidden="true" size={13} /> : <X aria-hidden="true" size={13} />}
      {active ? "Attivo" : "Non attivo"}
    </button>
  );
}

export default function ServiceCatalogManager({
  appointmentUsage,
}: {
  appointmentUsage: CatalogAppointmentUsage[];
}) {
  const router = useRouter();
  const [services, setServices] = useState<ServiceCatalogItem[]>(defaultServiceCatalog);
  const [scoreToday] = useState(() => new Date());
  const [form, setForm] = useState<ServiceFormState>(emptyForm);
  const [editingServiceId, setEditingServiceId] = useState("");
  const [deleteCandidateId, setDeleteCandidateId] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setServices(readServiceCatalog());
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeoutId = window.setTimeout(() => setToast(""), 2200);

    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  const activeServices = useMemo(
    () => services.filter((service) => service.active).length,
    [services],
  );
  const usageByService = useMemo(() => {
    const nextUsageByService = new Map<string, ServiceUsageStats>();

    appointmentUsage.forEach((appointment) => {
      const key = normalizeUsageKey(appointment.serviceName);

      if (!key) {
        return;
      }

      const currentStats = nextUsageByService.get(key) ?? {
        averageTicket: 0,
        lastSale: "",
        revenue: 0,
        visits: 0,
      };
      const revenue = currentStats.revenue + appointment.amount;
      const visits = currentStats.visits + 1;
      const lastSale =
        appointment.appointmentDate &&
        (!currentStats.lastSale ||
          appointment.appointmentDate > currentStats.lastSale)
          ? appointment.appointmentDate
          : currentStats.lastSale;

      nextUsageByService.set(key, {
        averageTicket: visits > 0 ? Math.round(revenue / visits) : 0,
        lastSale,
        revenue,
        visits,
      });
    });

    return nextUsageByService;
  }, [appointmentUsage]);
  const catalogInsights = useMemo(() => {
    const servicesWithUsage = services.map((service) => ({
      service,
      stats: usageByService.get(normalizeUsageKey(service.name)) ?? {
        averageTicket: 0,
        lastSale: "",
        revenue: 0,
        visits: 0,
      },
    }));
    const usedServices = servicesWithUsage.filter(({ stats }) => stats.visits > 0);
    const mostProfitable = [...usedServices].sort(
      (first, second) => second.stats.revenue - first.stats.revenue,
    )[0];
    const mostRequested = [...usedServices].sort((first, second) => {
      const visitDifference = second.stats.visits - first.stats.visits;

      return visitDifference !== 0
        ? visitDifference
        : second.stats.averageTicket - first.stats.averageTicket;
    })[0];
    const activeServicesWithUsage = servicesWithUsage.filter(
      ({ service }) => service.active,
    );
    const averageVisits =
      activeServicesWithUsage.length > 0
        ? activeServicesWithUsage.reduce(
            (total, item) => total + item.stats.visits,
            0,
          ) / activeServicesWithUsage.length
        : 0;
    const pushService = [...activeServicesWithUsage]
      .filter(({ service, stats }) => {
        const price = service.averagePrice ?? 0;

        return price > 0 && stats.visits <= Math.max(1, averageVisits);
      })
      .sort((first, second) => {
        const priceDifference =
          (second.service.averagePrice ?? 0) - (first.service.averagePrice ?? 0);

        return priceDifference !== 0
          ? priceDifference
          : first.stats.visits - second.stats.visits;
      })[0];
    const unusedServices = activeServicesWithUsage.filter(
      ({ stats }) => stats.visits === 0,
    );
    const highValueLowUsageService = [...activeServicesWithUsage]
      .filter(
        ({ service, stats }) =>
          (service.averagePrice ?? 0) >= 70 && stats.visits <= 1,
      )
      .sort(
        (first, second) =>
          (second.service.averagePrice ?? 0) - (first.service.averagePrice ?? 0),
      )[0];
    const requestedLowTicketService = [...usedServices]
      .filter(({ stats }) => stats.visits >= 2 && stats.averageTicket < 50)
      .sort((first, second) => second.stats.visits - first.stats.visits)[0];
    const suggestions = [
      highValueLowUsageService
        ? {
            actionService: highValueLowUsageService.service,
            text: `${highValueLowUsageService.service.name} ha prezzo alto ma poche vendite. Consigliata una campagna dedicata.`,
            title: "Spingi un servizio ad alto valore",
          }
        : null,
      requestedLowTicketService
        ? {
            actionService: requestedLowTicketService.service,
            text: `${requestedLowTicketService.service.name} viene richiesto spesso ma ha ticket medio basso. Valuta un upsell con un servizio premium.`,
            title: "Aumenta il ticket medio",
          }
        : null,
      unusedServices.length > 0
        ? {
            actionKind: "unused_services" as const,
            actionService: unusedServices[0]?.service,
            text: `Ci sono ${unusedServices.length} servizi mai venduti: ${unusedServices
              .slice(0, 3)
              .map(({ service }) => service.name)
              .join(", ")}${
              unusedServices.length > 3 ? ` +${unusedServices.length - 3}` : ""
            }. Provali in una campagna mirata o valuta di rimuoverli.`,
            title: "Servizi mai venduti",
          }
        : null,
      mostProfitable
        ? {
            actionService: mostProfitable.service,
            text: `${mostProfitable.service.name} è tra i servizi più redditizi. Può diventare un'offerta ricorrente.`,
            title: "Rendi ricorrente il servizio migliore",
          }
        : null,
    ].filter(
      (
        suggestion,
      ): suggestion is {
        actionKind?: "unused_services";
        actionService: ServiceCatalogItem;
        text: string;
        title: string;
      } => Boolean(suggestion),
    );

    return {
      mostProfitable,
      mostRequested,
      pushService,
      servicesWithUsage,
      suggestions: suggestions.slice(0, 3),
      unusedServices,
      unusedServicesCount: unusedServices.length,
    };
  }, [services, usageByService]);
  const filteredServices = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return services.filter((service) => {
      const matchesSearch =
        !normalizedQuery ||
        service.name.toLowerCase().includes(normalizedQuery) ||
        service.category.toLowerCase().includes(normalizedQuery);
      const matchesCategory =
        categoryFilter === "all" || service.category === categoryFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && service.active) ||
        (statusFilter === "inactive" && !service.active);

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [categoryFilter, searchQuery, services, statusFilter]);

  function persistServices(nextServices: ServiceCatalogItem[]) {
    setServices(nextServices);
    saveServiceCatalog(nextServices);
  }

  function resetEditing() {
    setForm(emptyForm);
    setEditingServiceId("");
    setError("");
  }

  function serviceNameExists(name: string, ignoredServiceId = "") {
    const serviceKey = normalizeServiceName(name).toLowerCase();

    return services.some(
      (service) =>
        service.id !== ignoredServiceId &&
        service.name.toLowerCase() === serviceKey,
    );
  }

  function validateForm(currentForm: ServiceFormState, ignoredServiceId = "") {
    const name = normalizeServiceName(currentForm.name);

    if (!name) {
      return "Inserisci il nome del servizio.";
    }

    if (serviceNameExists(name, ignoredServiceId)) {
      return "Questo servizio esiste già.";
    }

    if (
      currentForm.averagePrice &&
      (!Number.isFinite(Number(currentForm.averagePrice)) ||
        Number(currentForm.averagePrice) < 0)
    ) {
      return "Inserisci un prezzo valido.";
    }

    if (
      currentForm.averageDurationMinutes &&
      (!Number.isFinite(Number(currentForm.averageDurationMinutes)) ||
        Number(currentForm.averageDurationMinutes) < 0)
    ) {
      return "Inserisci una durata valida.";
    }

    return "";
  }

  function startAddingService() {
    setEditingServiceId(newServiceId);
    setDeleteCandidateId("");
    setForm(emptyForm);
    setError("");
  }

  function startEditing(service: ServiceCatalogItem) {
    setEditingServiceId(service.id);
    setDeleteCandidateId("");
    setForm(toFormState(service));
    setError("");
  }

  function saveEditing() {
    const isNewService = editingServiceId === newServiceId;
    const validationError = validateForm(form, isNewService ? "" : editingServiceId);

    if (validationError) {
      setError(validationError);
      return;
    }

    if (isNewService) {
      persistServices([toCatalogItem(form), ...services]);
      setToast("Servizio aggiunto");
    } else {
      persistServices(
        services.map((service) =>
          service.id === editingServiceId
            ? toCatalogItem(form, editingServiceId)
            : service,
        ),
      );
      setToast("Servizio aggiornato");
    }

    resetEditing();
  }

  function toggleService(serviceId: string) {
    persistServices(
      services.map((service) =>
        service.id === serviceId
          ? { ...service, active: !service.active }
          : service,
      ),
    );
    setToast("Stato servizio aggiornato");
  }

  function deleteService(serviceId: string) {
    persistServices(services.filter((service) => service.id !== serviceId));
    setDeleteCandidateId("");
    resetEditing();
    setToast("Servizio eliminato");
  }

  function updateForm<Field extends keyof ServiceFormState>(
    field: Field,
    value: ServiceFormState[Field],
  ) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  function getServiceUsage(service: ServiceCatalogItem) {
    return usageByService.get(normalizeUsageKey(service.name)) ?? {
      averageTicket: 0,
      lastSale: "",
      revenue: 0,
      visits: 0,
    };
  }

  function getServiceSuggestion(service: ServiceCatalogItem) {
    const stats = getServiceUsage(service);

    if (!service.active) {
      return "";
    }

    if (stats.visits >= 8 && stats.averageTicket >= 50) {
      return "Ottimo per campagne";
    }

    if (stats.visits === 0) {
      return service.averagePrice && service.averagePrice >= 70
        ? "Alto valore"
        : "Poco usato";
    }

    if (service.averagePrice && service.averagePrice >= 80) {
      return "Alto valore";
    }

    if (stats.visits <= 2) {
      return "Da monitorare";
    }

    return "";
  }

  function getServiceScore(service: ServiceCatalogItem) {
    const stats = getServiceUsage(service);
    const maxVisits = Math.max(
      1,
      ...catalogInsights.servicesWithUsage.map((item) => item.stats.visits),
    );
    const maxRevenue = Math.max(
      1,
      ...catalogInsights.servicesWithUsage.map((item) => item.stats.revenue),
    );
    const price = service.averagePrice ?? 0;

    if (stats.visits === 0) {
      return price >= 70 ? 45 : 35;
    }

    const visitsScore = Math.min(30, (stats.visits / maxVisits) * 30);
    const revenueScore = Math.min(35, (stats.revenue / maxRevenue) * 35);
    const priceScore = Math.min(20, (price / 120) * 20);
    const recencyScore = stats.lastSale
      ? Math.max(
          0,
          15 -
            Math.min(
              15,
              Math.round(
                (scoreToday.getTime() -
                  new Date(`${stats.lastSale}T00:00:00`).getTime()) /
                  86_400_000,
              ) / 6,
            ),
        )
      : 0;

    return Math.max(
      55,
      Math.min(
        100,
        Math.round(visitsScore + revenueScore + priceScore + recencyScore),
      ),
    );
  }

  function getScoreLabel(score: number) {
    if (score >= 80) {
      return "Ottima performance";
    }

    if (score >= 60) {
      return "Buona performance";
    }

    if (score >= 40) {
      return "Da monitorare";
    }

    return "Critico";
  }

  function isOpportunityService(service: ServiceCatalogItem) {
    const stats = getServiceUsage(service);

    return service.active && (service.averagePrice ?? 0) >= 70 && stats.visits <= 1;
  }

  function createCampaignFromService(service: ServiceCatalogItem) {
    window.localStorage.setItem(prefilledCampaignServiceStorageKey, service.name);
    router.push("/campagne");
  }

  function createUnusedServicesCampaign() {
    const selectedServices = catalogInsights.unusedServices.map(({ service }) => ({
      category: service.category,
      duration: service.averageDurationMinutes,
      name: service.name,
      price: service.averagePrice,
    }));

    if (selectedServices.length === 0) {
      return;
    }

    window.localStorage.setItem(
      customCampaignDraftStorageKey,
      JSON.stringify({
        createdAt: new Date().toISOString(),
        selectedServices,
        source: "catalog_unused_services",
        title: "Campagna servizi inutilizzati",
      }),
    );
    router.push("/campagne?new=1");
  }

  function renderEditFields() {
    return (
      <>
        <input
          className="min-w-0 rounded-full border border-black/10 bg-white px-3 py-2 text-sm text-black outline-none transition focus:border-black/30"
          onChange={(event) => updateForm("name", event.target.value)}
          placeholder="Nome servizio"
          type="text"
          value={form.name}
        />
        <select
          className="min-w-0 rounded-full border border-black/10 bg-white px-3 py-2 text-sm text-black outline-none transition focus:border-black/30"
          onChange={(event) =>
            updateForm("category", event.target.value as ServiceCategory)
          }
          value={form.category}
        >
          {serviceCategories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
        <input
          className="min-w-0 rounded-full border border-black/10 bg-white px-3 py-2 text-sm text-black outline-none transition focus:border-black/30"
          min="0"
          onChange={(event) => updateForm("averagePrice", event.target.value)}
          placeholder="Prezzo"
          type="number"
          value={form.averagePrice}
        />
        <input
          className="min-w-0 rounded-full border border-black/10 bg-white px-3 py-2 text-sm text-black outline-none transition focus:border-black/30"
          min="0"
          onChange={(event) =>
            updateForm("averageDurationMinutes", event.target.value)
          }
          placeholder="Durata"
          type="number"
          value={form.averageDurationMinutes}
        />
        <button
          className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
            form.active
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-black/10 bg-zinc-100 text-zinc-500"
          }`}
          onClick={() => updateForm("active", !form.active)}
          type="button"
        >
          {form.active ? "Attivo" : "Non attivo"}
        </button>
        <span className="hidden lg:block" />
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <button
            className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-zinc-800"
            onClick={saveEditing}
            type="button"
          >
            Salva
          </button>
          <button
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-zinc-600 transition hover:-translate-y-0.5 hover:bg-zinc-50"
            onClick={resetEditing}
            type="button"
          >
            Annulla
          </button>
        </div>
      </>
    );
  }

  function renderServiceRow(service: ServiceCatalogItem) {
    const isEditing = editingServiceId === service.id;
    const isConfirmingDelete = deleteCandidateId === service.id;
    const usage = getServiceUsage(service);
    const suggestion = getServiceSuggestion(service);
    const score = getServiceScore(service);
    const scoreLabel = getScoreLabel(score);
    const isOpportunity = isOpportunityService(service);

    return (
      <article
        className={`grid gap-3 px-4 py-4 transition lg:grid-cols-[1.32fr_0.62fr_0.5fr_0.5fr_0.62fr_0.72fr_auto] lg:items-center lg:px-5 ${
          isEditing ? "bg-[#fafafa] ring-1 ring-inset ring-black/10" : "hover:bg-[#fafafa]"
        }`}
        key={service.id}
      >
        {isEditing ? (
          renderEditFields()
        ) : (
          <>
            <div className="min-w-0">
              <p className="truncate font-semibold tracking-tight text-black">
                {service.name}
              </p>
              <p className="mt-1 text-xs text-zinc-500 lg:hidden">
                {service.category} · {formatPrice(service.averagePrice)} ·{" "}
                {formatDuration(service.averageDurationMinutes)} ·{" "}
                {formatUsage(usage.visits)}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Score AI {score}/100 · {scoreLabel}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {isOpportunity ? (
                  <button
                    className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 transition hover:-translate-y-0.5 hover:border-amber-300"
                    onClick={() => createCampaignFromService(service)}
                    type="button"
                  >
                    🔥 Opportunità
                  </button>
                ) : null}
                {suggestion ? (
                  <span className="text-xs font-medium text-zinc-400">
                    {suggestion}
                  </span>
                ) : null}
              </div>
            </div>
            <span className="hidden w-fit rounded-full border border-black/10 bg-[#f7f7f5] px-3 py-1 text-xs font-semibold text-zinc-700 lg:inline-flex">
              {service.category}
            </span>
            <p className="hidden text-sm font-medium text-zinc-700 lg:block">
              {formatPrice(service.averagePrice)}
            </p>
            <p className="hidden text-sm font-medium text-zinc-700 lg:block">
              {formatDuration(service.averageDurationMinutes)}
            </p>
            <StatusButton
              active={service.active}
              onClick={() => toggleService(service.id)}
            />
            <div className="hidden lg:block">
              <p className="text-sm font-medium text-zinc-700">
                {formatUsage(usage.visits)}
              </p>
              {usage.lastSale ? (
                <p className="mt-0.5 text-xs text-zinc-400">
                  ultima vendita: {formatShortDate(usage.lastSale)}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              {isConfirmingDelete ? (
                <div className="flex flex-wrap items-center gap-2 rounded-full border border-black/10 bg-white p-1.5 shadow-sm">
                  <span className="px-2 text-xs font-medium text-zinc-600">
                    Eliminare questo servizio dal catalogo?
                  </span>
                  <button
                    className="rounded-full px-3 py-1.5 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-50"
                    onClick={() => setDeleteCandidateId("")}
                    type="button"
                  >
                    Annulla
                  </button>
                  <button
                    className="rounded-full bg-black px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-zinc-800"
                    onClick={() => deleteService(service.id)}
                    type="button"
                  >
                    Elimina
                  </button>
                </div>
              ) : (
                <>
                  <button
                    aria-label="Modifica servizio"
                    className="grid size-9 place-items-center rounded-full border border-black/10 bg-white text-zinc-600 transition hover:-translate-y-0.5 hover:bg-zinc-50 hover:text-black"
                    onClick={() => startEditing(service)}
                    type="button"
                  >
                    <Pencil aria-hidden="true" size={16} />
                  </button>
                  <button
                    aria-label="Elimina servizio"
                    className="grid size-9 place-items-center rounded-full border border-black/10 bg-white text-zinc-600 transition hover:-translate-y-0.5 hover:bg-zinc-50 hover:text-black"
                    onClick={() => setDeleteCandidateId(service.id)}
                    type="button"
                  >
                    <Trash2 aria-hidden="true" size={16} />
                  </button>
                </>
              )}
            </div>
          </>
        )}
        {isEditing && error ? (
          <p className="text-sm text-rose-700 lg:col-span-7">{error}</p>
        ) : null}
      </article>
    );
  }

  function renderInsightValue(
    insight:
      | {
          service: ServiceCatalogItem;
          stats: ServiceUsageStats;
        }
      | undefined,
    type: "profit" | "requested" | "push",
  ) {
    if (!insight) {
      return (
        <div>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-black">
            Dati insufficienti
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Aggiungi visite allo storico per generare insight affidabili.
          </p>
        </div>
      );
    }

    return (
      <div>
        <p className="mt-3 truncate text-2xl font-semibold tracking-tight text-black">
          {insight.service.name}
        </p>
        {type === "profit" ? (
          <div className="mt-2 space-y-1 text-sm leading-6 text-zinc-500">
            <p>{formatPrice(insight.stats.revenue)} generati</p>
            <p>Ticket medio {formatPrice(insight.stats.averageTicket)}</p>
            <p>
              Ultima vendita{" "}
              {insight.stats.lastSale
                ? formatShortDate(insight.stats.lastSale)
                : "non disponibile"}
            </p>
          </div>
        ) : null}
        {type === "requested" ? (
          <div className="mt-2 space-y-1 text-sm leading-6 text-zinc-500">
            <p>{formatUsage(insight.stats.visits)}</p>
            <p>{formatPrice(insight.stats.revenue)} generati</p>
          </div>
        ) : null}
        {type === "push" ? (
          <div className="mt-2">
            <p className="text-sm leading-6 text-zinc-500">
              {formatPrice(insight.service.averagePrice)} medio ·{" "}
              {formatDescriptiveUsage(insight.stats.visits)}
            </p>
            <p className="mt-1 text-sm font-semibold text-black">
              Potenziale stimato{" "}
              {formatPrice((insight.service.averagePrice ?? 0) * 3)}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
              Da proporre nelle campagne
            </p>
            <button
              className="mt-3 rounded-full bg-black px-4 py-2 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-zinc-800"
              onClick={() => createCampaignFromService(insight.service)}
              type="button"
            >
              Apri campagna
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-5 border-b border-black/10 pb-6 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-zinc-500">
            Catalogo
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-black sm:text-5xl">
            Catalogo servizi
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
            Gestisci servizi, prezzi e durata del tuo salone.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3 md:justify-end">
          <span className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm">
            {activeServices} servizi attivi
          </span>
          <button
            className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-zinc-800"
            onClick={startAddingService}
            type="button"
          >
            <Plus aria-hidden="true" size={16} />
            Aggiungi servizio
          </button>
        </div>
      </header>

      {toast ? (
        <p className="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
          {toast}
        </p>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[1.25rem] border border-black/10 bg-white p-4 shadow-[0_16px_45px_rgba(0,0,0,0.05)]">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">
            Servizio più redditizio
          </p>
          {renderInsightValue(catalogInsights.mostProfitable, "profit")}
        </article>
        <article className="rounded-[1.25rem] border border-black/10 bg-white p-4 shadow-[0_16px_45px_rgba(0,0,0,0.05)]">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">
            Servizio più richiesto
          </p>
          {renderInsightValue(catalogInsights.mostRequested, "requested")}
        </article>
        <article className="rounded-[1.25rem] border border-black/10 bg-white p-4 shadow-[0_16px_45px_rgba(0,0,0,0.05)]">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">
            Servizio da spingere
          </p>
          {renderInsightValue(catalogInsights.pushService, "push")}
        </article>
        <article className="rounded-[1.25rem] border border-black/10 bg-white p-4 shadow-[0_16px_45px_rgba(0,0,0,0.05)]">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">
            Servizi inutilizzati
          </p>
          {catalogInsights.unusedServicesCount > 0 ? (
            <>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-black">
                {catalogInsights.unusedServicesCount} servizi
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                {catalogInsights.unusedServices
                  .slice(0, 3)
                  .map(({ service }) => service.name)
                  .join(", ")}
                {catalogInsights.unusedServicesCount > 3
                  ? ` +${catalogInsights.unusedServicesCount - 3}`
                  : ""}
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                Da valutare o promuovere
              </p>
              <button
                className="mt-3 rounded-full bg-black px-4 py-2 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-zinc-800"
                onClick={createUnusedServicesCampaign}
                type="button"
              >
                Crea campagna
              </button>
            </>
          ) : (
            <>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-black">
                Nessun servizio inutilizzato
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Tutti i servizi attivi hanno almeno una vendita.
              </p>
            </>
          )}
        </article>
      </section>

      <section className="overflow-hidden rounded-[1.35rem] border border-black/10 bg-white shadow-[0_22px_70px_rgba(0,0,0,0.07)]">
        <div className="grid gap-3 border-b border-black/10 p-4 lg:grid-cols-[1fr_180px_150px] lg:items-center lg:p-5">
          <input
            className="w-full rounded-full border border-black/10 bg-[#f7f7f5] px-4 py-2.5 text-sm outline-none transition focus:border-black/30"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Cerca servizio..."
            type="search"
            value={searchQuery}
          />
          <select
            className="w-full rounded-full border border-black/10 bg-[#f7f7f5] px-4 py-2.5 text-sm outline-none transition focus:border-black/30"
            onChange={(event) => setCategoryFilter(event.target.value)}
            value={categoryFilter}
          >
            <option value="all">Tutte le categorie</option>
            {serviceCategories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <select
            className="w-full rounded-full border border-black/10 bg-[#f7f7f5] px-4 py-2.5 text-sm outline-none transition focus:border-black/30"
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            value={statusFilter}
          >
            <option value="all">Tutti</option>
            <option value="active">Attivi</option>
            <option value="inactive">Non attivi</option>
          </select>
        </div>

        <div className="hidden border-b border-black/10 bg-[#fafafa] px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400 lg:grid lg:grid-cols-[1.32fr_0.62fr_0.5fr_0.5fr_0.62fr_0.72fr_auto]">
          <span>Servizio</span>
          <span>Categoria</span>
          <span>Prezzo</span>
          <span>Durata</span>
          <span>Stato</span>
          <span>Utilizzo</span>
          <span className="text-right">Azioni</span>
        </div>

        <div className="divide-y divide-black/10">
          {editingServiceId === newServiceId ? (
            <article className="grid gap-3 bg-[#fafafa] px-4 py-4 ring-1 ring-inset ring-black/10 lg:grid-cols-[1.32fr_0.62fr_0.5fr_0.5fr_0.62fr_0.72fr_auto] lg:items-center lg:px-5">
              {renderEditFields()}
              {error ? (
                <p className="text-sm text-rose-700 lg:col-span-7">{error}</p>
              ) : null}
            </article>
          ) : null}

          {filteredServices.length === 0 && editingServiceId !== newServiceId ? (
            <p className="p-5 text-sm text-zinc-500">
              Nessun servizio trovato.
            </p>
          ) : null}

          {filteredServices.map((service) => renderServiceRow(service))}
        </div>
      </section>

      <section className="rounded-[1.35rem] border border-black/10 bg-white p-5 shadow-[0_18px_55px_rgba(0,0,0,0.05)]">
        <div className="flex flex-col gap-2 border-b border-black/10 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-400">
              Suggerimenti AI
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-black">
              Azioni consigliate sul catalogo
            </h2>
          </div>
        </div>
        {catalogInsights.suggestions.length > 0 ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {catalogInsights.suggestions.map((suggestion) => (
              <article
                className="rounded-[1rem] border border-black/10 bg-[#f7f7f5] p-4"
                key={`${suggestion.title}-${suggestion.actionService?.id ?? "catalogo"}`}
              >
                <p className="text-sm font-semibold text-black">
                  {suggestion.title}
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  {suggestion.text}
                </p>
                {suggestion.actionService ? (
                  <button
                    className="mt-3 rounded-full bg-black px-4 py-2 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-zinc-800"
                    onClick={() =>
                      suggestion.actionKind === "unused_services"
                        ? createUnusedServicesCampaign()
                        : createCampaignFromService(suggestion.actionService)
                    }
                    type="button"
                  >
                    Crea campagna
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-[1rem] border border-black/10 bg-[#f7f7f5] p-4 text-sm text-zinc-500">
            Aggiungi visite allo storico per ricevere suggerimenti sul catalogo.
          </p>
        )}
      </section>
    </div>
  );
}
