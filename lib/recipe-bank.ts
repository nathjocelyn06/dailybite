/**
 * The recipe bank: one browser over every free source DailyBite can read.
 *
 *   themealdb  — photos and YouTube videos, no times and no nutrition (we estimate)
 *   bank       — fewer recipes, but real times, a stated difficulty and calories/serving
 *
 * Both are free and keyless, and nothing is scraped. One source failing never empties
 * the browser: each is caught on its own and whatever came back is what you see.
 */
import { searchMeals, getMeal, listCategories, type RecipeCard, type RecipeDetail, type RecipeSource } from "./mealdb";
import { searchFree, getFree, freeMealTypes } from "./freebank";

export type BrowseQuery = {
  query?: string;
  category?: string;
  maxMinutes?: number;
  difficulty?: string;
};

/**
 * TheMealDB states no time or difficulty, so narrowing by either means opening each
 * recipe. That is capped — a browse should never fan out to hundreds of requests.
 */
const DETAIL_BUDGET = 24;

export async function browseRecipes(q: BrowseQuery): Promise<{ recipes: RecipeCard[]; partial: boolean }> {
  const wantsDetail = !!q.maxMinutes || !!q.difficulty;
  const [mealdb, bank] = await Promise.allSettled([
    searchMeals({ query: q.query, category: q.category }),
    searchFree({ query: q.query, category: q.category })
  ]);

  let fromMealdb = mealdb.status === "fulfilled" ? mealdb.value : [];
  const fromBank = bank.status === "fulfilled" ? bank.value : [];

  if (wantsDetail && fromMealdb.length) {
    const details = await Promise.all(fromMealdb.slice(0, DETAIL_BUDGET).map((c) => getMeal(c.external_id).catch(() => null)));
    fromMealdb = details.filter((d): d is RecipeDetail => !!d).map(({ steps: _s, step_list: _l, ...rest }) => rest);
  }

  const fits = (c: RecipeCard) =>
    (!q.maxMinutes || (c.est_minutes ?? Infinity) <= q.maxMinutes) &&
    (!q.difficulty || c.est_difficulty === q.difficulty);

  // The bank first: those cards carry calories, which is what this app is for.
  const recipes = [...fromBank.filter(fits), ...fromMealdb.filter(fits)].slice(0, 48);
  return { recipes, partial: mealdb.status === "rejected" || bank.status === "rejected" };
}

export async function getBankRecipe(source: RecipeSource, id: string): Promise<RecipeDetail | null> {
  return source === "bank" ? getFree(id) : getMeal(id);
}

/** One category list across both sources, for the single "Meal type / diet" filter. */
export async function browseCategories(): Promise<string[]> {
  const [a, b] = await Promise.allSettled([listCategories(), freeMealTypes()]);
  const list = [...(a.status === "fulfilled" ? a.value : []), ...(b.status === "fulfilled" ? b.value : [])];
  return [...new Set(list.map((s) => s.trim()).filter(Boolean))].sort();
}
