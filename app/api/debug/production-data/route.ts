import { NextResponse } from "next/server";

import { getCurrentSalon } from "@/lib/currentSalon";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const fixedBeautyOsSalonId = "9dd2cbf4-5fdd-4219-88ab-64b8e83ff001";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getSupabaseUrlHost() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    return null;
  }

  try {
    return new URL(supabaseUrl).host;
  } catch {
    return null;
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const response = {
    ok: true,
    env: {
      hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      hasPublishableKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
      hasAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      supabaseUrlHost: getSupabaseUrlHost(),
    },
    auth: {
      userId: null as string | null,
      email: null as string | null,
      error: null as string | null,
    },
    currentSalon: {
      id: null as string | null,
      name: null as string | null,
      role: null as string | null,
    },
    counts: {
      customersForCurrentSalon: null as number | null,
      customersForFixedBeautyOsSalon: null as number | null,
    },
    errors: {
      currentSalonError: null as string | null,
      currentSalonCustomersError: null as string | null,
      fixedSalonCustomersError: null as string | null,
    },
  };

  if (!supabase) {
    response.auth.error = "Supabase server client non configurato.";

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  response.auth.userId = user?.id ?? null;
  response.auth.email = user?.email ?? null;
  response.auth.error = authError?.message ?? null;

  try {
    const currentSalon = await getCurrentSalon();

    response.currentSalon.id = currentSalon?.id ?? null;
    response.currentSalon.name = currentSalon?.name ?? null;
    response.currentSalon.role = currentSalon?.role ?? null;
  } catch (error) {
    response.errors.currentSalonError = getErrorMessage(error);
  }

  if (response.currentSalon.id) {
    const { count, error } = await supabase
      .from("customers")
      .select("*", { count: "exact", head: true })
      .eq("salon_id", response.currentSalon.id);

    response.counts.customersForCurrentSalon = count;
    response.errors.currentSalonCustomersError = error?.message ?? null;
  }

  const { count: fixedSalonCount, error: fixedSalonError } = await supabase
    .from("customers")
    .select("*", { count: "exact", head: true })
    .eq("salon_id", fixedBeautyOsSalonId);

  response.counts.customersForFixedBeautyOsSalon = fixedSalonCount;
  response.errors.fixedSalonCustomersError = fixedSalonError?.message ?? null;

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
