import type { OperationalTask } from "@/lib/operationalTasks";
import type { ServiceCatalogItem } from "@/lib/serviceCatalog";

export type OverviewActionType =
  | "urgent_customer"
  | "recovery_customer"
  | "lost_customers_campaign"
  | "birthday_campaign"
  | "unused_services_campaign"
  | "incomplete_profile"
  | "snoozed_task";

export type OverviewActionCampaignDraft = {
  channel: "WhatsApp";
  objective: string;
  segment: string;
  selectedCustomerIds: string[];
  selectedServices: Array<{
    category: string;
    duration: number | null;
    name: string;
    price: number | null;
  }>;
  source:
    | "overview_birthdays"
    | "overview_lost_customers"
    | "overview_unused_services";
  title: string;
};

export type OverviewAction = {
  action?: "create_campaign_draft" | "open_link";
  badge: string;
  campaignDraft?: OverviewActionCampaignDraft;
  customerId?: string;
  customerIds?: string[];
  description: string;
  estimatedValue?: number;
  href?: string;
  id: string;
  priority: number;
  title: string;
  tone: "calm" | "medium" | "urgent";
  type: OverviewActionType;
};

export type OverviewCustomer = {
  birthDate?: string | null;
  createdAt?: string;
  gender?: string;
  id: string;
  name: string;
  notes?: string;
  phone?: string;
  recoveryProbability?: number;
  status: string;
  totalSpentValue?: number;
};

export type OverviewVisit = {
  amount?: number;
  appointmentDate?: string | null;
  serviceName: string;
};

type BuildOverviewActionsInput = {
  customers: OverviewCustomer[];
  operationalTasks?: OperationalTask[];
  services?: ServiceCatalogItem[];
  today?: Date;
  visits?: OverviewVisit[];
};

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getMoneyValue(value: number | null | undefined) {
  const amount = Number(value ?? 0);

  return Number.isFinite(amount) ? amount : 0;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("it-IT", {
    currency: "EUR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function getEstimatedRecovery(customer: OverviewCustomer) {
  return Math.round(
    (getMoneyValue(customer.totalSpentValue) *
      getMoneyValue(customer.recoveryProbability)) /
      100,
  );
}

function isRecoverable(customer: OverviewCustomer) {
  return customer.status === "At Risk" || customer.status === "Lost";
}

function getMissingProfileFields(customer: OverviewCustomer) {
  return [
    customer.birthDate ? "" : "data nascita",
    !customer.phone || customer.phone === "Telefono non inserito"
      ? "telefono"
      : "",
    !customer.gender || customer.gender === "Non specificato" ? "genere" : "",
    !customer.notes || customer.notes === "Nessuna nota cliente inserita."
      ? "note"
      : "",
  ].filter((field): field is string => Boolean(field));
}

function getBirthdayDateThisYear(birthDate: string | null | undefined, year: number) {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    return null;
  }

  const [, month, day] = birthDate.split("-").map(Number);
  const birthdayDate = new Date(year, month - 1, day);

  if (
    birthdayDate.getMonth() !== month - 1 ||
    birthdayDate.getDate() !== day
  ) {
    return null;
  }

  return birthdayDate;
}

function getBirthdayCustomersThisMonth(
  customers: OverviewCustomer[],
  today: Date,
) {
  return customers.filter((customer) => {
    const birthdayDate = getBirthdayDateThisYear(
      customer.birthDate,
      today.getFullYear(),
    );

    return birthdayDate?.getMonth() === today.getMonth();
  });
}

function normalizeServiceName(name: string) {
  return name.trim().toLowerCase();
}

function getUnusedServices(services: ServiceCatalogItem[], visits: OverviewVisit[]) {
  const usedServiceNames = new Set(
    visits
      .map((visit) => normalizeServiceName(visit.serviceName))
      .filter(Boolean),
  );

  return services.filter(
    (service) => service.active && !usedServiceNames.has(normalizeServiceName(service.name)),
  );
}

function getPreviewNames(names: string[]) {
  const visibleNames = names.slice(0, 3).join(", ");
  const remainingCount = names.length - 3;

  return remainingCount > 0 ? `${visibleNames} +${remainingCount}` : visibleNames;
}

function isCustomerCompletedToday(
  customerId: string,
  operationalTasks: OperationalTask[],
  todayKey: string,
) {
  return operationalTasks.some(
    (task) =>
      task.status === "completed" &&
      task.date === todayKey &&
      task.customerId === customerId,
  );
}

function isActionCompletedToday(
  action: OverviewAction,
  operationalTasks: OperationalTask[],
  todayKey: string,
) {
  return operationalTasks.some((task) => {
    if (task.status !== "completed" || task.date !== todayKey) {
      return false;
    }

    if (task.id === action.id) {
      return true;
    }

    if (action.customerId && task.customerId === action.customerId) {
      return true;
    }

    if (action.type === "lost_customers_campaign" && task.type === "campaign") {
      return task.id === action.id || task.reason.includes("clienti persi");
    }

    if (action.type === "incomplete_profile" && task.type === "data_quality") {
      return action.customerId ? task.customerId === action.customerId : false;
    }

    return false;
  });
}

function sortByRecoveryPriority(
  firstCustomer: OverviewCustomer,
  secondCustomer: OverviewCustomer,
) {
  const recoveryDifference =
    getEstimatedRecovery(secondCustomer) - getEstimatedRecovery(firstCustomer);

  if (recoveryDifference !== 0) {
    return recoveryDifference;
  }

  const probabilityDifference =
    getMoneyValue(secondCustomer.recoveryProbability) -
    getMoneyValue(firstCustomer.recoveryProbability);

  if (probabilityDifference !== 0) {
    return probabilityDifference;
  }

  return getMoneyValue(secondCustomer.totalSpentValue) - getMoneyValue(firstCustomer.totalSpentValue);
}

export function buildOverviewActions({
  customers,
  operationalTasks = [],
  services = [],
  today = new Date(),
  visits = [],
}: BuildOverviewActionsInput) {
  const todayKey = toDateKey(today);
  const actions: OverviewAction[] = [];
  const recoverableCustomers = customers
    .filter(isRecoverable)
    .filter(
      (customer) =>
        !isCustomerCompletedToday(customer.id, operationalTasks, todayKey),
    )
    .sort(sortByRecoveryPriority);

  recoverableCustomers.slice(0, 2).forEach((customer, index) => {
    const estimatedRecovery = getEstimatedRecovery(customer);
    const recoveryProbability = Math.round(
      getMoneyValue(customer.recoveryProbability),
    );
    const isUrgent =
      index === 0 &&
      (estimatedRecovery >= 300 ||
        recoveryProbability >= 70 ||
        customer.status === "Lost");

    actions.push({
      action: "open_link",
      badge: isUrgent ? "URGENTE" : "ALTA",
      customerId: customer.id,
      description: `${formatCurrency(estimatedRecovery)} recuperabili · ${recoveryProbability}% possibilità`,
      estimatedValue: estimatedRecovery,
      href: "/opportunita-ai",
      id: `recovery:${customer.id}:${todayKey}`,
      priority: isUrgent ? 10 : 20 + index,
      title: `Contatta ${customer.name}`,
      tone: isUrgent ? "urgent" : "medium",
      type: isUrgent ? "urgent_customer" : "recovery_customer",
    });
  });

  const lostCustomers = recoverableCustomers.filter(
    (customer) => customer.status === "Lost",
  );

  if (lostCustomers.length > 0) {
    actions.push({
      action: "create_campaign_draft",
      badge: "MARKETING",
      campaignDraft: {
        channel: "WhatsApp",
        objective: "Recuperare clienti",
        segment: "Selezione manuale clienti",
        selectedCustomerIds: lostCustomers.map((customer) => customer.id),
        selectedServices: [],
        source: "overview_lost_customers",
        title: "Campagna clienti persi",
      },
      customerIds: lostCustomers.map((customer) => customer.id),
      description: `${lostCustomers.length} clienti da riattivare con messaggi mirati`,
      href: "/campagne?new=1",
      id: `campaign:lost-customers:${todayKey}`,
      priority: 30,
      title: "Apri campagna clienti persi",
      tone: "medium",
      type: "lost_customers_campaign",
    });
  }

  const birthdayCustomers = getBirthdayCustomersThisMonth(customers, today);

  if (birthdayCustomers.length > 0) {
    actions.push({
      action: "create_campaign_draft",
      badge: "COMPLEANNO",
      campaignDraft: {
        channel: "WhatsApp",
        objective: "Compleanni",
        segment: "Compleanni del mese",
        selectedCustomerIds: birthdayCustomers.map((customer) => customer.id),
        selectedServices: [],
        source: "overview_birthdays",
        title: "Campagna compleanni",
      },
      customerIds: birthdayCustomers.map((customer) => customer.id),
      description: `${birthdayCustomers.length} clienti con compleanno da valorizzare`,
      href: "/campagne?new=1",
      id: `campaign:birthdays:${todayKey}`,
      priority: 40,
      title: "Campagna compleanni del mese",
      tone: "calm",
      type: "birthday_campaign",
    });
  }

  const incompleteProfiles = customers
    .map((customer) => ({
      customer,
      missingFields: getMissingProfileFields(customer),
    }))
    .filter((item) => item.missingFields.length > 0)
    .filter(
      (item) =>
        !isCustomerCompletedToday(item.customer.id, operationalTasks, todayKey),
    )
    .sort((first, second) => {
      const missingDifference =
        second.missingFields.length - first.missingFields.length;

      if (missingDifference !== 0) {
        return missingDifference;
      }

      const valueDifference =
        getMoneyValue(second.customer.totalSpentValue) -
        getMoneyValue(first.customer.totalSpentValue);

      if (valueDifference !== 0) {
        return valueDifference;
      }

      return String(second.customer.createdAt ?? "").localeCompare(
        String(first.customer.createdAt ?? ""),
      );
    });
  const topIncompleteProfile = incompleteProfiles[0];

  if (topIncompleteProfile) {
    actions.push({
      action: "open_link",
      badge: "DATI",
      customerId: topIncompleteProfile.customer.id,
      description: `Mancano: ${topIncompleteProfile.missingFields.join(", ")}${
        incompleteProfiles.length > 1
          ? ` · +${incompleteProfiles.length - 1} altri profili da completare`
          : ""
      }`,
      href: `/clients/${topIncompleteProfile.customer.id}`,
      id: `data_quality:${topIncompleteProfile.customer.id}:${todayKey}`,
      priority: 50,
      title: `Completa profilo ${topIncompleteProfile.customer.name}`,
      tone: "calm",
      type: "incomplete_profile",
    });
  }

  const unusedServices = getUnusedServices(services, visits);

  if (unusedServices.length > 0) {
    actions.push({
      action: "create_campaign_draft",
      badge: "CATALOGO",
      campaignDraft: {
        channel: "WhatsApp",
        objective: "Spingere servizi poco usati",
        segment: "Tutti",
        selectedCustomerIds: [],
        selectedServices: unusedServices.map((service) => ({
          category: service.category,
          duration: service.averageDurationMinutes,
          name: service.name,
          price: service.averagePrice,
        })),
        source: "overview_unused_services",
        title: "Campagna servizi inutilizzati",
      },
      description: `${unusedServices.length} servizi mai venduti: ${getPreviewNames(
        unusedServices.map((service) => service.name),
      )}`,
      href: "/campagne?new=1",
      id: `campaign:unused-services:${todayKey}`,
      priority: 60,
      title: "Spingi servizi inutilizzati",
      tone: "calm",
      type: "unused_services_campaign",
    });
  }

  const snoozedTasksToday = operationalTasks.filter(
    (task) => task.status === "snoozed" && task.date === todayKey,
  );

  if (snoozedTasksToday.length > 0) {
    actions.push({
      action: "open_link",
      badge: "RIMANDATA",
      description: `${snoozedTasksToday.length} attività da recuperare oggi`,
      href: "/agenda-ai",
      id: `snoozed:${todayKey}`,
      priority: 70,
      title: "Riprendi attività rimandate",
      tone: "calm",
      type: "snoozed_task",
    });
  }

  return actions
    .filter((action) => !isActionCompletedToday(action, operationalTasks, todayKey))
    .sort((first, second) => first.priority - second.priority);
}

export function getOverviewActionStatus({
  actionCount,
  completedToday,
}: {
  actionCount: number;
  completedToday: number;
}) {
  const totalToday = completedToday + actionCount;
  const percentage =
    totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;

  return {
    completedToday,
    percentage,
    totalToday,
  };
}
