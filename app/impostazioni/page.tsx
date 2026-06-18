import type { Metadata } from "next";

import { PageHeader, PageShell, SectionCard } from "../components/BeautyUi";

export const metadata: Metadata = {
  title: "Impostazioni | Beauty OS",
  description: "Impostazioni generali Beauty OS.",
};

export default function ImpostazioniPage() {
  return (
    <PageShell
      active="Impostazioni"
      sidebarEyebrow="Impostazioni"
      sidebarText="Configura account, preferenze AI, notifiche e integrazioni."
    >
      <PageHeader
        eyebrow="Beauty OS"
        subtitle="Configura account, preferenze AI, notifiche e integrazioni."
        title="Impostazioni"
      />

      <div className="grid gap-4 py-6 md:grid-cols-2">
        {[
          "Configurazione account",
          "Preferenze AI",
          "Notifiche",
          "Integrazioni",
        ].map((item) => (
          <SectionCard className="shadow-sm" key={item}>
            <div className="p-5">
              <h2 className="text-lg font-semibold tracking-tight text-black">
                {item}
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Sezione pronta per la configurazione del salone.
              </p>
            </div>
          </SectionCard>
        ))}
      </div>
    </PageShell>
  );
}
