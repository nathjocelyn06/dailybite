import "server-only";
import { type Db, must, clean } from "./db";
import { getMeal, searchMeals, type RecipeCard, type RecipeDetail, type RecipeSource } from "../mealdb";
import { getBankRecipe } from "../recipe-bank";
import { listFridge } from "./fridge";
import { addShopping } from "./shopping";

export type SavedRecipe = {
  id: string;
  source: "mine" | "themealdb";
  external_id: string | null;
  title: string;
  category: string | null;
  area: string | null;
  thumb_url: string | null;
  video_url: string | null;
  source_url: string | null;
  ingredients: { name: string; measure: string }[];
  steps: string | null;
  minutes: number | null;
  difficulty: "Easy" | "Medium" | "Hard" | null;
  diet_tags: string[];
  kcal_per_serving: number | null;
  servings: number | null;
  folder: string | null;
};

const COLS =
  "id,source,external_id,title,category,area,thumb_url,video_url,source_url,ingredients,steps,minutes,difficulty,diet_tags,kcal_per_serving,servings,folder";

export { searchMeals, getMeal };

export async function listSaved(db: Db, folder?: string): Promise<SavedRecipe[]> {
  let q = db.sb.from("recipes").select(COLS).eq("user_id", db.userId);
  if (folder) q = q.eq("folder", folder);
  return must(await q.order("updated_at", { ascending: false }), "list recipes") as SavedRecipe[];
}

export async function getSaved(db: Db, id: string): Promise<SavedRecipe | null> {
  return must(await db.sb.from("recipes").select(COLS).eq("user_id", db.userId).eq("id", id).maybeSingle(), "get recipe") as SavedRecipe | null;
}

/**
 * Where a browsed recipe lands in the user's own table.
 *
 * TheMealDB recipes are kept as a reference (`source: 'themealdb'` + its id) because the
 * API can always be asked again. Free-bank recipes are **copied in whole** as the user's
 * own, keyed `bank:<id>`: they carry stated times and calories per serving that are worth
 * keeping even if the source goes away, and the schema's source check only allows
 * 'mine' and 'themealdb', so this needs no migration.
 */
export function savedKey(source: RecipeSource, externalId: string): { source: "mine" | "themealdb"; external_id: string } {
  return source === "bank" ? { source: "mine", external_id: `bank:${externalId}` } : { source: "themealdb", external_id: externalId };
}

export async function findSavedByExternal(db: Db, externalId: string, source: RecipeSource = "themealdb"): Promise<SavedRecipe | null> {
  const key = savedKey(source, externalId);
  return must(
    await db.sb.from("recipes").select(COLS).eq("user_id", db.userId).eq("source", key.source).eq("external_id", key.external_id).maybeSingle(),
    "find recipe"
  ) as SavedRecipe | null;
}

/** Save a TheMealDB recipe (by id) or the user's own recipe. Upserts, so saving twice is safe. */
export async function saveRecipe(
  db: Db,
  input:
    | { source: "themealdb"; external_id: string; folder?: string; kcal_per_serving?: number; servings?: number }
    | { source: "bank"; external_id: string; folder?: string }
    | ({ source: "mine"; title: string } & Partial<Omit<SavedRecipe, "id" | "external_id" | "source">>)
): Promise<SavedRecipe> {
  if (input.source === "bank") {
    const b = await getBankRecipe("bank", input.external_id);
    if (!b) throw new Error(`Recipe ${input.external_id} is not in the recipe bank`);
    const key = savedKey("bank", input.external_id);
    const row = {
      user_id: db.userId,
      source: key.source,
      external_id: key.external_id,
      title: b.title,
      category: b.category,
      area: b.area,
      thumb_url: b.thumb_url,
      video_url: null,
      source_url: null,
      ingredients: b.ingredients,
      steps: b.steps,
      minutes: b.est_minutes,
      difficulty: b.est_difficulty,
      diet_tags: b.tags.filter((t) => /vegan|vegetarian|gluten|dairy/i.test(t)).map((t) => t.toLowerCase()),
      kcal_per_serving: b.kcal_per_serving,
      servings: b.servings,
      folder: input.folder ?? "Saved"
    };
    return must(
      await db.sb.from("recipes").upsert(row, { onConflict: "user_id,source,external_id" }).select(COLS).single(),
      "save recipe"
    ) as SavedRecipe;
  }
  if (input.source === "themealdb") {
    const m = await getMeal(input.external_id);
    if (!m) throw new Error(`Recipe ${input.external_id} not found on TheMealDB`);
    const row = {
      user_id: db.userId,
      source: "themealdb",
      external_id: m.external_id,
      title: m.title,
      category: m.category,
      area: m.area,
      thumb_url: m.thumb_url,
      video_url: m.video_url,
      source_url: m.source_url,
      ingredients: m.ingredients,
      steps: m.steps,
      minutes: m.est_minutes,
      difficulty: m.est_difficulty,
      diet_tags: m.category && /vegan|vegetarian/i.test(m.category) ? [m.category.toLowerCase()] : [],
      folder: input.folder ?? "Saved",
      ...clean({ kcal_per_serving: input.kcal_per_serving, servings: input.servings })
    };
    return must(
      await db.sb.from("recipes").upsert(row, { onConflict: "user_id,source,external_id" }).select(COLS).single(),
      "save recipe"
    ) as SavedRecipe;
  }
  const { source: _s, ...rest } = input;
  return must(
    await db.sb.from("recipes").insert({ ...clean(rest), source: "mine", user_id: db.userId }).select(COLS).single(),
    "create recipe"
  ) as SavedRecipe;
}

export async function updateSaved(db: Db, id: string, patch: Partial<SavedRecipe>): Promise<SavedRecipe> {
  const { id: _i, source: _s, external_id: _e, ...rest } = patch;
  return must(
    await db.sb.from("recipes").update(clean(rest)).eq("user_id", db.userId).eq("id", id).select(COLS).single(),
    "update recipe"
  ) as SavedRecipe;
}

export async function deleteSaved(db: Db, id: string): Promise<void> {
  must(await db.sb.from("recipes").delete().eq("user_id", db.userId).eq("id", id), "delete recipe");
}

/** Which recipe ingredients are already in the fridge (simple name match). */
export async function matchFridge(db: Db, ingredients: { name: string }[]) {
  const stock = await listFridge(db);
  const names = stock.map((s) => s.name.toLowerCase());
  return ingredients.map((i) => {
    const n = i.name.toLowerCase();
    const have = names.some((s) => s.includes(n) || n.includes(s));
    return { name: i.name, have };
  });
}

export async function addMissingToShopping(db: Db, recipe: { ingredients: { name: string; measure: string }[] }, recipeId?: string) {
  const matched = await matchFridge(db, recipe.ingredients);
  const missing = recipe.ingredients.filter((_, i) => !matched[i].have);
  const added = await addShopping(
    db,
    missing.map((m) => ({ name: m.name, qty: 1, unit: m.measure || "pcs", reason: "recipe" as const, recipe_id: recipeId }))
  );
  return { missing: missing.map((m) => m.name), added: added.length };
}

/**
 * AI-ingredient-scanner backend: ranks TheMealDB recipes by how many of the given
 * ingredients (plus fridge stock, expiring first) they use.
 */
export async function recipesFromIngredients(
  db: Db,
  input: { ingredients: string[]; use_fridge?: boolean; limit?: number }
): Promise<{ used_ingredients: string[]; recipes: (RecipeCard & { matches: string[]; score: number })[] }> {
  const fromFridge = input.use_fridge === false ? [] : (await listFridge(db)).map((f) => f.name); // already expiry-sorted
  const pool = dedupe([...input.ingredients, ...fromFridge]).slice(0, 8);
  const byId = new Map<string, RecipeCard & { matches: string[]; score: number }>();
  const lookups = await Promise.all(pool.map((ing) => searchMeals({ ingredient: ing }).catch(() => [] as RecipeCard[])));
  lookups.forEach((cards, idx) => {
    const ing = pool[idx];
    const weight = idx < input.ingredients.length ? 2 : fromFridge.indexOf(ing) < 3 ? 1.5 : 1; // scanned + expiring first
    for (const c of cards) {
      const cur = byId.get(c.external_id) ?? { ...c, matches: [], score: 0 };
      cur.matches.push(ing);
      cur.score += weight;
      byId.set(c.external_id, cur);
    }
  });
  const recipes = [...byId.values()].sort((a, b) => b.score - a.score).slice(0, input.limit ?? 12);
  return { used_ingredients: pool, recipes };
}

function dedupe(list: string[]) {
  const seen = new Set<string>();
  return list.map((s) => s.trim()).filter((s) => s && !seen.has(s.toLowerCase()) && !!seen.add(s.toLowerCase()));
}

export type { RecipeCard, RecipeDetail };
