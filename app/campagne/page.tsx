import type { Metadata } from "next";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentSalon } from "@/lib/currentSalon";
import { PageHeader, PageShell } from "../components/BeautyUi";
import {
  ageCampaignSegments,
  calculateAge,
  type AgeCampaignSegmentStatus,
  getAgeSegmentStatus,
} from "./ageSegments";
import {
  birthdayCampaignSegments,
  getBirthdayCampaignOccurrence,
  matchesBirthdaySegment,
  type BirthdayCampaignSegmentStatus,
} from "./birthdaySegments";
import CampaignModal from "./CampaignModal";
import CustomCampaignDrawer from "./CustomCampaignDrawer";
import type { AiCampaignSegmentStatus } from "./actions";

export const metadata: Metadata = {
  title: "Campagne AI | Beauty OS",
  description: "Generazione campagne WhatsApp AI per Beauty OS.",
};

export const dynamic = "force-dynamic";

const campaignSegments: Array<{
  description: string;
  label: string;
  objective: string;
  status: AiCampaignSegmentStatus;
}> = [
  {
    label: "Clienti persi",
    status: "Perso",
    objective: "Riattivare clienti inattivi con un messaggio caldo e non aggressivo.",
    description:
      "Clienti inattivi da recuperare con un invito delicato e professionale.",
  },
  {
    label: "Clienti a rischio",
    status: "A rischio",
    objective: "Intervenire prima che il ritardo diventi abbandono reale.",
    description:
      "Clienti da ricontattare prima che il ritardo diventi abbandono reale.",
  },
  {
    label: "Clienti VIP",
    status: "VIP",
    objective: "Aumentare ritorni e prenotazioni dei clienti ad alto valore.",
    description:
      "Clienti ad alto valore da coinvolgere con una comunicazione curata e prioritaria.",
  },
];

type SegmentSummary = {
  averageAge: number | null;
  customerCount: number;
  potentialValue: number;
};

type CampaignCustomerSummaryRow = {
  ai_status: string | null;
  birth_date: string | null;
  total_spent: number | null;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

async function getCampaignSegmentSummaries() {
  const supabase = createSupabaseServerClient();
  const currentSalon = await getCurrentSalon();
  const emptySummaries = Object.fromEntries(
    campaignSegments.map((segment) => [
      segment.status,
      { averageAge: null, customerCount: 0, potentialValue: 0 },
    ]),
  ) as Record<AiCampaignSegmentStatus, SegmentSummary>;
  const emptyAgeSummaries = Object.fromEntries(
    ageCampaignSegments.map((segment) => [
      segment.status,
      { averageAge: null, customerCount: 0, potentialValue: 0 },
    ]),
  ) as Record<AgeCampaignSegmentStatus, SegmentSummary>;
  const emptyBirthdaySummaries = Object.fromEntries(
    birthdayCampaignSegments.map((segment) => [
      segment.status,
      { averageAge: null, customerCount: 0, potentialValue: 0 },
    ]),
  ) as Record<BirthdayCampaignSegmentStatus, SegmentSummary>;

  if (!supabase || !currentSalon) {
    return {
      ageSummaries: emptyAgeSummaries,
      birthdaySummaries: emptyBirthdaySummaries,
      missingBirthDateCount: 0,
      segmentSummaries: emptySummaries,
    };
  }

  const { data, error } = await supabase
    .from("customers")
    .select("birth_date,ai_status,total_spent")
    .eq("salon_id", currentSalon.id);

  if (error) {
    console.error("Errore Supabase getCampaignSegmentSummaries:", error);
    return {
      ageSummaries: emptyAgeSummaries,
      birthdaySummaries: emptyBirthdaySummaries,
      missingBirthDateCount: 0,
      segmentSummaries: emptySummaries,
    };
  }

  const rows = (data ?? []) as CampaignCustomerSummaryRow[];
  const ageTotals = Object.fromEntries(
    ageCampaignSegments.map((segment) => [segment.status, 0]),
  ) as Record<AgeCampaignSegmentStatus, number>;
  const birthdayAgeTotals = Object.fromEntries(
    birthdayCampaignSegments.map((segment) => [segment.status, 0]),
  ) as Record<BirthdayCampaignSegmentStatus, number>;
  const segmentSummaries = rows.reduce((summaries, customer) => {
    const status = customer.ai_status?.trim() as AiCampaignSegmentStatus;

    if (!summaries[status]) {
      return summaries;
    }

    summaries[status].customerCount += 1;
    summaries[status].potentialValue += Number(customer.total_spent ?? 0);

    return summaries;
  }, emptySummaries);
  const ageSummaries = rows.reduce((summaries, customer) => {
    const age = calculateAge(customer.birth_date);
    const ageSegmentStatus = getAgeSegmentStatus(age);

    if (!ageSegmentStatus || age === null) {
      return summaries;
    }

    summaries[ageSegmentStatus].customerCount += 1;
    summaries[ageSegmentStatus].potentialValue += Number(customer.total_spent ?? 0);
    ageTotals[ageSegmentStatus] += age;

    return summaries;
  }, emptyAgeSummaries);
  const birthdaySummaries = rows.reduce((summaries, customer) => {
    birthdayCampaignSegments.forEach((segment) => {
      if (!matchesBirthdaySegment(customer.birth_date, segment.status)) {
        return;
      }

      const birthdayOccurrence = getBirthdayCampaignOccurrence(
        customer.birth_date,
        segment.status,
      );

      summaries[segment.status].customerCount += 1;
      summaries[segment.status].potentialValue += Number(customer.total_spent ?? 0);

      if (birthdayOccurrence) {
        birthdayAgeTotals[segment.status] += birthdayOccurrence.ageTurning;
      }
    });

    return summaries;
  }, emptyBirthdaySummaries);

  ageCampaignSegments.forEach((segment) => {
    const summary = ageSummaries[segment.status];

    summary.averageAge =
      summary.customerCount > 0
        ? Math.round(ageTotals[segment.status] / summary.customerCount)
        : null;
  });
  birthdayCampaignSegments.forEach((segment) => {
    const summary = birthdaySummaries[segment.status];

    summary.averageAge =
      summary.customerCount > 0
        ? Math.round(birthdayAgeTotals[segment.status] / summary.customerCount)
        : null;
  });

  return {
    ageSummaries,
    birthdaySummaries,
    missingBirthDateCount: rows.filter((customer) => calculateAge(customer.birth_date) === null).length,
    segmentSummaries,
  };
}

export default async function CampagnePage() {
  const { ageSummaries, birthdaySummaries, missingBirthDateCount, segmentSummaries } =
    await getCampaignSegmentSummaries();
  const estimatedRecovery = campaignSegments.reduce(
    (total, segment) =>
      segmentSummaries[segment.status].customerCount > 0
        ? total + segmentSummaries[segment.status].potentialValue
        : total,
    0,
  );
  const visibleAgeSegments = ageCampaignSegments.filter(
    (segment) => ageSummaries[segment.status].customerCount > 0,
  );
  const visibleBirthdaySegments = birthdayCampaignSegments.filter(
    (segment) => birthdaySummaries[segment.status].customerCount > 0,
  );

  return (
    <PageShell
      active="Campagne"
      sidebarEyebrow="Campagne AI"
      sidebarText="Genera anteprime WhatsApp per i segmenti più importanti senza inviare messaggi reali."
    >
      <PageHeader
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm shadow-sm">
              <span className="mr-2 text-zinc-500">Recupero stimato</span>
              <span className="font-semibold text-black">
                {estimatedRecovery > 0 ? formatCurrency(estimatedRecovery) : "-- €"}
              </span>
            </div>
            <CustomCampaignDrawer />
          </div>
        }
        eyebrow="Centro marketing"
        subtitle="Genera messaggi WhatsApp personalizzati per riattivare clienti e aumentare le prenotazioni."
        title="Campagne AI"
      />

          <section className="grid gap-4 py-6 xl:grid-cols-3">
            {campaignSegments.map((segment) => {
              const summary = segmentSummaries[segment.status];

              return (
                <article
                  className="rounded-[1.5rem] border border-black/10 bg-white p-5 shadow-[0_22px_70px_rgba(0,0,0,0.07)]"
                  key={segment.status}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-400">
                        Campagna
                      </p>
                      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-black">
                        {segment.label}
                      </h2>
                    </div>
                    <span className="rounded-full border border-black/10 bg-[#f7f7f5] px-3 py-1.5 text-xs font-semibold text-zinc-700">
                      {segment.status}
                    </span>
                  </div>

                  <p className="mt-4 min-h-12 text-sm leading-6 text-zinc-500">
                    {segment.objective}
                  </p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                    <div className="rounded-[1rem] border border-black/10 bg-[#f7f7f5] p-4">
                      <p className="text-xs font-medium text-zinc-500">
                        Clienti
                      </p>
                      <p className="mt-2 text-3xl font-semibold tracking-tight text-black">
                        {summary.customerCount}
                      </p>
                    </div>
                    <div className="rounded-[1rem] border border-black/10 bg-[#f7f7f5] p-4">
                      <p className="text-xs font-medium text-zinc-500">
                        Valore potenziale
                      </p>
                      <p className="mt-2 text-3xl font-semibold tracking-tight text-black">
                        {formatCurrency(summary.potentialValue)}
                      </p>
                    </div>
                  </div>

                  <CampaignModal
                    averageAge={summary.averageAge}
                    customerCount={summary.customerCount}
                    objective={segment.objective}
                    potentialValue={summary.potentialValue}
                    segmentLabel={segment.label}
                    segmentStatus={segment.status}
                  />
                </article>
              );
            })}
          </section>

          {visibleAgeSegments.length > 0 ? (
            <section className="pb-8">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-400">
                    Segmentazione
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-black">
                    Campagne per età
                  </h2>
                </div>
                {missingBirthDateCount > 0 ? (
                  <p className="text-sm text-zinc-500">
                    {missingBirthDateCount} clienti senza data di nascita non inclusi nelle campagne età.
                  </p>
                ) : null}
              </div>

              <div className="grid gap-4 xl:grid-cols-4">
                {visibleAgeSegments.map((segment) => {
                  const summary = ageSummaries[segment.status];

                  return (
                    <article
                      className="flex h-full flex-col rounded-[1.5rem] border border-black/10 bg-white p-5 shadow-[0_22px_70px_rgba(0,0,0,0.07)]"
                      key={segment.status}
                    >
                      <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-400">
                        Fascia età
                      </p>
                      <h3 className="mt-3 text-xl font-semibold tracking-tight text-black">
                        {segment.title}
                      </h3>

                      <div className="flex flex-1 flex-col">
                        <p className="mt-4 min-h-[96px] text-sm leading-6 text-zinc-500">
                          {segment.objective}
                        </p>

                        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                          <div className="rounded-[1rem] border border-black/10 bg-[#f7f7f5] p-4">
                            <p className="text-xs font-medium text-zinc-500">
                              Clienti
                            </p>
                            <p className="mt-2 text-3xl font-semibold tracking-tight text-black">
                              {summary.customerCount}
                            </p>
                          </div>
                          <div className="rounded-[1rem] border border-black/10 bg-[#f7f7f5] p-4">
                            <p className="text-xs font-medium text-zinc-500">
                              Valore storico
                            </p>
                            <p className="mt-2 text-3xl font-semibold tracking-tight text-black">
                              {formatCurrency(summary.potentialValue)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-auto">
                          <CampaignModal
                            averageAge={summary.averageAge}
                            customerCount={summary.customerCount}
                            objective={segment.objective}
                            potentialValue={summary.potentialValue}
                            segmentLabel={segment.title}
                            segmentStatus={segment.status}
                          />
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

          {visibleBirthdaySegments.length > 0 ? (
            <section className="pb-8">
              <div className="mb-4">
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-400">
                  Automazioni
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-black">
                  Campagne compleanno
                </h2>
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                {visibleBirthdaySegments.map((segment) => {
                  const summary = birthdaySummaries[segment.status];

                  return (
                    <article
                      className="flex h-full flex-col rounded-[1.5rem] border border-black/10 bg-white p-5 shadow-[0_22px_70px_rgba(0,0,0,0.07)]"
                      key={segment.status}
                    >
                      <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-400">
                        Compleanni
                      </p>
                      <h3 className="mt-3 text-xl font-semibold tracking-tight text-black">
                        {segment.title}
                      </h3>
                      <p className="mt-4 min-h-[72px] text-sm leading-6 text-zinc-500">
                        {segment.objective}
                      </p>

                      <div className="mt-6 grid gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
                        <div className="rounded-[1rem] border border-black/10 bg-[#f7f7f5] p-4">
                          <p className="text-xs font-medium text-zinc-500">
                            Clienti
                          </p>
                          <p className="mt-2 text-3xl font-semibold tracking-tight text-black">
                            {summary.customerCount}
                          </p>
                        </div>
                        <div className="rounded-[1rem] border border-black/10 bg-[#f7f7f5] p-4">
                          <p className="text-xs font-medium text-zinc-500">
                            Valore storico
                          </p>
                          <p className="mt-2 text-2xl font-semibold tracking-tight text-black">
                            {formatCurrency(summary.potentialValue)}
                          </p>
                        </div>
                        <div className="rounded-[1rem] border border-black/10 bg-[#f7f7f5] p-4">
                          <p className="text-xs font-medium text-zinc-500">
                            Età media
                          </p>
                          <p className="mt-2 text-2xl font-semibold tracking-tight text-black">
                            {summary.averageAge === null
                              ? "N/D"
                              : `${summary.averageAge} anni`}
                          </p>
                        </div>
                      </div>

                      <div className="mt-auto">
                        <CampaignModal
                          averageAge={summary.averageAge}
                          customerCount={summary.customerCount}
                          objective={segment.objective}
                          potentialValue={summary.potentialValue}
                          segmentLabel={segment.title}
                          segmentStatus={segment.status}
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}
    </PageShell>
  );
}
