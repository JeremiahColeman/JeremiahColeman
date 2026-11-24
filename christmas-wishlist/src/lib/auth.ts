import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/** The signed-in user, verified with the Auth server. Cached per request. */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

export const getProfile = cache(async () => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, display_name").eq("id", user.id).single();
  return data;
});

/** The path being rendered, as passed along by proxy.ts. */
export async function currentPath() {
  return (await headers()).get("x-pathname") ?? "/lists";
}

/**
 * Requires a signed-in user who has picked a display name. Otherwise sends
 * them to sign in or to the welcome screen, then back to `next`.
 */
export async function requireProfile(next?: string) {
  const returnTo = next ?? (await currentPath());
  const user = await getUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  const profile = await getProfile();
  if (!profile?.display_name) redirect(`/welcome?next=${encodeURIComponent(returnTo)}`);
  return { user, profile };
}

/** Origin of the current request, for building auth redirect links. */
export async function requestOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") || host?.startsWith("127.") ? "http" : "https");
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}
