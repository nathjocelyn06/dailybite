import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";

let cached: SupabaseClient | null = null;

/** Service-role client. Bypasses RLS, so callers MUST filter by user_id. Server only. */
export function supabaseAdmin(): SupabaseClient {
  if (!cached) {
    cached = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }
  return cached;
}
