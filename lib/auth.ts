import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export type CurrentSalon = {
  id: string;
  name: string;
  role?: string | null;
  slug?: string | null;
};

export function isSupabaseAuthConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
}

export async function getCurrentSession() {
  const supabase = createSupabaseBrowserClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.warn("Sessione Supabase non disponibile:", error.message);
    return null;
  }

  return data.session;
}

export async function getCurrentUser() {
  const supabase = createSupabaseBrowserClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.auth.getUser();

  if (error) {
    console.warn("Utente Supabase non disponibile:", error.message);
    return null;
  }

  return data.user;
}

export async function signInWithEmail(email: string, password: string) {
  const supabase = createSupabaseBrowserClient();

  if (!supabase) {
    return {
      error: { message: "Supabase Auth non configurato." },
      session: null,
      user: null,
    };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  return {
    error,
    session: data.session,
    user: data.user,
  };
}

export async function signUpWithEmail(
  email: string,
  password: string,
  salonName?: string,
) {
  const supabase = createSupabaseBrowserClient();

  if (!supabase) {
    return {
      error: { message: "Supabase Auth non configurato." },
      session: null,
      user: null,
    };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    options: {
      data: salonName ? { salon_name: salonName } : undefined,
    },
    password,
  });

  if (!error && data.user) {
    await ensureUserSalon(salonName, data.user.id);
  }

  return {
    error,
    session: data.session,
    user: data.user,
  };
}

export async function signOut() {
  const supabase = createSupabaseBrowserClient();

  if (!supabase) {
    return { error: null };
  }

  return supabase.auth.signOut();
}

export async function getCurrentSalon(): Promise<CurrentSalon | null> {
  const supabase = createSupabaseBrowserClient();
  const user = await getCurrentUser();

  if (!supabase || !user) {
    return null;
  }

  try {
    return await getSalonForUser(user.id);
  } catch {
    return null;
  }
}

export async function getCurrentSalonId() {
  const salon = await getCurrentSalon();

  return salon?.id ?? null;
}

export async function ensureUserSalon(
  salonName?: string,
  userIdOverride?: string,
): Promise<CurrentSalon | null> {
  const supabase = createSupabaseBrowserClient();

  if (!supabase) {
    return null;
  }

  try {
    const userId = userIdOverride ?? (await getCurrentUser())?.id;

    if (!userId) {
      return null;
    }

    const existingSalon = await getSalonForUser(userId);

    if (existingSalon) {
      return existingSalon;
    }

    const resolvedSalonName =
      salonName?.trim() ||
      (await getCurrentUser())?.user_metadata?.salon_name ||
      "Studio Beauty";
    const { data: salon, error: salonError } = await supabase
      .from("salons")
      .insert({
        name: resolvedSalonName,
        owner_user_id: userId,
        slug: createSalonSlug(resolvedSalonName),
      })
      .select("id,name,slug")
      .single();

    if (salonError || !salon?.id) {
      return null;
    }

    const { error: membershipError } = await supabase.from("salon_members").insert({
      role: "owner",
      salon_id: salon.id,
      user_id: userId,
    });

    if (membershipError) {
      return null;
    }

    return {
      id: String(salon.id),
      name: String(salon.name),
      role: "owner",
      slug: salon.slug ? String(salon.slug) : null,
    };
  } catch {
    // Tables may not exist yet. The app must keep working before multi-salon migration.
    return null;
  }
}

async function getSalonForUser(userId: string): Promise<CurrentSalon | null> {
  const supabase = createSupabaseBrowserClient();

  if (!supabase) {
    return null;
  }

  const { data: membership, error: membershipError } = await supabase
    .from("salon_members")
    .select("role,salon_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership?.salon_id) {
    return null;
  }

  const { data: salon, error: salonError } = await supabase
    .from("salons")
    .select("id,name,slug")
    .eq("id", membership.salon_id)
    .maybeSingle();

  if (salonError || !salon) {
    return null;
  }

  return {
    id: String(salon.id),
    name: String(salon.name),
    role: membership.role ? String(membership.role) : null,
    slug: salon.slug ? String(salon.slug) : null,
  };
}

function createSalonSlug(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug ? `${slug}-${Date.now().toString(36)}` : `salone-${Date.now().toString(36)}`;
}
