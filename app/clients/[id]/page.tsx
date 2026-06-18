import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { buildFinalWhatsAppMessage, buildWhatsAppUrl } from "@/lib/whatsapp";
import { PageShell } from "../../components/BeautyUi";
import AddAppointmentModal from "./AddAppointmentModal";
import AppointmentActionsModal from "./AppointmentActionsModal";
import AppointmentServiceMeta from "./AppointmentServiceMeta";
import CustomerManagedButton from "./CustomerManagedButton";
import CustomerRetentionTrend from "./CustomerRetentionTrend";
import DeleteCustomerModal from "./DeleteCustomerModal";
import EditCustomerModal from "./EditCustomerModal";
import RecoveryMessageModal from "./RecoveryMessageModal";
import RetentionHistoryDrawer, {
  type RetentionHistoryPoint,
} from "./RetentionHistoryDrawer";
import {
  analyzeRetention,
  generateRecoveryMessage,
  getAppointmentsByCustomerId,
  getCustomerById,
  getCustomerIds,
  getProfileDataQuality,
  healthLabels,
  statusLabels,
  statusStyles,
} from "../data";

export const dynamic = "force-dynamic";

type CustomerProfilePageProps = {
  params: Promise<{ id: string }>;
};

export async function generateStaticParams() {
  return getCustomerIds();
}

export async function generateMetadata({
  params,
}: CustomerProfilePageProps): Promise<Metadata> {
  const { id } = await params;
  const customer = await getCustomerById(id);

  return {
    title: customer ? `${customer.name} | Beauty OS` : "Cliente | Beauty OS",
    description: customer
      ? `Profilo CRM Beauty OS per ${customer.name}.`
      : "Profilo cliente CRM Beauty OS.",
  };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function parseDateValue(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function formatShortDate(value: string | null | undefined) {
  const date = parseDateValue(value);

  if (!date) {
    return "—";
  }

  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatYear(value: string | null | undefined) {
  const date = parseDateValue(value);

  if (!date) {
    return "—";
  }

  return new Intl.DateTimeFormat("it-IT", {
    year: "numeric",
  }).format(date);
}

function formatCompactAnnualValue(value: number) {
  return new Intl.NumberFormat("it-IT", {
    currency: "EUR",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
    notation: value >= 1000 ? "compact" : "standard",
    style: "currency",
  }).format(value);
}

function formatBirthday(value: string | null | undefined) {
  const date = parseDateValue(value);

  if (!date) {
    return "—";
  }

  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
  }).format(date);
}

function addDays(dateValue: string | null | undefined, days: number) {
  const date = parseDateValue(dateValue);

  if (!date) {
    return "";
  }

  date.setDate(date.getDate() + days);

  return date.toISOString().slice(0, 10);
}

function getBirthdaySummary(birthDate: string, age: number | null) {
  if (!parseDateValue(birthDate)) {
    return "";
  }

  const parts = [
    age === null ? null : `${age} anni`,
    `Compleanno ${formatBirthday(birthDate)}`,
    `Nascita ${formatShortDate(birthDate)}`,
  ].filter((part): part is string => Boolean(part));

  return parts.join(" · ");
}

function cleanPhoneNumber(phone: string) {
  const cleanedPhone = phone.replace(/\D/g, "");

  if (!cleanedPhone) {
    return "";
  }

  return cleanedPhone.startsWith("39") ? cleanedPhone : `39${cleanedPhone}`;
}

function getFavoriteService(appointments: Awaited<ReturnType<typeof getAppointmentsByCustomerId>>) {
  if (appointments.length === 0) {
    return "Non disponibile";
  }

  const serviceStats = appointments.reduce<
    Record<string, { count: number; latestDate: string }>
  >((stats, appointment) => {
    const currentStats = stats[appointment.serviceName] ?? {
      count: 0,
      latestDate: "",
    };

    stats[appointment.serviceName] = {
      count: currentStats.count + 1,
      latestDate:
        appointment.appointmentDate > currentStats.latestDate
          ? appointment.appointmentDate
          : currentStats.latestDate,
    };

    return stats;
  }, {});

  return Object.entries(serviceStats).sort((firstService, secondService) => {
    const countDifference = secondService[1].count - firstService[1].count;

    if (countDifference !== 0) {
      return countDifference;
    }

    return secondService[1].latestDate.localeCompare(firstService[1].latestDate);
  })[0][0];
}

function getVisitStatusBadge(status: string) {
  if (status === "VIP") {
    return "Cliente VIP";
  }

  if (status === "Loyal") {
    return "Cliente fedele";
  }

  if (status === "At Risk") {
    return "Cliente a rischio";
  }

  return "Cliente da recuperare";
}

function getDaysBetween(firstDate: string, secondDate: string) {
  const first = parseDateValue(firstDate);
  const second = parseDateValue(secondDate);

  if (!first || !second) {
    return 0;
  }

  return Math.max(
    0,
    Math.round((second.getTime() - first.getTime()) / 86_400_000),
  );
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildRetentionHistory({
  appointments,
  currentScore,
  expectedFrequencyDays,
  lastVisitDate,
}: {
  appointments: Awaited<ReturnType<typeof getAppointmentsByCustomerId>>;
  currentScore: number;
  expectedFrequencyDays: number;
  lastVisitDate: string;
}): RetentionHistoryPoint[] {
  if (appointments.length === 0) {
    return lastVisitDate
      ? [
          {
            amount: 0,
            date: lastVisitDate,
            event: "Stato cliente attuale",
            label: "Nessuna visita nello storico",
            score: currentScore,
          },
        ]
      : [];
  }

  const sortedAppointments = [...appointments].sort((first, second) =>
    first.appointmentDate.localeCompare(second.appointmentDate),
  );
  const firstScore = Math.max(45, Math.min(82, currentScore + 8));
  const points = sortedAppointments.map((appointment, index) => {
    const previousAppointment = sortedAppointments[index - 1];
    const gapDays = previousAppointment
      ? getDaysBetween(previousAppointment.appointmentDate, appointment.appointmentDate)
      : expectedFrequencyDays;
    const regularityPenalty = Math.max(
      0,
      Math.round((gapDays - expectedFrequencyDays) / Math.max(1, expectedFrequencyDays / 12)),
    );
    const visitBonus = Math.min(18, index * 4);
    const rawScore = firstScore + visitBonus - regularityPenalty;
    const score =
      index === sortedAppointments.length - 1
        ? currentScore
        : clampScore(rawScore);

    return {
      amount: appointment.amountValue,
      date: appointment.appointmentDate,
      event:
        gapDays > expectedFrequencyDays * 1.5
          ? "Cliente oltre la frequenza abituale"
          : "Visita registrata",
      label: appointment.serviceName,
      score,
    };
  });

  if (points.length === 1) {
    points.push({
      amount: 0,
      date: lastVisitDate || points[0].date,
      event: "Stato cliente attuale",
      label: "Score attuale",
      score: currentScore,
    });
  } else {
    points[points.length - 1] = {
      ...points[points.length - 1],
      score: currentScore,
    };
  }

  return points;
}

export default async function CustomerProfilePage({
  params,
}: CustomerProfilePageProps) {
  const { id } = await params;
  const [customer, appointments] = await Promise.all([
    getCustomerById(id),
    getAppointmentsByCustomerId(id),
  ]);

  if (!customer) {
    notFound();
  }

  const analysis = analyzeRetention(customer);
  const dataQuality = getProfileDataQuality(customer, appointments.length);
  const generatedMessage = generateRecoveryMessage(customer, analysis);
  const totalAppointmentRevenue = appointments.reduce(
    (total, appointment) => total + appointment.amountValue,
    0,
  );
  const averageAppointmentTicket =
    appointments.length > 0
      ? Math.round(totalAppointmentRevenue / appointments.length)
      : 0;
  const lastService = appointments[0]?.serviceName ?? "Non disponibile";
  const firstVisitDate =
    appointments[appointments.length - 1]?.appointmentDate ?? customer.createdAt;
  const futureVisitsEstimate =
    customer.expectedFrequencyDays > 0
      ? Math.max(0, Math.round(365 / customer.expectedFrequencyDays))
      : 0;
  const futureValueEstimate =
    averageAppointmentTicket > 0 && futureVisitsEstimate > 0
      ? Math.round(averageAppointmentTicket * futureVisitsEstimate)
      : 0;
  const overdueDays = Math.max(
    0,
    analysis.daysSinceLastVisit - analysis.expectedFrequencyDays,
  );
  const overdueLabel =
    overdueDays === 1
      ? "1 giorno"
      : overdueDays > 1
        ? `${overdueDays} giorni`
        : "0 giorni";
  const nextReturnDate = addDays(
    customer.lastVisitDate,
    analysis.expectedFrequencyDays,
  );
  const favoriteService = getFavoriteService(appointments);
  const retentionHistory = buildRetentionHistory({
    appointments,
    currentScore: analysis.score,
    expectedFrequencyDays: analysis.expectedFrequencyDays,
    lastVisitDate: customer.lastVisitDate,
  });
  const whatsappPhone = cleanPhoneNumber(customer.phone);
  const finalGeneratedMessage = buildFinalWhatsAppMessage(
    generatedMessage,
    analysis.status,
  );
  const whatsappHref = whatsappPhone
    ? buildWhatsAppUrl({
        phone: whatsappPhone,
        message: finalGeneratedMessage,
        target: "web",
      })
    : "";
  const visitStatusBadge = getVisitStatusBadge(analysis.status);
  const isBirthDateMissing = !customer.birthDate;
  const birthdaySummary = getBirthdaySummary(customer.birthDate, customer.age);
  const isMissingImportantProfileData =
    isBirthDateMissing ||
    customer.phone === "Telefono non inserito" ||
    customer.gender === "Non specificato" ||
    !customer.notes ||
    customer.notes === "Nessuna nota cliente inserita.";
  const headerDetails = [
    customer.phone,
    customer.gender,
    customer.totalSpent,
    `${appointments.length} visite`,
    customer.frequency,
    `Ultima visita ${customer.lastVisit}`,
  ].filter((detail): detail is string => Boolean(detail));
  const aiInsights = [
    {
      label: "Ritardo",
      value: overdueDays > 0 ? `${overdueDays} giorni` : "",
    },
    {
      label: "Servizio principale",
      value: favoriteService,
    },
    {
      label: "Ticket medio",
      value: formatCurrency(averageAppointmentTicket),
    },
    {
      label: "Possibilità recupero",
      value:
        customer.recoveryProbability > 0
          ? `${customer.recoveryProbability}%`
          : "",
    },
  ].filter((insight) => Boolean(insight.value));
  const defaultTrend: "In peggioramento" | "In recupero" | "Stabile" =
    analysis.status === "At Risk" || analysis.status === "Lost"
      ? analysis.daysSinceLastVisit > analysis.expectedFrequencyDays
        ? "In peggioramento"
        : "Stabile"
      : "Stabile";

  return (
    <PageShell
      active="Clienti"
      sidebarEyebrow="Profilo operativo"
      sidebarText="Guida ogni decisione cliente partendo da valore, cadenza visite e rischio reale."
    >
      <header className="border-b border-black/10 pb-5">
        <Link
          className="text-sm font-medium text-zinc-500 transition hover:text-zinc-950"
          href="/clients"
        >
          Torna ai clienti
        </Link>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-zinc-500">
                Profilo cliente
              </p>
              <span
                className={`inline-flex whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  statusStyles[analysis.status]
                }`}
              >
                {statusLabels[analysis.status]}
              </span>
              {!isMissingImportantProfileData ? (
                <span className="inline-flex rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700">
                  Profilo completo
                </span>
              ) : null}
              <CustomerManagedButton
                customerId={customer.id}
                customerName={customer.name}
                estimatedValue={averageAppointmentTicket}
                reason={
                  overdueDays > 0
                    ? `Cliente in ritardo di ${overdueDays} giorni`
                    : "Cliente da gestire oggi"
                }
                recoveryProbability={customer.recoveryProbability}
                variant="badge"
              />
            </div>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-black sm:text-5xl">
              {customer.name}
            </h1>
            {birthdaySummary ? (
              <p className="mt-3 text-sm font-medium text-zinc-700">
                {birthdaySummary}
              </p>
            ) : (
              <span className="mt-3 inline-flex whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[0.65rem] font-semibold text-amber-800">
                Compleanno mancante
              </span>
            )}
            <p className="mt-3 max-w-5xl text-sm leading-7 text-zinc-500">
              {headerDetails.join(" · ")}
            </p>
            {isBirthDateMissing ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[0.65rem] font-semibold text-amber-800">
                  Data di nascita mancante
                </span>
                <EditCustomerModal
                  buttonClassName="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm transition duration-200 hover:-translate-y-px hover:bg-zinc-50"
                  buttonLabel="Completa profilo"
                  customer={customer}
                />
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-start gap-3 lg:justify-end">
            <EditCustomerModal customer={customer} />
            <DeleteCustomerModal customerId={customer.id} />
          </div>
        </div>
      </header>

      {isMissingImportantProfileData ? (
        <section className="pt-4">
          <div className="rounded-[1.25rem] border border-amber-200 bg-amber-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-800">
                  Profilo da completare
                </p>
                <p className="mt-2 text-sm font-semibold text-black">
                  Mancano alcune informazioni utili per messaggi e previsioni più precisi.
                </p>
              </div>
              <span className="w-fit rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm">
                {dataQuality.completionScore}% dati CRM
              </span>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {[
                isBirthDateMissing ? "Data di nascita mancante." : "",
                customer.phone === "Telefono non inserito" ? "Telefono mancante." : "",
                customer.gender === "Non specificato" ? "Genere non specificato." : "",
                !customer.notes || customer.notes === "Nessuna nota cliente inserita."
                  ? "Note CRM mancanti."
                  : "",
              ]
                .filter(Boolean)
                .map((warning) => (
                <p
                  className="rounded-[0.9rem] border border-amber-200 bg-white px-3 py-2 text-sm leading-6 text-amber-900"
                  key={warning}
                >
                  {warning}
                </p>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="py-4">
        <article className="rounded-[1.5rem] border border-black/10 bg-black p-5 text-white shadow-[0_28px_90px_rgba(0,0,0,0.18)] sm:p-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.6fr)_minmax(22rem,0.4fr)] lg:items-stretch">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                Azione AI consigliata
              </p>
              <span className="mt-4 inline-flex rounded-full border border-white/10 bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-zinc-200">
                Possibilità recupero {customer.recoveryProbability}%
              </span>
              <h2 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Recupera {formatCurrency(averageAppointmentTicket)}
              </h2>
              <p className="mt-3 text-xl font-semibold tracking-tight text-zinc-100 sm:text-2xl">
                da {customer.name}
              </p>
              <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-300">
                {overdueDays > 0
                  ? `Cliente in ritardo di ${overdueDays} giorni rispetto alla frequenza abituale.`
                  : "Cliente in linea con la frequenza abituale: prepara il prossimo contatto prima che rallenti."}
              </p>
              <p className="mt-4 text-sm font-semibold text-zinc-100">
                Prossima azione: Invia WhatsApp con proposta appuntamento.
              </p>
            </div>

            <div className="flex flex-col justify-between gap-4">
              <div className="grid grid-cols-2 items-stretch gap-3">
                <div className="flex min-h-28 flex-col justify-between rounded-[0.95rem] border border-white/10 bg-white/[0.08] p-3.5">
                  <p className="text-base text-zinc-400">Ritardo</p>
                  <p className="pt-4 text-xl font-semibold tracking-tight text-white">
                    {overdueLabel}
                  </p>
                </div>
                <div className="flex min-h-28 flex-col justify-between rounded-[0.95rem] border border-white/10 bg-white/[0.08] p-3.5">
                  <p className="text-base text-zinc-400">Possibilità recupero</p>
                  <p className="pt-4 text-xl font-semibold tracking-tight text-white">
                    {customer.recoveryProbability}%
                  </p>
                </div>
                <div className="flex min-h-28 flex-col justify-between rounded-[0.95rem] border border-white/10 bg-white/[0.08] p-3.5">
                  <p className="text-base text-zinc-400">Valore recuperabile</p>
                  <p className="pt-4 text-xl font-semibold tracking-tight text-white">
                    {formatCurrency(averageAppointmentTicket)}
                  </p>
                </div>
                <div className="flex min-h-28 flex-col justify-between rounded-[0.95rem] border border-white/10 bg-white/[0.08] p-3.5">
                  <p className="text-base text-zinc-400">Ritorno previsto</p>
                  <p className="whitespace-nowrap pt-4 text-xl font-semibold tracking-tight text-white">
                    {formatShortDate(nextReturnDate)}
                  </p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                {whatsappHref ? (
                  <a
                    className="inline-flex w-full items-center justify-center rounded-full bg-white px-3 py-2 text-center text-xs font-semibold text-black shadow-[0_14px_35px_rgba(255,255,255,0.14)] transition duration-200 hover:-translate-y-px hover:bg-zinc-200"
                    href={whatsappHref}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Invia WhatsApp
                  </a>
                ) : (
                  <span className="inline-flex w-full items-center justify-center rounded-full bg-white/15 px-3 py-2 text-center text-xs font-medium text-zinc-400">
                    Invia WhatsApp
                  </span>
                )}
                <RecoveryMessageModal
                  buttonVariant="light"
                  customerId={customer.id}
                  customerName={customer.name}
                  customerPhone={customer.phone}
                  customerStatus={analysis.status}
                  retentionScore={analysis.score}
                  daysSinceLastVisit={analysis.daysSinceLastVisit}
                  generatedMessage={generatedMessage}
                />
                <CustomerManagedButton
                  customerId={customer.id}
                  customerName={customer.name}
                  estimatedValue={averageAppointmentTicket}
                  reason={
                    overdueDays > 0
                      ? `Cliente in ritardo di ${overdueDays} giorni`
                      : "Cliente da gestire oggi"
                  }
                  recoveryProbability={customer.recoveryProbability}
                />
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-3 pb-3 xl:grid-cols-4">
        <article className="rounded-[1.05rem] border border-black/10 bg-white p-3.5 shadow-[0_16px_45px_rgba(0,0,0,0.045)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
            Punteggio fidelizzazione
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-black">
            {analysis.score}
          </p>
          <div className="mt-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">
              Stato operativo
            </p>
            <span
              className={`mt-1.5 inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${analysis.healthStyles}`}
            >
              {healthLabels[analysis.health]}
            </span>
          </div>
          <CustomerRetentionTrend
            customerId={customer.id}
            defaultTrend={defaultTrend}
          />
          <RetentionHistoryDrawer
            currentScore={analysis.score}
            customerName={customer.name}
            favoriteService={favoriteService}
            historicalValue={customer.totalSpent}
            points={retentionHistory}
          />
        </article>

        <article className="rounded-[1.05rem] border border-black/10 bg-white p-3.5 shadow-[0_16px_45px_rgba(0,0,0,0.045)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
            Valore cliente
          </p>
          <p className="mt-2 text-4xl font-semibold tracking-tight text-black">
            {customer.totalSpent}
          </p>
          <p className="mt-1 text-sm font-medium text-zinc-500">
            Lifetime Value
          </p>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-zinc-600">
            <span>{appointments.length} visite</span>
            <span>Ticket medio {formatCurrency(averageAppointmentTicket)}</span>
            <span>Cliente dal {formatYear(firstVisitDate)}</span>
          </div>
          <div className="mt-3 border-t border-black/10 pt-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">
              Ultimo servizio
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-black">
              {lastService}
            </p>
          </div>
          <div className="mt-3 border-t border-black/10 pt-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">
            Servizio preferito
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-black">
              {favoriteService}
            </p>
          </div>
        </article>

        <article className="rounded-[1.05rem] border border-black/10 bg-white p-3.5 shadow-[0_16px_45px_rgba(0,0,0,0.045)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
            Valore futuro stimato
          </p>
          {futureValueEstimate > 0 ? (
            <>
              <p className="mt-2 text-4xl font-semibold tracking-tight text-black">
                {formatCompactAnnualValue(futureValueEstimate)}/anno
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                {formatCurrency(averageAppointmentTicket)} × circa{" "}
                {futureVisitsEstimate} visite.
              </p>
              <p className="mt-2 text-xs leading-5 text-zinc-500">
                Stima basata su frequenza e ticket medio.
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm font-semibold text-zinc-600">
              Dati insufficienti
            </p>
          )}
        </article>

        <article className="rounded-[1.05rem] border border-black/10 bg-white p-3.5 shadow-[0_16px_45px_rgba(0,0,0,0.045)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
            Rischio / recupero
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-black">
            {customer.recoveryProbability}%
          </p>
          <div className="mt-3 flex flex-col gap-2 text-xs">
            <p className="flex min-h-16 flex-col justify-between rounded-[0.8rem] bg-[#f7f7f5] p-3 text-zinc-600">
              Giorni dall&apos;ultima visita
              <span className="mt-2 block text-lg font-semibold text-black">
                {analysis.daysSinceLastVisit}
              </span>
            </p>
            <p className="flex min-h-16 flex-col justify-between rounded-[0.8rem] bg-[#f7f7f5] p-3 text-zinc-600">
              Valore recuperabile
              <span className="mt-2 block text-lg font-semibold text-black">
                {formatCurrency(averageAppointmentTicket)}
              </span>
            </p>
          </div>
        </article>
      </section>

      <section className="grid gap-4 pb-4 xl:grid-cols-[0.8fr_1fr]">
        <article className="rounded-[1.25rem] border border-black/10 bg-black p-4 text-white shadow-[0_22px_70px_rgba(0,0,0,0.16)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Perché è a rischio
          </p>
          <ul className="mt-3 space-y-2">
            {aiInsights.map((insight) => (
              <li
                className="flex items-center justify-between gap-3 text-sm leading-5 text-zinc-200"
                key={insight.label}
              >
                <span className="text-zinc-400">{insight.label}</span>
                <span className="text-right font-semibold text-white">
                  {insight.value}
                </span>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-[1.25rem] border border-black/10 bg-white p-5 shadow-[0_18px_55px_rgba(0,0,0,0.05)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
                Note CRM
              </p>
              <h2 className="mt-2 text-lg font-semibold tracking-tight text-black">
                Contesto utile
              </h2>
            </div>
            <span className="rounded-full border border-black/10 bg-[#f7f7f5] px-3 py-1.5 text-xs font-semibold text-zinc-700">
              Sintesi
            </span>
          </div>
          <p className="mt-3 max-h-32 overflow-y-auto text-sm leading-7 text-zinc-600">
            {customer.notes}
          </p>
        </article>
      </section>

      <section className="rounded-[1.25rem] border border-black/10 bg-white shadow-[0_18px_55px_rgba(0,0,0,0.06)]">
        <div className="flex flex-col gap-3 border-b border-black/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-black">
              Storico visite
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Timeline ordinata per data decrescente.
            </p>
          </div>
          <AddAppointmentModal customerId={customer.id} />
        </div>

        <div className="p-4">
          {appointments.length > 0 ? (
            <div className="relative space-y-3">
              <div className="absolute bottom-4 left-[0.42rem] top-4 hidden w-px bg-black/10 sm:block" />
              {appointments.map((appointment, index) => (
                <article
                  className="relative grid gap-4 rounded-[1rem] border border-black/10 bg-white p-4 shadow-[0_12px_34px_rgba(0,0,0,0.04)] transition duration-200 hover:-translate-y-px hover:border-black/20 hover:shadow-[0_18px_45px_rgba(0,0,0,0.07)] sm:ml-5 sm:grid-cols-[9rem_minmax(0,1fr)_auto]"
                  key={appointment.id}
                >
                  <div className="absolute -left-[1.43rem] top-6 hidden size-3 rounded-full border-2 border-white bg-black shadow-[0_0_0_1px_rgba(0,0,0,0.1)] sm:block" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-black">
                      {appointment.formattedDate}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Visita {appointments.length - index}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="line-clamp-2 text-base font-semibold tracking-tight text-black">
                        {appointment.serviceName}
                      </h3>
                      <span className="rounded-full border border-black/10 bg-[#f7f7f5] px-3 py-1 text-xs font-semibold text-zinc-950">
                        {appointment.amount}
                      </span>
                      <AppointmentServiceMeta serviceName={appointment.serviceName} />
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                          statusStyles[analysis.status]
                        }`}
                      >
                        {visitStatusBadge}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-zinc-500">
                      Nota CRM: {appointment.notes}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                    <AppointmentActionsModal
                      appointment={appointment}
                      customerId={customer.id}
                    />
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-[1.25rem] border border-dashed border-black/15 bg-[#f7f7f5] p-8 text-center">
              <p className="mx-auto max-w-md text-sm font-medium leading-6 text-zinc-600">
                Nessuna visita registrata. Aggiungi la prima visita per attivare gli
                insight AI.
              </p>
            </div>
          )}
        </div>
      </section>
    </PageShell>
  );
}
