"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";

type OverviewCampaignDraft = {
  channel: "WhatsApp";
  createdAt: string;
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

type OverviewCampaignActionLinkProps = {
  children: ReactNode;
  className: string;
  customerIds?: string[];
  draft?: Omit<OverviewCampaignDraft, "createdAt">;
};

const customCampaignDraftStorageKey = "beauty_os_custom_campaign_draft";

export default function OverviewCampaignActionLink({
  children,
  className,
  customerIds = [],
  draft,
}: OverviewCampaignActionLinkProps) {
  const [message, setMessage] = useState("");

  function createDraft() {
    const selectedCustomerIds = draft?.selectedCustomerIds ?? customerIds;
    const selectedServices = draft?.selectedServices ?? [];

    if (selectedCustomerIds.length === 0 && selectedServices.length === 0) {
      setMessage("Nessun cliente perso disponibile per questa campagna.");
      return false;
    }

    const nextDraft: OverviewCampaignDraft = {
      channel: "WhatsApp",
      createdAt: new Date().toISOString(),
      objective: draft?.objective ?? "Recuperare clienti",
      segment: draft?.segment ?? "Selezione manuale clienti",
      selectedCustomerIds,
      selectedServices,
      source: draft?.source ?? "overview_lost_customers",
      title: draft?.title ?? "Campagna clienti persi",
    };

    window.localStorage.setItem(
      customCampaignDraftStorageKey,
      JSON.stringify(nextDraft),
    );

    return true;
  }

  return (
    <div>
      <Link
        className={className}
        href="/campagne?new=1"
        onClick={(event) => {
          if (!createDraft()) {
            event.preventDefault();
          }
        }}
      >
        {children}
      </Link>
      {message ? (
        <p className="mt-2 rounded-[0.9rem] border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {message}
        </p>
      ) : null}
    </div>
  );
}
