/**
 * Remote MCP endpoint (Streamable HTTP): {APP_URL}/api/mcp?key=MCP_ACCESS_KEY
 *  - claude.ai (web + mobile): Settings > Connectors > Add custom connector, paste the URL.
 *  - Claude Desktop: same connector (synced from your account), or locally via
 *    `npx mcp-remote http://localhost:3000/api/mcp?key=...` in claude_desktop_config.json.
 */
import { createMcpHandler } from "mcp-handler";
import { registerTools, SERVER_INSTRUCTIONS } from "@/lib/mcp/tools";
import { withMcpDb } from "@/lib/mcp/context";
import { dbForMcpKey } from "@/lib/services/db";

export const runtime = "nodejs";
export const maxDuration = 60;

const handler = createMcpHandler(
  (server) => {
    registerTools(server);
  },
  { instructions: SERVER_INSTRUCTIONS },
  { basePath: "/api", maxDuration: 60, verboseLogs: process.env.NODE_ENV !== "production" }
);

function presentedKey(req: Request): string {
  const url = new URL(req.url);
  return url.searchParams.get("key") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
}

/** The shared key from the env, which still means "the owner's account". */
function isOwnerKey(key: string): boolean {
  const expected = process.env.MCP_ACCESS_KEY;
  if (!expected || expected === "change-me") return false; // refuse to run unprotected
  return timingSafeEqual(key, expected);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Two kinds of key open this door, and which one decides whose data the tools see:
 * the shared `MCP_ACCESS_KEY` acts as the owner (the connector set up before v5), and
 * any account's own key from Settings acts as that account.
 */
async function guarded(req: Request): Promise<Response> {
  const key = presentedKey(req);
  if (isOwnerKey(key)) return handler(req);

  const db = await dbForMcpKey(key).catch(() => null);
  if (db) return withMcpDb(db, () => handler(req));

  return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "content-type": "application/json" } });
}

export { guarded as GET, guarded as POST, guarded as DELETE };
