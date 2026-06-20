import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { resolveExistingSalonForUser } from "@/lib/salonProvisioning";

export type CurrentSalon = {
  id: string;
  name: string;
  role: string;
  slug: string | null;
};

async function resolveSalonWithAuthenticatedClient(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
): Promise<CurrentSalon | null> {
  const { data: memberships, error: membershipError } = await supabase
    .from("salon_members")
    .select("role,salon_id,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (membershipError) {
    console.log("RESOLVE_SALON_MEMBERSHIP_ERROR", membershipError.message);
  }

  const membership = (memberships ?? [])[0] as
    | { role: string | null; salon_id: string | null }
    | undefined;

  if (membership?.salon_id) {
    const { data: salon, error: salonError } = await supabase
      .from("salons")
      .select("id,name,slug")
      .eq("id", membership.salon_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (salonError) {
      console.log("RESOLVE_SALON_READ_ERROR", salonError.message);
    }

    if (salon?.id) {
      return {
        id: String(salon.id),
        name: String(salon.name || "Nuovo salone"),
        role: membership.role ?? "owner",
        slug: typeof salon.slug === "string" ? salon.slug : null,
      };
    }
  }

  const { data: ownedSalon, error: ownedSalonError } = await supabase
    .from("salons")
    .select("id,name,slug")
    .eq("owner_user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (ownedSalonError) {
    console.log("RESOLVE_OWNED_SALON_ERROR", ownedSalonError.message);
  }

  if (!ownedSalon?.id) {
    return null;
  }

  return {
    id: String(ownedSalon.id),
    name: String(ownedSalon.name || "Nuovo salone"),
    role: "owner",
    slug: typeof ownedSalon.slug === "string" ? ownedSalon.slug : null,
  };
}

export async function getCurrentSalon(): Promise<CurrentSalon | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, options, value }) => {
          try {
            cookieStore.set(name, value, options);
          } catch {
            // Server Components cannot always write cookies. Proxy/callback
            // refreshes the session; this helper only needs to read it.
          }
        });
      },
    },
  });
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    console.log("USER_ID", null);
    console.log("SALON_ID", null);
    console.log("AUTH_USER_ID", user?.id);
    console.log("CURRENT_SALON_ID", null);
    return null;
  }

  const salon =
    (await resolveExistingSalonForUser(user)) ??
    (await resolveSalonWithAuthenticatedClient(supabase, user.id));

  console.log("USER_ID", user.id);
  console.log("SALON_ID", salon?.id ?? null);
  console.log("AUTH_USER_ID", user?.id);
  console.log("CURRENT_SALON_ID", salon?.id);

  return salon;
}

export async function getCurrentSalonId() {
  const salon = await getCurrentSalon();

  return salon?.id ?? null;
}
