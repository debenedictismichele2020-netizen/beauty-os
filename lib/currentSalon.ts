import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CurrentSalon = {
  id: string;
  name: string;
  role: string;
  slug: string | null;
};

function formatSalonName(name: unknown) {
  return typeof name === "string" && name.trim() ? name : "Nuovo salone";
}

function formatSalonSlug(slug: unknown) {
  return typeof slug === "string" ? slug : null;
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

  // 1. Prima cerca il salone dove l’utente è proprietario diretto.
  // Questo è il caso corretto per debenedictismichele2020@gmail.com.
  const { data: ownedSalon } = await supabase
    .from("salons")
    .select("id,name,slug")
    .eq("owner_user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (ownedSalon?.id) {
    return {
      id: String(ownedSalon.id),
      name: formatSalonName(ownedSalon.name),
      role: "owner",
      slug: formatSalonSlug(ownedSalon.slug),
    };
  }

  // 2. Solo se non trova un salone come proprietario,
  // cerca tramite salon_members.
  const { data: membership } = await supabase
    .from("salon_members")
    .select("role,salon_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership?.salon_id) {
    return null;
  }

  const { data: memberSalon } = await supabase
    .from("salons")
    .select("id,name,slug")
    .eq("id", membership.salon_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!memberSalon?.id) {
    return null;
  }

  return {
    id: String(memberSalon.id),
    name: formatSalonName(memberSalon.name),
    role: typeof membership.role === "string" ? membership.role : "owner",
    slug: formatSalonSlug(memberSalon.slug),
  };
}

export async function getCurrentSalonId() {
  const salon = await getCurrentSalon();

  return salon?.id ?? null;
}