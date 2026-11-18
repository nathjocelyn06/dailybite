/**
 * The recipe browser: one layer over every source DailyBite can read for free.
 *
 * Right now that is TheMealDB alone. A second source was tried and dropped: it was
 * demo data — ingredients with no quantities and five-line methods — and you cannot
 * cook from that. A source has to carry measures and a real method to earn a place
 * here. The `source` field stays on every card and in every tool so a genuine second
 * source can be added without touching the pages again.
 */
import { searchMeals, getMeal, listCategories, type RecipeCard, type RecipeDetail, type RecipeSource } from "./mealdb";

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
  const found = await Promise.allSettled([searchMeals({ query: q.query, category: q.category })]);
  const first = found[0];
  if (first.status === "rejected") return { recipes: [], partial: true };

  let cards = first.value;
  if (wantsDetail && cards.length) {
    const details = await Promise.all(cards.slice(0, DETAIL_BUDGET).map((c) => getMeal(c.external_id).catch(() => null)));
    cards = details.filter((d): d is RecipeDetail => !!d).map(({ steps: _s, step_list: _l, ...rest }) => rest);
  }

  const fits = (c: RecipeCard) =>
    (!q.maxMinutes || (c.est_minutes ?? Infinity) <= q.maxMinutes) &&
    (!q.difficulty || c.est_difficulty === q.difficulty);

  return { recipes: cards.filter(fits).slice(0, 48), partial: false };
}

export async function getRecipeDetail(_source: RecipeSource, id: string): Promise<RecipeDetail | null> {
  return getMeal(id);
}

/** The category list the "Meal type / diet" filter offers. */
export async function browseCategories(): Promise<string[]> {
  const list = await listCategories().catch(() => [] as string[]);
  return [...new Set(list.map((s) => s.trim()).filter(Boolean))].sort();
}
