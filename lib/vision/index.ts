import "server-only";
import { optionalEnv } from "../env";
import { anthropicVision } from "./anthropic";
import type { VisionProvider } from "./types";

export type { VisionProvider, VisionImage, VisionRequest } from "./types";

/**
 * The vision provider for photo scans, or null when none is configured — callers
 * then fall back to an empty, hand-fillable draft instead of failing.
 *
 * To add a provider: implement `VisionProvider`, add a case here, set VISION_PROVIDER.
 * Nothing above this module knows which provider answered.
 */
export function getVisionProvider(): VisionProvider | null {
  const which = (optionalEnv("VISION_PROVIDER") ?? "anthropic").toLowerCase();
  if (which === "anthropic") {
    const key = optionalEnv("ANTHROPIC_API_KEY");
    return key ? anthropicVision(key) : null;
  }
  return null;
}

/** Models like to wrap JSON in prose or fences; take the outermost object. */
export function extractJson<T>(text: string): T | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
