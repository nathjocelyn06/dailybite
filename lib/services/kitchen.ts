import "server-only";
import type { Db } from "./db";
import { dayKey } from "../dates";
import { listFridge } from "./fridge";
import { listShopping } from "./shopping";
import { listSaved, recipesFromIngredients } from "./recipes";

/**
 * My Kitchen hub (web /kitchen and MCP get_kitchen_overview): food at home only.
 * Fridge: stock count, use soon, running low, To buy list. Recipes: saved count and
 * "What can I cook tonight?" ranked by what is already in the fridge, expiring first.
 * Reads the shared records; never copies them. Budget and Calendar are NOT here (v3).
 */
export async function getKitchenOverview(db: Db, opts: { suggestions?: boolean } = {}) {
  const today = dayKey(new Date(), db.tz);
  const [stock, shopping, saved] = await Promise.all([listFridge(db), listShopping(db, false), listSaved(db)]);
  const useSoon = stock.filter((s) => s.expiry === "use_soon" || s.expiry === "expired").slice(0, 6);

  // TheMealDB lookups are network calls: keep them optional and never let them break the page.
  let cookTonight: { external_id: string; title: string; thumb_url: string | null; matches: string[]; score: number }[] = [];
  if (opts.suggestions !== false && stock.length) {
    cookTonight = await recipesFromIngredients(db, { ingredients: useSoon.map((u) => u.name), limit: 6 })
      .then((r) => r.recipes.slice(0, 6).map((x) => ({ external_id: x.external_id, title: x.title, thumb_url: x.thumb_url ?? null, matches: x.matches, score: x.score })))
      .catch(() => []);
  }

  return {
    date: today,
    timezone: db.tz,
    fridge: {
      total: stock.length,
      use_soon: useSoon,
      low_stock: stock.filter((s) => s.low).slice(0, 6)
    },
    to_buy: { open: shopping.length, items: shopping.slice(0, 8) },
    recipes: { saved: saved.length },
    cook_tonight: cookTonight
  };
}

export type KitchenOverview = Awaited<ReturnType<typeof getKitchenOverview>>;
