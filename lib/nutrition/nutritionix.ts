import "server-only";
import { optionalEnv } from "../env";

const ENDPOINT = "https://trackapi.nutritionix.com/v2/natural/nutrients";
const TIMEOUT_MS = 12_000;

export type LookupItem = { name: string; portion?: string; grams?: number };
export type LookupResult = {
  /** Index of the item we asked about, so callers can merge by position. */
  index: number;
  matched: string;
  grams?: number;
  kcal?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
};

type NixFood = {
  food_name?: string;
  serving_weight_grams?: number | null;
  nf_calories?: number | null;
  nf_protein?: number | null;
  nf_total_carbohydrate?: number | null;
  nf_total_fat?: number | null;
};

const r1 = (v: number | null | undefined): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? Math.round(v * 10) / 10 : undefined;

export function nutritionixConfigured(): boolean {
  return !!(optionalEnv("NUTRITIONIX_APP_ID") && optionalEnv("NUTRITIONIX_API_KEY"));
}

/** "150 g chicken breast" / "1 bowl kimchi fried rice" — the phrasing their parser expects. */
function phrase(item: LookupItem): string {
  const amount = item.grams ? `${Math.round(item.grams)} g` : (item.portion ?? "").trim();
  return `${amount} ${item.name}`.trim();
}

/**
 * Real nutrition numbers for foods a vision model identified.
 *
 * The model is good at *naming* what is on the plate and judging portion size, and bad
 * at remembering exact macros. So we ask it for names and portions, then look the
 * numbers up here. Returns [] when unconfigured or on any failure — callers keep the
 * model's estimates in that case, so a lookup outage never blocks a scan.
 */
export async function lookupNutrition(items: LookupItem[]): Promise<LookupResult[]> {
  const appId = optionalEnv("NUTRITIONIX_APP_ID");
  const apiKey = optionalEnv("NUTRITIONIX_API_KEY");
  if (!appId || !apiKey || !items.length) return [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // One line per item keeps the order, so results map back by index.
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", "x-app-id": appId, "x-app-key": apiKey },
      body: JSON.stringify({ query: items.map(phrase).join("\n") }),
      signal: controller.signal
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { foods?: NixFood[] };
    const foods = data.foods ?? [];
    return foods.slice(0, items.length).map((f, i) => ({
      index: i,
      matched: f.food_name ?? items[i].name,
      grams: r1(f.serving_weight_grams),
      kcal: r1(f.nf_calories),
      protein_g: r1(f.nf_protein),
      carbs_g: r1(f.nf_total_carbohydrate),
      fat_g: r1(f.nf_total_fat)
    }));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
