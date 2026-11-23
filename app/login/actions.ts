"use server";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { appUrl } from "@/lib/env";

export type LoginState = { error?: string; sent?: string };

/**
 * Send a sign-in link. The same call signs people up: `shouldCreateUser` means a
 * first-time address gets an account, so there is one door rather than two.
 */
export async function sendLinkAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const next = String(form.get("next") ?? "");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "That does not look like an email address." };

  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: appUrl(`/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`)
    }
  });
  if (error) {
    // The free tier allows a few of these an hour; say so rather than "error".
    const rate = /rate limit|too many/i.test(error.message);
    return { error: rate ? "Too many links sent for now — wait a minute and try again." : error.message };
  }
  return { sent: email };
}

/** For the code in the email, when tapping the link is not convenient. */
export async function verifyCodeAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const token = String(form.get("token") ?? "").replace(/\D/g, "");
  if (token.length < 6) return { sent: email, error: "Enter the six-digit code from the email." };

  const sb = await supabaseServer();
  const { error } = await sb.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { sent: email, error: "That code did not work. Check it, or use the link instead." };
  redirect(String(form.get("next") || "/"));
}

export async function signOutAction(): Promise<void> {
  const sb = await supabaseServer();
  await sb.auth.signOut();
  redirect("/login");
}
