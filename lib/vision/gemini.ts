import "server-only";
import { optionalEnv } from "../env";
import type { VisionProvider } from "./types";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Google Gemini vision. Chosen as the default because its free tier needs no card,
 * which keeps the food camera working without a paid account. The key is server-side
 * only — it is never sent to the browser.
 */
export function geminiVision(apiKey: string): VisionProvider {
  // A stable alias on purpose: Google retires numbered models for new keys
  // (gemini-2.5-flash already 404s for them), and this always resolves to the current flash.
  const model = optionalEnv("GEMINI_MODEL") ?? "gemini-flash-latest";
  return {
    name: "Gemini",
    async analyse({ image, system, prompt, maxTokens = 1500 }) {
      const res = await fetch(`${BASE}/${model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [
            {
              role: "user",
              parts: [{ inline_data: { mime_type: image.mediaType, data: image.base64 } }, { text: prompt }]
            }
          ],
          generationConfig: { responseMimeType: "application/json", maxOutputTokens: maxTokens, temperature: 0.2 }
        })
      });
      if (!res.ok) throw new Error(await explain(res));

      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
        promptFeedback?: { blockReason?: string };
      };
      if (data.promptFeedback?.blockReason) {
        throw new Error(`the photo was blocked by Gemini (${data.promptFeedback.blockReason})`);
      }
      return data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
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
  if (res.status === 400 && /api key not valid/i.test(message)) return "the Gemini API key was rejected";
  if (res.status === 403) return "the Gemini key is not allowed to use this model";
  if (res.status === 404) return `the Gemini model was not found — check GEMINI_MODEL`;
  if (res.status === 429) return "Gemini's free-tier rate limit was hit — wait a minute and try again";
  if (res.status >= 500) return "Gemini is unavailable right now — try again shortly";
  return message || `Gemini API ${res.status}`;
}
