"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { readOperationalTasks } from "@/lib/operationalTasks";
import {
  buildOverviewActions,
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
  const [runtimeActions, setRuntimeActions] =
    useState<OverviewAgendaAction[]>(actions);

  useEffect(() => {
    function refreshActions() {
      const nextOperationalTasks = readOperationalTasks();
      const nextServices = getActiveServices(readServiceCatalog());

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
    window.addEventListener(
      "beauty-os-operational-tasks-updated",
      refreshActions,
    );

    return () => {
      window.removeEventListener("storage", refreshActions);
      window.removeEventListener("focus", refreshActions);
      window.removeEventListener("beauty-os-customer-managed", refreshActions);
      window.removeEventListener(
        "beauty-os-operational-tasks-updated",
        refreshActions,
      );
    };
  }, [customers, visits]);

  const visibleActions = useMemo(
    () => runtimeActions.slice(0, 4),
    [runtimeActions],
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

  return actionsBlock;
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
