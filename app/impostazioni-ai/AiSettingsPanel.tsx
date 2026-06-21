"use client";

import { useEffect, useMemo, useState } from "react";

import {
  aiCreativityDescriptions,
  aiCreativityOptions,
  aiEmojiStyleOptions,
  aiMessageLengthOptions,
  aiPreferenceLabels,
  aiToneOptions,
  defaultAiSettings,
  readAiSettings,
  resetAiSettings,
  saveAiSettings,
  type AiGenerationSettings,
  type AiPreferences,
} from "@/lib/aiSettings";

function OptionGroup<Option extends string>({
  descriptions,
  label,
  options,
  value,
  onChange,
}: {
  descriptions?: Partial<Record<Option, string>>;
  label: string;
  options: readonly Option[];
  value: Option;
  onChange: (value: Option) => void;
}) {
  return (
    <section className="rounded-[1.25rem] border border-black/10 bg-white p-5 shadow-[0_18px_55px_rgba(0,0,0,0.055)]">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
        {label}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = option === value;

          return (
            <button
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 ${
                isSelected
                  ? "border-black bg-black text-white shadow-[0_14px_35px_rgba(0,0,0,0.16)]"
                  : "border-black/10 bg-[#f7f7f5] text-zinc-700 hover:border-black/20 hover:bg-white"
              }`}
              key={option}
              onClick={() => onChange(option)}
              type="button"
            >
              <span>{option}</span>
              {descriptions?.[option] ? (
                <span
                  className={`mt-1 block text-xs font-medium ${
                    isSelected ? "text-white/70" : "text-zinc-500"
                  }`}
                >
                  {descriptions[option]}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SwitchRow({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      className="flex w-full items-center justify-between gap-4 rounded-[1rem] border border-black/10 bg-[#f7f7f5] p-3 text-left transition hover:bg-white"
      onClick={() => onChange(!checked)}
      type="button"
    >
      <span className="text-sm font-medium text-zinc-800">{label}</span>
      <span
        className={`flex h-6 w-11 items-center rounded-full p-1 transition ${
          checked ? "bg-black" : "bg-zinc-300"
        }`}
      >
        <span
          className={`size-4 rounded-full bg-white transition ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}

function buildPreviewMessage(settings: AiGenerationSettings) {
  const introByTone: Record<AiGenerationSettings["tone"], string> = {
    "Caldo e amichevole": "ti scrivo per proporti",
    Diretto: "ti propongo",
    Elegante: "abbiamo pensato di riservarti",
    Premium: "abbiamo selezionato per te",
    Professionale: "ti contatto per proporti",
  };
  const signature = settings.businessSignature.trim();
  const greeting = signature
    ? `Ciao Maria, qui è ${signature}.`
    : "Ciao Maria,";
  const servicePhrase = settings.preferences.personalizeByService
    ? "una pulizia viso pensata per rinfrescare la tua routine beauty"
    : "un trattamento beauty pensato per la tua routine";
  const availability = settings.preferences.alwaysSuggestAvailability
    ? " Ti va se ti mando qualche disponibilità?"
    : "";
  const commercialSoftener = settings.preferences.avoidCommercialTone
    ? " con un approccio semplice e curato"
    : "";
  const historyHint = settings.preferences.personalizeByVisitHistory
    ? " in linea con le tue ultime visite"
    : "";
  const emoji =
    settings.emojiStyle === "Nessuna emoji"
      ? ""
      : settings.emojiStyle === "Emoji frequenti"
        ? " ✨"
        : " ✨";
  const creativityHint =
    settings.creativity === "Conservativa"
      ? ""
      : settings.creativity === "Creativa"
        ? " Ho pensato a qualcosa di leggero ma speciale per darti una piccola pausa beauty."
        : " Potrebbe essere un bel modo per prenderti cura di te nei prossimi giorni.";
  const greetingWithEmoji =
    emoji && !signature ? `Ciao Maria${emoji},` : `${greeting}${emoji}`;
  const baseMessage = `${greetingWithEmoji} ${introByTone[settings.tone]} ${servicePhrase}${historyHint}${commercialSoftener}.${creativityHint}${availability}`;

  if (settings.messageLength === "Breve") {
    return `${greetingWithEmoji} ti proponiamo una pulizia viso per rinfrescare la tua routine beauty.${availability}`;
  }

  if (settings.messageLength === "Dettagliata") {
    return `${baseMessage} Possiamo scegliere insieme l’orario più comodo nei prossimi giorni.`;
  }

  return baseMessage;
}

export default function AiSettingsPanel() {
  const [settings, setSettings] = useState<AiGenerationSettings>(defaultAiSettings);
  const [hasLoadedSettings, setHasLoadedSettings] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        setSettings(await readAiSettings());
        setHasLoadedSettings(true);
      })();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!hasLoadedSettings) {
      return;
    }

    void saveAiSettings(settings);
  }, [hasLoadedSettings, settings]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeoutId = window.setTimeout(() => setToast(""), 2200);

    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  const previewMessage = useMemo(() => buildPreviewMessage(settings), [settings]);

  function updateSettings(nextSettings: AiGenerationSettings) {
    setSettings(nextSettings);
    setToast("Impostazioni AI salvate");
  }

  function updatePreference<Key extends keyof AiPreferences>(
    key: Key,
    value: AiPreferences[Key],
  ) {
    updateSettings({
      ...settings,
      preferences: {
        ...settings.preferences,
        [key]: value,
      },
    });
  }

  async function restoreDefaultSettings() {
    const nextSettings = await resetAiSettings();

    setSettings(nextSettings);
    setHasLoadedSettings(true);
    setToast("Impostazioni AI ripristinate");
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-5 border-b border-black/10 pb-6 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-zinc-500">
            Beauty OS
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-black sm:text-5xl">
            Impostazioni AI
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
            Personalizza tono, stile e comportamento dei messaggi generati.
          </p>
        </div>
        <button
          className="w-fit rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-zinc-50"
          onClick={() => {
            void restoreDefaultSettings();
          }}
          type="button"
        >
          Ripristina impostazioni AI
        </button>
      </header>

      {toast ? (
        <p className="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
          {toast}
        </p>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
        <div className="space-y-5">
          <OptionGroup
            label="Tono comunicazione"
            onChange={(tone) => updateSettings({ ...settings, tone })}
            options={aiToneOptions}
            value={settings.tone}
          />

          <OptionGroup
            label="Lunghezza messaggi"
            onChange={(messageLength) =>
              updateSettings({ ...settings, messageLength })
            }
            options={aiMessageLengthOptions}
            value={settings.messageLength}
          />

          <OptionGroup
            descriptions={aiCreativityDescriptions}
            label="Creatività AI"
            onChange={(creativity) => updateSettings({ ...settings, creativity })}
            options={aiCreativityOptions}
            value={settings.creativity}
          />

          <section className="rounded-[1.25rem] border border-black/10 bg-white p-5 shadow-[0_18px_55px_rgba(0,0,0,0.055)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
              Firma attività
            </p>
            <input
              className="mt-4 w-full rounded-full border border-black/10 bg-[#f7f7f5] px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-black/30"
              onChange={(event) =>
                updateSettings({
                  ...settings,
                  businessSignature: event.target.value,
                })
              }
              placeholder="Es. Studio Beauty"
              type="text"
              value={settings.businessSignature}
            />
            <p className="mt-2 text-xs leading-5 text-zinc-500">
              Se compilata, Beauty OS la userà una sola volta in modo naturale nei
              messaggi.
            </p>
          </section>

          <OptionGroup
            label="Stile emoji"
            onChange={(emojiStyle) => updateSettings({ ...settings, emojiStyle })}
            options={aiEmojiStyleOptions}
            value={settings.emojiStyle}
          />

          <section className="rounded-[1.25rem] border border-black/10 bg-white p-5 shadow-[0_18px_55px_rgba(0,0,0,0.055)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
              Preferenze messaggi
            </p>
            <div className="mt-4 grid gap-2">
              {(Object.keys(aiPreferenceLabels) as Array<keyof AiPreferences>).map(
                (key) => (
                  <SwitchRow
                    checked={settings.preferences[key]}
                    key={key}
                    label={aiPreferenceLabels[key]}
                    onChange={(checked) => updatePreference(key, checked)}
                  />
                ),
              )}
            </div>
          </section>
        </div>

        <aside className="h-fit rounded-[1.5rem] border border-black/10 bg-black p-5 text-white shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Anteprima messaggio
          </p>
          <div className="mt-5 overflow-hidden rounded-[1.25rem] border border-white/10 bg-[#f0eee6] text-black shadow-inner">
            <div className="flex items-center gap-3 border-b border-black/10 bg-white/80 px-4 py-3">
              <div className="grid size-10 place-items-center rounded-full bg-black text-sm font-semibold text-white">
                MA
              </div>
              <div>
                <p className="text-sm font-semibold tracking-tight">Maria</p>
                <p className="text-xs text-zinc-500">Cliente demo · Pulizia viso</p>
              </div>
            </div>
            <div className="p-4">
              <div className="ml-auto max-w-[88%] rounded-[1rem] rounded-tr-sm bg-[#dcf8c6] px-4 py-3 shadow-sm">
                <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-900">
                  {previewMessage}
                </p>
                <p className="mt-1 text-right text-[11px] font-medium text-zinc-500">
                  10:24
                </p>
              </div>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
