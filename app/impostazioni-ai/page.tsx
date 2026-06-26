import type { Metadata } from "next";

import { getCurrentSalon } from "@/lib/currentSalon";

import { PageShell } from "../components/BeautyUi";
import AiSettingsPanel from "./AiSettingsPanel";

export const metadata: Metadata = {
  title: "Impostazioni AI | Beauty OS",
  description: "Personalizza tono, stile e comportamento dei messaggi AI.",
};

export default async function ImpostazioniAiPage() {
  const currentSalon = await getCurrentSalon();

  console.log("AI_SETTINGS_PAGE_CURRENT_SALON", currentSalon);

  return (
    <PageShell
      active="Impostazioni AI"
      sidebarEyebrow="Impostazioni AI"
      sidebarText="Personalizza tono, stile e comportamento dei messaggi generati."
    >
      {currentSalon ? (
        <AiSettingsPanel salonId={currentSalon.id} />
      ) : (
        <section className="rounded-[1.25rem] border border-black/10 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-black">Salone non trovato</p>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Non è stato possibile recuperare il salone corrente. Effettua di nuovo
            l’accesso e riprova.
          </p>
        </section>
      )}
    </PageShell>
  );
}
