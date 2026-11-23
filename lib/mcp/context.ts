import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { ownerDb, type Db } from "../services/db";

/**
 * Which account an MCP request is acting as.
 *
 * Tools are registered once, at module load, but the account is per request — so the
 * route puts the Db here for the length of the call and `run()` reads it back. Without
 * one (the legacy shared key) it falls back to the owner, which is what the connector
 * that is already set up expects.
 */
const store = new AsyncLocalStorage<Db>();

export function withMcpDb<T>(db: Db, fn: () => Promise<T>): Promise<T> {
  return store.run(db, fn);
}

export async function mcpDb(): Promise<Db> {
  return store.getStore() ?? (await ownerDb());
}
