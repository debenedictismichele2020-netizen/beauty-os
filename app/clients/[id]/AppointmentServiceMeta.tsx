"use client";

import { useEffect, useState } from "react";

import { readServiceCatalog, type ServiceCatalogItem } from "@/lib/serviceCatalog";

export default function AppointmentServiceMeta({
  serviceName,
}: {
  serviceName: string;
}) {
  const [service, setService] = useState<ServiceCatalogItem | null | undefined>(
    undefined,
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const catalog = readServiceCatalog();
      const matchedService = catalog.find(
        (item) => item.name.toLowerCase() === serviceName.trim().toLowerCase(),
      );

      setService(matchedService ?? null);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [serviceName]);

  if (service === undefined) {
    return null;
  }

  if (service === null) {
    return (
      <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-zinc-600">
        Servizio storico
      </span>
    );
  }

  return (
    <>
      <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-zinc-600">
        {service.category}
      </span>
      {service.averageDurationMinutes !== null ? (
        <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-zinc-600">
          {service.averageDurationMinutes} min
        </span>
      ) : null}
    </>
  );
}
