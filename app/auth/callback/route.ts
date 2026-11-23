import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Where the emailed link lands. Supabase sends a one-time code; exchanging it sets
 * the session cookies, and from then on the app is ordinary.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/";
  const home = new URL(next.startsWith("/") ? next : "/", url.origin);

  if (!code) {
    const failed = new URL("/login", url.origin);
    failed.searchParams.set("next", next);
    return NextResponse.redirect(failed);
  }

  const sb = await supabaseServer();
  const { error } = await sb.auth.exchangeCodeForSession(code);
  if (error) {
    const failed = new URL("/login", url.origin);
    failed.searchParams.set("expired", "1");
    return NextResponse.redirect(failed);
  }
  return NextResponse.redirect(home);
}
