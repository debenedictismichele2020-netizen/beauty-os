import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildFinalWhatsAppMessage, buildWhatsAppUrl } from "@/lib/whatsapp";
import {
  buildOverviewActions,
  type OverviewVisit,
} from "@/lib/overviewActions";
import { PageHeader, PageShell } from "./components/BeautyUi";
import OverviewAgendaActionsList from "./OverviewAgendaActionsList";
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
  const mainPriority = prioritizedRecoverableCustomers[0];
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
  const quickKpis = [
    {
      detail: "Clienti a rischio e persi",
      href: "/opportunita-ai",
      label: "Oggi puoi recuperare",
      value: formatCompactCurrency(recoverableValue),
    },
    {
      detail: "Persone da gestire oggi",
      href: "/agenda-ai",
      label: "Clienti da contattare",
      value: `${recoverableCustomers.length}`,
    },
    {
      detail: "Visite registrate nel mese corrente",
      href: "/fatturato",
      label: "Fatturato mese",
      value: formatCompactCurrency(monthRevenue),
    },
  ];
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
      <PageHeader
        actions={
          <Link
            className="rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white shadow-[0_14px_35px_rgba(0,0,0,0.22)] transition hover:bg-zinc-800"
            href="/opportunita-ai"
          >
            Apri priorità
          </Link>
        }
        eyebrow="Panoramica"
        subtitle="La tua agenda intelligente per recuperare clienti e fatturato."
        title="Beauty OS"
      />

      <section className="py-6">
        <article className="overflow-hidden rounded-[1.75rem] border border-black/10 bg-white shadow-[0_28px_90px_rgba(0,0,0,0.08)]">
          <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="p-6 sm:p-7 lg:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-zinc-400">
                Priorità di oggi
              </p>
              {mainPriority ? (
                <>
                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <h2 className="text-3xl font-semibold tracking-tight text-black sm:text-4xl">
                      {mainPriority.name}
                    </h2>
                    <span className="whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                      {statusLabels[mainPriority.status]}
                    </span>
                  </div>
                  <p className="mt-4 max-w-xl text-base leading-7 text-zinc-600">
                    {mainPriorityReason}
                  </p>
                  <div className="mt-7 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[1.15rem] border border-black/10 bg-[#f7f7f5] p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-400">
                        Valore recuperabile stimato
                      </p>
                      <p className="mt-3 text-3xl font-semibold tracking-tight text-black">
                        {formatCompactCurrency(mainPriority.estimatedRecovery)}
                      </p>
                    </div>
                    <div className="rounded-[1.15rem] border border-black/10 bg-[#f7f7f5] p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-400">
                        Probabilità
                      </p>
                      <p className="mt-3 text-3xl font-semibold tracking-tight text-black">
                        {mainPriority.recoveryProbability}%
                      </p>
                    </div>
                  </div>
                  <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                    {mainPriorityWhatsAppHref ? (
                      <a
                        className="inline-flex items-center justify-center rounded-full bg-black px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(0,0,0,0.2)] transition hover:bg-zinc-800"
                        href={mainPriorityWhatsAppHref}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Apri WhatsApp
                      </a>
                    ) : (
                      <span className="inline-flex cursor-not-allowed items-center justify-center rounded-full bg-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-500">
                        Telefono mancante
                      </span>
                    )}
                    <Link
                      className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-black transition hover:border-black/20 hover:bg-zinc-50"
                      href={`/clients/${mainPriority.id}`}
                    >
                      Apri profilo
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="mt-5 text-3xl font-semibold tracking-tight text-black sm:text-4xl">
                    Nessuna priorità critica oggi
                  </h2>
                  <p className="mt-4 max-w-xl text-base leading-7 text-zinc-600">
                    La base clienti non mostra recuperi urgenti. Mantieni i
                    profili aggiornati per far emergere nuove opportunità.
                  </p>
                  <Link
                    className="mt-7 inline-flex rounded-full bg-black px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(0,0,0,0.2)] transition hover:bg-zinc-800"
                    href="/clients"
                  >
                    Vai ai clienti
                  </Link>
                </>
              )}
            </div>
            <div className="border-t border-black/10 bg-black p-6 text-white sm:p-7 lg:border-l lg:border-t-0 lg:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-zinc-500">
                Cosa fare adesso
              </p>
              <h3 className="mt-4 text-2xl font-semibold tracking-tight">
                {mainPriority
                  ? "Invia un messaggio breve e porta il cliente alla prossima prenotazione."
                  : "La giornata parte senza urgenze critiche."}
              </h3>
              <p className="mt-5 text-sm leading-6 text-zinc-300">
                {mainPriority
                  ? `${statusLabels[mainPriority.status]} · ${formatCompactCurrency(mainPriority.totalSpentValue)} valore storico · ${mainPriority.recoveryProbability}% probabilità di recupero.`
                  : "Controlla i clienti e registra nuove visite per mantenere i dati affidabili."}
              </p>
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {quickKpis.map((kpi) => (
          <Link
            className="group cursor-pointer rounded-[1.35rem] border border-black/10 bg-white p-5 shadow-[0_18px_55px_rgba(0,0,0,0.06)] transition hover:-translate-y-0.5 hover:border-black/20 hover:shadow-[0_24px_70px_rgba(0,0,0,0.09)]"
            href={kpi.href}
            key={kpi.label}
          >
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm font-medium text-zinc-500">{kpi.label}</p>
              <span className="text-sm font-semibold text-black transition group-hover:translate-x-0.5">
                Apri
              </span>
            </div>
            <p className="mt-6 break-words text-3xl font-semibold tracking-tight text-black">
              {kpi.value}
            </p>
            <p className="mt-3 text-sm leading-6 text-zinc-500">{kpi.detail}</p>
          </Link>
        ))}
      </section>

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
