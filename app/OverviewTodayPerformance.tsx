"use client";

import { useEffect, useMemo, useState } from "react";

import {
  getTodayDateKey,
  readOperationalTasks,
  type OperationalTask,
} from "@/lib/operationalTasks";
import {
  buildOverviewActions,
  type OverviewAction,
  type OverviewCustomer,
  type OverviewVisit,
} from "@/lib/overviewActions";
import { getActiveServices, readServiceCatalog } from "@/lib/serviceCatalog";
import { formatCompactCurrency } from "./clients/data";

type OverviewTodayPerformanceProps = {
  actions: OverviewAction[];
  customers: OverviewCustomer[];
  estimatedRecoverableRevenue: number;
  variant: "kpis" | "progress";
  visits: OverviewVisit[];
};

export default function OverviewTodayPerformance({
  actions,
  customers,
  estimatedRecoverableRevenue,
  variant,
  visits,
}: OverviewTodayPerformanceProps) {
  const [operationalTasks, setOperationalTasks] = useState<OperationalTask[]>(
    [],
  );
  const [runtimeActions, setRuntimeActions] =
    useState<OverviewAction[]>(actions);

  useEffect(() => {
    function refreshPerformance() {
      const nextOperationalTasks = readOperationalTasks();
      const nextServices = getActiveServices(readServiceCatalog());

      setOperationalTasks(nextOperationalTasks);
      setRuntimeActions(
        buildOverviewActions({
          customers,
          operationalTasks: nextOperationalTasks,
          services: nextServices,
          visits,
        }),
      );
    }

    refreshPerformance();
    window.addEventListener("storage", refreshPerformance);
    window.addEventListener("focus", refreshPerformance);
    window.addEventListener(
      "beauty-os-customer-managed",
      refreshPerformance,
    );
    window.addEventListener(
      "beauty-os-operational-tasks-updated",
      refreshPerformance,
    );

    return () => {
      window.removeEventListener("storage", refreshPerformance);
      window.removeEventListener("focus", refreshPerformance);
      window.removeEventListener(
        "beauty-os-customer-managed",
        refreshPerformance,
      );
      window.removeEventListener(
        "beauty-os-operational-tasks-updated",
        refreshPerformance,
      );
    };
  }, [customers, visits]);

  const completedTasksToday = useMemo(
    () =>
      operationalTasks.filter(
        (task) =>
          task.status === "completed" && task.date === getTodayDateKey(),
      ),
    [operationalTasks],
  );
  const completedActions = completedTasksToday.length;
  const activeOpportunities = runtimeActions.length;
  const totalActions = completedActions + activeOpportunities;
  const recoveredToday = completedTasksToday.reduce(
    (total, task) => total + task.estimatedValue,
    0,
  );
  const recoveryProgress =
    estimatedRecoverableRevenue > 0
      ? Math.min(
          100,
          Math.round((recoveredToday / estimatedRecoverableRevenue) * 100),
        )
      : 0;
  const customerProbabilityById = useMemo(
    () =>
      new Map(
        customers.map((customer) => [
          customer.id,
          customer.recoveryProbability ?? 0,
        ]),
      ),
    [customers],
  );
  const openRecoveryProbabilities = runtimeActions.flatMap((action) => {
    if (!action.customerId) {
      return [];
    }

    const probability = customerProbabilityById.get(action.customerId);

    return probability === undefined ? [] : [probability];
  });
  const averageRecoveryProbability =
    openRecoveryProbabilities.length > 0
      ? Math.round(
          openRecoveryProbabilities.reduce(
            (total, probability) => total + probability,
            0,
          ) / openRecoveryProbabilities.length,
        )
      : 0;
  const kpis = [
    {
      detail: "Azioni consigliate dall’AI per oggi",
      label: "Opportunità attive",
      value: `${activeOpportunities}`,
    },
    {
      detail: "Progressi operativi della giornata",
      label: "Azioni completate",
      value: `${completedActions} / ${totalActions}`,
    },
    {
      detail: "Media stimata sulle opportunità aperte",
      label: "Probabilità media",
      value: `${averageRecoveryProbability}%`,
    },
  ];

  if (variant === "kpis") {
    return (
      <section className="grid gap-4 sm:grid-cols-3">
        {kpis.map((kpi) => (
          <article
            className="rounded-[1.35rem] border border-black/10 bg-white p-5 shadow-[0_18px_55px_rgba(0,0,0,0.06)]"
            key={kpi.label}
          >
            <p className="text-sm font-medium text-zinc-500">{kpi.label}</p>
            <p className="mt-6 break-words text-3xl font-semibold tracking-tight text-black">
              {kpi.value}
            </p>
            <p className="mt-3 text-sm leading-6 text-zinc-500">{kpi.detail}</p>
          </article>
        ))}
      </section>
    );
  }

  return (
    <section className="mt-6">
      <p className="mb-3 text-xs font-medium uppercase tracking-[0.22em] text-zinc-400">
        Progresso di oggi
      </p>
      <article className="rounded-[1.5rem] border border-black/10 bg-white p-5 shadow-[0_22px_70px_rgba(0,0,0,0.07)] sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500">
              Recupero operativo
            </p>
            <p className="mt-3 text-4xl font-semibold tracking-tight text-black sm:text-5xl">
              {formatCompactCurrency(recoveredToday)}
            </p>
            <p className="mt-2 text-sm text-zinc-500">
              su {formatCompactCurrency(estimatedRecoverableRevenue)} stimati
            </p>
          </div>
          <div className="sm:text-right">
            <p className="text-2xl font-semibold tracking-tight text-black">
              {recoveryProgress}%
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              {completedActions} di {totalActions} azioni completate
            </p>
          </div>
        </div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-black transition-all duration-500"
            style={{ width: `${recoveryProgress}%` }}
          />
        </div>
      </article>
    </section>
  );
}
