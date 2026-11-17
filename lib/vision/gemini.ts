import "server-only";
import { optionalEnv } from "../env";
import type { VisionProvider } from "./types";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/** Per attempt. Two attempts must finish inside Vercel's 60 s function limit. */
const ATTEMPT_TIMEOUT_MS = 22_000;
const ATTEMPTS = 2;

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
      const body = JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [
          {
            role: "user",
            parts: [{ inline_data: { mime_type: image.mediaType, data: image.base64 } }, { text: prompt }]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: maxTokens,
          temperature: 0.2,
          // Reading a plate is perception, not reasoning. Thinking tokens only add
          // latency here, and the whole request has to fit in one serverless call.
          thinkingConfig: { thinkingBudget: 0 }
        }
      });

      let last = "";
      for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
        try {
          const res = await withTimeout((signal) =>
            fetch(`${BASE}/${model}:generateContent`, {
              method: "POST",
              headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
              body,
              signal
            })
          );

          if (res.ok) {
            const data = (await res.json()) as {
              candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
              promptFeedback?: { blockReason?: string };
            };
            if (data.promptFeedback?.blockReason) {
              throw new Error(`the photo was blocked by Gemini (${data.promptFeedback.blockReason})`);
            }
            return data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
          }

          last = await explain(res);
          // 429/5xx are worth one more go; anything else will fail the same way twice.
          if (res.status !== 429 && res.status < 500) throw new Error(last);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.startsWith("the photo was blocked")) throw e;
          last = msg === "timeout" ? "Gemini did not answer in time — try again" : msg;
          if (attempt === ATTEMPTS) break;
        }
      }
      throw new Error(last || "Gemini did not answer");
    }
  };
}

/** Fail fast instead of hanging until the serverless function is killed. */
async function withTimeout(run: (signal: AbortSignal) => Promise<Response>): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);
  try {
    return await run(controller.signal);
  } catch (e) {
    if (controller.signal.aborted) throw new Error("timeout");
    throw e;
  } finally {
    clearTimeout(timer);
  }
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
  if (res.status === 404) return "the Gemini model was not found — check GEMINI_MODEL";
  if (res.status === 429) return "Gemini's free-tier rate limit was hit — wait a minute and try again";
  if (res.status === 503) return "Gemini is overloaded right now — try again in a moment";
  if (res.status >= 500) return "Gemini is unavailable right now — try again shortly";
  return message || `Gemini API ${res.status}`;
}
