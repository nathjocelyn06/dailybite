/**
 * Remote MCP endpoint (Streamable HTTP): {APP_URL}/api/mcp?key=MCP_ACCESS_KEY
 *  - claude.ai (web + mobile): Settings > Connectors > Add custom connector, paste the URL.
 *  - Claude Desktop: same connector (synced from your account), or locally via
 *    `npx mcp-remote http://localhost:3000/api/mcp?key=...` in claude_desktop_config.json.
 */
import { createMcpHandler } from "mcp-handler";
import { registerTools, SERVER_INSTRUCTIONS } from "@/lib/mcp/tools";

export const runtime = "nodejs";
export const maxDuration = 60;

const handler = createMcpHandler(
  (server) => {
    registerTools(server);
  },
  { instructions: SERVER_INSTRUCTIONS },
  { basePath: "/api", maxDuration: 60, verboseLogs: process.env.NODE_ENV !== "production" }
);

function authorized(req: Request): boolean {
  const expected = process.env.MCP_ACCESS_KEY;
  if (!expected || expected === "change-me") return false; // refuse to run unprotected
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get("key");
  const fromHeader = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return timingSafeEqual(fromQuery ?? fromHeader ?? "", expected);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function guarded(req: Request): Promise<Response> {
  if (!authorized(req)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "content-type": "application/json" } });
  }
  return handler(req);
}

export { guarded as GET, guarded as POST, guarded as DELETE };
