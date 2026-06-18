"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  getActiveServices,
  readServiceCatalog,
  type ServiceCatalogItem,
} from "@/lib/serviceCatalog";

type AppointmentServiceFieldsProps = {
  initialDurationMinutes?: number | null;
  initialPrice?: number | null;
  initialServiceName?: string;
};

function formatServiceOption(service: ServiceCatalogItem) {
  const price =
    service.averagePrice === null ? "Prezzo non impostato" : `${service.averagePrice} €`;
  const duration =
    service.averageDurationMinutes === null
      ? "Durata non impostata"
      : `${service.averageDurationMinutes} min`;

  return `${service.name} · ${service.category} · ${price} · ${duration}`;
}

export default function AppointmentServiceFields({
  initialDurationMinutes = null,
  initialPrice = null,
  initialServiceName = "",
}: AppointmentServiceFieldsProps) {
  const [services, setServices] = useState<ServiceCatalogItem[]>([]);
  const [serviceName, setServiceName] = useState(initialServiceName);
  const [servicePrice, setServicePrice] = useState(
    initialPrice === null || initialPrice === undefined ? "" : String(initialPrice),
  );
  const [durationMinutes, setDurationMinutes] = useState(
    initialDurationMinutes === null || initialDurationMinutes === undefined
      ? ""
      : String(initialDurationMinutes),
  );
  const [searchQuery, setSearchQuery] = useState(initialServiceName);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setServices(readServiceCatalog());
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const activeServices = useMemo(() => getActiveServices(services), [services]);
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredServices = activeServices.filter((service) => {
    if (!normalizedSearch) {
      return true;
    }

    return (
      service.name.toLowerCase().includes(normalizedSearch) ||
      service.category.toLowerCase().includes(normalizedSearch)
    );
  });
  const matchedCatalogService = services.find(
    (service) => service.name.toLowerCase() === serviceName.trim().toLowerCase(),
  );
  const isHistoricalService =
    Boolean(serviceName.trim()) && services.length > 0 && !matchedCatalogService;

  function selectService(service: ServiceCatalogItem) {
    setServiceName(service.name);
    setSearchQuery(service.name);

    if (service.averagePrice !== null) {
      setServicePrice(String(service.averagePrice));
    }

    if (service.averageDurationMinutes !== null) {
      setDurationMinutes(String(service.averageDurationMinutes));
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="text-sm font-medium text-zinc-700">
          Servizio
          <input
            className="mt-2 w-full rounded-2xl border border-black/10 bg-[#f7f7f5] px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-black/30"
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setServiceName(event.target.value);
            }}
            placeholder="Cerca servizio..."
            type="search"
            value={searchQuery}
          />
        </label>
        <input name="service_name" type="hidden" value={serviceName} />

        {activeServices.length > 0 ? (
          <div className="mt-2 max-h-44 overflow-y-auto rounded-2xl border border-black/10 bg-white p-1.5 shadow-sm">
            {filteredServices.length > 0 ? (
              filteredServices.map((service) => {
                const isSelected = service.name === serviceName;

                return (
                  <button
                    className={`flex w-full flex-col rounded-[0.9rem] px-3 py-2.5 text-left text-sm transition ${
                      isSelected
                        ? "bg-black text-white"
                        : "text-zinc-700 hover:bg-[#f7f7f5]"
                    }`}
                    key={service.id}
                    onClick={() => selectService(service)}
                    type="button"
                  >
                    <span className="font-semibold">{service.name}</span>
                    <span
                      className={`mt-0.5 text-xs ${
                        isSelected ? "text-white/70" : "text-zinc-500"
                      }`}
                    >
                      {formatServiceOption(service)}
                    </span>
                  </button>
                );
              })
            ) : (
              <p className="px-3 py-2 text-sm text-zinc-500">
                Nessun servizio trovato. Puoi mantenere il nome inserito manualmente.
              </p>
            )}
          </div>
        ) : (
          <div className="mt-2 rounded-2xl border border-black/10 bg-[#f7f7f5] p-4">
            <p className="text-sm font-medium text-zinc-700">
              Nessun servizio attivo nel Catalogo.
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              Puoi inserire manualmente il nome servizio per non bloccare la visita.
            </p>
            <Link
              className="mt-3 inline-flex rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
              href="/catalogo"
            >
              Apri Catalogo
            </Link>
          </div>
        )}

        {isHistoricalService ? (
          <span className="mt-2 inline-flex rounded-full border border-black/10 bg-[#f7f7f5] px-3 py-1 text-xs font-semibold text-zinc-600">
            Servizio storico
          </span>
        ) : null}
      </div>

      <label className="text-sm font-medium text-zinc-700">
        Importo
        <input
          className="mt-2 w-full rounded-2xl border border-black/10 bg-[#f7f7f5] px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-black/30"
          min="0"
          name="service_price"
          onChange={(event) => setServicePrice(event.target.value)}
          required
          step="0.01"
          type="number"
          value={servicePrice}
        />
      </label>

      <label className="text-sm font-medium text-zinc-700">
        Durata
        <input
          className="mt-2 w-full rounded-2xl border border-black/10 bg-[#f7f7f5] px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-black/30"
          min="0"
          name="duration_minutes"
          onChange={(event) => setDurationMinutes(event.target.value)}
          placeholder="Minuti"
          type="number"
          value={durationMinutes}
        />
      </label>

      <p className="text-xs font-medium text-zinc-500 sm:col-span-2">
        Valori suggeriti dal Catalogo servizi. Prezzo e durata restano modificabili
        per questa singola visita.
      </p>
    </div>
  );
}
