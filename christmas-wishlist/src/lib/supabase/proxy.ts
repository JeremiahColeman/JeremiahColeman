import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";

/** Paths anyone can open while signed out. */
const PUBLIC_PATHS = [/^\/$/, /^\/sign-in$/, /^\/auth\//, /^\/invite-invalid$/];

/**
 * Refreshes the Supabase session cookie on every request and sends signed-out
 * visitors to sign-in. This is an optimistic check for a better redirect; the
 * pages and the database enforce access themselves.
 */
export async function updateSession(request: NextRequest) {
  const pathWithQuery = request.nextUrl.pathname + request.nextUrl.search;
  // Layouts can't see the URL, so pass it along for "return here after sign-in".
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathWithQuery);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request: { headers: requestHeaders } });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  // Don't run code between createServerClient and getClaims: it refreshes the
  // session and must see the cookies first.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  if (!signedIn && request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, message: "Sign in first." }, { status: 401 });
  }

  if (!signedIn && !PUBLIC_PATHS.some((re) => re.test(request.nextUrl.pathname))) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = `?next=${encodeURIComponent(pathWithQuery)}`;
    const redirect = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  return response;
}
