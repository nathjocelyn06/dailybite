import { NextResponse } from "next/server";
import { browseRecipes, browseCategories } from "@/lib/recipe-bank";

export const runtime = "nodejs";

/**
 * GET /api/recipes?query=&category=&maxMinutes=&difficulty=
 * GET /api/recipes?meta=1  -> { categories }
 *
 * Searches the whole recipe bank (TheMealDB + the free bank). Cuisine and main
 * ingredient are no longer browse filters; "Cook from my fridge" still searches
 * by ingredient through its own path.
 */
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  try {
    if (p.get("meta")) return NextResponse.json({ categories: await browseCategories() });

    const { recipes, partial } = await browseRecipes({
      query: p.get("query") || undefined,
      category: p.get("category") || undefined,
      maxMinutes: Number(p.get("maxMinutes") || 0) || undefined,
      difficulty: p.get("difficulty") || undefined
    });
    return NextResponse.json({ recipes, partial });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed", recipes: [] }, { status: 502 });
  }
}
