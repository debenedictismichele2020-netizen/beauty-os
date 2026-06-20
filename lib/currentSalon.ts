import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CurrentSalon = {
  id: string;
  name: string;
  role: string;
  slug: string | null;
};

export async function getCurrentSalon(): Promise<CurrentSalon | null> {
  const supabase = (await createSupabaseServerClient()) as SupabaseClient | null;

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

  const { data: ownedSalon, error: ownedSalonError } = await supabase
    .from("salons")
    .select("id,name,slug")
    .eq("owner_user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!ownedSalonError && ownedSalon?.id) {
    return {
      id: String(ownedSalon.id),
      name:
        typeof ownedSalon.name === "string" && ownedSalon.name.trim()
          ? ownedSalon.name
          : "Nuovo salone",
      role: "owner",
      slug: typeof ownedSalon.slug === "string" ? ownedSalon.slug : null,
    };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("salon_members")
    .select("role,salon_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership?.salon_id) {
    return null;
  }

  const { data: memberSalon, error: memberSalonError } = await supabase
    .from("salons")
    .select("id,name,slug")
    .eq("id", membership.salon_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (memberSalonError || !memberSalon?.id) {
    return null;
  }

  return {
    id: String(memberSalon.id),
    name:
      typeof memberSalon.name === "string" && memberSalon.name.trim()
        ? memberSalon.name
        : "Nuovo salone",
    role: typeof membership.role === "string" ? membership.role : "owner",
    slug: typeof memberSalon.slug === "string" ? memberSalon.slug : null,
  };
}

export async function getCurrentSalonId() {
  const salon = await getCurrentSalon();

  return salon?.id ?? null;
}
