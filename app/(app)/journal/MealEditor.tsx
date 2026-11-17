"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateMealAction } from "../actions";

type Item = {
  name: string;
  portion?: string;
  grams?: number;
  ingredients?: string[];
  kcal?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
};

export type EditableMeal = {
  id: string;
  name: string;
  slot: string;
  status: string;
  items: Item[];
};

const n = (v: string) => (v.trim() === "" ? undefined : Number(v));
const r1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Correct a meal before it counts — above all one Claude logged from a photo as
 * `pending_confirm`. Totals are recomputed from the items by `updateMeal`, so what
 * you see here is what gets saved.
 */
export function MealEditor({ meal, backHref }: { meal: EditableMeal; backHref: string }) {
  const router = useRouter();
  const [name, setName] = useState(meal.name);
  const [slot, setSlot] = useState(meal.slot);
  const [items, setItems] = useState<Item[]>(meal.items.length ? meal.items : [{ name: "" }]);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  const setItem = (i: number, patch: Partial<Item>) => setItems(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const totals = items.reduce(
    (a, i) => ({
      kcal: a.kcal + (i.kcal ?? 0),
      protein_g: r1(a.protein_g + (i.protein_g ?? 0)),
      carbs_g: r1(a.carbs_g + (i.carbs_g ?? 0)),
      fat_g: r1(a.fat_g + (i.fat_g ?? 0))
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );

  function save(confirmEaten: boolean) {
    const clean = items.filter((i) => i.name.trim());
    if (!name.trim()) return setErr("Give the meal a name.");
    if (!clean.length) return setErr("Keep at least one item.");
    setErr("");
    start(async () => {
      try {
        await updateMealAction({
          id: meal.id,
          name: name.trim(),
          slot,
          items: clean.map((i) => ({
            name: i.name.trim(),
            portion: i.portion || undefined,
            grams: i.grams,
            ingredients: i.ingredients?.length ? i.ingredients : undefined,
            kcal: i.kcal,
            protein_g: i.protein_g,
            carbs_g: i.carbs_g,
            fat_g: i.fat_g
          })),
          ...(confirmEaten ? { status: "eaten" as const } : {})
        });
        router.push(backHref);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Could not save");
      }
    });
  }

  return (
    <div className="card" style={{ flex: "1 1 320px", display: "flex", flexDirection: "column", gap: 10 }}>
      <span className="lbl">{meal.status === "eaten" ? "Edit meal" : "Check this estimate"}</span>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <label className="field" style={{ flex: "2 1 180px" }}>Meal name
          <input className="input" value={name} onChange={(e) => { setName(e.target.value); setErr(""); }} />
        </label>
        <label className="field" style={{ flex: "1 1 120px" }}>Meal
          <select className="input" value={slot} onChange={(e) => setSlot(e.target.value)}>
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
            <option value="snack">Snack</option>
          </select>
        </label>
      </div>

      {items.map((i, idx) => (
        <div key={idx} className="item-card">
          <div className="item-head">
            <input className="input" style={{ flex: "2 1 150px" }} placeholder="Food" value={i.name} onChange={(e) => { setItem(idx, { name: e.target.value }); setErr(""); }} aria-label={`Food ${idx + 1}`} />
            <input className="input" style={{ flex: "1 1 100px" }} placeholder="Portion" value={i.portion ?? ""} onChange={(e) => setItem(idx, { portion: e.target.value })} aria-label={`Portion ${idx + 1}`} />
            <input className="input" style={{ width: 80 }} placeholder="grams" inputMode="numeric" value={i.grams ?? ""} onChange={(e) => setItem(idx, { grams: n(e.target.value) })} aria-label={`Grams ${idx + 1}`} />
            <button className="btn sm" onClick={() => setItems(items.length > 1 ? items.filter((_, j) => j !== idx) : items)} aria-label={`Remove item ${idx + 1}`} disabled={items.length === 1}>×</button>
          </div>
          <div className="item-macros">
            <label className="field"><span className="lbl">kcal</span><input className="input" inputMode="numeric" value={i.kcal ?? ""} onChange={(e) => setItem(idx, { kcal: n(e.target.value) })} /></label>
            <label className="field"><span className="lbl">protein g</span><input className="input" inputMode="decimal" value={i.protein_g ?? ""} onChange={(e) => setItem(idx, { protein_g: n(e.target.value) })} /></label>
            <label className="field"><span className="lbl">carbs g</span><input className="input" inputMode="decimal" value={i.carbs_g ?? ""} onChange={(e) => setItem(idx, { carbs_g: n(e.target.value) })} /></label>
            <label className="field"><span className="lbl">fat g</span><input className="input" inputMode="decimal" value={i.fat_g ?? ""} onChange={(e) => setItem(idx, { fat_g: n(e.target.value) })} /></label>
          </div>
          {i.ingredients?.length ? <p className="muted" style={{ fontSize: 12 }}>Ingredients: {i.ingredients.join(", ")}</p> : null}
        </div>
      ))}

      <button className="btn sm" style={{ alignSelf: "flex-start" }} onClick={() => setItems([...items, { name: "" }])}>+ Add an item</button>

      <div className="totals" aria-live="polite">
        <strong>Total ≈ {totals.kcal} kcal</strong>
        <span>protein {totals.protein_g} g</span>
        <span>carbs {totals.carbs_g} g</span>
        <span>fat {totals.fat_g} g</span>
      </div>

      {err && <p style={{ color: "#a32d2d", fontSize: 13 }} role="alert">{err}</p>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {meal.status !== "eaten" && (
          <button className="btn pri" disabled={pending} onClick={() => save(true)}>{pending ? "Saving…" : "Save & mark eaten"}</button>
        )}
        <button className="btn" disabled={pending} onClick={() => save(false)}>{pending ? "Saving…" : "Save changes"}</button>
        <button className="btn" disabled={pending} onClick={() => router.push(backHref)}>Cancel</button>
      </div>
    </div>
  );
}
