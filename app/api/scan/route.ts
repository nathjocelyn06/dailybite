import { NextResponse } from "next/server";
import { webDb } from "@/lib/services/db";
import { downloadPhoto } from "@/lib/services/photos";
import { optionalEnv } from "@/lib/env";
import type { ScanDraft, ScanMode } from "@/lib/scan-types";

export const runtime = "nodejs";
export const maxDuration = 60;

const PROMPTS: Record<ScanMode, string> = {
  calorie:
    'Identify each food in this meal photo. Estimate a typical portion and nutrition. JSON: {"title": string, "rows":[{"name","portion","kcal","protein_g","carbs_g","fat_g","unsure":bool}],"note": string}',
  receipt:
    'Read this food receipt. JSON: {"merchant","date":"YYYY-MM-DD"|null,"total":number,"category":"groceries"|"daily_food"|"snacks_drinks"|"other","rows":[{"name","qty","unit","price","fridge_category":"veg_fruit"|"protein"|"dairy_eggs"|"frozen"|"pantry"|"other"|null,"expires_in_days":number|null,"unsure":bool}]}',
  ingredient:
    'List the groceries/ingredients visible. JSON: {"rows":[{"name","qty","unit","fridge_category":"veg_fruit"|"protein"|"dairy_eggs"|"frozen"|"pantry"|"other","expires_in_days":number,"unsure":bool}]}',
  recipe_finder: 'List the ingredients visible so recipes can be suggested. JSON: {"rows":[{"name","unsure":bool}]}',
  journal: 'Describe the meal in a few words for a journal caption. JSON: {"title": string, "rows": [], "note": string}',
  grocery:
    'Identify the purchased grocery items. JSON: {"rows":[{"name","qty","unit","fridge_category":"veg_fruit"|"protein"|"dairy_eggs"|"frozen"|"pantry"|"other","expires_in_days":number,"unsure":bool}]}'
};

/**
 * POST { path: string (storage path of an uploaded photo), mode: ScanMode }
 * Returns a DRAFT only. Nothing is saved until the user confirms in /snap.
 * Without ANTHROPIC_API_KEY returns an empty draft for manual entry.
 */
export async function POST(req: Request) {
  let db;
  try {
    db = await webDb();
  } catch {
    return NextResponse.json({ error: "Server is not configured (check SUPABASE_SERVICE_ROLE_KEY and OWNER_USER_ID)" }, { status: 500 });
  }
  const body = (await req.json().catch(() => ({}))) as { path?: string; mode?: ScanMode };
  const mode: ScanMode = body.mode && body.mode in PROMPTS ? body.mode : "calorie";
  const empty: ScanDraft = { mode, rows: [], ai: false };
  const key = optionalEnv("ANTHROPIC_API_KEY");
  if (!key || !body.path) return NextResponse.json(empty);

  try {
    const img = await downloadPhoto(db, body.path);
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: optionalEnv("ANTHROPIC_MODEL") ?? "claude-sonnet-5-5",
        max_tokens: 1200,
        system:
          "You extract structured data from food photos for a personal food journal. Reply with ONLY one JSON object, no prose. Estimates are fine; mark low-confidence rows unsure:true. Never comment on the person's body or health.",
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: img.mediaType, data: img.base64 } },
              { type: "text", text: PROMPTS[mode] }
            ]
          }
        ]
      })
    });
    if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = data.content?.find((c) => c.type === "text")?.text ?? "{}";
    const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as Partial<ScanDraft>;
    const draft: ScanDraft = { ...empty, ...json, mode, rows: Array.isArray(json.rows) ? json.rows : [], ai: true };
    return NextResponse.json(draft);
  } catch (e) {
    return NextResponse.json({ ...empty, note: `AI scan unavailable (${e instanceof Error ? e.message : "error"}). Fill in by hand.` });
  }
}
