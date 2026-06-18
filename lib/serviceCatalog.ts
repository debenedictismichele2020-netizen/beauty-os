import { cleanupLegacyLocalStorageKeys } from "@/lib/legacyLocalStorage";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export const serviceCatalogStorageKey = "beauty_os_service_catalog";
export const legacyCampaignServicesStorageKey = "beauty_os_campaign_services";
const serviceCatalogBackfillStorageKey = "beauty_os_service_catalog_backfill_v1";
let hasHydratedServiceCatalogFromSupabase = false;
let isSyncingServiceCatalog = false;

export const serviceCategories = [
  "Viso",
  "Corpo",
  "Nails",
  "Hair",
  "Barber",
  "Relax",
  "Evento",
  "Altro",
] as const;

export type ServiceCategory = (typeof serviceCategories)[number];

export type ServiceCatalogItem = {
  active: boolean;
  averageDurationMinutes: number | null;
  averagePrice: number | null;
  category: ServiceCategory;
  id: string;
  name: string;
};

type ServiceRow = {
  active?: boolean | null;
  average_duration_minutes?: number | string | null;
  average_price?: number | string | null;
  category?: string | null;
  id?: string | null;
  local_service_id?: string | null;
  name?: string | null;
};

export const defaultServiceCatalog: ServiceCatalogItem[] = [
  createDefaultService("Trattamento viso", "Viso", 75, 60),
  createDefaultService("Pulizia viso", "Viso", 55, 45),
  createDefaultService("Laminazione ciglia", "Viso", 60, 60),
  createDefaultService("Trattamento corpo", "Corpo", 85, 75),
  createDefaultService("Massaggio relax", "Relax", 70, 60),
  createDefaultService("Manicure", "Nails", 35, 45),
  createDefaultService("Pedicure", "Nails", 45, 50),
  createDefaultService("Barba / grooming uomo", "Barber", 30, 30),
  createDefaultService("Pacchetto sposa", "Evento", 250, 180),
  createDefaultService("Check-up beauty", "Altro", 40, 30),
];

const defaultServicesByName = new Map(
  defaultServiceCatalog.map((service) => [service.name.toLowerCase(), service]),
);

function createDefaultService(
  name: string,
  category: ServiceCategory,
  averagePrice: number,
  averageDurationMinutes: number,
): ServiceCatalogItem {
  return {
    active: true,
    averageDurationMinutes,
    averagePrice,
    category,
    id: createServiceId(name),
    name,
  };
}

export function createServiceId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || `servizio-${Date.now()}`;
}

export function normalizeServiceName(service: string) {
  return service.trim().replace(/\s+/g, " ");
}

function normalizeServiceCategory(category: unknown): ServiceCategory {
  return serviceCategories.includes(category as ServiceCategory)
    ? (category as ServiceCategory)
    : "Altro";
}

function normalizeNumber(value: unknown) {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) && numericValue > 0
    ? Math.round(numericValue)
    : null;
}

function dedupeCatalog(services: ServiceCatalogItem[]) {
  const seenServices = new Set<string>();
  const nextServices: ServiceCatalogItem[] = [];

  services.forEach((service) => {
    const normalizedName = normalizeServiceName(service.name);
    const serviceKey = normalizedName.toLowerCase();

    if (!normalizedName || seenServices.has(serviceKey)) {
      return;
    }

    seenServices.add(serviceKey);
    nextServices.push({
      ...service,
      id: service.id || createServiceId(normalizedName),
      name: normalizedName,
    });
  });

  return nextServices;
}

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function normalizeServiceRow(row: ServiceRow): ServiceCatalogItem | null {
  const name = normalizeServiceName(String(row.name ?? ""));

  if (!name) {
    return null;
  }

  return {
    active: row.active !== false,
    averageDurationMinutes: normalizeNumber(row.average_duration_minutes),
    averagePrice: normalizeNumber(row.average_price),
    category: normalizeServiceCategory(row.category),
    id: String(row.local_service_id || row.id || createServiceId(name)),
    name,
  };
}

function toServiceRow(service: ServiceCatalogItem) {
  return {
    active: service.active,
    average_duration_minutes: service.averageDurationMinutes ?? 0,
    average_price: service.averagePrice ?? 0,
    category: service.category,
    deleted_at: null,
    local_service_id: service.id,
    name: service.name,
    updated_at: new Date().toISOString(),
  };
}

export function normalizeServiceCatalog(value: unknown): ServiceCatalogItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return dedupeCatalog(
    value.flatMap((item) => {
      if (typeof item === "string") {
        const name = normalizeServiceName(item);

        return name
          ? [
              {
                active: true,
                averageDurationMinutes: null,
                averagePrice: null,
                category: "Altro" as ServiceCategory,
                id: createServiceId(name),
                name,
              },
            ]
          : [];
      }

      if (!item || typeof item !== "object" || !("name" in item)) {
        return [];
      }

      const service = item as Partial<ServiceCatalogItem>;
      const name = normalizeServiceName(String(service.name ?? ""));

      if (!name) {
        return [];
      }

      return [
        {
          active: service.active !== false,
          averageDurationMinutes: normalizeNumber(service.averageDurationMinutes),
          averagePrice: normalizeNumber(service.averagePrice),
          category: normalizeServiceCategory(service.category),
          id: String(service.id || createServiceId(name)),
          name,
        },
      ];
    }),
  );
}

function backfillServiceCatalogDefaults(services: ServiceCatalogItem[]) {
  let didChangeCatalog = false;
  const backfilledServices = services.map((service) => {
    const defaultService = defaultServicesByName.get(service.name.toLowerCase());

    if (!defaultService) {
      return service;
    }

    const hasMissingOperationalData =
      service.averageDurationMinutes === null || service.averagePrice === null;
    const nextService = {
      ...service,
      averageDurationMinutes:
        service.averageDurationMinutes ?? defaultService.averageDurationMinutes,
      averagePrice: service.averagePrice ?? defaultService.averagePrice,
      category:
        service.category === "Altro" && hasMissingOperationalData
          ? defaultService.category
          : service.category,
    };

    if (
      nextService.averageDurationMinutes !== service.averageDurationMinutes ||
      nextService.averagePrice !== service.averagePrice ||
      nextService.category !== service.category
    ) {
      didChangeCatalog = true;
    }

    return nextService;
  });

  return { didChangeCatalog, services: backfilledServices };
}

function runCatalogBackfillOnce(services: ServiceCatalogItem[]) {
  if (!canUseStorage()) {
    return services;
  }

  const alreadyBackfilled = window.localStorage.getItem(
    serviceCatalogBackfillStorageKey,
  );

  if (alreadyBackfilled === "true") {
    return services;
  }

  const { didChangeCatalog, services: backfilledServices } =
    backfillServiceCatalogDefaults(services);

  if (didChangeCatalog) {
    saveServiceCatalog(backfilledServices);
  }

  window.localStorage.setItem(serviceCatalogBackfillStorageKey, "true");

  return backfilledServices;
}

function readServiceCatalogFromLocalStorage() {
  if (!canUseStorage()) {
    return defaultServiceCatalog;
  }

  try {
    const storedCatalog = window.localStorage.getItem(serviceCatalogStorageKey);

    if (storedCatalog) {
      const parsedCatalog = JSON.parse(storedCatalog);
      return runCatalogBackfillOnce(normalizeServiceCatalog(parsedCatalog));
    }

    const legacyServices = window.localStorage.getItem(
      legacyCampaignServicesStorageKey,
    );

    if (legacyServices) {
      const migratedCatalog = runCatalogBackfillOnce(
        normalizeServiceCatalog(JSON.parse(legacyServices)),
      );

      if (migratedCatalog.length > 0) {
        saveServiceCatalog(migratedCatalog);
        return migratedCatalog;
      }
    }

    saveServiceCatalog(defaultServiceCatalog);

    return defaultServiceCatalog;
  } catch {
    return defaultServiceCatalog;
  }
}

function scheduleServiceCatalogHydration() {
  if (
    hasHydratedServiceCatalogFromSupabase ||
    isSyncingServiceCatalog ||
    typeof window === "undefined"
  ) {
    return;
  }

  const supabase = createSupabaseBrowserClient();

  if (!supabase) {
    return;
  }

  hasHydratedServiceCatalogFromSupabase = true;
  isSyncingServiceCatalog = true;

  void (async () => {
    try {
      cleanupLegacyLocalStorageKeys();

      const localServices = readServiceCatalogFromLocalStorage();
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .is("deleted_at", null)
        .order("name", { ascending: true });

      if (error) {
        console.warn("Fallback localStorage services:", error.message);
        return;
      }

      const remoteServices = normalizeServiceCatalog(
        (data ?? []).flatMap((row) => {
          const service = normalizeServiceRow(row as ServiceRow);

          return service ? [service] : [];
        }),
      );

      if (remoteServices.length > 0) {
        saveServiceCatalog(remoteServices, { syncRemote: false });
        return;
      }

      if (localServices.length > 0) {
        await upsertServicesToSupabase(localServices);
      }
    } catch (error) {
      console.warn("Fallback localStorage services:", error);
    } finally {
      isSyncingServiceCatalog = false;
    }
  })();
}

async function upsertServicesToSupabase(services: ServiceCatalogItem[]) {
  const supabase = createSupabaseBrowserClient();

  if (!supabase) {
    return;
  }

  const normalizedServices = normalizeServiceCatalog(services);
  const { error } = await supabase
    .from("services")
    .upsert(normalizedServices.map(toServiceRow), {
      onConflict: "local_service_id",
    });

  if (error) {
    console.warn("Fallback localStorage services:", error.message);
  }
}

async function syncSavedCatalogToSupabase(services: ServiceCatalogItem[]) {
  const supabase = createSupabaseBrowserClient();

  if (!supabase) {
    return;
  }

  const normalizedServices = normalizeServiceCatalog(services);
  const activeLocalIds = new Set(normalizedServices.map((service) => service.id));

  await upsertServicesToSupabase(normalizedServices);

  const { data, error } = await supabase
    .from("services")
    .select("local_service_id")
    .is("deleted_at", null);

  if (error) {
    console.warn("Fallback localStorage services:", error.message);
    return;
  }

  const removedServiceIds = (data ?? [])
    .map((row) => String(row.local_service_id ?? ""))
    .filter((serviceId) => serviceId && !activeLocalIds.has(serviceId));

  if (removedServiceIds.length === 0) {
    return;
  }

  const { error: deleteError } = await supabase
    .from("services")
    .update({ deleted_at: new Date().toISOString(), active: false })
    .in("local_service_id", removedServiceIds);

  if (deleteError) {
    console.warn("Fallback localStorage services:", deleteError.message);
  }
}

export function readServiceCatalog() {
  scheduleServiceCatalogHydration();

  return readServiceCatalogFromLocalStorage();
}

export function saveServiceCatalog(
  services: ServiceCatalogItem[],
  options: { syncRemote?: boolean } = {},
) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(
    serviceCatalogStorageKey,
    JSON.stringify(dedupeCatalog(services)),
  );

  if (options.syncRemote !== false) {
    void syncSavedCatalogToSupabase(services);
  }
}

export function getActiveServices(services: ServiceCatalogItem[]) {
  return services.filter((service) => service.active);
}
