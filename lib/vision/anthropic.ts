import "server-only";
import { optionalEnv } from "../env";
import type { VisionProvider } from "./types";

const ENDPOINT = "https://api.anthropic.com/v1/messages";

/** Claude vision. The key never leaves the server. */
export function anthropicVision(apiKey: string): VisionProvider {
  return {
    name: "Anthropic",
    async analyse({ image, system, prompt, maxTokens = 1500 }) {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: optionalEnv("ANTHROPIC_MODEL") ?? "claude-sonnet-5-5",
          max_tokens: maxTokens,
          system,
          messages: [
            {
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.base64 } },
                { type: "text", text: prompt }
              ]
            }
          ]
        })
      });
      if (!res.ok) {
        throw new Error(await explain(res));
      }
      const data = (await res.json()) as { content?: { type: string; text?: string }[] };
      return data.content?.find((c) => c.type === "text")?.text ?? "";
    }
  };
}

/** Turn an API failure into something a person can act on, not a status code. */
async function explain(res: Response): Promise<string> {
  const body = await res.text().catch(() => "");
  let message = "";
  try {
    message = (JSON.parse(body) as { error?: { message?: string } }).error?.message ?? "";
  } catch {
    message = body.slice(0, 160);
  }
  if (/credit balance is too low/i.test(message)) {
    return "the Anthropic account is out of credits — add credits under Plans & Billing and try again";
  }
  if (res.status === 401 || /authentication/i.test(message)) return "the Anthropic API key was rejected";
  if (res.status === 429) return "Anthropic is rate-limiting this key — wait a moment and try again";
  if (res.status === 529 || res.status >= 500) return "Anthropic is unavailable right now — try again shortly";
  return message || `Anthropic API ${res.status}`;
}
