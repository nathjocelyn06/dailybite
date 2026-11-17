import Link from "next/link";
import { notFound } from "next/navigation";
import { webDb } from "@/lib/services/db";
import { getSaved } from "@/lib/services/recipes";
import { EMPTY_DRAFT, RecipeForm, type RecipeDraft } from "./RecipeForm";

/**
 * Recipes › write your own. `/recipes/edit` creates, `/recipes/edit?id=<uuid>` edits.
 * A static segment, so it never shadows the `/recipes/[source]/[id]` detail route.
 */
export default async function EditRecipePage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const sp = await searchParams;
  const db = await webDb();

  let draft: RecipeDraft = EMPTY_DRAFT;
  if (sp.id) {
    const r = await getSaved(db, sp.id);
    if (!r) notFound();
    if (r.source !== "mine") {
      // TheMealDB recipes are other people's; we keep them as they are.
      return (
        <>
          <header className="head"><div className="titles"><span className="lbl">Recipes</span><h1 className="h1">Can&apos;t edit this one</h1></div></header>
          <section className="card">
            <p>“{r.title}” came from TheMealDB, so it stays as published. Create your own version instead and change what you like.</p>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <Link className="btn pri" href="/recipes/edit">Write my own</Link>
              <Link className="btn" href={`/recipes/themealdb/${r.external_id}`}>Back to the recipe</Link>
            </div>
          </section>
        </>
      );
    }
    draft = {
      id: r.id,
      title: r.title,
      category: r.category ?? "",
      area: r.area ?? "",
      servings: r.servings != null ? String(r.servings) : "",
      minutes: r.minutes != null ? String(r.minutes) : "",
      difficulty: r.difficulty ?? "",
      kcal_per_serving: r.kcal_per_serving != null ? String(r.kcal_per_serving) : "",
      folder: r.folder ?? "My recipes",
      thumb_url: r.thumb_url ?? "",
      video_url: r.video_url ?? "",
      source_url: r.source_url ?? "",
      steps: r.steps ?? "",
      ingredients: r.ingredients.length ? r.ingredients.map((i) => ({ name: i.name, measure: i.measure })) : [{ name: "", measure: "" }]
    };
  }

  return (
    <>
      <header className="head">
        <div className="titles">
          <span className="lbl">My Kitchen · Recipes</span>
          <h1 className="h1">{draft.id ? "Edit recipe" : "New recipe"}</h1>
        </div>
      </header>
      <RecipeForm draft={draft} />
    </>
  );
}
