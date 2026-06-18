const safeLegacyLocalStorageKeys = [
  "beauty_os_campaign_services",
  "beauty_os_service_catalog_backfill_v1",
  "beauty_os_prefilled_campaign_service",
];

export function cleanupLegacyLocalStorageKeys() {
  if (typeof window === "undefined") {
    return;
  }

  safeLegacyLocalStorageKeys.forEach((key) => {
    window.localStorage.removeItem(key);
  });
}
