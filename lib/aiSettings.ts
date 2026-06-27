import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

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

type AiSettingsReadResult = {
  settings: AiGenerationSettings;
  source: "supabase" | "missing";
};

export type AiSettingsSaveResult = {
  error: string | null;
  saved: boolean;
  settings: AiGenerationSettings;
};

type AiSettingsUpsertResult = {
  error: string | null;
  row: SalonAiSettingsRow | null;
  success: boolean;
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

export async function readAiSettings(salonId?: string): Promise<AiGenerationSettings> {
  const remoteResult = await readAiSettingsFromSupabase(salonId);

  if (remoteResult?.source === "supabase") {
    writeAiSettingsCache(remoteResult.settings);

    return remoteResult.settings;
  }

  if (remoteResult?.source === "missing") {
    const fallbackSettings = hasLocalAiSettings()
      ? readAiSettingsFromLocalStorage()
      : defaultAiSettings;

    if (!salonId) {
      return fallbackSettings;
    }

    const saveResult = await saveAiSettings(fallbackSettings, salonId);

    return saveResult.saved ? saveResult.settings : fallbackSettings;
  }

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

function toAiPreferencesJson(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const preferences = value as Partial<Record<keyof AiPreferences, unknown>>;
  const jsonPreferences: Partial<Record<keyof AiPreferences, boolean>> = {};

  (Object.keys(defaultAiPreferences) as Array<keyof AiPreferences>).forEach((key) => {
    if (typeof preferences[key] === "boolean") {
      jsonPreferences[key] = preferences[key];
    }
  });

  return jsonPreferences;
}

function toAiSettingsRow(settings: AiGenerationSettings, salonId: string) {
  return {
    business_signature: settings.businessSignature,
    creativity: settings.creativity,
    emoji_style: settings.emojiStyle,
    message_length: settings.messageLength,
    preferences: toAiPreferencesJson(settings.preferences),
    salon_id: salonId,
    tone: settings.tone,
    updated_at: new Date().toISOString(),
  };
}

async function readAiSettingsFromSupabase(
  salonId?: string,
): Promise<AiSettingsReadResult | null> {
  const supabase = createSupabaseBrowserClient();

  if (!supabase) {
    return null;
  }

  if (!salonId) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("salon_ai_settings")
      .select("*")
      .eq("salon_id", salonId)
      .order("created_at", { ascending: true })
      .limit(1);

    if (error) {
      console.warn("Fallback localStorage salon_ai_settings:", error.message);
      return null;
    }

    const remoteRow = data?.[0] as SalonAiSettingsRow | undefined;

    if (remoteRow) {
      return {
        settings: normalizeAiSettingsRow(remoteRow),
        source: "supabase",
      };
    }

    return {
      settings: defaultAiSettings,
      source: "missing",
    };
  } catch (error) {
    console.warn("Fallback localStorage salon_ai_settings:", error);
    return null;
  }
}

async function upsertAiSettingsToSupabase(
  settings: AiGenerationSettings,
  salonId: string,
): Promise<AiSettingsUpsertResult> {
  const supabase = createSupabaseBrowserClient();

  if (!salonId) {
    console.error("AI_SETTINGS_SAVE_ERROR", {
      reason: "salonId mancante",
      salonId,
    });
    return {
      error: "salonId mancante",
      row: null,
      success: false,
    };
  }

  if (!supabase) {
    console.error("AI_SETTINGS_SAVE_ERROR", {
      error: "Supabase non disponibile",
      reason: "supabase error",
    });
    return {
      error: "Supabase non disponibile",
      row: null,
      success: false,
    };
  }

  const normalizedSettings = normalizeAiSettings(settings);
  const settingsRow = toAiSettingsRow(normalizedSettings, salonId);

  console.log("AI_SETTINGS_SAVE_PAYLOAD", {
    businessSignature: settingsRow.business_signature,
    creativity: settingsRow.creativity,
    emojiStyle: settingsRow.emoji_style,
    messageLength: settingsRow.message_length,
    preferences: settingsRow.preferences,
    salonId,
    tone: settingsRow.tone,
  });

  const { data: updatedRows, error: updateError } = await supabase
    .from("salon_ai_settings")
    .update(settingsRow)
    .eq("salon_id", salonId)
    .select("*")
    .limit(1);

  if (updateError) {
    console.error("AI_SETTINGS_SAVE_ERROR", {
      error: updateError,
      reason: "supabase error",
    });
    return {
      error: updateError.message,
      row: null,
      success: false,
    };
  }

  const updatedRow = updatedRows?.[0] as SalonAiSettingsRow | undefined;

  if (updatedRow) {
    console.log("AI_SETTINGS_SAVE_SUCCESS", updatedRow);

    return {
      error: null,
      row: updatedRow,
      success: true,
    };
  }

  const { data: insertedRow, error: insertError } = await supabase
    .from("salon_ai_settings")
    .insert(settingsRow)
    .select("*")
    .maybeSingle();

  if (insertError) {
    console.error("AI_SETTINGS_SAVE_ERROR", {
      error: insertError,
      reason: "supabase error",
    });
    return {
      error: insertError.message,
      row: null,
      success: false,
    };
  }

  console.log("AI_SETTINGS_SAVE_SUCCESS", insertedRow);

  return {
    error: null,
    row: (insertedRow as SalonAiSettingsRow | null) ?? null,
    success: true,
  };
}

function writeAiSettingsCache(settings: AiGenerationSettings) {
  if (!canUseStorage()) {
    return;
  }

  const normalizedSettings = normalizeAiSettings(settings);

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
}

export async function saveAiSettings(
  settings: AiGenerationSettings,
  salonId: string,
  options: { syncRemote?: boolean } = {},
): Promise<AiSettingsSaveResult> {
  const normalizedSettings = normalizeAiSettings(settings);

  if (options.syncRemote === false) {
    writeAiSettingsCache(normalizedSettings);

    return {
      error: null,
      saved: true,
      settings: normalizedSettings,
    };
  }

  const saveResult = await upsertAiSettingsToSupabase(normalizedSettings, salonId);

  if (!saveResult.success) {
    const error = saveResult.error ?? "Errore salvataggio impostazioni AI.";

    console.error("AI_SETTINGS_SAVE_ERROR", {
      error,
      reason: salonId ? "supabase error" : "salonId mancante",
      salonId,
    });

    return {
      error,
      saved: false,
      settings: normalizedSettings,
    };
  }

  const remoteResult = await readAiSettingsFromSupabase(salonId);
  const confirmedSettings =
    remoteResult?.source === "supabase"
      ? remoteResult.settings
      : saveResult.row
        ? normalizeAiSettingsRow(saveResult.row)
        : normalizedSettings;

  if (remoteResult?.source !== "supabase") {
    console.warn(
      "Impostazioni AI salvate, ma rilettura Supabase non confermata. Uso valori appena salvati.",
    );
  }

  writeAiSettingsCache(confirmedSettings);

  return {
    error: null,
    saved: true,
    settings: confirmedSettings,
  };
}

export async function resetAiSettings(salonId: string) {
  return saveAiSettings(defaultAiSettings, salonId);
}
