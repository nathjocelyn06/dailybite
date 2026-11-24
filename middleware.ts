import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * Two jobs, and nothing else.
 *
 *  1. Refresh the Supabase session on every request, so a server component never
 *     reads an expired token. `@supabase/ssr` needs this to exist.
 *  2. Send signed-out visitors to /login, and signed-in ones away from it.
 *
 * The MCP server is deliberately not gated here: it authenticates with a per-account
 * key in the query string, not with a cookie.
 */

const PUBLIC = ["/login", "/auth", "/api/mcp", "/api/reminders", "/manifest.webmanifest", "/sw.js"];

export async function middleware(req: NextRequest) {
  const res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.DAILYBITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.DAILYBITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list: { name: string; value: string; options?: CookieOptions }[]) => {
          for (const { name, value } of list) req.cookies.set(name, value);
          for (const { name, value, options } of list) res.cookies.set(name, value, options);
        }
      }
    }
  );

  // getUser, not getSession: it verifies the token with Supabase instead of trusting
  // whatever is in the cookie.
  const { data } = await supabase.auth.getUser();
  const path = req.nextUrl.pathname;
  const open = PUBLIC.some((p) => path === p || path.startsWith(`${p}/`));

  // Everyone gets their own DailyBite, so a visitor without a session is sent to
  // sign in. REQUIRE_SIGN_IN=0 opens the app to anyone again, which is only for
  // showing it to a room full of people who are not going to make accounts.
  const gated = process.env.REQUIRE_SIGN_IN !== "0";

  if (gated && !data.user && !open) {
    const to = req.nextUrl.clone();
    to.pathname = "/login";
    // Come back to where they were trying to go once they are in.
    if (path !== "/") to.searchParams.set("next", path + req.nextUrl.search);
    return NextResponse.redirect(to);
  }
  if (data.user && path === "/login") {
    const to = req.nextUrl.clone();
    to.pathname = "/";
    to.search = "";
    return NextResponse.redirect(to);
  }
  return res;
}

export const config = {
  // Everything except Next's own assets and the files a browser fetches before
  // there is any session to speak of.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|fonts/|magnets/|stickers/|logo-).*)"]
};
