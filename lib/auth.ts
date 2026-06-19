import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export type CurrentSalon = {
  id: string;
  name: string;
  role: string;
  slug: string | null;
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

  if (!error && data.user) {
    await ensureCurrentUserSalon();
  }

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
      data: salonName?.trim() ? { salon_name: salonName.trim() } : undefined,
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
    password,
  });

  if (!error && data.session) {
    await ensureCurrentUserSalon();
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

export async function ensureCurrentUserSalon(): Promise<CurrentSalon | null> {
  const response = await fetch("/api/auth/provision-salon", {
    cache: "no-store",
    method: "POST",
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { salon?: CurrentSalon | null };

  return payload.salon ?? null;
}
