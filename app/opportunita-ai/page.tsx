import type { Metadata } from "next";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentSalon } from "@/lib/currentSalon";
import { PageHeader, PageShell } from "../components/BeautyUi";
import { formatCompactCurrency } from "../clients/data";
import OpportunityTable from "./OpportunityTable";

export const metadata: Metadata = {
  title: "Opportunità AI | Beauty OS",
  description: "Priorità giornaliera per recuperare clienti e fatturato.",
};

export const dynamic = "force-dynamic";

type OpportunityCustomer = {
  ai_status: string | null;
  first_name: string | null;
  id: string;
  last_name: string | null;
  phone: string | null;
  recovery_probability?: number | null;
  average_visit_frequency_days?: number | null;
  last_visit_date?: string | null;
  retention_score?: number | null;
  total_spent: number | null;
};

function getCustomerName(customer: OpportunityCustomer) {
  const name = `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim();

  return name || "Cliente senza nome";
}

function getMoneyValue(value: number | null | undefined) {
  const amount = Number(value ?? 0);

  return Number.isFinite(amount) ? amount : 0;
}

function getRecoveryProbability(customer: OpportunityCustomer) {
  const probability = Number(
    customer.recovery_probability ?? customer.retention_score ?? 0,
  );

  return Number.isFinite(probability)
    ? Math.max(0, Math.min(100, probability))
    : 0;
}

function getOpportunityScore(customer: OpportunityCustomer) {
  return getEstimatedRecovery(customer);
}

function getEstimatedRecovery(customer: OpportunityCustomer) {
  return (
    (getMoneyValue(customer.total_spent) * getRecoveryProbability(customer)) /
    100
  );
}

function differenceInDays(fromDate: string | null | undefined, toDate: string) {
  if (!fromDate) {
    return 0;
  }

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

async function getOpportunityData() {
  const supabase = createSupabaseServerClient();
  const currentSalon = await getCurrentSalon();

  if (!supabase || !currentSalon) {
    return {
      allCustomers: [] as OpportunityCustomer[],
      customers: [] as OpportunityCustomer[],
      error: "Configurazione Supabase non valida. Controlla le variabili ambiente.",
    };
  }

  const { data, error } = await supabase
    .from("customers")
    .select(
      "id,first_name,last_name,phone,birth_date,ai_status,total_spent,recovery_probability,last_visit_date,average_visit_frequency_days,retention_score",
    )
    .eq("salon_id", currentSalon.id);

  if (error) {
    console.error("Errore Supabase opportunità AI:", error);

    return {
      allCustomers: [] as OpportunityCustomer[],
      customers: [] as OpportunityCustomer[],
      error: `Dati opportunità non disponibili: ${error.message}`,
    };
  }

  const today = toDateKey(new Date());
  const allCustomers = data ?? [];
  const customers = allCustomers.filter(
    (customer) =>
      customer.ai_status === "A rischio" || customer.ai_status === "Perso",
  );
  const sortedCustomers = [...customers].sort(
    (firstCustomer, secondCustomer) => {
      const recoveryDifference =
        getOpportunityScore(secondCustomer) - getOpportunityScore(firstCustomer);

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
        differenceInDays(secondCustomer.last_visit_date, today) -
        differenceInDays(firstCustomer.last_visit_date, today)
      );
    },
  );

  return {
    allCustomers,
    customers: sortedCustomers,
    error: "",
  };
}

export default async function OpportunitaAiPage() {
  const { customers, error } = await getOpportunityData();
  const today = toDateKey(new Date());
  const recoverableRevenue = customers.reduce(
    (total, customer) => total + getEstimatedRecovery(customer),
    0,
  );
  const topOpportunity = customers[0] ?? null;
  const topOpportunityValue = topOpportunity
    ? getEstimatedRecovery(topOpportunity)
    : 0;
  const cards = [
    {
      detail: "Somma ponderata su clienti A rischio e Persi",
      label: "Recupero potenziale",
      value: formatCompactCurrency(recoverableRevenue),
    },
    {
      detail: "Clienti recuperabili da contattare",
      label: "Clienti da contattare",
      value: `${customers.length}`,
    },
    {
      detail: topOpportunity
        ? `${formatCompactCurrency(topOpportunityValue)} recuperabili`
        : "Nessun cliente recuperabile",
      label: "Migliore opportunità",
      value: topOpportunity ? getCustomerName(topOpportunity) : "Nessuna",
    },
    {
      detail: topOpportunity
        ? `Priorità massima: ${getCustomerName(topOpportunity)}`
        : "Nessuna priorità oggi",
      label: "Recupero stimato oggi",
      value: formatCompactCurrency(topOpportunityValue),
    },
  ];
  return (
    <PageShell
      active="Opportunità AI"
      sidebarEyebrow="Priorità operativa"
      sidebarText="Contatta prima i clienti con valore storico e probabilità di recupero più alti."
    >
      <PageHeader
        eyebrow="Motore recupero fatturato"
        subtitle="Chi contattare oggi, ordinato per valore stimato recuperabile."
        title="Opportunità AI"
      />

          {error ? (
            <div className="mt-6 rounded-[1.25rem] border border-rose-200 bg-rose-50 p-5 text-sm leading-6 text-rose-700">
              {error}
            </div>
          ) : null}

          <section className="grid gap-4 py-5 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) =>
              card.label === "Migliore opportunità" ? (
                <article
                  className="min-h-36 rounded-[1.35rem] border border-black/10 bg-white px-5 py-4 shadow-[0_18px_55px_rgba(0,0,0,0.06)]"
                  key={card.label}
                >
                  <p className="text-sm font-medium text-zinc-500">
                    {card.label}
                  </p>
                  <p className="mt-5 truncate text-3xl font-semibold tracking-tight text-black">
                    {card.value}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">
                    {card.detail}
                  </p>
                  {topOpportunity ? (
                    <span
                      className={`mt-3 inline-flex whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold ${getStatusBadgeStyles(
                        topOpportunity.ai_status,
                      )}`}
                    >
                      {topOpportunity.ai_status ?? "Non disponibile"}
                    </span>
                  ) : null}
                </article>
              ) : (
                <article
                  className="min-h-36 rounded-[1.35rem] border border-black/10 bg-white px-5 py-4 shadow-[0_18px_55px_rgba(0,0,0,0.06)]"
                  key={card.label}
                >
                  <p className="text-sm font-medium text-zinc-500">
                    {card.label}
                  </p>
                  <p className="mt-5 text-4xl font-semibold tracking-tight text-black">
                    {card.value}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">
                    {card.detail}
                  </p>
                </article>
              ),
            )}
          </section>

          <div className="pb-8">
            <OpportunityTable customers={customers} today={today} />
          </div>
    </PageShell>
  );
}
