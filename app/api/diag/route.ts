/** TEMPORARY: reports which Supabase project the deployment is wired to. No secrets. Delete after use. */
import { supabaseTarget } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { url, key } = supabaseTarget();
  return Response.json({
    using_project_ref: url.replace(/^https?:\/\//, "").split(".")[0],
    using_key_scheme: key.slice(0, 10),
    injected_project_ref: (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/^https?:\/\//, "").split(".")[0],
    override_set: !!process.env.DAILYBITE_SUPABASE_URL,
    app_url: process.env.APP_URL ?? "(unset)"
  });
}
