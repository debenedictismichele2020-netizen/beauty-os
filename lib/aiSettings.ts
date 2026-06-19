import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { ensureCurrentUserSalon } from "@/lib/auth";

export const aiToneStorageKey = "beauty_os_ai_tone";
export const aiMessageLengthStorageKey = "beauty_os_ai_message_length";
export const aiEmojiStyleStorageKey = "beauty_os_ai_emoji_style";
export const aiPreferencesStorageKey = "beauty_os_ai_preferences";
export const aiCreativityStorageKey = "beauty_os_ai_creativity";
export const businessSignatureStorageKey = "beauty_os_business_signature";

export const aiToneOptions = [
  "Professionale",
  "Caldo e amichevole",
  "Elegante",
  "Diretto",
  "Premium",
] as const;

export const aiMessageLengthOptions = [
  "Breve",
  "Media",
  "Dettagliata",
] as const;

export const aiEmojiStyleOptions = [
  "Nessuna emoji",
  "Emoji leggere",
  "Emoji frequenti",
] as const;

export const aiCreativityOptions = [
  "Conservativa",
  "Bilanciata",
  "Creativa",
] as const;

export const aiCreativityDescriptions: Record<
  (typeof aiCreativityOptions)[number],
  string
> = {
  Bilanciata: "variazione moderata",
  Conservativa: "messaggi più stabili e professionali",
  Creativa: "messaggi più vari e meno ripetitivi",
};

export const aiPreferenceLabels = {
  alwaysSuggestAvailability: "Proporre sempre una disponibilità",
  neverMentionAge: "Non citare mai l’età del cliente",
  personalizeByService: "Personalizzare in base al servizio scelto",
  personalizeByVisitHistory: "Personalizzare in base allo storico visite",
  avoidCommercialTone: "Non usare tono troppo commerciale",
} as const;

export type AiTone = (typeof aiToneOptions)[number];
export type AiMessageLength = (typeof aiMessageLengthOptions)[number];
export type AiEmojiStyle = (typeof aiEmojiStyleOptions)[number];
export type AiCreativity = (typeof aiCreativityOptions)[number];

export type AiPreferences = {
  alwaysSuggestAvailability: boolean;
  avoidCommercialTone: boolean;
  neverMentionAge: boolean;
  personalizeByService: boolean;
  personalizeByVisitHistory: boolean;
};

export type AiGenerationSettings = {
  businessSignature: string;
  creativity: AiCreativity;
  emojiStyle: AiEmojiStyle;
  messageLength: AiMessageLength;
  preferences: AiPreferences;
  tone: AiTone;
};

export const defaultAiPreferences: AiPreferences = {
  alwaysSuggestAvailability: true,
  avoidCommercialTone: true,
  neverMentionAge: true,
  personalizeByService: true,
  personalizeByVisitHistory: true,
};

export const defaultAiSettings: AiGenerationSettings = {
  businessSignature: "Studio Beauty",
  creativity: "Bilanciata",
  emojiStyle: "Emoji leggere",
  messageLength: "Media",
  preferences: defaultAiPreferences,
  tone: "Elegante",
};
let hasHydratedAiSettingsFromSupabase = false;
let isSyncingAiSettings = false;

type SalonAiSettingsRow = {
  business_signature?: string | null;
  creativity?: string | null;
  emoji_style?: string | null;
  id?: string | null;
  message_length?: string | null;
  preferences?: unknown;
  salon_id?: string | null;
  tone?: string | null;
};

function isOption<T extends readonly string[]>(value: unknown, options: T): value is T[number] {
  return typeof value === "string" && options.includes(value);
}

function normalizePreferences(value: unknown): AiPreferences {
  if (!value || typeof value !== "object") {
    return defaultAiPreferences;
  }

  const preferences = value as Partial<Record<keyof AiPreferences, unknown>>;

  return {
    alwaysSuggestAvailability:
      typeof preferences.alwaysSuggestAvailability === "boolean"
        ? preferences.alwaysSuggestAvailability
        : defaultAiPreferences.alwaysSuggestAvailability,
    avoidCommercialTone:
      typeof preferences.avoidCommercialTone === "boolean"
        ? preferences.avoidCommercialTone
        : defaultAiPreferences.avoidCommercialTone,
    neverMentionAge:
      typeof preferences.neverMentionAge === "boolean"
        ? preferences.neverMentionAge
        : defaultAiPreferences.neverMentionAge,
    personalizeByService:
      typeof preferences.personalizeByService === "boolean"
        ? preferences.personalizeByService
        : defaultAiPreferences.personalizeByService,
    personalizeByVisitHistory:
      typeof preferences.personalizeByVisitHistory === "boolean"
        ? preferences.personalizeByVisitHistory
        : defaultAiPreferences.personalizeByVisitHistory,
  };
}

export function normalizeAiSettings(
  value: Partial<{
    emojiStyle: unknown;
    businessSignature: unknown;
    creativity: unknown;
    messageLength: unknown;
    preferences: unknown;
    tone: unknown;
  }> = {},
): AiGenerationSettings {
  return {
    businessSignature:
      typeof value.businessSignature === "string"
        ? value.businessSignature.trim()
        : defaultAiSettings.businessSignature,
    creativity: isOption(value.creativity, aiCreativityOptions)
      ? value.creativity
      : defaultAiSettings.creativity,
    emojiStyle: isOption(value.emojiStyle, aiEmojiStyleOptions)
      ? value.emojiStyle
      : defaultAiSettings.emojiStyle,
    messageLength: isOption(value.messageLength, aiMessageLengthOptions)
      ? value.messageLength
      : defaultAiSettings.messageLength,
    preferences: normalizePreferences(value.preferences),
    tone: isOption(value.tone, aiToneOptions) ? value.tone : defaultAiSettings.tone,
  };
}

export function readAiSettings(): AiGenerationSettings {
  scheduleAiSettingsHydration();

  return readAiSettingsFromLocalStorage();
}

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function hasLocalAiSettings() {
  if (!canUseStorage()) {
    return false;
  }

  return [
    aiToneStorageKey,
    aiMessageLengthStorageKey,
    aiEmojiStyleStorageKey,
    aiPreferencesStorageKey,
    aiCreativityStorageKey,
    businessSignatureStorageKey,
  ].some((key) => window.localStorage.getItem(key) !== null);
}

function readAiSettingsFromLocalStorage(): AiGenerationSettings {
  if (!canUseStorage()) {
    return defaultAiSettings;
  }

  try {
    const tone = window.localStorage.getItem(aiToneStorageKey);
    const messageLength = window.localStorage.getItem(aiMessageLengthStorageKey);
    const emojiStyle = window.localStorage.getItem(aiEmojiStyleStorageKey);
    const creativity = window.localStorage.getItem(aiCreativityStorageKey);
    const businessSignature = window.localStorage.getItem(
      businessSignatureStorageKey,
    );
    const storedPreferences = window.localStorage.getItem(aiPreferencesStorageKey);
    const preferences = storedPreferences ? JSON.parse(storedPreferences) : undefined;

    return normalizeAiSettings({
      businessSignature: businessSignature ?? undefined,
      creativity: creativity ?? undefined,
      emojiStyle: emojiStyle ?? undefined,
      messageLength: messageLength ?? undefined,
      preferences,
      tone: tone ?? undefined,
    });
  } catch {
    return defaultAiSettings;
  }
}

function normalizeAiSettingsRow(row: SalonAiSettingsRow): AiGenerationSettings {
  return normalizeAiSettings({
    businessSignature: row.business_signature ?? undefined,
    creativity: row.creativity ?? undefined,
    emojiStyle: row.emoji_style ?? undefined,
    messageLength: row.message_length ?? undefined,
    preferences: row.preferences ?? undefined,
    tone: row.tone ?? undefined,
  });
}

function toAiSettingsRow(settings: AiGenerationSettings, salonId: string) {
  return {
    business_signature: settings.businessSignature,
    creativity: settings.creativity,
    emoji_style: settings.emojiStyle,
    message_length: settings.messageLength,
    preferences: settings.preferences,
    salon_id: salonId,
    tone: settings.tone,
    updated_at: new Date().toISOString(),
  };
}

function scheduleAiSettingsHydration() {
  if (
    hasHydratedAiSettingsFromSupabase ||
    isSyncingAiSettings ||
    typeof window === "undefined"
  ) {
    return;
  }

  const supabase = createSupabaseBrowserClient();

  if (!supabase) {
    return;
  }

  hasHydratedAiSettingsFromSupabase = true;
  isSyncingAiSettings = true;

  void (async () => {
    try {
      const localSettings = readAiSettingsFromLocalStorage();
      const currentSalon = await ensureCurrentUserSalon();

      if (!currentSalon) {
        return;
      }

      const { data, error } = await supabase
        .from("salon_ai_settings")
        .select("*")
        .eq("salon_id", currentSalon.id)
        .order("created_at", { ascending: true })
        .limit(1);

      if (error) {
        console.warn("Fallback localStorage salon_ai_settings:", error.message);
        return;
      }

      const remoteRow = data?.[0] as SalonAiSettingsRow | undefined;

      if (remoteRow) {
        saveAiSettings(normalizeAiSettingsRow(remoteRow), { syncRemote: false });
        return;
      }

      if (hasLocalAiSettings()) {
        await upsertAiSettingsToSupabase(localSettings);
      } else {
        saveAiSettings(defaultAiSettings);
      }
    } catch (error) {
      console.warn("Fallback localStorage salon_ai_settings:", error);
    } finally {
      isSyncingAiSettings = false;
    }
  })();
}

async function upsertAiSettingsToSupabase(settings: AiGenerationSettings) {
  const supabase = createSupabaseBrowserClient();
  const currentSalon = await ensureCurrentUserSalon();

  if (!supabase || !currentSalon) {
    return;
  }

  const normalizedSettings = normalizeAiSettings(settings);
  const { data, error } = await supabase
    .from("salon_ai_settings")
    .select("id")
    .eq("salon_id", currentSalon.id)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    console.warn("Fallback localStorage salon_ai_settings:", error.message);
    return;
  }

  const existingId = data?.[0]?.id;

  if (existingId) {
    const { error: updateError } = await supabase
      .from("salon_ai_settings")
      .update(toAiSettingsRow(normalizedSettings, currentSalon.id))
      .eq("salon_id", currentSalon.id)
      .eq("id", existingId);

    if (updateError) {
      console.warn("Fallback localStorage salon_ai_settings:", updateError.message);
    }

    return;
  }

  const { error: insertError } = await supabase
    .from("salon_ai_settings")
    .insert(toAiSettingsRow(normalizedSettings, currentSalon.id));

  if (insertError) {
    console.warn("Fallback localStorage salon_ai_settings:", insertError.message);
  }
}

export function saveAiSettings(
  settings: AiGenerationSettings,
  options: { syncRemote?: boolean } = {},
) {
  const normalizedSettings = normalizeAiSettings(settings);

  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(aiToneStorageKey, normalizedSettings.tone);
  window.localStorage.setItem(
    aiMessageLengthStorageKey,
    normalizedSettings.messageLength,
  );
  window.localStorage.setItem(aiEmojiStyleStorageKey, normalizedSettings.emojiStyle);
  window.localStorage.setItem(
    aiCreativityStorageKey,
    normalizedSettings.creativity,
  );
  window.localStorage.setItem(
    businessSignatureStorageKey,
    normalizedSettings.businessSignature,
  );
  window.localStorage.setItem(
    aiPreferencesStorageKey,
    JSON.stringify(normalizedSettings.preferences),
  );

  if (options.syncRemote !== false) {
    void upsertAiSettingsToSupabase(normalizedSettings);
  }
}

export function resetAiSettings() {
  saveAiSettings(defaultAiSettings);

  return defaultAiSettings;
}
