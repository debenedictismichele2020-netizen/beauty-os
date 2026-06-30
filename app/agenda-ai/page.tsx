import type { Metadata } from "next";

import { getCurrentSalon } from "@/lib/currentSalon";
import { buildFinalWhatsAppMessage, buildWhatsAppUrl } from "@/lib/whatsapp";
import { PageHeader, PageShell } from "../components/BeautyUi";
import {
  type Customer,
  formatCompactCurrency,
} from "../clients/data";
import { getCustomers } from "../clients/serverData";
import { AgendaCalendar, type AgendaTask } from "./AgendaCalendar";

export const metadata: Metadata = {
  title: "Agenda AI | Beauty OS",
  description: "Calendario operativo delle azioni consigliate da Beauty OS.",
};

export const dynamic = "force-dynamic";

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

function getBirthdayWhatsAppHref(customer: Pick<Customer, "phone">) {
  const cleanedPhone = cleanWhatsAppPhone(customer.phone);

  if (!cleanedPhone) {
    return "";
  }

  return `https://wa.me/${cleanedPhone}`;
}

function getEstimatedRecovery(customer: Customer) {
  return Math.round(
    (customer.totalSpentValue * customer.recoveryProbability) / 100,
  );
}

function differenceInDays(fromDate: string, toDate: string) {
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);

  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 86_400_000));
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function isProfileIncomplete(customer: Customer) {
  return (
    !customer.lastVisitDate ||
    customer.gender === "Non specificato" ||
    customer.phone === "Telefono non inserito" ||
    customer.totalSpentValue <= 0
  );
}

function getAverageSpent(customers: Customer[]) {
  if (customers.length === 0) {
    return 0;
  }

  return (
    customers.reduce((total, customer) => total + customer.totalSpentValue, 0) /
    customers.length
  );
}

function getBirthdayMonthDay(value: string) {
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const shortMatch = value.match(/^(\d{2})-(\d{2})$/);

  if (!isoMatch && !shortMatch) {
    return "";
  }

  const month = Number(isoMatch?.[2] ?? shortMatch?.[1]);
  const day = Number(isoMatch?.[3] ?? shortMatch?.[2]);

  if (!Number.isInteger(month) || !Number.isInteger(day)) {
    return "";
  }

  const validationDate = new Date(2000, month - 1, day);
  const isValidMonthDay =
    validationDate.getMonth() === month - 1 && validationDate.getDate() === day;

  if (!isValidMonthDay) {
    return "";
  }

  return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function buildAgendaTasks(
  customers: Customer[],
) {
  const todayKey = toDateKey(new Date());
  const averageSpent = getAverageSpent(customers);
  const atRiskCustomers = customers
    .filter((customer) => customer.status === "At Risk")
    .sort((first, second) => getEstimatedRecovery(second) - getEstimatedRecovery(first));
  const lostCustomers = customers
    .filter((customer) => customer.status === "Lost")
    .sort((first, second) => second.totalSpentValue - first.totalSpentValue);
  const vipCustomers = customers
    .filter((customer) => customer.status === "VIP")
    .sort((first, second) => second.totalSpentValue - first.totalSpentValue)
    .slice(0, 8);
  const incompleteCustomers = customers
    .filter(isProfileIncomplete)
    .sort((first, second) => second.totalSpentValue - first.totalSpentValue)
    .slice(0, 10);
  const tasks: AgendaTask[] = [];

  atRiskCustomers.forEach((customer) => {
    const estimatedRecovery = getEstimatedRecovery(customer);
    const daysSinceLastVisit = customer.lastVisitDate
      ? differenceInDays(customer.lastVisitDate, todayKey)
      : null;
    const priority =
      customer.recoveryProbability >= 60 || customer.totalSpentValue >= averageSpent
        ? "Alta"
        : "Media";

    tasks.push({
      category: priority === "Alta" ? "Recupero" : "Monitorare",
      customerId: customer.id,
      customerName: customer.name,
      daysSinceLastVisit,
      description: daysSinceLastVisit
        ? `Assente da ${daysSinceLastVisit} giorni`
        : "Cliente a rischio da monitorare oggi",
      estimatedValue: estimatedRecovery,
      id: `risk-${customer.id}`,
      lastVisitDate: customer.lastVisitDate,
      phone: customer.phone,
      potentialValue: formatCompactCurrency(estimatedRecovery),
      priority,
      reason:
        daysSinceLastVisit && daysSinceLastVisit >= 60
          ? `Ultima visita il ${formatShortDate(customer.lastVisitDate)}`
          : "Alta possibilità di ritorno",
      recoveryProbability: customer.recoveryProbability,
      title: `Contatta ${customer.name}`,
      whatsappHref: getWhatsAppHref(customer),
    });
  });

  lostCustomers.forEach((customer) => {
    const estimatedRecovery = getEstimatedRecovery(customer);
    const daysSinceLastVisit = customer.lastVisitDate
      ? differenceInDays(customer.lastVisitDate, todayKey)
      : null;

    tasks.push({
      category: "Recupero",
      customerId: customer.id,
      customerName: customer.name,
      daysSinceLastVisit,
      description: daysSinceLastVisit
        ? `Assente da ${daysSinceLastVisit} giorni`
        : "Cliente perso da recuperare",
      estimatedValue: estimatedRecovery,
      id: `lost-${customer.id}`,
      lastVisitDate: customer.lastVisitDate,
      phone: customer.phone,
      potentialValue: formatCompactCurrency(estimatedRecovery),
      priority: customer.totalSpentValue >= averageSpent ? "Alta" : "Media",
      reason: `Cliente perso con ${formatCompactCurrency(estimatedRecovery)} recuperabili`,
      recoveryProbability: customer.recoveryProbability,
      title: `Riattiva ${customer.name}`,
      whatsappHref: getWhatsAppHref(customer),
    });
  });

  vipCustomers.forEach((customer) => {
    tasks.push({
      category: "Fidelizzazione",
      customerId: customer.id,
      customerName: customer.name,
      description:
        "Cliente VIP da mantenere vicino con un contatto curato o una proposta dedicata.",
      id: `vip-${customer.id}`,
      phone: customer.phone,
      potentialValue: formatCompactCurrency(customer.totalSpentValue),
      priority: customer.recoveryProbability >= 60 ? "Media" : "Bassa",
      title: `Mantieni relazione con ${customer.name}`,
      whatsappHref: getWhatsAppHref(customer),
    });
  });

  incompleteCustomers.forEach((customer) => {
    tasks.push({
      category: "Qualità dati",
      customerId: customer.id,
      customerName: customer.name,
      description:
        "Profilo da completare per rendere più affidabili score, messaggi e previsioni.",
      id: `quality-${customer.id}`,
      priority: customer.totalSpentValue >= averageSpent ? "Media" : "Bassa",
      title: `Completa profilo ${customer.name}`,
    });
  });

  if (lostCustomers.length > 0) {
    tasks.push({
      campaignHref: "/campagne",
      category: "Campagna",
      description: `${lostCustomers.length} clienti persi disponibili per una campagna di riattivazione.`,
      id: "campaign-lost",
      potentialValue: formatCompactCurrency(
        lostCustomers.reduce(
          (total, customer) => total + customer.totalSpentValue,
          0,
        ),
      ),
      priority: "Alta",
      title: "Prepara campagna clienti persi",
    });
  }

  if (vipCustomers.length > 0) {
    tasks.push({
      campaignHref: "/campagne",
      category: "Campagna",
      description: `${vipCustomers.length} clienti VIP disponibili per un messaggio relazionale.`,
      id: "campaign-vip",
      potentialValue: formatCompactCurrency(
        vipCustomers.reduce(
          (total, customer) => total + customer.totalSpentValue,
          0,
        ),
      ),
      priority: "Bassa",
      title: "Prepara campagna VIP",
    });
  }

  customers.forEach((customer) => {
    const scheduledMonthDay = getBirthdayMonthDay(customer.birthDate);

    if (!scheduledMonthDay) {
      return;
    }

    tasks.push({
      category: "Compleanno",
      customerId: customer.id,
      customerName: customer.name,
      description:
        "Invia auguri personalizzati e proponi una piccola coccola beauty o uno sconto birthday.",
      id: `birthday-${customer.id}`,
      phone: customer.phone,
      potentialValue: formatCompactCurrency(customer.totalSpentValue),
      priority: "Media",
      birthDate: customer.birthDate,
      scheduledMonthDay,
      title: `Compleanno ${customer.name}`,
      whatsappHref: getBirthdayWhatsAppHref(customer),
    });
  });

  return tasks;
}

export default async function AgendaAiPage() {
  const currentSalon = await getCurrentSalon();
  const customers = await getCustomers();
  const tasks = buildAgendaTasks(customers);

  return (
    <PageShell
      active="Agenda AI"
      sidebarEyebrow="Agenda AI"
      sidebarText="Calendario operativo generato dai dati clienti reali."
    >
      <PageHeader
        eyebrow="Agenda operativa"
        subtitle="Calendario operativo delle azioni consigliate per recuperare clienti e riempire l’agenda."
        title="Agenda AI"
      />

      <div className="py-6">
        {!currentSalon ? (
          <section className="rounded-[1.75rem] border border-black/10 bg-white p-8 shadow-[0_24px_80px_rgba(0,0,0,0.08)]">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-400">
              Calendario operativo
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-black">
              Salone non trovato
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
              Non è stato possibile recuperare il salone corrente. Effettua di nuovo
              l’accesso e riprova.
            </p>
          </section>
        ) : tasks.length > 0 ? (
          <AgendaCalendar salonId={currentSalon.id} tasks={tasks} />
        ) : (
          <section className="rounded-[1.75rem] border border-black/10 bg-white p-8 shadow-[0_24px_80px_rgba(0,0,0,0.08)]">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-400">
              Calendario operativo
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-black">
              Non ci sono azioni programmate
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
              Aggiungi clienti o visite per generare l’agenda AI.
            </p>
          </section>
        )}
      </div>
    </PageShell>
  );
}
