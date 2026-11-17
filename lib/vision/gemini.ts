import "server-only";
import { optionalEnv } from "../env";
import type { VisionProvider } from "./types";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/** Per attempt. The whole chain must finish inside Vercel's 60 s function limit. */
const ATTEMPT_TIMEOUT_MS = 13_000;

/**
 * Tried in order. gemini-flash-latest is the obvious choice and the one that hangs
 * when Google is busy — measured timing out at 15 s while 3.1-flash-lite answered the
 * same photo in 4.2 s. So the lite model leads and flash is the backstop.
 */
const MODEL_CHAIN = ["gemini-3.1-flash-lite", "gemini-flash-latest"];

/**
 * Google Gemini vision. Chosen as the default because its free tier needs no card,
 * which keeps the food camera working without a paid account. The key is server-side
 * only — it is never sent to the browser.
 */
export function geminiVision(apiKey: string): VisionProvider {
  // GEMINI_MODEL pins one model; otherwise we work down the chain.
  const pinned = optionalEnv("GEMINI_MODEL");
  const models = pinned ? [pinned, ...MODEL_CHAIN.filter((m) => m !== pinned)] : MODEL_CHAIN;

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
      for (const model of models) {
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
          // A rejected key or a blocked photo fails identically on every model; a 404,
          // a rate limit or an outage is worth trying the next one for.
          if (res.status === 400 && /api key/i.test(last)) throw new Error(last);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.startsWith("the photo was blocked")) throw e;
          last = msg === "timeout" ? "Gemini did not answer in time — try again" : msg;
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
