/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { webDb } from "@/lib/services/db";
import { splitSteps } from "@/lib/mealdb";
import { estimateKcalPerServing } from "@/lib/nutrition/estimate";
import { getRecipeDetail } from "@/lib/recipe-bank";
import { findSavedByExternal, getSaved, matchFridge } from "@/lib/services/recipes";
import { RecipeActions } from "./RecipeActions";
import { Ingredients } from "./Ingredients";

type R = {
  title: string;
  thumb_url: string | null;
  category: string | null;
  area: string | null;
  ingredients: { name: string; measure: string }[];
  steps: string[];
  video_url: string | null;
  source_url: string | null;
  minutes: number | null;
  difficulty: string | null;
  kcal: number | null;
  estimated: boolean;
  servings: number | null;
};

export default async function RecipeDetailPage({ params }: { params: Promise<{ source: string; id: string }> }) {
  const { source, id } = await params;
  const db = await webDb();
  let r: R | null = null;
  let savedId: string | null = null;
  let externalId: string | null = null;

  if (source === "themealdb") {
    const m = await getRecipeDetail(source, id);
    if (!m) notFound();
    const saved = await findSavedByExternal(db, id, source);
    savedId = saved?.id ?? null;
    externalId = id;
    r = {
      title: m.title, thumb_url: m.thumb_url, category: m.category, area: m.area, ingredients: m.ingredients,
      steps: m.step_list, video_url: m.video_url, source_url: m.source_url, minutes: m.est_minutes,
      difficulty: m.est_difficulty, estimated: m.times_estimated,
      // the bank states calories per serving; TheMealDB has none until the user saves one
      kcal: m.kcal_per_serving ?? saved?.kcal_per_serving ?? null,
      servings: m.servings ?? saved?.servings ?? null
    };
  } else {
    const s = await getSaved(db, id);
    if (!s) notFound();
    savedId = s.id;
    r = {
      title: s.title, thumb_url: s.thumb_url, category: s.category, area: s.area, ingredients: s.ingredients,
      steps: splitSteps(s.steps ?? ""), video_url: s.video_url, source_url: s.source_url, minutes: s.minutes,
      difficulty: s.difficulty, kcal: s.kcal_per_serving, estimated: false,
      servings: s.servings
    };
  }

  // No source gives calories, so rather than leave the tile empty we work out a rough
  // figure from the ingredient list and label it as the guess it is.
  const servings = r.servings ?? 4;
  const guessedKcal = r.kcal ?? estimateKcalPerServing(r.ingredients, servings);
  const kcalIsGuess = r.kcal == null && guessedKcal != null;

  const have = await matchFridge(db, r.ingredients);
  const missing = have.filter((h) => !h.have).length;

  return (
    <>
      <Link href="/recipes" className="muted" style={{ minHeight: 32, display: "inline-flex", alignItems: "center" }}>‹ Back to recipes</Link>
      <div className="split">
        <div className="grow" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {r.thumb_url ? (
            <img src={r.thumb_url} alt={r.title} style={{ width: "100%", borderRadius: 16, aspectRatio: "16/10", objectFit: "cover" }} />
          ) : (
            <div className="thumb" />
          )}
        </div>
        <div className="side-col">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {r.category && <span className="chip">{r.category}</span>}
            {r.area && <span className="chip">{r.area}</span>}
            {r.difficulty && <span className="chip">{r.difficulty}{r.estimated ? " (est.)" : ""}</span>}
          </div>
          <h1 className="h1">{r.title}</h1>
          <div className="grid" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8 }}>
            <div className="card" style={{ padding: 12 }}><div className="lbl">Time</div><strong>{r.minutes ? `${r.estimated ? "~" : ""}${r.minutes} min` : "—"}</strong></div>
            <div className="card" style={{ padding: 12 }}>
              <div className="lbl">Calories</div>
              <strong>{guessedKcal ? `${kcalIsGuess ? "~" : ""}${guessedKcal} kcal` : "\u2014"}</strong>
              {kcalIsGuess && <div className="muted" style={{ fontSize: 11 }}>estimated</div>}
            </div>
            <div className="card" style={{ padding: 12 }}><div className="lbl">In fridge</div><strong>{r.ingredients.length - missing}/{r.ingredients.length}</strong></div>
          </div>
          <RecipeActions externalId={externalId} savedId={savedId} missing={missing} />
          {source !== "themealdb" && savedId && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link className="btn pri" href={`/recipes/edit?id=${savedId}`}>Edit recipe</Link>
              <Link className="btn" href="/recipes?tab=collection">All my recipes</Link>
            </div>
          )}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {r.source_url && <a className="muted" href={r.source_url} target="_blank" rel="noreferrer">Original source ↗</a>}
            <a className="muted" href={`https://www.allrecipes.com/search?q=${encodeURIComponent(r.title)}`} target="_blank" rel="noreferrer">
              More versions on Allrecipes ↗
            </a>
          </div>
        </div>
      </div>

      <div className="split">
        <Ingredients
          ingredients={r.ingredients}
          have={have.map((h) => h.have)}
          baseServings={r.servings ?? 4}
          servingsKnown={r.servings != null}
          kcalPerServing={guessedKcal}
        />
        <section className="card grow" aria-label="Instructions">
          <h2 className="h2" style={{ marginBottom: 12 }}>Instructions</h2>
          <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 12, lineHeight: 1.55 }}>
            {r.steps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
          {kcalIsGuess && (
            <p className="muted" style={{ marginTop: 14 }}>
              Calories are worked out from the ingredient list, so treat them as a rough figure. Ask Claude to
              “estimate calories for {r.title} and save it” for a closer one.
            </p>
          )}
        </section>
      </div>

    </>
  );
}
