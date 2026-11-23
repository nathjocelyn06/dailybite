import "server-only";
import { optionalEnv } from "../env";

const ref = (url?: string) => /https:\/\/([a-z0-9]+)\.supabase\.co/i.exec(url ?? "")?.[1] ?? null;

/**
 * Is the anon key we would sign people in with from the same project as the data?
 *
 * Vercel's Supabase integration rewrites `NEXT_PUBLIC_SUPABASE_URL` and the anon key
 * to a project it provisioned itself, which is why the service-role side is pinned
 * with `DAILYBITE_*`. If the anon side was not pinned too, auth would talk to one
 * project while every page reads another, and nobody could ever get in. Rather than
 * fail silently at that point, the sign-in page says what to set.
 */
export function authConfigProblem(): string | null {
  const dataUrl = optionalEnv("DAILYBITE_SUPABASE_URL");
  const anonKey = optionalEnv("DAILYBITE_SUPABASE_ANON_KEY") ?? optionalEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!anonKey) return "No anon key is set, so sign-in cannot work. Add DAILYBITE_SUPABASE_ANON_KEY.";
  if (!dataUrl) return null; // local: the NEXT_PUBLIC pair is the whole story

  const pinnedAnon = optionalEnv("DAILYBITE_SUPABASE_ANON_KEY");
  if (pinnedAnon) return null;
  const publicRef = ref(optionalEnv("NEXT_PUBLIC_SUPABASE_URL"));
  if (publicRef && publicRef !== ref(dataUrl)) {
    return "The anon key belongs to a different Supabase project than the data. Add DAILYBITE_SUPABASE_ANON_KEY (the anon key of the project the migrations ran on) and redeploy.";
  }
  return null;
}

/**
 * Ask the project itself whether the anon key is one of its own.
 *
 * Comparing project refs only works for the old JWT-shaped keys; the current
 * `sb_publishable_…` ones carry nothing to compare, and a wrong one of those is what
 * turned sign-in into a bare "Invalid API key". One cheap call to the auth endpoint
 * settles it, and the answer is kept for the life of the process.
 */
let verdict: { ok: boolean; at: number } | null = null;

export async function authKeyWorks(): Promise<boolean> {
  if (verdict && Date.now() - verdict.at < 10 * 60_000) return verdict.ok;
  const url = optionalEnv("DAILYBITE_SUPABASE_URL") ?? optionalEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = optionalEnv("DAILYBITE_SUPABASE_ANON_KEY") ?? optionalEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !key) return false;
  try {
    const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key }, cache: "no-store" });
    verdict = { ok: res.ok, at: Date.now() };
  } catch {
    return true; // a network blip is not a misconfiguration; let the form try
  }
  return verdict.ok;
}
