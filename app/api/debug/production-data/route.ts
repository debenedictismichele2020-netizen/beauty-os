import { NextResponse } from "next/server";

import { getCurrentSalon } from "@/lib/currentSalon";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const fixedBeautyOsSalonId = "9dd2cbf4-5fdd-4219-88ab-64b8e83ff001";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DebugSalonRecord = {
  id: string;
  name: string | null;
  slug: string | null;
};

type DebugMembershipRecord = {
  role: string | null;
  salon_id: string | null;
};

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
    currentSalonSource: null as "owner" | "membership" | null,
    directOwnerSalonQuery: null as DebugSalonRecord | null,
    directMembershipQuery: null as DebugMembershipRecord | null,
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

  if (user?.id) {
    const { data: directOwnerSalon } = await supabase
      .from("salons")
      .select("id,name,slug")
      .eq("owner_user_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<DebugSalonRecord>();

    const { data: directMembership } = await supabase
      .from("salon_members")
      .select("role,salon_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<DebugMembershipRecord>();

    response.directOwnerSalonQuery = directOwnerSalon ?? null;
    response.directMembershipQuery = directMembership ?? null;
  }

  try {
    const currentSalon = await getCurrentSalon();

    response.currentSalon.id = currentSalon?.id ?? null;
    response.currentSalon.name = currentSalon?.name ?? null;
    response.currentSalon.role = currentSalon?.role ?? null;
    response.currentSalonSource =
      currentSalon?.id && response.directOwnerSalonQuery?.id === currentSalon.id
        ? "owner"
        : currentSalon?.id &&
            response.directMembershipQuery?.salon_id === currentSalon.id
          ? "membership"
          : null;
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
