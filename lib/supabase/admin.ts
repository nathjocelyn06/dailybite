import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, optionalEnv } from "../env";

let cached: SupabaseClient | null = null;

/**
 * Which Supabase project this app talks to.
 *
 * `DAILYBITE_*` wins when set. Vercel's Supabase storage connection injects its own
 * `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` at deploy time, pointing at
 * a project it provisioned — which is empty, so every page 500s with
 * "Could not find the table 'public.settings' in the schema cache". Setting the
 * `DAILYBITE_*` pair in Vercel pins us to the project the migrations actually ran on.
 * Locally, `.env.local` only needs the standard names.
 */
export function supabaseTarget(): { url: string; key: string } {
  return {
    url: optionalEnv("DAILYBITE_SUPABASE_URL") ?? env("NEXT_PUBLIC_SUPABASE_URL"),
    key: optionalEnv("DAILYBITE_SUPABASE_SERVICE_KEY") ?? env("SUPABASE_SERVICE_ROLE_KEY")
  };
}

/** Service-role client. Bypasses RLS, so callers MUST filter by user_id. Server only. */
export function supabaseAdmin(): SupabaseClient {
  if (!cached) {
    const { url, key } = supabaseTarget();
    cached = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return cached;
}
