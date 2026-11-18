/**
 * TheMealDB (https://www.themealdb.com/api.php): free recipe browsing with photos and
 * YouTube links. Key "1" is the public test key. No nutrition data is provided, so
 * calories for these recipes are estimated by Claude (MCP) or entered by the user.
 */
const KEY = process.env.MEALDB_API_KEY || "1";
const BASE = `https://www.themealdb.com/api/json/v1/${KEY}`;

/** Where a browsable recipe came from. Kept as a union so a second source can join. */
export type RecipeSource = "themealdb";

export type RecipeCard = {
  source: RecipeSource;
  external_id: string;
  title: string;
  thumb_url: string | null;
  category: string | null;
  area: string | null;
  /** Present when the source states them, or once a detail lookup has estimated them. */
  est_minutes?: number;
  est_difficulty?: "Easy" | "Medium" | "Hard";
  kcal_per_serving?: number | null;
  youtube_id?: string | null;
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
  servings: number | null;
  kcal_per_serving: number | null;
  /** TheMealDB states no time or difficulty, so ours are guesses; the bank's are not. */
  times_estimated: boolean;
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

/**
 * Turn a recipe's method into steps you can cook from.
 *
 * TheMealDB writes the method as a handful of paragraphs, and a 370-character
 * paragraph holding four separate actions is easy to lose your place in halfway
 * through cooking. So paragraphs come first, and any long one is broken again at
 * sentence ends — one action per line, without rewriting a word of the recipe.
 */
const LONG_STEP = 200;
const MIN_STEP = 80;

export function splitSteps(text: string): string[] {
  const paragraphs = text
    .split(/\r?\n+/)
    .map((s) =>
      s
        .replace(/^\s*[*•·-]+\s*/, "")
        .replace(/^\s*(step\s*\d+[:.)]?|\d+[.)])\s*/i, "")
        .trim()
    )
    .filter((s) => s.length > 2);

  const out: string[] = [];
  for (const para of paragraphs) {
    if (para.length <= LONG_STEP) {
      out.push(para);
      continue;
    }
    // Break after . ! ? only where a capital, digit or quote opens the next sentence,
    // so "350 deg. F", "1/2 oz." and "Mrs. Smith" are not split down the middle.
    const sentences = para.split(/(?<=[.!?])\s+(?=["“(]?[A-Z0-9])/);
    let buf = "";
    for (const sentence of sentences) {
      buf = buf ? `${buf} ${sentence}` : sentence;
      if (buf.length >= MIN_STEP) {
        out.push(buf.trim());
        buf = "";
      }
    }
    const tail = buf.trim();
    if (tail) {
      // a short leftover belongs to the step before it, not on a line of its own
      if (out.length && tail.length < 40) out[out.length - 1] += ` ${tail}`;
      else out.push(tail);
    }
  }
  return out;
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
    servings: null,
    kcal_per_serving: null,
    times_estimated: true,
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
  /** Not a browse filter any more — kept because "Cook from my fridge" searches by it. */
  ingredient?: string;
}): Promise<RecipeCard[]> {
  let list: Raw[] = [];
  if (q.query) list = (await get(`search.php?s=${encodeURIComponent(q.query)}`)).meals ?? [];
  else if (q.ingredient) list = (await get(`filter.php?i=${encodeURIComponent(q.ingredient.trim().replace(/\s+/g, "_"))}`)).meals ?? [];
  else if (q.category) list = (await get(`filter.php?c=${encodeURIComponent(q.category)}`)).meals ?? [];
  else list = await randomMeals(24);

  let cards = list.map(card);
  // filter.php results lack a category, so only narrow when the data is actually there.
  if (q.query && q.category) cards = cards.filter((c) => c.category?.toLowerCase() === q.category!.toLowerCase());
  return cards;
}

export async function getMeal(id: string): Promise<RecipeDetail | null> {
  const data = await get(`lookup.php?i=${encodeURIComponent(id)}`);
  const m = data.meals?.[0];
  return m ? parseMeal(m) : null;
}

/**
 * A varied opening set for the browser.
 *
 * Not `random.php`: every call is the same URL, so Next's fetch cache collapses the
 * whole batch into one response and the browser opens on a single card. Listing a few
 * letters instead gives distinct, cacheable URLs and a real spread of recipes.
 */
export async function randomMeals(n: number): Promise<Raw[]> {
  const letters = "abcdefghijklmnopqrstuvw".split("");
  const picked: string[] = [];
  while (picked.length < 4 && letters.length) picked.push(...letters.splice(Math.floor(Math.random() * letters.length), 1));

  const batches = await Promise.all(picked.map((l) => get(`search.php?f=${l}`).then((d) => d.meals ?? []).catch(() => [] as Raw[])));
  const pool = batches.flat();
  // shuffle so the same letters do not always open with the same meals
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const seen = new Set<string>();
  return pool.filter((m) => !seen.has(String(m.idMeal)) && !!seen.add(String(m.idMeal))).slice(0, n);
}

export async function listCategories(): Promise<string[]> {
  const data = await get("list.php?c=list");
  return (data.meals ?? []).map((m) => String(m.strCategory));
}

