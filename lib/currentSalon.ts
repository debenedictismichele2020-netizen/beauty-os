import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CurrentSalon = {
  id: string;
  name: string;
  role: string;
  slug: string | null;
};

type CurrentSalonRpcRow = {
  id: string | null;
  name: string | null;
  role: string | null;
  slug: string | null;
};

function formatSalonName(name: unknown) {
  return typeof name === "string" && name.trim() ? name : "Nuovo salone";
}

function formatSalonSlug(slug: unknown) {
  return typeof slug === "string" && slug.trim() ? slug : null;
}

export async function getCurrentSalon(): Promise<CurrentSalon | null> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return null;
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.id) {
    return null;
  }

  const { data, error } = await supabase.rpc(
    "get_current_salon_for_authenticated_user" as never,
  );

  if (error) {
    return null;
  }

  const rows = Array.isArray(data) ? (data as CurrentSalonRpcRow[]) : [];
  const salon = rows[0] ?? null;

  if (!salon?.id) {
    return null;
  }

  return {
    id: String(salon.id),
    name: formatSalonName(salon.name),
    role:
      typeof salon.role === "string" && salon.role.trim()
        ? salon.role
        : "owner",
    slug: formatSalonSlug(salon.slug),
  };
}

export async function getCurrentSalonId() {
  const salon = await getCurrentSalon();

  return salon?.id ?? null;
}