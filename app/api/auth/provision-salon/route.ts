import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { ensureSalonForUser } from "@/lib/salonProvisioning";

function createAuthResponse(request: NextRequest) {
  const response = NextResponse.json({ salon: null });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return { response, supabase: null };
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, options, value }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  return { response, supabase };
}

export async function POST(request: NextRequest) {
  const { response, supabase } = createAuthResponse(request);

  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase Auth non configurato.", salon: null },
      { status: 500 },
    );
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json(
      { error: "Sessione non valida.", salon: null },
      { status: 401 },
    );
  }

  try {
    const salon = await ensureSalonForUser(user);
    const jsonResponse = NextResponse.json({ salon });

    response.cookies.getAll().forEach((cookie) => {
      jsonResponse.cookies.set(cookie);
    });

    return jsonResponse;
  } catch (provisioningError) {
    return NextResponse.json(
      {
        error:
          provisioningError instanceof Error
            ? provisioningError.message
            : "Provisioning salone non riuscito.",
        salon: null,
      },
      { status: 500 },
    );
  }
}
