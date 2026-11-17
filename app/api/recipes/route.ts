import { NextResponse } from "next/server";
import { getMeal, searchMeals, listAreas, listCategories, type RecipeDetail } from "@/lib/mealdb";

export const runtime = "nodejs";

/**
 * GET /api/recipes?query=&category=&area=&ingredient=&maxMinutes=&difficulty=
 * GET /api/recipes?meta=1  -> { categories, areas }
 * Time/difficulty are estimates computed from each recipe's detail (fetched for up to 24 results).
 */
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  try {
    if (p.get("meta")) {
      const [categories, areas] = await Promise.all([listCategories(), listAreas()]);
      return NextResponse.json({ categories, areas });
    }
    const cards = await searchMeals({
      query: p.get("query") || undefined,
      category: p.get("category") || undefined,
      area: p.get("area") || undefined,
      ingredient: p.get("ingredient") || undefined
    });
    const maxMinutes = Number(p.get("maxMinutes") || 0);
    const difficulty = p.get("difficulty") || "";
    const wantDetails = maxMinutes > 0 || !!difficulty || p.get("details") === "1";
    if (!wantDetails) return NextResponse.json({ recipes: cards.slice(0, 48) });

    const details = (await Promise.all(cards.slice(0, 24).map((c) => getMeal(c.external_id).catch(() => null)))).filter(
      (d): d is RecipeDetail => !!d
    );
    const filtered = details.filter(
      (d) => (!maxMinutes || d.est_minutes <= maxMinutes) && (!difficulty || d.est_difficulty === difficulty)
    );
    return NextResponse.json({
      recipes: filtered.map(({ steps: _s, step_list: _l, ...rest }) => rest)
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed", recipes: [] }, { status: 502 });
  }
}
