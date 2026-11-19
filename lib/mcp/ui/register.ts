import "server-only";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * MCP Apps (SEP-1865) on top of the MCP SDK we already run.
 *
 * `@modelcontextprotocol/ext-apps/server` is two one-line wrappers over
 * `registerTool` / `registerResource`, but its peer dependencies are the v2 SDK
 * packages and zod 4, and this app is on SDK 1.26 and zod 3. Rather than fork the
 * whole dependency tree for two wrappers, the same thing is done here — the values
 * below are taken from that package, not guessed:
 *
 *   RESOURCE_MIME_TYPE   "text/html;profile=mcp-app"
 *   RESOURCE_URI_META_KEY "ui/resourceUri"   (the deprecated flat key)
 *   the nested form       _meta.ui.resourceUri
 *
 * The package writes BOTH keys so old and new hosts both find the resource, and so
 * does this. The browser half of the extension is vendored as `bridge.js`.
 */

export const RESOURCE_MIME_TYPE = "text/html;profile=mcp-app";
const RESOURCE_URI_META_KEY = "ui/resourceUri";

/** Everything a host needs on a tool to know which view renders its result. */
export function uiMeta(resourceUri: string): Record<string, unknown> {
  return { ui: { resourceUri }, [RESOURCE_URI_META_KEY]: resourceUri };
}

/**
 * Register a `ui://` HTML resource. `html` is produced once at module load, so a
 * read is a string copy — the view is static and the data arrives with the tool result.
 */
export function registerAppResource(
  server: McpServer,
  name: string,
  uri: string,
  html: string,
  meta?: Record<string, unknown>
): void {
  server.registerResource(
    name,
    uri,
    { mimeType: RESOURCE_MIME_TYPE, ...(meta ? { _meta: meta } : {}) },
    async () => ({ contents: [{ uri, mimeType: RESOURCE_MIME_TYPE, text: html, ...(meta ? { _meta: meta } : {}) }] })
  );
}
