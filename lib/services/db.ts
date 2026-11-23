import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../supabase/admin";
import { supabaseServer } from "../supabase/server";
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
 * The signed-in person's Db (v5).
 *
 * This client carries their session, so the RLS policies from migration 0001 are
 * doing the scoping, not just the `.eq("user_id", ...)` in every service. Both are
 * kept: the filter makes the intent plain in the code, and the policy makes it true
 * even if a filter is ever forgotten.
 *
 * The middleware already turned away anyone without a session, so reaching here
 * without one means something is wired wrong rather than someone being logged out.
 */
export async function webDb(): Promise<Db> {
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  return { sb, userId: data.user.id, tz: await loadTz(sb, data.user.id) };
}

/**
 * The Db behind a per-account MCP key.
 *
 * The MCP server has no cookie, so it cannot be the user the way a page can. It looks
 * the key up on the service-role client and then acts as that account — which is why
 * every service still filters by `user_id` explicitly.
 */
export async function dbForMcpKey(key: string): Promise<Db | null> {
  if (!key || key.length < 24) return null;
  const sb = supabaseAdmin();
  const { data } = await sb.from("settings").select("user_id,timezone").eq("mcp_key", key).maybeSingle();
  if (!data) return null;
  return { sb, userId: data.user_id as string, tz: (data.timezone as string) || DEFAULT_TZ };
}

/**
 * The owner's Db on the service-role client. Still here for the MCP server's own
 * fallback key (`MCP_ACCESS_KEY`), which predates per-account keys and keeps the
 * connector that is already set up working.
 */
export async function ownerDb(): Promise<Db> {
  const sb = supabaseAdmin();
  const userId = env("OWNER_USER_ID");
  return { sb, userId, tz: await loadTz(sb, userId) };
}

/**
 * The time zone, remembered for a minute.
 *
 * Every page, every server action and every MCP tool starts with a Db, and the Db
 * needs the time zone before it can work out what "today" is. Read fresh, that is a
 * database round trip in front of everything else the request does — and the database
 * is in Seoul, so it is not a cheap one. The value changes about once in the life of
 * the app, so a warm process keeps it for 60 seconds: a time-zone change in Settings
 * is live within a minute, and nothing else ever notices.
 */
let tzCache: { userId: string; tz: string; at: number } | null = null;
const TZ_TTL_MS = 60_000;

/** Called by updateSettings so a time-zone change is not held for the minute. */
export function forgetTimezone(): void {
  tzCache = null;
}

async function loadTz(sb: SupabaseClient, userId: string): Promise<string> {
  const now = Date.now();
  if (tzCache && tzCache.userId === userId && now - tzCache.at < TZ_TTL_MS) return tzCache.tz;
  const { data } = await sb.from("settings").select("timezone").eq("user_id", userId).maybeSingle();
  const tz = (data?.timezone as string | undefined) ?? DEFAULT_TZ;
  tzCache = { userId, tz, at: now };
  return tz;
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
