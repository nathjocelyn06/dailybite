/** TEMPORARY: reports which Supabase project the deployment is wired to. No secrets. Delete after use. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "(unset)";
  return Response.json({
    supabase_project_ref: url.replace(/^https?:\/\//, "").split(".")[0],
    service_key_scheme: (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "(unset)").slice(0, 10),
    owner_user_id_tail: (process.env.OWNER_USER_ID ?? "(unset)").slice(-6),
    app_url: process.env.APP_URL ?? "(unset)",
    mcp_key_set: !!process.env.MCP_ACCESS_KEY,
    node: process.version,
    vercel_env: process.env.VERCEL_ENV ?? "(none)"
  });
}
