import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { AppointmentRow, CustomerRow } from "@/app/clients/data";

type Database = {
  public: {
    Tables: {
      customers: {
        Row: CustomerRow;
        Insert: Partial<CustomerRow>;
        Update: Partial<CustomerRow>;
        Relationships: [];
      };
      appointments: {
        Row: AppointmentRow;
        Insert: Partial<AppointmentRow>;
        Update: Partial<AppointmentRow>;
        Relationships: [
          {
            foreignKeyName: "appointments_customer_id_fkey";
            columns: ["customer_id"];
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export async function createSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  try {
    const parsedUrl = new URL(supabaseUrl);

    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      return null;
    }
  } catch {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabaseKey, {
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
}
