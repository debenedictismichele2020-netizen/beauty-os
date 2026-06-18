import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildFinalWhatsAppMessage, buildWhatsAppUrl } from "@/lib/whatsapp";
import {
  buildOverviewActions,
  type OverviewVisit,
} from "@/lib/overviewActions";
import { PageShell } from "./components/BeautyUi";
import OverviewAgendaActionsList from "./OverviewAgendaActionsList";
import OverviewTodayPerformance from "./OverviewTodayPerformance";
import {
  type Customer,
  formatCompactCurrency,
  getCustomers,
  statusLabels,
} from "./clients/data";

export const dynamic = "force-dynamic";

type AppointmentRevenueRow = {
  amount?: number | string | null;
  service_price?: number | string | null;
};

type PrioritizedCustomer = Customer & {
  estimatedRecovery: number;
  priorityLevel: "high" | "medium" | "low";
};

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getMoneyValue(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);

  return Number.isFinite(amount) ? amount : 0;
}

function getEstimatedRecovery(totalSpent: number, recoveryProbability: number) {
  return Math.round((totalSpent * recoveryProbability) / 100);
}

function getDaysSinceLastVisit(lastVisitDate: string) {
  if (!lastVisitDate) {
    return null;
  }

  const lastVisit = new Date(`${lastVisitDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Math.max(
    0,
    Math.round((today.getTime() - lastVisit.getTime()) / 86_400_000),
  );
}

function cleanWhatsAppPhone(phone: string) {
  const cleanedPhone = phone.replace(/\D/g, "");

  if (!cleanedPhone) {
    return "";
  }

  return cleanedPhone.startsWith("39") ? cleanedPhone : `39${cleanedPhone}`;
}

function getWhatsAppHref(customer: Customer) {
  const cleanedPhone = cleanWhatsAppPhone(customer.phone);

  if (!cleanedPhone) {
    return "";
  }

  const message = `Ciao ${customer.firstName}, ti scrivo per aiutarti a riprenotare il prossimo appuntamento quando ti è comodo.`;
  const finalMessage = buildFinalWhatsAppMessage(message, "recupero");

  return buildWhatsAppUrl({
    phone: cleanedPhone,
    message: finalMessage,
    target: "web",
  });
}

function getPriorityLevel(
  totalSpent: number,
  recoveryProbability: number,
  averageRecoverableValue: number,
): PrioritizedCustomer["priorityLevel"] {
  if (totalSpent > averageRecoverableValue || recoveryProbability >= 60) {
    return "high";
  }

  if (recoveryProbability >= 30) {
    return "medium";
  }

  return "low";
}

function getPriorityReason(
  customer: PrioritizedCustomer,
  averageRecoverableValue: number,
) {
  if (
    customer.status === "Lost" &&
    customer.totalSpentValue >= averageRecoverableValue
  ) {
    return "Ex cliente ad alto valore da riattivare oggi.";
  }

  if (
    customer.totalSpentValue >= averageRecoverableValue &&
    customer.recoveryProbability >= 60
  ) {
    return "Cliente ad alto valore da contattare oggi.";
  }

  if (customer.recoveryProbability >= 60) {
    return "Alta probabilità di ritorno con un contatto rapido.";
  }

  if (customer.status === "At Risk") {
    return "Cliente a rischio da recuperare prima che diventi inattivo.";
  }

  return "Cliente recuperabile da inserire nelle azioni di oggi.";
}

async function getCurrentMonthRevenue() {
  const supabase = createSupabaseServerClient();

  if (!supabase) {
    return 0;
  }

  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const getPeriodAppointments = (fields: string) =>
    supabase
      .from("appointments")
      .select(fields)
      .gte("appointment_date", toDateKey(start))
      .lte("appointment_date", toDateKey(end));

  const { data, error } = await getPeriodAppointments("service_price,amount");

  if (!error) {
    return (data as AppointmentRevenueRow[]).reduce(
      (total, appointment) =>
        total +
        getMoneyValue(appointment.service_price ?? appointment.amount),
      0,
    );
  }

  const missingKnownColumn =
    error.message.includes("amount") ||
    error.message.includes("service_price") ||
    error.details?.includes("amount") ||
    error.details?.includes("service_price");

  if (!missingKnownColumn) {
    console.error("Errore Supabase fatturato mese panoramica:", error);

    return 0;
  }

  const servicePriceFallback = await getPeriodAppointments("service_price");

  if (!servicePriceFallback.error) {
    return (servicePriceFallback.data as AppointmentRevenueRow[]).reduce(
      (total, appointment) => total + getMoneyValue(appointment.service_price),
      0,
    );
  }

  const amountFallback = await getPeriodAppointments("amount");

  if (amountFallback.error) {
    console.error(
      "Errore Supabase fatturato mese fallback:",
      amountFallback.error,
    );

    return 0;
  }

  return (amountFallback.data as AppointmentRevenueRow[]).reduce(
    (total, appointment) => total + getMoneyValue(appointment.amount),
    0,
  );
}

async function getOverviewAppointmentUsage(): Promise<OverviewVisit[]> {
  const supabase = createSupabaseServerClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("appointments")
    .select("service_name,service_price,appointment_date");

  if (!error) {
    return (data ?? []).flatMap((appointment) => {
      if (!appointment.service_name) {
        return [];
      }

      return [
        {
          amount: getMoneyValue(appointment.service_price),
          appointmentDate: appointment.appointment_date,
          serviceName: appointment.service_name,
        },
      ];
    });
  }

  const fallback = await supabase
    .from("appointments")
    .select("service_name,amount,appointment_date");

  if (fallback.error) {
    console.error("Errore Supabase visite panoramica:", fallback.error);

    return [];
  }

  return (fallback.data ?? []).flatMap((appointment) => {
    if (!appointment.service_name) {
      return [];
    }

    return [
      {
        amount: getMoneyValue(appointment.amount),
        appointmentDate: appointment.appointment_date,
        serviceName: appointment.service_name,
      },
    ];
  });
}

export default async function Home() {
  const [customers, monthRevenue, overviewVisits] = await Promise.all([
    getCustomers(),
    getCurrentMonthRevenue(),
    getOverviewAppointmentUsage(),
  ]);
  const totalCustomers = customers.length;
  const activeCustomers = customers.filter(
    (customer) => customer.status === "VIP" || customer.status === "Loyal",
  ).length;
  const atRiskCustomers = customers.filter(
    (customer) => customer.status === "At Risk",
  ).length;
  const lostCustomers = customers.filter(
    (customer) => customer.status === "Lost",
  ).length;
  const recoverableCustomers = customers.filter(
    (customer) => customer.status === "At Risk" || customer.status === "Lost",
  );
  const recoverableValue = recoverableCustomers.reduce(
    (total, customer) => total + customer.totalSpentValue,
    0,
  );
  const averageRecoverableValue =
    recoverableCustomers.length > 0
      ? recoverableValue / recoverableCustomers.length
      : 0;
  const prioritizedRecoverableCustomers = recoverableCustomers
    .map((customer) => ({
      ...customer,
      estimatedRecovery: getEstimatedRecovery(
        customer.totalSpentValue,
        customer.recoveryProbability,
      ),
      priorityLevel: getPriorityLevel(
        customer.totalSpentValue,
        customer.recoveryProbability,
        averageRecoverableValue,
      ),
    }))
    .sort((first, second) => second.estimatedRecovery - first.estimatedRecovery);
  const estimatedRecoverableRevenue = prioritizedRecoverableCustomers.reduce(
    (total, customer) => total + customer.estimatedRecovery,
    0,
  );
  const mainPriority = prioritizedRecoverableCustomers[0];
  const mainPriorityDaysSinceLastVisit = mainPriority
    ? getDaysSinceLastVisit(mainPriority.lastVisitDate)
    : null;
  const mainPriorityWhatsAppHref = mainPriority
    ? getWhatsAppHref(mainPriority)
    : "";
  const mainPriorityReason = mainPriority
    ? getPriorityReason(mainPriority, averageRecoverableValue)
    : "";
  const agendaActions = buildOverviewActions({
    customers,
    visits: overviewVisits,
  });
  const activeRatio =
    totalCustomers > 0 ? Math.round((activeCustomers / totalCustomers) * 100) : 0;
  const customerBaseStatus =
    totalCustomers === 0 || activeRatio < 60 ? "Da monitorare" : "Stabile";
  const recommendedCampaignSegments =
    Number(atRiskCustomers > 0) + Number(lostCustomers > 0);
  const salonStatusCards = [
    {
      detail:
        totalCustomers > 0
          ? `${activeRatio}% dei clienti è attivo`
          : "Aggiungi clienti per iniziare",
      href: "/clients",
      label: "Base clienti",
      value: customerBaseStatus,
    },
    {
      detail: "Da seguire nella salute clienti",
      href: "/opportunita-ai",
      label: "Clienti a rischio",
      value: `${atRiskCustomers}`,
    },
    {
      detail: "Segmenti con clienti recuperabili",
      href: "/campagne",
      label: "Campagne consigliate",
      value: `${recommendedCampaignSegments}`,
    },
  ];

  return (
    <PageShell
      active="Panoramica"
      sidebarEyebrow="Panoramica"
      sidebarText="Apri Beauty OS ogni mattina per capire chi contattare, quanto puoi recuperare e dove agire."
    >
      <section className="py-6">
        <article className="overflow-hidden rounded-[2rem] border border-black/10 bg-white shadow-[0_30px_100px_rgba(0,0,0,0.09)]">
          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.35fr_0.65fr] lg:items-end lg:p-10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-400">
                Panoramica · Oggi
              </p>
              <h1 className="mt-5 text-2xl font-semibold tracking-tight text-black sm:text-3xl">
                Recupero stimato oggi
              </h1>
              <p className="mt-4 text-5xl font-semibold tracking-[-0.05em] text-black sm:text-6xl lg:text-7xl">
                {formatCompactCurrency(estimatedRecoverableRevenue)}
              </p>
              <p className="mt-5 max-w-xl text-sm leading-6 text-zinc-500 sm:text-base">
                Valore recuperabile stimato sui clienti a rischio e persi,
                ponderato sulla probabilità di ritorno.
              </p>
              <Link
                className="mt-7 inline-flex items-center justify-center rounded-full bg-black px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(0,0,0,0.2)] transition hover:-translate-y-0.5 hover:bg-zinc-800"
                href="/opportunita-ai"
              >
                Recupera clienti
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-2 border-t border-black/10 pt-6 lg:grid-cols-1 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
              {[
                [recoverableCustomers.length, "Da contattare"],
                [atRiskCustomers, "A rischio"],
                [lostCustomers, "Da riattivare"],
              ].map(([value, label]) => (
                <div
                  className="min-w-0 rounded-[1.15rem] bg-[#f7f7f5] p-3 sm:p-4"
                  key={label}
                >
                  <p className="text-3xl font-semibold tracking-tight text-black">
                    {value}
                  </p>
                  <p className="mt-2 text-xs font-medium leading-5 text-zinc-500">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>

      <OverviewTodayPerformance
        actions={agendaActions}
        customers={customers}
        estimatedRecoverableRevenue={estimatedRecoverableRevenue}
        variant="kpis"
        visits={overviewVisits}
      />

      <section className="mt-6 overflow-hidden rounded-[1.75rem] bg-black text-white shadow-[0_28px_90px_rgba(0,0,0,0.2)]">
        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-zinc-500">
                Raccomandazione AI
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">
                {mainPriority
                  ? `${mainPriority.name} è la priorità con il maggiore impatto.`
                  : "Nessuna azione di recupero urgente."}
              </h2>
            </div>
            {mainPriority ? (
              <span className="w-fit shrink-0 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white">
                {statusLabels[mainPriority.status]}
              </span>
            ) : null}
          </div>

          {mainPriority ? (
            <>
              <div className="grid gap-px overflow-hidden rounded-[1.15rem] bg-white/10 sm:grid-cols-3">
                {[
                  [
                    "Ultima visita",
                    mainPriorityDaysSinceLastVisit === null
                      ? "Dato non disponibile"
                      : `${mainPriorityDaysSinceLastVisit} giorni fa`,
                  ],
                  [
                    "Valore storico",
                    formatCompactCurrency(mainPriority.totalSpentValue),
                  ],
                  [
                    "Probabilità di recupero",
                    `${mainPriority.recoveryProbability}%`,
                  ],
                ].map(([label, value]) => (
                  <div className="bg-black p-4 sm:p-5" key={label}>
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                      {label}
                    </p>
                    <p className="mt-2 text-lg font-semibold tracking-tight text-white">
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                    Azione consigliata
                  </p>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">
                    {mainPriorityReason} Invia un messaggio personale e proponi
                    una nuova prenotazione oggi.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  {mainPriorityWhatsAppHref ? (
                    <a
                      className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200"
                      href={mainPriorityWhatsAppHref}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Apri WhatsApp
                    </a>
                  ) : (
                    <span className="inline-flex cursor-not-allowed items-center justify-center rounded-full bg-zinc-800 px-5 py-2.5 text-sm font-semibold text-zinc-500">
                      Telefono mancante
                    </span>
                  )}
                  <Link
                    className="inline-flex items-center justify-center rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                    href={`/clients/${mainPriority.id}`}
                  >
                    Apri profilo
                  </Link>
                </div>
              </div>
            </>
          ) : (
            <div className="pt-4">
              <p className="max-w-2xl text-base leading-7 text-zinc-300">
                La base clienti non mostra recuperi urgenti. Mantieni visite e
                profili aggiornati per far emergere nuove opportunità.
              </p>
              <Link
                className="mt-6 inline-flex rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
                href="/clients"
              >
                Vai ai clienti
              </Link>
            </div>
          )}
        </div>
      </section>

      <OverviewTodayPerformance
        actions={agendaActions}
        customers={customers}
        estimatedRecoverableRevenue={estimatedRecoverableRevenue}
        variant="progress"
        visits={overviewVisits}
      />

      <section className="mt-6 rounded-[1.5rem] border border-black/10 bg-white p-5 shadow-[0_22px_70px_rgba(0,0,0,0.07)]">
        <div className="border-b border-black/10 pb-5">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-500">
            Agenda AI di oggi
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-black">
            Dove cliccare per agire
          </h2>
        </div>
        <OverviewAgendaActionsList
          actions={agendaActions}
          customers={customers}
          visits={overviewVisits}
        />
      </section>

      <section className="mt-6">
        <div className="mb-3">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-400">
            Andamento del mese
          </p>
        </div>
        <Link
          className="group flex flex-col gap-5 rounded-[1.35rem] border border-black/10 bg-white p-5 shadow-[0_18px_55px_rgba(0,0,0,0.06)] transition hover:-translate-y-0.5 hover:border-black/20 sm:flex-row sm:items-end sm:justify-between"
          href="/fatturato"
        >
          <div>
            <p className="text-sm font-medium text-zinc-500">
              Fatturato mese corrente
            </p>
            <p className="mt-4 text-4xl font-semibold tracking-tight text-black">
              {formatCompactCurrency(monthRevenue)}
            </p>
            <p className="mt-3 text-sm leading-6 text-zinc-500">
              Visite registrate nel mese corrente
            </p>
          </div>
          <span className="text-sm font-semibold text-black transition group-hover:translate-x-0.5">
            Apri fatturato
          </span>
        </Link>
      </section>

      <section className="mt-6">
        <div className="mb-3">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-400">
            Stato del salone
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {salonStatusCards.map((card) => (
            <Link
              className="cursor-pointer rounded-[1.15rem] border border-black/10 bg-white p-4 shadow-[0_14px_42px_rgba(0,0,0,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_55px_rgba(0,0,0,0.08)]"
              href={card.href}
              key={card.label}
            >
              <p className="text-sm font-medium text-zinc-500">{card.label}</p>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-black">
                {card.value}
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                {card.detail}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
