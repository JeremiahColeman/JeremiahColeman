"use server";

import { redirect } from "next/navigation";
import { requestOrigin } from "@/lib/auth";
import { googleSignInEnabled } from "@/lib/env";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

export type SignInState =
  | { step: "email"; error?: string; email?: string }
  | { step: "code"; email: string; error?: string; resent?: boolean; redirectTo?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function friendlyAuthError(message: string) {
  if (/rate limit|security purposes|too many/i.test(message)) {
    return "We just sent you an email. Please wait a minute before asking for another one.";
  }
  if (/expired|invalid/i.test(message)) {
    return "That code didn't work. Check the newest email, or ask for a new code.";
  }
  return "Something went wrong. Please try again.";
}

/** Emails a sign-in link and a 6-digit code. Creates the account if it's new. */
export async function sendMagicLink(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = safeNext(formData.get("next"));
  if (!EMAIL_RE.test(email)) return { step: "email", email, error: "Enter your email address, like name@example.com." };

  const origin = await requestOrigin();
  const supabase = await createClient();
  // The email template appends "&token_hash=…&type=email" to this URL, so the
  // link works on any device (no PKCE cookie needed).
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(next)}`, shouldCreateUser: true },
  });
  if (error) return { step: "email", email, error: friendlyAuthError(error.message) };
  return { step: "code", email, resent: formData.get("resend") === "1" };
}

/** Signs in with the 6-digit code from the email, for people on another device. */
export async function verifyCode(prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const token = String(formData.get("code") ?? "").replace(/\D/g, "");
  const next = safeNext(formData.get("next"));
  if (token.length !== 6) return { step: "code", email, error: "Enter the 6-digit code from the email." };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { step: "code", email, error: friendlyAuthError(error.message) };
  return { step: "code", email, redirectTo: next };
}

export async function signInWithGoogle(formData: FormData) {
  if (!googleSignInEnabled()) redirect("/sign-in");
  const next = safeNext(formData.get("next"));
  const origin = await requestOrigin();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect(`/sign-in?error=google&next=${encodeURIComponent(next)}`);
  redirect(data.url);
}
