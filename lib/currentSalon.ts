import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { ensureSalonForUser } from "@/lib/salonProvisioning";

export type CurrentSalon = {
  id: string;
  name: string;
  role: string;
  slug: string | null;
};

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
    return null;
  }

  return ensureSalonForUser(user);
}
