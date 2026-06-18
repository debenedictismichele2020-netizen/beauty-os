"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  getTodayDateKey,
  readOperationalTasks,
  type OperationalTask,
} from "@/lib/operationalTasks";
import {
  buildOverviewActions,
  getOverviewActionStatus,
  type OverviewAction,
  type OverviewCustomer,
  type OverviewVisit,
} from "@/lib/overviewActions";
import { getActiveServices, readServiceCatalog } from "@/lib/serviceCatalog";
import OverviewCampaignActionLink from "./OverviewCampaignActionLink";

export type OverviewAgendaAction = OverviewAction;

type OverviewAgendaActionsListProps = {
  actions: OverviewAgendaAction[];
  customers: OverviewCustomer[];
  visits: OverviewVisit[];
};

function getBadgeStyles(tone: OverviewAgendaAction["tone"]) {
  if (tone === "urgent") {
    return "bg-black text-white";
  }

  if (tone === "medium") {
    return "bg-amber-100 text-amber-800";
  }

  return "bg-zinc-100 text-zinc-700";
}

export default function OverviewAgendaActionsList({
  actions,
  customers,
  visits,
}: OverviewAgendaActionsListProps) {
  const [operationalTasks, setOperationalTasks] = useState<OperationalTask[]>(
    [],
  );
  const [runtimeActions, setRuntimeActions] =
    useState<OverviewAgendaAction[]>(actions);

  useEffect(() => {
    function refreshActions() {
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

    refreshActions();
    window.addEventListener("storage", refreshActions);
    window.addEventListener("focus", refreshActions);
    window.addEventListener("beauty-os-customer-managed", refreshActions);

    return () => {
      window.removeEventListener("storage", refreshActions);
      window.removeEventListener("focus", refreshActions);
      window.removeEventListener("beauty-os-customer-managed", refreshActions);
    };
  }, [customers, visits]);

  const visibleActions = useMemo(
    () => runtimeActions.slice(0, 4),
    [runtimeActions],
  );
  const completedToday = operationalTasks.filter(
    (task) => task.status === "completed" && task.date === getTodayDateKey(),
  ).length;
  const actionStatus = getOverviewActionStatus({
    actionCount: visibleActions.length,
    completedToday,
  });

  const statusBlock =
    actionStatus.totalToday > 0 ? (
      <div className="mt-4 rounded-[1.15rem] border border-black/10 bg-white p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
              Operatività oggi
            </p>
            <p className="mt-2 text-sm font-semibold text-black">
              {actionStatus.completedToday} / {actionStatus.totalToday} azioni
              completate
            </p>
          </div>
          <span className="text-sm font-semibold text-zinc-700">
            {actionStatus.percentage}%
          </span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-black transition-all"
            style={{ width: `${actionStatus.percentage}%` }}
          />
        </div>
      </div>
    ) : (
      <div className="mt-4 rounded-[1.15rem] border border-black/10 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
          Operatività oggi
        </p>
        <p className="mt-2 text-sm font-semibold text-black">
          0 azioni urgenti
        </p>
      </div>
    );

  const actionsBlock = useMemo(
    () =>
      visibleActions.length === 0 ? (
        <div className="mt-3 rounded-[1.15rem] border border-black/10 bg-[#f7f7f5] p-5">
          <h3 className="text-sm font-semibold text-black">
            Nessuna azione urgente oggi
          </h3>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Beauty OS continuerà a monitorare clienti, campagne e opportunità.
          </p>
        </div>
      ) : (
        <div className="mt-3 grid gap-3">
          {visibleActions.map((action) =>
            action.action === "create_campaign_draft" && action.campaignDraft ? (
              <OverviewCampaignActionLink
                className="group flex cursor-pointer flex-col gap-3 rounded-[1.15rem] border border-black/10 bg-[#f7f7f5] p-4 transition hover:border-black/20 hover:bg-white sm:flex-row sm:items-center sm:justify-between"
                draft={action.campaignDraft}
                key={action.id}
              >
                <AgendaActionContent action={action} />
              </OverviewCampaignActionLink>
            ) : (
              <Link
                className={`group flex cursor-pointer flex-col gap-3 rounded-[1.15rem] border border-black/10 bg-[#f7f7f5] p-4 transition-all hover:border-black/20 hover:bg-white sm:flex-row sm:items-center sm:justify-between ${
                  action.type === "incomplete_profile"
                    ? "ring-1 ring-zinc-200 hover:ring-black/20"
                    : ""
                }`}
                href={action.href ?? "/agenda-ai"}
                key={action.id}
              >
                <AgendaActionContent action={action} />
              </Link>
            ),
          )}
        </div>
      ),
    [visibleActions],
  );

  return (
    <>
      {statusBlock}
      {actionsBlock}
    </>
  );
}

function AgendaActionContent({ action }: { action: OverviewAgendaAction }) {
  return (
    <>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-black">{action.title}</h3>
          <span
            className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${getBadgeStyles(action.tone)}`}
          >
            {action.badge}
          </span>
          {action.type === "incomplete_profile" ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500">
              <span className="size-1.5 animate-pulse rounded-full bg-amber-400" />
              da completare
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          {action.description}
        </p>
      </div>
      <span className="shrink-0 text-sm font-semibold text-black transition group-hover:translate-x-0.5">
        Apri
      </span>
    </>
  );
}
