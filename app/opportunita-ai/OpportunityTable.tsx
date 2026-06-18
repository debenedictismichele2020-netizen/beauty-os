"use client";

import { useEffect, useMemo, useState } from "react";

import { type OperationalTask, readOperationalTasks } from "@/lib/operationalTasks";
import OpportunityActions from "./OpportunityActions";

export type OpportunityCustomerForTable = {
  ai_status: string | null;
  average_visit_frequency_days?: number | null;
  first_name: string | null;
  id: string;
  last_name: string | null;
  last_visit_date?: string | null;
  phone: string | null;
  recovery_probability?: number | null;
  retention_score?: number | null;
  total_spent: number | null;
};

type FilterKey = "all" | "at-risk" | "lost" | "high-value" | "high-probability";

const filters: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "Tutti" },
  { key: "at-risk", label: "A rischio" },
  { key: "lost", label: "Persi" },
  { key: "high-value", label: "Alto valore" },
  { key: "high-probability", label: "Alta probabilità" },
];

function getCustomerName(customer: OpportunityCustomerForTable) {
  const name = `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim();

  return name || "Cliente senza nome";
}

function getMoneyValue(value: number | null | undefined) {
  const amount = Number(value ?? 0);

  return Number.isFinite(amount) ? amount : 0;
}

function getRecoveryProbability(customer: OpportunityCustomerForTable) {
  const probability = Number(
    customer.recovery_probability ?? customer.retention_score ?? 0,
  );

  return Number.isFinite(probability)
    ? Math.max(0, Math.min(100, probability))
    : 0;
}

function getEstimatedRecovery(customer: OpportunityCustomerForTable) {
  return (
    (getMoneyValue(customer.total_spent) * getRecoveryProbability(customer)) /
    100
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("it-IT", {
    currency: "EUR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: 0,
    style: "percent",
  }).format(value / 100);
}

function getStatusBadgeStyles(status: string | null) {
  const normalizedStatus = typeof status === "string" ? status.trim() : "";

  if (normalizedStatus === "A rischio") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  if (normalizedStatus === "Perso") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (normalizedStatus === "VIP") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (normalizedStatus === "Fedele") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  return "border-zinc-200 bg-zinc-50 text-zinc-700";
}

function differenceInDays(fromDate: string, toDate: string) {
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);

  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 86_400_000));
}

function getOpportunityReason({
  averageRecoverableValue,
  customer,
  today,
}: {
  averageRecoverableValue: number;
  customer: OpportunityCustomerForTable;
  today: string;
}) {
  const daysSinceLastVisit = customer.last_visit_date
    ? differenceInDays(customer.last_visit_date, today)
    : null;
  const totalSpent = getMoneyValue(customer.total_spent);
  const probability = getRecoveryProbability(customer);
  const status = customer.ai_status?.trim();
  const isHighValue = totalSpent > averageRecoverableValue;

  if (status === "Perso") {
    return isHighValue ? "Cliente perso ad alto valore" : "Cliente perso da recuperare";
  }

  if (daysSinceLastVisit !== null && daysSinceLastVisit >= 90) {
    return `Assente da ${daysSinceLastVisit} giorni`;
  }

  if (daysSinceLastVisit !== null && daysSinceLastVisit >= 61) {
    return "Ultima visita oltre la media";
  }

  if (daysSinceLastVisit !== null && daysSinceLastVisit >= 31) {
    return "Frequenza in rallentamento";
  }

  if (probability >= 60) {
    return "Alta probabilità di ritorno";
  }

  if (isHighValue && probability < 60) {
    return "Valore alto, rischio medio";
  }

  if (daysSinceLastVisit !== null && daysSinceLastVisit >= 0) {
    return "Cliente recente da monitorare";
  }

  return "Dati cliente da completare";
}

function getAiPriority({
  averageRecoverableValue,
  customer,
}: {
  averageRecoverableValue: number;
  customer: OpportunityCustomerForTable;
}) {
  const estimatedRecovery = getEstimatedRecovery(customer);
  const probability = getRecoveryProbability(customer);
  const totalSpent = getMoneyValue(customer.total_spent);
  const status = customer.ai_status?.trim();
  const highHistoricalValue = totalSpent >= Math.max(300, averageRecoverableValue);

  if (
    estimatedRecovery >= 300 ||
    probability >= 70 ||
    (status === "Perso" && highHistoricalValue)
  ) {
    return "Alta";
  }

  if (estimatedRecovery >= 100 || probability >= 40) {
    return "Media";
  }

  return "Bassa";
}

function getPriorityBadgeStyles(priority: string) {
  if (priority === "Alta") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (priority === "Media") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

export default function OpportunityTable({
  customers,
  today,
}: {
  customers: OpportunityCustomerForTable[];
  today: string;
}) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [operationalTasks, setOperationalTasks] = useState<OperationalTask[]>([]);
  const averageRecoverableValue =
    customers.length > 0
      ? customers.reduce(
          (total, customer) => total + getMoneyValue(customer.total_spent),
          0,
        ) / customers.length
      : 0;
  useEffect(() => {
    const readTasks = () => setOperationalTasks(readOperationalTasks());

    readTasks();
    window.addEventListener("storage", readTasks);

    return () => window.removeEventListener("storage", readTasks);
  }, []);

  const completedRecoveryCustomerIds = useMemo(
    () =>
      new Set(
        operationalTasks
          .filter(
            (task) =>
              task.date === today &&
              task.type === "recovery" &&
              task.status === "completed" &&
              task.customerId,
          )
          .map((task) => task.customerId as string),
      ),
    [operationalTasks, today],
  );

  const filteredCustomers = useMemo(() => {
    return customers
      .filter((customer) => {
        if (completedRecoveryCustomerIds.has(customer.id)) {
          return false;
        }

        const status = customer.ai_status?.trim();

        if (activeFilter === "at-risk") {
          return status === "A rischio";
        }

        if (activeFilter === "lost") {
          return status === "Perso";
        }

        if (activeFilter === "high-value") {
          return getMoneyValue(customer.total_spent) > averageRecoverableValue;
        }

        if (activeFilter === "high-probability") {
          return getRecoveryProbability(customer) >= 60;
        }

        return true;
      })
      .sort((firstCustomer, secondCustomer) => {
        const recoveryDifference =
          getEstimatedRecovery(secondCustomer) - getEstimatedRecovery(firstCustomer);

        if (recoveryDifference !== 0) {
          return recoveryDifference;
        }

        const probabilityDifference =
          getRecoveryProbability(secondCustomer) -
          getRecoveryProbability(firstCustomer);

        if (probabilityDifference !== 0) {
          return probabilityDifference;
        }

        return (
          differenceInDays(secondCustomer.last_visit_date ?? "", today) -
          differenceInDays(firstCustomer.last_visit_date ?? "", today)
        );
      });
  }, [activeFilter, averageRecoverableValue, completedRecoveryCustomerIds, customers, today]);

  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-black/10 bg-white shadow-[0_22px_70px_rgba(0,0,0,0.07)]">
      <div className="border-b border-black/10 p-4">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-400">
          Azioni consigliate oggi
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          Ordinate per valore stimato recuperabile.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-black/[0.06] px-4 py-3">
        {filters.map((filter) => {
          const isActive = activeFilter === filter.key;

          return (
            <button
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                isActive
                  ? "bg-black text-white shadow-sm"
                  : "border border-black/10 bg-white text-zinc-600 shadow-sm hover:bg-zinc-50 hover:text-zinc-950"
              }`}
              key={filter.key}
              onClick={() => setActiveFilter(filter.key)}
              type="button"
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {filteredCustomers.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1060px] border-collapse text-left">
            <thead className="bg-[#f7f7f5] text-xs uppercase tracking-[0.16em] text-zinc-400">
              <tr>
                <th className="min-w-[210px] px-4 py-3 font-medium">Cliente</th>
                <th className="min-w-[115px] px-4 py-3 font-medium">Stato</th>
                <th className="min-w-[130px] px-4 py-3 font-medium">
                  Recupero stimato
                </th>
                <th className="min-w-[115px] px-4 py-3 font-medium">
                  Possibilità recupero
                </th>
                <th className="min-w-[120px] px-4 py-3 font-medium">Priorità AI</th>
                <th className="min-w-[190px] px-4 py-3 font-medium">Motivo</th>
                <th className="min-w-[180px] px-4 py-3 font-medium">Azione</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {filteredCustomers.map((customer) => {
                const reason = getOpportunityReason({
                  averageRecoverableValue,
                  customer,
                  today,
                });
                const priority = getAiPriority({
                  averageRecoverableValue,
                  customer,
                });
                const estimatedRecovery = getEstimatedRecovery(customer);
                const recoveryProbability = getRecoveryProbability(customer);

                return (
                  <tr
                    className="transition hover:bg-[#fafafa]"
                    key={customer.id}
                  >
                    <td className="px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium tracking-tight text-black">
                          {getCustomerName(customer)}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-zinc-400">
                          ultimo contatto non disponibile
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex w-fit whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold ${getStatusBadgeStyles(
                          customer.ai_status,
                        )}`}
                      >
                        {customer.ai_status ?? "Non disponibile"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-zinc-900">
                      {formatCurrency(estimatedRecovery)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-zinc-900">
                      <span>{formatPercent(recoveryProbability)}</span>
                      <span className="mt-1 block h-1 overflow-hidden rounded-full bg-zinc-100">
                        <span
                          className="block h-full rounded-full bg-black"
                          style={{
                            width: `${recoveryProbability}%`,
                          }}
                        />
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex w-fit whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold ${getPriorityBadgeStyles(
                          priority,
                        )}`}
                      >
                        {priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm leading-5 text-zinc-600">
                      {reason}
                    </td>
                    <td className="px-4 py-3">
                      <OpportunityActions
                        customerId={customer.id}
                        customerName={getCustomerName(customer)}
                        estimatedValue={estimatedRecovery}
                        phone={customer.phone ?? ""}
                        priority={priority}
                        reason={reason}
                        recoveryProbability={recoveryProbability}
                        today={today}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid min-h-64 place-items-center p-8 text-center">
          <div>
            <p className="text-base font-semibold tracking-tight text-black">
              Nessuna opportunità urgente oggi
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              Il CRM continuerà a monitorare clienti inattivi, compleanni e
              valore recuperabile.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
