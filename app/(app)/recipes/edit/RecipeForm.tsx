"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import { createMyRecipeAction, updateMyRecipeAction } from "../../actions";

type Row = { name: string; measure: string };

export type RecipeDraft = {
  id?: string;
  title: string;
  category: string;
  area: string;
  servings: string;
  minutes: string;
  difficulty: string;
  kcal_per_serving: string;
  folder: string;
  thumb_url: string;
  video_url: string;
  source_url: string;
  steps: string;
  ingredients: Row[];
};

export const EMPTY_DRAFT: RecipeDraft = {
  title: "", category: "", area: "", servings: "", minutes: "", difficulty: "",
  kcal_per_serving: "", folder: "My recipes", thumb_url: "", video_url: "", source_url: "",
  steps: "", ingredients: [{ name: "", measure: "" }]
};

const num = (v: string) => (v.trim() === "" ? null : Number(v));
const str = (v: string) => (v.trim() === "" ? null : v.trim());

/** Create or edit one of the user's own recipes. Saved to the same `recipes` table as TheMealDB favourites. */
export function RecipeForm({ draft }: { draft: RecipeDraft }) {
  const router = useRouter();
  const editing = !!draft.id;
  const [f, setF] = useState<RecipeDraft>(draft);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  const setRow = (i: number, patch: Partial<Row>) =>
    setF({ ...f, ingredients: f.ingredients.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const addRow = () => setF({ ...f, ingredients: [...f.ingredients, { name: "", measure: "" }] });
  const removeRow = (i: number) =>
    setF({ ...f, ingredients: f.ingredients.length > 1 ? f.ingredients.filter((_, j) => j !== i) : f.ingredients });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.title.trim()) return setErr("Give the recipe a name.");
    const ingredients = f.ingredients
      .filter((r) => r.name.trim())
      .map((r) => ({ name: r.name.trim(), measure: r.measure.trim() }));
    if (!ingredients.length) return setErr("Add at least one ingredient.");
    if (f.servings.trim() && !(Number(f.servings) > 0)) return setErr("Servings must be a positive number.");
    if (f.minutes.trim() && !(Number(f.minutes) > 0)) return setErr("Time must be a positive number of minutes.");
    setErr("");

    const payload = {
      title: f.title.trim(),
      category: str(f.category),
      area: str(f.area),
      thumb_url: str(f.thumb_url),
      video_url: str(f.video_url),
      source_url: str(f.source_url),
      ingredients,
      steps: str(f.steps),
      minutes: num(f.minutes),
      difficulty: f.difficulty ? (f.difficulty as "Easy" | "Medium" | "Hard") : null,
      kcal_per_serving: num(f.kcal_per_serving),
      servings: num(f.servings),
      folder: str(f.folder) ?? "My recipes"
    };

    start(async () => {
      try {
        const r = draft.id ? await updateMyRecipeAction(draft.id, payload) : await createMyRecipeAction(payload);
        router.push(`/recipes/mine/${r.id}`);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Could not save the recipe.");
      }
    });
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="split">
        <section className="card grow" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label className="field">Name
            <input className="input" value={f.title} onChange={(e) => { setF({ ...f, title: e.target.value }); setErr(""); }} placeholder="Kimchi fried rice" />
          </label>

          <span className="lbl">Ingredients</span>
          {f.ingredients.map((r, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <label className="field" style={{ width: 120 }}>
                <span className="lbl">Amount</span>
                <input className="input" value={r.measure} onChange={(e) => setRow(i, { measure: e.target.value })} placeholder="1 cup" aria-label={`Amount for ingredient ${i + 1}`} />
              </label>
              <label className="field" style={{ flex: 1 }}>
                <span className="lbl">Ingredient</span>
                <input className="input" value={r.name} onChange={(e) => { setRow(i, { name: e.target.value }); setErr(""); }} placeholder="Rice" aria-label={`Ingredient ${i + 1}`} />
              </label>
              <button type="button" className="btn" onClick={() => removeRow(i)} aria-label={`Remove ingredient ${i + 1}`} disabled={f.ingredients.length === 1}>×</button>
            </div>
          ))}
          <button type="button" className="btn" onClick={addRow}>+ Add ingredient</button>

          <label className="field">Steps (one per line)
            <textarea
              className="input"
              rows={8}
              value={f.steps}
              onChange={(e) => setF({ ...f, steps: e.target.value })}
              placeholder={"Fry the kimchi for 2 minutes.\nAdd the rice and stir."}
              style={{ resize: "vertical", lineHeight: 1.5 }}
            />
          </label>
        </section>

        <aside className="side-col">
          <section className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span className="lbl">Details</span>
            <label className="field">Servings<input className="input" inputMode="numeric" value={f.servings} onChange={(e) => { setF({ ...f, servings: e.target.value }); setErr(""); }} placeholder="2" /></label>
            <label className="field">Time (minutes)<input className="input" inputMode="numeric" value={f.minutes} onChange={(e) => { setF({ ...f, minutes: e.target.value }); setErr(""); }} placeholder="25" /></label>
            <label className="field">Calories per serving<input className="input" inputMode="numeric" value={f.kcal_per_serving} onChange={(e) => setF({ ...f, kcal_per_serving: e.target.value })} placeholder="620" /></label>
            <label className="field">Difficulty
              <select className="input" value={f.difficulty} onChange={(e) => setF({ ...f, difficulty: e.target.value })}>
                <option value="">Not set</option>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </label>
            <label className="field">Category<input className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="Dinner" /></label>
            <label className="field">Cuisine<input className="input" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} placeholder="Korean" /></label>
            <label className="field">Folder<input className="input" value={f.folder} onChange={(e) => setF({ ...f, folder: e.target.value })} placeholder="My recipes" /></label>
            <label className="field">Photo URL<input className="input" type="url" value={f.thumb_url} onChange={(e) => setF({ ...f, thumb_url: e.target.value })} placeholder="https://…" /></label>
            <label className="field">Video URL<input className="input" type="url" value={f.video_url} onChange={(e) => setF({ ...f, video_url: e.target.value })} placeholder="https://youtube.com/…" /></label>
            <label className="field">Source URL<input className="input" type="url" value={f.source_url} onChange={(e) => setF({ ...f, source_url: e.target.value })} placeholder="https://…" /></label>
          </section>
        </aside>
      </div>

      {err && <p style={{ color: "#a32d2d", fontSize: 13 }} role="alert">{err}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn pri" disabled={pending}>{pending ? "Saving…" : editing ? "Save changes" : "Create recipe"}</button>
        <Link className="btn" href={draft.id ? `/recipes/mine/${draft.id}` : "/recipes?tab=collection"}>Cancel</Link>
      </div>
    </form>
  );
}
