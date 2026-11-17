import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../supabase/admin";
import { DEFAULT_TZ, env } from "../env";

/**
 * Everything in lib/services takes a Db. Since v3.1 the app has no sign-in screen,
 * so both callers are the same single owner:
 *  - the web app (pages + server actions) -> webDb()
 *  - the MCP server                       -> ownerDb()
 * Both use the service-role client, so services ALWAYS filter/insert with db.userId.
 * That scoping is what keeps the data to one user now that RLS is not doing it.
 */
export type Db = { sb: SupabaseClient; userId: string; tz: string };

/**
 * The web app's Db. No session, no login: it is the owner, like the MCP server.
 * Kept as a separate name so pages and actions stay readable and so a signed-in
 * mode can come back here without touching every call site.
 */
export async function webDb(): Promise<Db> {
  return ownerDb();
}

export async function ownerDb(): Promise<Db> {
  const sb = supabaseAdmin();
  const userId = env("OWNER_USER_ID");
  return { sb, userId, tz: await loadTz(sb, userId) };
}

async function loadTz(sb: SupabaseClient, userId: string): Promise<string> {
  const { data } = await sb.from("settings").select("timezone").eq("user_id", userId).maybeSingle();
  return (data?.timezone as string | undefined) ?? DEFAULT_TZ;
}

type Res<T> = { data: T | null; error: { message: string } | null };

/** Unwrap a Supabase response or throw a readable error. */
export function must<T>(r: Res<T>, what = "query"): T {
  if (r.error) throw new Error(`${what} failed: ${r.error.message}`);
  return r.data as T;
}

/** Strip undefined keys so partial updates don't overwrite columns with null. */
export function clean<T extends Record<string, unknown>>(o: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v;
  return out as Partial<T>;
}
