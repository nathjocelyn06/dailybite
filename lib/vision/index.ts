import "server-only";
import { optionalEnv } from "../env";
import { anthropicVision } from "./anthropic";
import { geminiVision } from "./gemini";
import type { VisionProvider } from "./types";

export type { VisionProvider, VisionImage, VisionRequest } from "./types";

/**
 * The vision provider for photo scans, or null when no key is configured — callers
 * then fall back to an empty, hand-fillable draft instead of failing.
 *
 * Selection: `VISION_PROVIDER` when set, otherwise whichever key exists (Gemini first,
 * because its free tier needs no card). To add a provider: implement `VisionProvider`,
 * add a case here, done — nothing above this module knows which one answered.
 */
export function getVisionProvider(): VisionProvider | null {
  const gemini = optionalEnv("GEMINI_API_KEY") ?? optionalEnv("GOOGLE_API_KEY");
  const anthropic = optionalEnv("ANTHROPIC_API_KEY");
  const forced = optionalEnv("VISION_PROVIDER")?.toLowerCase();

  if (forced === "gemini") return gemini ? geminiVision(gemini) : null;
  if (forced === "anthropic") return anthropic ? anthropicVision(anthropic) : null;

  if (gemini) return geminiVision(gemini);
  if (anthropic) return anthropicVision(anthropic);
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
