"use server";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { appUrl } from "@/lib/env";

export type LoginState = { error?: string; sent?: string; mode?: "signup" };

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

/**
 * Email and password: the path that needs no email at all.
 *
 * Magic links go through Supabase's built-in mailer, which on the free tier allows a
 * handful an hour and quietly lands in spam, so a password is what makes sign-in
 * dependable. The link still works for anyone who prefers it.
 */
export async function signInPasswordAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Email and password, please." };

  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    if (/email not confirmed/i.test(error.message)) return { error: "That account still needs its email confirmed." };
    return { error: "Wrong email or password." };
  }
  redirect(String(form.get("next") || "/"));
}

export async function signUpPasswordAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { mode: "signup", error: "That does not look like an email address." };
  if (password.length < 8) return { mode: "signup", error: "Use at least 8 characters." };

  const sb = await supabaseServer();
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) {
    if (/already registered|already exists/i.test(error.message)) return { error: "You already have an account — sign in instead." };
    if (/rate limit|too many/i.test(error.message)) return { mode: "signup", error: "Supabase is rate-limiting sign-up emails. Turn off “Confirm email” in Authentication › Providers › Email and this works instantly." };
    return { mode: "signup", error: error.message };
  }
  // With "Confirm email" off, signUp returns a session and we are already in.
  if (data.session) redirect(String(form.get("next") || "/"));
  return { mode: "signup", sent: email };
}

export async function signOutAction(): Promise<void> {
  const sb = await supabaseServer();
  await sb.auth.signOut();
  redirect("/login");
}
