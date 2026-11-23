import "server-only";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env, optionalEnv } from "../env";

/**
 * The signed-in user's Supabase client.
 *
 * This one carries the session, so every query runs as that user and the RLS
 * policies from migration 0001 (`user_id = auth.uid()`) are what keeps one person's
 * records away from another's. The service-role client in `admin.ts` still exists for
 * the MCP server, which has no cookie to read.
 */
export async function supabaseServer(): Promise<SupabaseClient> {
  const store = await cookies();
  return createServerClient(
    optionalEnv("DAILYBITE_SUPABASE_URL") ?? env("NEXT_PUBLIC_SUPABASE_URL"),
    optionalEnv("DAILYBITE_SUPABASE_ANON_KEY") ?? env("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list: { name: string; value: string; options?: CookieOptions }[]) => {
          try {
            for (const { name, value, options } of list) store.set(name, value, options);
          } catch {
            // A server component cannot set cookies. The middleware refreshes the
            // session on every request, so there is nothing to do here.
          }
        }
      }
    }
  );
}

/** The signed-in user, or null. */
export async function currentUser(): Promise<{ id: string; email: string | null } | null> {
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  return data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
}
