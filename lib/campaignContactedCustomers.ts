import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const contactedCustomersStorageKey = "beauty_os_contacted_campaign_customers";

type CampaignContactedCustomerRow = {
  contact_key: string | null;
};

type ContactedCampaignCustomerInput = {
  campaignName?: string;
  campaignType?: string;
  contactKey: string;
  customerId: string;
  salonId: string;
};

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

export function readContactedCampaignCustomersCache() {
  if (!canUseStorage()) {
    return new Set<string>();
  }

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

function writeContactedCampaignCustomersCache(customerKeys: Set<string>) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(
    contactedCustomersStorageKey,
    JSON.stringify([...customerKeys]),
  );
}

export async function readContactedCampaignCustomersForSalon(salonId: string) {
  const supabase = createSupabaseBrowserClient();

  if (!supabase || !salonId) {
    return readContactedCampaignCustomersCache();
  }

  const { data, error } = await supabase
    .from("campaign_contacted_customers")
    .select("contact_key")
    .eq("salon_id", salonId)
    .returns<CampaignContactedCustomerRow[]>();

  if (error) {
    console.error("CAMPAIGN_CONTACTED_SAVE_ERROR", error);
    return readContactedCampaignCustomersCache();
  }

  const remoteKeys = new Set(
    (data ?? [])
      .map((row) => row.contact_key)
      .filter((contactKey): contactKey is string => typeof contactKey === "string"),
  );

  writeContactedCampaignCustomersCache(remoteKeys);

  return remoteKeys;
}

export async function markCampaignCustomerContacted({
  campaignName,
  campaignType,
  contactKey,
  customerId,
  salonId,
}: ContactedCampaignCustomerInput) {
  const supabase = createSupabaseBrowserClient();
  const cachedKeys = readContactedCampaignCustomersCache();

  if (!supabase || !salonId) {
    cachedKeys.add(contactKey);
    writeContactedCampaignCustomersCache(cachedKeys);
    return false;
  }

  const { error } = await supabase
    .from("campaign_contacted_customers")
    .upsert(
      {
        campaign_key: campaignType ?? campaignName ?? null,
        campaign_name: campaignName ?? null,
        campaign_type: campaignType ?? null,
        channel: "WhatsApp",
        contact_key: contactKey,
        contacted_at: new Date().toISOString(),
        customer_id: customerId,
        salon_id: salonId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "salon_id,contact_key" },
    );

  if (error) {
    console.error("CAMPAIGN_CONTACTED_SAVE_ERROR", error);
    cachedKeys.add(contactKey);
    writeContactedCampaignCustomersCache(cachedKeys);
    return false;
  }

  cachedKeys.add(contactKey);
  writeContactedCampaignCustomersCache(cachedKeys);

  return true;
}

export async function unmarkCampaignCustomerContacted(
  salonId: string,
  contactKey: string,
) {
  const supabase = createSupabaseBrowserClient();
  const cachedKeys = readContactedCampaignCustomersCache();

  if (!supabase || !salonId) {
    cachedKeys.delete(contactKey);
    writeContactedCampaignCustomersCache(cachedKeys);
    return false;
  }

  const { error } = await supabase
    .from("campaign_contacted_customers")
    .delete()
    .eq("salon_id", salonId)
    .eq("contact_key", contactKey);

  if (error) {
    console.error("CAMPAIGN_CONTACTED_SAVE_ERROR", error);
    cachedKeys.delete(contactKey);
    writeContactedCampaignCustomersCache(cachedKeys);
    return false;
  }

  cachedKeys.delete(contactKey);
  writeContactedCampaignCustomersCache(cachedKeys);

  return true;
}
