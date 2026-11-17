import { NextResponse } from "next/server";
import { webDb } from "@/lib/services/db";
import { downloadPhoto } from "@/lib/services/photos";
import { getVisionProvider, extractJson } from "@/lib/vision";
import { lookupNutrition, nutritionixConfigured } from "@/lib/nutrition/nutritionix";
import type { ScanDraft, ScanMode, ScanRow } from "@/lib/scan-types";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM =
  "You read food photos for a personal food journal and reply with ONLY one JSON object — no prose, no code fences. " +
  "Everything you return is an estimate: when you are not confident about an item, still give your best guess and set unsure:true. " +
  "Never comment on the person's body, weight or health.";

const PROMPTS: Record<ScanMode, string> = {
  calorie:
    'Identify every distinct food and drink in this meal photo and estimate the nutrition of each one separately. ' +
    'Judge portion size from the photo (plate, bowl, cutlery and hands are useful scale references). ' +
    'JSON: {"title": short meal name, "slot": "breakfast"|"lunch"|"dinner"|"snack" (what this meal looks like), ' +
    '"rows":[{"name", "portion": human-readable like "1 bowl" or "2 slices", "grams": number, "kcal": number, ' +
    '"protein_g": number, "carbs_g": number, "fat_g": number, "ingredients": [visible ingredients], "unsure": bool}], ' +
    '"note": one short sentence on anything you could not judge}',
  receipt:
    'Read this food receipt. JSON: {"merchant","date":"YYYY-MM-DD"|null,"total":number,"category":"groceries"|"daily_food"|"snacks_drinks"|"other","rows":[{"name","qty","unit","price","fridge_category":"veg_fruit"|"protein"|"dairy_eggs"|"frozen"|"pantry"|"other"|null,"expires_in_days":number|null,"unsure":bool}]}',
  ingredient:
    'List the groceries/ingredients visible. JSON: {"rows":[{"name","qty","unit","fridge_category":"veg_fruit"|"protein"|"dairy_eggs"|"frozen"|"pantry"|"other","expires_in_days":number,"unsure":bool}]}',
  recipe_finder: 'List the ingredients visible so recipes can be suggested. JSON: {"rows":[{"name","unsure":bool}]}',
  journal: 'Describe the meal in a few words for a journal caption. JSON: {"title": string, "rows": [], "note": string}',
  grocery:
    'Identify the purchased grocery items. JSON: {"rows":[{"name","qty","unit","fridge_category":"veg_fruit"|"protein"|"dairy_eggs"|"frozen"|"pantry"|"other","expires_in_days":number,"unsure":bool}]}'
};

const SLOTS = ["breakfast", "lunch", "dinner", "snack"] as const;
const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v * 10) / 10 : undefined;

/** Keep only what the form understands, and never trust a model's types. */
function cleanRow(raw: unknown): ScanRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === "string" ? r.name.trim() : "";
  if (!name) return null;
  const ingredients = Array.isArray(r.ingredients)
    ? r.ingredients.filter((x): x is string => typeof x === "string" && !!x.trim()).slice(0, 12)
    : undefined;
  return {
    name,
    portion: typeof r.portion === "string" ? r.portion : undefined,
    grams: num(r.grams),
    ingredients: ingredients?.length ? ingredients : undefined,
    qty: num(r.qty),
    unit: typeof r.unit === "string" ? r.unit : undefined,
    kcal: num(r.kcal),
    protein_g: num(r.protein_g),
    carbs_g: num(r.carbs_g),
    fat_g: num(r.fat_g),
    price: num(r.price),
    fridge_category: (["veg_fruit", "protein", "dairy_eggs", "frozen", "pantry", "other"] as const).includes(
      r.fridge_category as never
    )
      ? (r.fridge_category as ScanRow["fridge_category"])
      : undefined,
    expires_in_days: num(r.expires_in_days),
    unsure: r.unsure === true
  };
}

/**
 * POST { path: storage path of an uploaded photo, mode: ScanMode }
 * Returns a DRAFT only — nothing is written to the journal until the user confirms in /snap.
 * With no vision provider configured it returns an empty draft so the form can be filled by hand.
 */
export async function POST(req: Request) {
  let db;
  try {
    db = await webDb();
  } catch {
    return NextResponse.json(
      { error: "Server is not configured (check SUPABASE_SERVICE_ROLE_KEY and OWNER_USER_ID)" },
      { status: 500 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { path?: string; mode?: ScanMode };
  const mode: ScanMode = body.mode && body.mode in PROMPTS ? body.mode : "calorie";
  const empty: ScanDraft = { mode, rows: [], ai: false };

  const provider = getVisionProvider();
  if (!provider) {
    return NextResponse.json({
      ...empty,
      note: "No vision model is connected on the server, so this photo was not analysed. Fill it in below."
    });
  }
  if (!body.path) return NextResponse.json({ ...empty, note: "No photo was uploaded. Fill the meal in by hand." });

  try {
    const img = await downloadPhoto(db, body.path);
    const text = await provider.analyse({
      image: { base64: img.base64, mediaType: img.mediaType },
      system: SYSTEM,
      prompt: PROMPTS[mode]
    });
    const json = extractJson<Partial<ScanDraft> & { rows?: unknown[] }>(text);
    if (!json) {
      return NextResponse.json({ ...empty, note: `${provider.name} replied in a format we couldn't read. Try again, or fill it in by hand.` });
    }

    let rows = (Array.isArray(json.rows) ? json.rows : []).map(cleanRow).filter((r): r is ScanRow => !!r);

    // The model names the food and judges the portion; a nutrition database knows the
    // numbers. Where a lookup succeeds its values win; where it fails we keep the model
    // estimate, so a database outage never costs us a scan.
    if (mode === "calorie" && rows.length && nutritionixConfigured()) {
      const found = await lookupNutrition(rows.map((x) => ({ name: x.name, portion: x.portion, grams: x.grams })));
      rows = rows.map((row, i) => {
        const hit = found.find((f) => f.index === i);
        if (!hit || hit.kcal === undefined) return { ...row, source: "ai" as const };
        return {
          ...row,
          grams: hit.grams ?? row.grams,
          kcal: hit.kcal,
          protein_g: hit.protein_g ?? row.protein_g,
          carbs_g: hit.carbs_g ?? row.carbs_g,
          fat_g: hit.fat_g ?? row.fat_g,
          source: "db" as const
        };
      });
    }
    const slot = SLOTS.includes(json.slot as never) ? (json.slot as ScanDraft["slot"]) : undefined;

    return NextResponse.json({
      ...empty,
      ...json,
      mode,
      rows,
      slot,
      ai: true,
      note: typeof json.note === "string" ? json.note : undefined
    } satisfies ScanDraft);
  } catch (e) {
    return NextResponse.json({
      ...empty,
      note: `${provider.name} scan failed (${e instanceof Error ? e.message : "error"}). Retry, or fill it in by hand.`
    });
  }
}
