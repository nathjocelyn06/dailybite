/**
 * The free recipe bank (https://dummyjson.com/recipes): a small, clean, open set of
 * recipes with no key and nothing scraped — the second source behind the recipe browser.
 *
 * It earns its place next to TheMealDB because of what TheMealDB does not have:
 * a stated prep and cook time, a stated difficulty, servings, and **calories per
 * serving**. A meal logged from one of these is a real number rather than an AI
 * estimate, which is the whole point of DailyBite.
 *
 * It is small enough (50 recipes) that one cached request fetches the lot and the
 * filtering happens in memory — far fewer round trips than a query per filter.
 */
import type { RecipeCard, RecipeDetail } from "./mealdb";

const BASE = "https://dummyjson.com/recipes";

type Raw = {
  id: number;
  name: string;
  ingredients?: string[];
  instructions?: string[];
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  servings?: number;
  difficulty?: string;
  cuisine?: string;
  caloriesPerServing?: number;
  tags?: string[];
  image?: string;
  mealType?: string[];
};

function difficulty(d: string | undefined): RecipeDetail["est_difficulty"] {
  return d === "Hard" ? "Hard" : d === "Medium" ? "Medium" : "Easy";
}

function minutes(r: Raw): number {
  return Math.max(1, (r.prepTimeMinutes ?? 0) + (r.cookTimeMinutes ?? 0));
}

function toCard(r: Raw): RecipeCard {
  return {
    source: "bank",
    external_id: String(r.id),
    title: r.name,
    thumb_url: r.image ?? null,
    category: r.mealType?.[0] ?? null,
    area: r.cuisine ?? null,
    est_minutes: minutes(r),
    est_difficulty: difficulty(r.difficulty),
    kcal_per_serving: r.caloriesPerServing ?? null,
    youtube_id: null
  };
}

function toDetail(r: Raw): RecipeDetail {
  const steps = r.instructions ?? [];
  return {
    ...toCard(r),
    // The bank lists ingredients as plain strings; quantities live in the steps.
    ingredients: (r.ingredients ?? []).map((name) => ({ name, measure: "" })),
    steps: steps.join("\n"),
    step_list: steps,
    video_url: null,
    youtube_id: null,
    source_url: null,
    tags: r.tags ?? [],
    est_minutes: minutes(r),
    est_difficulty: difficulty(r.difficulty),
    servings: r.servings ?? null,
    kcal_per_serving: r.caloriesPerServing ?? null,
    times_estimated: false
  };
}

/** The whole bank, cached for an hour. 50 rows is cheaper to hold than to re-query. */
async function all(): Promise<Raw[]> {
  const res = await fetch(`${BASE}?limit=0`, { next: { revalidate: 3600 } } as RequestInit);
  if (!res.ok) throw new Error(`Recipe bank ${res.status}`);
  const data = (await res.json()) as { recipes?: Raw[] };
  return data.recipes ?? [];
}

const hit = (hay: string | undefined, needle: string) => !!hay && hay.toLowerCase().includes(needle);

export async function searchFree(q: { query?: string; category?: string }): Promise<RecipeCard[]> {
  const rows = await all();
  const query = q.query?.trim().toLowerCase();
  const category = q.category?.trim().toLowerCase();
  return rows
    .filter((r) => {
      if (query && !(hit(r.name, query) || r.tags?.some((t) => hit(t, query)) || r.ingredients?.some((i) => hit(i, query)))) return false;
      // "Meal type / diet" covers both the bank's meal types and its tags
      if (category && !(r.mealType?.some((m) => hit(m, category)) || r.tags?.some((t) => hit(t, category)) || hit(r.cuisine, category))) return false;
      return true;
    })
    .map(toCard);
}

export async function getFree(id: string): Promise<RecipeDetail | null> {
  const res = await fetch(`${BASE}/${encodeURIComponent(id)}`, { next: { revalidate: 3600 } } as RequestInit);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Recipe bank ${res.status}`);
  return toDetail((await res.json()) as Raw);
}

/** Meal types the bank can filter by, folded into the browser's one category list. */
export async function freeMealTypes(): Promise<string[]> {
  const rows = await all();
  return [...new Set(rows.flatMap((r) => r.mealType ?? []))].sort();
}
