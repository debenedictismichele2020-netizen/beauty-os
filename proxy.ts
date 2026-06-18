import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const protectedRoutes = [
  "/",
  "/agenda-ai",
  "/campagne",
  "/catalogo",
  "/clients",
  "/fatturato",
  "/impostazioni",
  "/impostazioni-ai",
  "/opportunita-ai",
];

function isProtectedPath(pathname: string) {
  return protectedRoutes.some((route) => {
    if (route === "/") {
      return pathname === "/";
    }

    return pathname === route || pathname.startsWith(`${route}/`);
  });
}

function isAuthPath(pathname: string) {
  return pathname === "/login" || pathname === "/register";
}

function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isSupabaseConfigured()) {
    return NextResponse.next();
  }

  if (!isProtectedPath(pathname) && !isAuthPath(pathname)) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request,
  });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      "",
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, options, value }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user && isProtectedPath(pathname)) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("next", pathname);

      return NextResponse.redirect(loginUrl);
    }

    if (user && isAuthPath(pathname)) {
      const homeUrl = request.nextUrl.clone();
      homeUrl.pathname = "/";
      homeUrl.search = "";

      return NextResponse.redirect(homeUrl);
    }
  } catch {
    return NextResponse.next();
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/agenda-ai/:path*",
    "/campagne/:path*",
    "/catalogo/:path*",
    "/clients/:path*",
    "/fatturato/:path*",
    "/impostazioni/:path*",
    "/impostazioni-ai/:path*",
    "/opportunita-ai/:path*",
    "/login",
    "/register",
  ],
};
