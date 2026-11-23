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
