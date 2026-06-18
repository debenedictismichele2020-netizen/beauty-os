import type { Metadata } from "next";

import { PageShell } from "../components/BeautyUi";
import AiSettingsPanel from "./AiSettingsPanel";

export const metadata: Metadata = {
  title: "Impostazioni AI | Beauty OS",
  description: "Personalizza tono, stile e comportamento dei messaggi AI.",
};

export default function ImpostazioniAiPage() {
  return (
    <PageShell
      active="Impostazioni AI"
      sidebarEyebrow="Impostazioni AI"
      sidebarText="Personalizza tono, stile e comportamento dei messaggi generati."
    >
      <AiSettingsPanel />
    </PageShell>
  );
}
