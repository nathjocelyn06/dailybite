/**
 * TheMealDB (https://www.themealdb.com/api.php): free recipe browsing with photos and
 * YouTube links. Key "1" is the public test key. No nutrition data is provided, so
 * calories for these recipes are estimated by Claude (MCP) or entered by the user.
 */
const KEY = process.env.MEALDB_API_KEY || "1";
const BASE = `https://www.themealdb.com/api/json/v1/${KEY}`;

export type RecipeCard = {
  source: "themealdb";
  external_id: string;
  title: string;
  thumb_url: string | null;
  category: string | null;
  area: string | null;
};

export type RecipeDetail = RecipeCard & {
  ingredients: { name: string; measure: string }[];
  steps: string;
  step_list: string[];
  video_url: string | null;
  youtube_id: string | null;
  source_url: string | null;
  tags: string[];
  est_minutes: number;
  est_difficulty: "Easy" | "Medium" | "Hard";
};

type Raw = Record<string, string | null | undefined>;

export function youtubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

export function youtubeEmbed(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}`;
}

export function splitSteps(text: string): string[] {
  return text
    .split(/\r?\n+/)
    .map((s) => s.replace(/^\s*(step\s*\d+[:.)]?|\d+[.)])\s*/i, "").trim())
    .filter((s) => s.length > 2);
}

/** Rough, clearly-labelled estimates (TheMealDB has no time/difficulty fields). */
export function estimate(ingredientCount: number, stepCount: number) {
  const est_minutes = Math.min(180, Math.max(10, 10 + stepCount * 6 + ingredientCount * 1.5));
  const score = ingredientCount + stepCount * 1.5;
  const est_difficulty: RecipeDetail["est_difficulty"] = score <= 14 ? "Easy" : score <= 24 ? "Medium" : "Hard";
  return { est_minutes: Math.round(est_minutes / 5) * 5, est_difficulty };
}

export function parseMeal(m: Raw): RecipeDetail {
  const ingredients: { name: string; measure: string }[] = [];
  for (let i = 1; i <= 20; i++) {
    const name = (m[`strIngredient${i}`] ?? "").trim();
    if (name) ingredients.push({ name, measure: (m[`strMeasure${i}`] ?? "").trim() });
  }
  const steps = (m.strInstructions ?? "").trim();
  const step_list = splitSteps(steps);
  const video_url = m.strYoutube?.trim() || null;
  return {
    source: "themealdb",
    external_id: String(m.idMeal),
    title: String(m.strMeal ?? "Untitled"),
    thumb_url: m.strMealThumb ?? null,
    category: m.strCategory ?? null,
    area: m.strArea ?? null,
    ingredients,
    steps,
    step_list,
    video_url,
    youtube_id: youtubeId(video_url),
    source_url: m.strSource?.trim() || null,
    tags: (m.strTags ?? "").split(",").map((t) => t.trim()).filter(Boolean),
    ...estimate(ingredients.length, step_list.length)
  };
}

function card(m: Raw): RecipeCard {
  return {
    source: "themealdb",
    external_id: String(m.idMeal),
    title: String(m.strMeal ?? "Untitled"),
    thumb_url: m.strMealThumb ?? null,
    category: m.strCategory ?? null,
    area: m.strArea ?? null
  };
}

async function get(path: string): Promise<{ meals: Raw[] | null }> {
  const res = await fetch(`${BASE}/${path}`, { next: { revalidate: 3600 } } as RequestInit);
  if (!res.ok) throw new Error(`TheMealDB ${res.status}`);
  return (await res.json()) as { meals: Raw[] | null };
}

export async function searchMeals(q: {
  query?: string;
  category?: string;
  area?: string;
  ingredient?: string;
}): Promise<RecipeCard[]> {
  let list: Raw[] = [];
  if (q.query) list = (await get(`search.php?s=${encodeURIComponent(q.query)}`)).meals ?? [];
  else if (q.ingredient) list = (await get(`filter.php?i=${encodeURIComponent(q.ingredient.trim().replace(/\s+/g, "_"))}`)).meals ?? [];
  else if (q.category) list = (await get(`filter.php?c=${encodeURIComponent(q.category)}`)).meals ?? [];
  else if (q.area) list = (await get(`filter.php?a=${encodeURIComponent(q.area)}`)).meals ?? [];
  else list = await randomMeals(12);

  let cards = list.map(card);
  // filter.php results lack category/area; apply secondary filters only when the data exists.
  if (q.query && q.category) cards = cards.filter((c) => c.category?.toLowerCase() === q.category!.toLowerCase());
  if (q.query && q.area) cards = cards.filter((c) => c.area?.toLowerCase() === q.area!.toLowerCase());
  return cards;
}

export async function getMeal(id: string): Promise<RecipeDetail | null> {
  const data = await get(`lookup.php?i=${encodeURIComponent(id)}`);
  const m = data.meals?.[0];
  return m ? parseMeal(m) : null;
}

export async function randomMeals(n: number): Promise<Raw[]> {
  const all = await Promise.all(Array.from({ length: n }, () => get("random.php").then((d) => d.meals?.[0]).catch(() => undefined)));
  const seen = new Set<string>();
  return all.filter((m): m is Raw => !!m && !seen.has(String(m.idMeal)) && !!seen.add(String(m.idMeal)));
}

export async function listCategories(): Promise<string[]> {
  const data = await get("list.php?c=list");
  return (data.meals ?? []).map((m) => String(m.strCategory));
}

export async function listAreas(): Promise<string[]> {
  const data = await get("list.php?a=list");
  return (data.meals ?? []).map((m) => String(m.strArea));
}
