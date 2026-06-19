import { getCurrentSalon } from "@/lib/currentSalon";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  type AppointmentRow,
  type CustomerKpis,
  type CustomerRow,
  type EconomicDashboardKpis,
  mapAppointment,
  mapCustomer,
} from "./data";

const emptyCustomerKpis: CustomerKpis = {
  totalCustomers: 0,
  vipCount: 0,
  vipValue: 0,
  atRiskCount: 0,
  lostCount: 0,
};

const emptyEconomicDashboardKpis: EconomicDashboardKpis = {
  recoverableRevenue: 0,
  lostRevenue: 0,
  atRiskRevenue: 0,
  averageRecoveryProbability: 0,
  recoverableCustomerCount: 0,
};

export async function getCustomers(searchQuery = "", statusFilter = "") {
  const supabase = createSupabaseServerClient();
  const currentSalon = await getCurrentSalon();

  if (!supabase || !currentSalon) {
    return [];
  }

  let query = supabase
    .from("customers")
    .select(
      "id,first_name,last_name,phone,email,birth_date,gender,ai_status,retention_score,recovery_probability,total_spent,average_visit_frequency_days,last_visit_date,notes,created_at",
    )
    .eq("salon_id", currentSalon.id)
    .order("created_at", { ascending: false });

  const normalizedSearch = searchQuery.trim();

  if (normalizedSearch) {
    const escapedSearch = normalizedSearch.replaceAll("%", "\\%").replaceAll("_", "\\_");

    query = query.or(
      `first_name.ilike.%${escapedSearch}%,last_name.ilike.%${escapedSearch}%,phone.ilike.%${escapedSearch}%,email.ilike.%${escapedSearch}%`,
    );
  }

  const normalizedStatusFilter = statusFilter.trim();

  if (normalizedStatusFilter) {
    query = query.eq("ai_status", normalizedStatusFilter);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Errore Supabase getCustomers:", error);
    return [];
  }

  return (data as CustomerRow[]).map(mapCustomer);
}

export async function getRetentionCustomers() {
  const [atRisk, lost] = await Promise.all([
    getCustomers("", "A rischio"),
    getCustomers("", "Perso"),
  ]);

  return { atRisk, lost };
}

export async function getCustomerKpis(): Promise<CustomerKpis> {
  const supabase = createSupabaseServerClient();
  const currentSalon = await getCurrentSalon();

  if (!supabase || !currentSalon) {
    return emptyCustomerKpis;
  }

  const pageSize = 1000;
  let from = 0;
  const rows: Array<{
    ai_status: string | null;
    birth_date?: string | null;
    total_spent: number | null;
  }> = [];

  while (true) {
    const { data, error } = await supabase
      .from("customers")
      .select("birth_date,ai_status,total_spent")
      .eq("salon_id", currentSalon.id)
      .range(from, from + pageSize - 1);

    if (error) {
      console.error("Errore Supabase getCustomerKpis:", error);
      return emptyCustomerKpis;
    }

    const typedData = data as unknown as Array<{
      ai_status: string | null;
      birth_date?: string | null;
      recovery_probability?: number | null;
      total_spent: number | null;
    }>;

    rows.push(...typedData);

    if (typedData.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return rows.reduce<CustomerKpis>(
    (totals, row) => {
      const aiStatus = typeof row.ai_status === "string" ? row.ai_status.trim() : "";
      const totalSpent =
        typeof row.total_spent === "number" && Number.isFinite(row.total_spent)
          ? row.total_spent
          : 0;

      return {
        totalCustomers: totals.totalCustomers + 1,
        vipCount: aiStatus === "VIP" ? totals.vipCount + 1 : totals.vipCount,
        vipValue: aiStatus === "VIP" ? totals.vipValue + totalSpent : totals.vipValue,
        atRiskCount:
          aiStatus === "A rischio" ? totals.atRiskCount + 1 : totals.atRiskCount,
        lostCount: aiStatus === "Perso" ? totals.lostCount + 1 : totals.lostCount,
      };
    },
    {
      ...emptyCustomerKpis,
    },
  );
}

function calculateEconomicDashboardKpis(
  rows: Array<{
    ai_status: string | null;
    birth_date?: string | null;
    recovery_probability?: number | null;
    total_spent: number | null;
  }>,
): EconomicDashboardKpis {
  return rows.reduce<EconomicDashboardKpis>(
    (totals, row) => {
      const aiStatus = typeof row.ai_status === "string" ? row.ai_status.trim() : "";
      const totalSpent =
        typeof row.total_spent === "number" && Number.isFinite(row.total_spent)
          ? row.total_spent
          : 0;
      const recoveryProbability =
        typeof row.recovery_probability === "number" &&
        Number.isFinite(row.recovery_probability)
          ? row.recovery_probability
          : 0;
      const isRecoverable = aiStatus === "A rischio" || aiStatus === "Perso";

      if (!isRecoverable) {
        return totals;
      }

      return {
        recoverableRevenue: totals.recoverableRevenue + totalSpent,
        lostRevenue:
          aiStatus === "Perso" ? totals.lostRevenue + totalSpent : totals.lostRevenue,
        atRiskRevenue:
          aiStatus === "A rischio"
            ? totals.atRiskRevenue + totalSpent
            : totals.atRiskRevenue,
        averageRecoveryProbability:
          totals.averageRecoveryProbability + recoveryProbability,
        recoverableCustomerCount: totals.recoverableCustomerCount + 1,
      };
    },
    {
      ...emptyEconomicDashboardKpis,
    },
  );
}

export async function getEconomicDashboardKpis(): Promise<EconomicDashboardKpis> {
  const supabase = createSupabaseServerClient();
  const currentSalon = await getCurrentSalon();

  if (!supabase || !currentSalon) {
    return emptyEconomicDashboardKpis;
  }

  const pageSize = 1000;
  let from = 0;
  const rows: Array<{
    ai_status: string | null;
    birth_date?: string | null;
    recovery_probability?: number | null;
    total_spent: number | null;
  }> = [];
  let selectFields = "birth_date,ai_status,total_spent,recovery_probability";

  while (true) {
    const { data, error } = await supabase
      .from("customers")
      .select(selectFields)
      .eq("salon_id", currentSalon.id)
      .in("ai_status", ["A rischio", "Perso"])
      .range(from, from + pageSize - 1);

    if (
      error &&
      selectFields.includes("recovery_probability") &&
      error.message.includes("recovery_probability")
    ) {
      selectFields = "birth_date,ai_status,total_spent";
      from = 0;
      rows.length = 0;
      continue;
    }

    if (error) {
      console.error("Errore Supabase getEconomicDashboardKpis:", error);
      return emptyEconomicDashboardKpis;
    }

    const typedData = data as unknown as Array<{
      ai_status: string | null;
      recovery_probability?: number | null;
      total_spent: number | null;
    }>;

    rows.push(...typedData);

    if (typedData.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  const totals = calculateEconomicDashboardKpis(rows);

  return {
    ...totals,
    averageRecoveryProbability:
      totals.recoverableCustomerCount > 0
        ? Math.round(
            totals.averageRecoveryProbability / totals.recoverableCustomerCount,
          )
        : 0,
  };
}

export async function getCustomerById(id: string) {
  const supabase = createSupabaseServerClient();
  const currentSalon = await getCurrentSalon();

  if (!supabase || !currentSalon) {
    return null;
  }

  const { data, error } = await supabase
    .from("customers")
    .select(
      "id,first_name,last_name,phone,email,birth_date,gender,ai_status,retention_score,recovery_probability,total_spent,average_visit_frequency_days,last_visit_date,notes,created_at",
    )
    .eq("salon_id", currentSalon.id)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Errore Supabase getCustomerById:", error);
    return null;
  }

  return data ? mapCustomer(data as CustomerRow) : null;
}

export async function getAppointmentsByCustomerId(customerId: string) {
  const supabase = createSupabaseServerClient();
  const currentSalon = await getCurrentSalon();

  if (!supabase || !currentSalon) {
    return [];
  }

  const { data, error } = await supabase
    .from("appointments")
    .select("id,customer_id,service_name,service_price,appointment_date,notes,created_at")
    .eq("salon_id", currentSalon.id)
    .eq("customer_id", customerId)
    .order("appointment_date", { ascending: false });

  if (error) {
    const missingServicePrice =
      error.message.includes("service_price") ||
      error.details?.includes("service_price");

    if (missingServicePrice) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("appointments")
        .select("id,customer_id,service_name,amount,appointment_date,notes,created_at")
        .eq("salon_id", currentSalon.id)
        .eq("customer_id", customerId)
        .order("appointment_date", { ascending: false });

      if (!fallbackError) {
        return (fallbackData as AppointmentRow[]).map((row) =>
          mapAppointment({
            ...row,
            service_price: row.amount ?? 0,
          }),
        );
      }

      console.error("Errore Supabase getAppointmentsByCustomerId:", fallbackError);
      return [];
    }

    console.error("Errore Supabase getAppointmentsByCustomerId:", error);
    return [];
  }

  return (data as AppointmentRow[]).map(mapAppointment);
}

export async function getCustomerIds() {
  const supabase = createSupabaseServerClient();
  const currentSalon = await getCurrentSalon();

  if (!supabase || !currentSalon) {
    return [];
  }

  const { data, error } = await supabase
    .from("customers")
    .select("id")
    .eq("salon_id", currentSalon.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Errore Supabase getCustomerIds:", error);
    return [];
  }

  return data.map((row) => ({ id: row.id }));
}
