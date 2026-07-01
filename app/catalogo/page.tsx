import type { Metadata } from "next";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentSalon } from "@/lib/currentSalon";
import { PageShell } from "../components/BeautyUi";
import ServiceCatalogManager from "./ServiceCatalogManager";

export const metadata: Metadata = {
  title: "Catalogo servizi | Beauty OS",
  description: "Gestione servizi, prezzi e durata del salone Beauty OS.",
};

export const dynamic = "force-dynamic";

export type CatalogAppointmentUsage = {
  amount: number;
  appointmentDate: string | null;
  serviceName: string;
};

function getMoneyValue(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);

  return Number.isFinite(amount) ? amount : 0;
}

async function getCatalogAppointmentUsage() {
  const supabase = await createSupabaseServerClient();
  const currentSalon = await getCurrentSalon();

  if (!supabase || !currentSalon) {
    return [];
  }

  const { data, error } = await supabase
    .from("appointments")
    .select("service_name,service_price,appointment_date")
    .eq("salon_id", currentSalon.id);

  if (!error) {
    return (data ?? []).flatMap((appointment) => {
      if (!appointment.service_name) {
        return [];
      }

      return [
        {
          amount: getMoneyValue(appointment.service_price),
          appointmentDate: appointment.appointment_date,
          serviceName: appointment.service_name,
        },
      ];
    });
  }

  const fallback = await supabase
    .from("appointments")
    .select("service_name,amount,appointment_date")
    .eq("salon_id", currentSalon.id);

  if (fallback.error) {
    console.error("Errore Supabase insight catalogo:", fallback.error);

    return [];
  }

  return (fallback.data ?? []).flatMap((appointment) => {
    if (!appointment.service_name) {
      return [];
    }

    return [
      {
        amount: getMoneyValue(appointment.amount),
        appointmentDate: appointment.appointment_date,
        serviceName: appointment.service_name,
      },
    ];
  });
}

export default async function CatalogoPage() {
  const currentSalon = await getCurrentSalon();
  const appointmentUsage = await getCatalogAppointmentUsage();

  return (
    <PageShell
      active="Catalogo"
      sidebarEyebrow="Catalogo"
      sidebarText="Gestisci servizi, prezzi e durata del tuo salone."
    >
      <ServiceCatalogManager
        appointmentUsage={appointmentUsage}
        salonId={currentSalon?.id ?? ""}
      />
    </PageShell>
  );
}
