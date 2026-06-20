import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader, PageShell } from "../components/BeautyUi";
import AddCustomerModal from "./AddCustomerModal";
import ClientTableRow from "./ClientTableRow";
import CustomerSearch from "./CustomerSearch";
import StatusFilters from "./StatusFilters";
import {
  type Customer,
  statusLabels,
  statusStyles,
} from "./data";
import { getCustomers } from "./serverData";

export const metadata: Metadata = {
  title: "Clienti | Beauty OS",
  description: "Intelligence clienti per il CRM Beauty OS.",
};

export const dynamic = "force-dynamic";

type ClientsPageProps = {
  searchParams: Promise<{ deleted?: string; q?: string; status?: string }>;
};

type ClientPriority = "Urgente" | "Monitorare" | "Stabile";

const priorityStyles: Record<ClientPriority, string> = {
  Urgente: "border-rose-200 bg-rose-50 text-rose-700",
  Monitorare: "border-amber-200 bg-amber-50 text-amber-800",
  Stabile: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const validStatusFilters = new Set(["VIP", "Fedele", "A rischio", "Perso"]);

function isRecoverableCustomer(customer: Customer) {
  return customer.status === "At Risk" || customer.status === "Lost";
}

function getClientPriority(
  customer: Customer,
  averageCustomerValue: number,
): ClientPriority {
  const isRecoverable = isRecoverableCustomer(customer);

  if (!isRecoverable) {
    return "Stabile";
  }

  if (
    customer.totalSpentValue > averageCustomerValue ||
    customer.recoveryProbability >= 60
  ) {
    return "Urgente";
  }

  if (customer.recoveryProbability < 30) {
    return "Stabile";
  }

  if (customer.recoveryProbability >= 30 || isRecoverable) {
    return "Monitorare";
  }

  return "Stabile";
}

function getPriorityRank(priority: ClientPriority) {
  if (priority === "Urgente") {
    return 3;
  }

  if (priority === "Monitorare") {
    return 2;
  }

  return 1;
}

function buildClientInsight(
  customers: Customer[],
  averageCustomerValue: number,
) {
  const monitoredCustomers = customers
    .filter(isRecoverableCustomer)
    .map((customer) => ({
      customer,
      priority: getClientPriority(customer, averageCustomerValue),
    }))
    .sort((first, second) => {
      const priorityDifference =
        getPriorityRank(second.priority) - getPriorityRank(first.priority);

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      return (
        second.customer.totalSpentValue * second.customer.recoveryProbability -
        first.customer.totalSpentValue * first.customer.recoveryProbability
      );
    });

  if (monitoredCustomers.length === 0) {
    return "La base clienti è stabile. Continua a monitorare le nuove inattività.";
  }

  const topCustomer = monitoredCustomers[0].customer;

  return `Ci sono ${monitoredCustomers.length} clienti da monitorare. La priorità più alta è ${topCustomer.name}.`;
}

function isProfileIncomplete(customer: Customer) {
  return (
    !customer.birth_date ||
    !customer.phone ||
    customer.phone === "Telefono non inserito" ||
    !customer.gender ||
    customer.gender === "Non specificato" ||
    !customer.notes ||
    customer.notes === "Nessuna nota cliente inserita."
  );
}

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const { deleted, q, status } = await searchParams;
  const searchQuery = q?.trim() ?? "";
  const activeStatus = status?.trim() ?? "";
  const validActiveStatus = validStatusFilters.has(activeStatus) ? activeStatus : "";
  const customers = await getCustomers(searchQuery, validActiveStatus);
  const averageCustomerValue =
    customers.length > 0
      ? customers.reduce(
          (total, customer) => total + customer.totalSpentValue,
          0,
        ) / customers.length
      : 0;
  const sidebarInsight = buildClientInsight(customers, averageCustomerValue);
  const profilesToComplete = customers.filter(isProfileIncomplete).length;
  const summary = [
    {
      label: "Clienti totali",
      value: `${customers.length}`,
      detail: "Persone presenti in anagrafica",
    },
    {
      label: "VIP",
      value: `${customers.filter((customer) => customer.status === "VIP").length}`,
      detail: "Clienti principali da seguire con cura",
    },
    {
      label: "A rischio",
      value: `${customers.filter((customer) => customer.status === "At Risk").length}`,
      detail: "Persone da monitorare rapidamente",
    },
    {
      label: "Persi",
      value: `${customers.filter((customer) => customer.status === "Lost").length}`,
      detail: "Profili da valutare per recupero",
    },
    {
      label: "Profili da completare",
      value: `${profilesToComplete}`,
      detail: "Mancano data nascita, telefono, genere o note",
    },
  ];

  return (
    <PageShell
      active="Clienti"
      sidebarEyebrow="Insight clienti"
      sidebarText={sidebarInsight}
    >
          {deleted === "1" ? (
            <div className="mb-5 rounded-[1.25rem] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700 shadow-[0_18px_55px_rgba(0,0,0,0.04)]">
              Cliente eliminato con successo
            </div>
          ) : null}

          <PageHeader
            eyebrow="Intelligence clienti"
            subtitle="Persone, ricerca, stato cliente e azioni rapide in una vista pulita per il lavoro quotidiano."
            title="Clienti"
          />

          <section className="grid gap-3 py-6 sm:grid-cols-2 xl:grid-cols-5">
            {summary.map((item) => (
              <article
                className="rounded-[1.15rem] border border-black/10 bg-white p-4 shadow-[0_14px_38px_rgba(0,0,0,0.045)]"
                key={item.label}
              >
                <p className="text-sm font-medium text-zinc-500">
                  {item.label}
                </p>
                <p className="mt-5 text-3xl font-semibold tracking-tight text-black">
                  {item.value}
                </p>
                <p className="mt-2 text-xs leading-5 text-zinc-500">
                  {item.detail}
                </p>
              </article>
            ))}
          </section>

          <section className="mb-5 rounded-[1.5rem] border border-black/10 bg-white p-5 shadow-[0_18px_55px_rgba(0,0,0,0.055)]">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-400">
                  Azioni rapide
                </p>
                <h2 className="mt-2 text-lg font-semibold tracking-tight text-black">
                  Azioni rapide
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  className="rounded-full bg-black px-4 py-2.5 text-sm font-medium text-white shadow-[0_14px_35px_rgba(0,0,0,0.18)] transition hover:bg-zinc-800"
                  href="/opportunita-ai"
                >
                  Contatta clienti a rischio
                </Link>
                <Link
                  className="rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 hover:text-zinc-950"
                  href="/opportunita-ai"
                >
                  Apri opportunità AI
                </Link>
                <Link
                  className="rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 hover:text-zinc-950"
                  href="/campagne"
                >
                  Nuova campagna
                </Link>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-[1.5rem] border border-black/10 bg-white shadow-[0_22px_70px_rgba(0,0,0,0.07)]">
            <div className="flex flex-col gap-3 border-b border-black/10 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">
                  Anagrafica clienti
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Dati CRM con classificazione AI di fidelizzazione.
                </p>
              </div>
              <AddCustomerModal />
            </div>

            <CustomerSearch initialQuery={searchQuery} />
            <StatusFilters
              activeStatus={validActiveStatus}
              searchQuery={searchQuery}
            />

            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[960px] border-collapse text-left">
                <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  <tr>
                    <th className="min-w-[320px] px-5 py-4">Cliente</th>
                    <th className="min-w-[170px] px-5 py-4">Ultima visita</th>
                    <th className="min-w-[130px] px-5 py-4">Valore</th>
                    <th className="min-w-[130px] px-5 py-4">Stato AI</th>
                    <th className="min-w-[140px] px-5 py-4">Priorità AI</th>
                    <th className="min-w-[160px] px-5 py-4">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/10">
                  {customers.length > 0 ? (
                    customers.map((customer) => {
                      const priority = getClientPriority(
                        customer,
                        averageCustomerValue,
                      );

                      return (
                        <ClientTableRow
                          customer={customer}
                          key={customer.id}
                          priorityClassName={priorityStyles[priority]}
                          priorityLabel={priority}
                          statusClassName={statusStyles[customer.status]}
                          statusLabel={statusLabels[customer.status]}
                        />
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        className="px-5 py-12 text-center text-sm font-medium text-zinc-500"
                        colSpan={6}
                      >
                        Nessun cliente trovato
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
    </PageShell>
  );
}
