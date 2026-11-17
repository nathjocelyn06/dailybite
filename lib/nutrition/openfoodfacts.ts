import "server-only";

/**
 * Open Food Facts: a free, open packaged-food database. No API key, no account.
 * This is what makes barcode scanning and food search work in DailyBite without
 * depending on any paid provider.
 *
 * They ask automated clients to identify themselves in the User-Agent. We send the
 * app name only — never anything identifying the person using it.
 */
const UA = "DailyBite/1.0 (personal food journal)";
const PRODUCT = "https://world.openfoodfacts.org/api/v2/product";
// The long-standing search endpoint. v2 /api/v2/search exists but has been returning
// 503s, and its popularity ordering is worse, so v2 is only a fallback.
const SEARCH_LEGACY = "https://world.openfoodfacts.org/cgi/search.pl";
const SEARCH_V2 = "https://world.openfoodfacts.org/api/v2/search";
const FIELDS = "code,product_name,brands,quantity,serving_size,serving_quantity,nutriments,image_front_small_url";
const TIMEOUT_MS = 10_000;

export type FoodHit = {
  code: string;
  name: string;
  brand?: string;
  image?: string;
  /** Per 100 g/ml — the only figures Open Food Facts always carries. */
  per100: { kcal?: number; protein_g?: number; carbs_g?: number; fat_g?: number };
  /** The pack's own serving, when it declares one. */
  serving?: { label: string; grams?: number };
};

type Nutriments = Record<string, number | string | undefined>;
type Product = {
  code?: string;
  product_name?: string;
  brands?: string;
  quantity?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  nutriments?: Nutriments;
  image_front_small_url?: string;
};

const num = (v: unknown): number | undefined => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : undefined;
};

/** Open Food Facts stores kJ in some entries and kcal in others. */
function kcalPer100(n: Nutriments | undefined): number | undefined {
  if (!n) return undefined;
  const kcal = num(n["energy-kcal_100g"]);
  if (kcal !== undefined) return kcal;
  const kj = num(n["energy_100g"]) ?? num(n["energy-kj_100g"]);
  return kj === undefined ? undefined : Math.round(kj / 4.184);
}

function toHit(p: Product): FoodHit | null {
  const name = (p.product_name ?? "").trim();
  if (!name || !p.code) return null;
  const per100 = {
    kcal: kcalPer100(p.nutriments),
    protein_g: num(p.nutriments?.["proteins_100g"]),
    carbs_g: num(p.nutriments?.["carbohydrates_100g"]),
    fat_g: num(p.nutriments?.["fat_100g"])
  };
  if (per100.kcal === undefined) return null; // a food with no calories is no use to a journal
  const label = (p.serving_size ?? "").trim();
  return {
    code: p.code,
    name,
    brand: (p.brands ?? "").split(",")[0]?.trim() || undefined,
    image: p.image_front_small_url,
    per100,
    serving: label ? { label, grams: num(p.serving_quantity) } : undefined
  };
}

async function get(url: string): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" }, signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** One packaged product by barcode (EAN-13, EAN-8, UPC-A …). */
export async function lookupBarcode(code: string): Promise<FoodHit | null> {
  const clean = code.replace(/\D/g, "");
  if (clean.length < 6 || clean.length > 14) return null;
  const data = (await get(`${PRODUCT}/${clean}.json?fields=${FIELDS}`)) as { status?: number; product?: Product } | null;
  if (!data?.product) return null;
  return toHit(data.product);
}

/**
 * Free-text food search, best matches first.
 * Returns null when the database could not be reached — the caller can then say so
 * instead of claiming the food does not exist. Their search endpoint 503s and rate
 * limits often enough that the difference matters.
 */
export async function searchFoods(query: string, limit = 12): Promise<FoodHit[] | null> {
  const q = query.trim();
  if (q.length < 2) return [];
  const size = Math.min(limit * 2, 24);
  const legacy = `${SEARCH_LEGACY}?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=${size}&fields=${FIELDS}`;
  const v2 = `${SEARCH_V2}?search_terms=${encodeURIComponent(q)}&fields=${FIELDS}&page_size=${size}&sort_by=popularity_key`;
  const data = ((await get(legacy)) ?? (await get(v2))) as { products?: Product[] } | null;
  if (!data) return null;
  const hits = (data?.products ?? []).map(toHit).filter((h): h is FoodHit => !!h);

  // Open Food Facts ranks by popularity, not relevance — a search for "greek yogurt"
  // comes back with bottled water near the top. Score by how much of the query actually
  // appears in the product name and drop entries that match none of it.
  const words = q.toLowerCase().split(/s+/).filter((w) => w.length > 2);
  const score = (h: FoodHit) => {
    const name = `${h.name} ${h.brand ?? ""}`.toLowerCase();
    if (!words.length) return 1;
    const hit = words.filter((w) => name.includes(w)).length;
    return hit === words.length ? 3 : hit > 0 ? 2 : 0;
  };
  const ranked = hits
    .map((h) => ({ h, s: score(h) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.h);
  // If the ranking threw everything away, the raw list still beats an empty screen.
  return (ranked.length ? ranked : hits).slice(0, limit);
}

/** Scale a hit to a weight in grams — what the serving picker shows. */
export function forGrams(hit: FoodHit, grams: number): { kcal?: number; protein_g?: number; carbs_g?: number; fat_g?: number } {
  const f = grams / 100;
  const at = (v: number | undefined) => (v === undefined ? undefined : Math.round(v * f * 10) / 10);
  return { kcal: at(hit.per100.kcal), protein_g: at(hit.per100.protein_g), carbs_g: at(hit.per100.carbs_g), fat_g: at(hit.per100.fat_g) };
}
