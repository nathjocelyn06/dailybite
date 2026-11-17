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
        const detail = await res.text().catch(() => "");
        throw new Error(`Anthropic API ${res.status}${detail ? `: ${detail.slice(0, 160)}` : ""}`);
      }
      const data = (await res.json()) as { content?: { type: string; text?: string }[] };
      return data.content?.find((c) => c.type === "text")?.text ?? "";
    }
  };
}
