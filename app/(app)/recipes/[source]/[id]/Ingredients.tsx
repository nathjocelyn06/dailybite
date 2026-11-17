"use client";
import { useState } from "react";
import { scaleIngredients, scaleTotal } from "@/lib/scale";

type Ingredient = { name: string; measure: string };

/**
 * Ingredients with a serving scaler. Quantities are scaled for display only —
 * nothing is saved, and a measure we can't parse ("to taste") is left as written.
 */
export function Ingredients({
  ingredients,
  have,
  baseServings,
  kcalPerServing,
  servingsKnown
}: {
  ingredients: Ingredient[];
  have: boolean[];
  baseServings: number;
  kcalPerServing: number | null;
  servingsKnown: boolean;
}) {
  const [servings, setServings] = useState(baseServings);
  const factor = servings / baseServings;
  const scaled = scaleIngredients(ingredients, factor);
  const total = scaleTotal(kcalPerServing, servings);
  const clamp = (n: number) => Math.min(24, Math.max(1, n));

  return (
    <section className="card side-col" aria-label="Ingredients" style={{ gap: 0 }}>
      <h2 className="h2" style={{ marginBottom: 8 }}>Ingredients</h2>

      <div className="row" style={{ gap: 10 }}>
        <span className="lbl" style={{ flex: 1 }}>Servings</span>
        <div className="stepper">
          <button type="button" className="btn sm" onClick={() => setServings(clamp(servings - 1))} aria-label="One serving fewer" disabled={servings <= 1}>−</button>
          <output aria-live="polite" style={{ minWidth: 28, textAlign: "center", fontWeight: 600 }}>{servings}</output>
          <button type="button" className="btn sm" onClick={() => setServings(clamp(servings + 1))} aria-label="One serving more" disabled={servings >= 24}>+</button>
        </div>
        {servings !== baseServings && (
          <button type="button" className="btn sm" onClick={() => setServings(baseServings)}>Reset</button>
        )}
      </div>

      <p className="muted" style={{ fontSize: 12, margin: "2px 0 10px" }}>
        {servingsKnown
          ? `Recipe is written for ${baseServings}.`
          : `This recipe doesn't say how many it serves, so ${baseServings} is assumed.`}
        {total ? ` ${total} kcal in total at ${servings}.` : ""}
      </p>

      {scaled.map((i, idx) => (
        <div className="row" key={`${i.name}-${idx}`}>
          <span style={{ width: 110, color: "var(--ink-2)" }}>{i.measure}</span>
          <span style={{ flex: 1 }}>{i.name}</span>
          <span className={`chip ${have[idx] ? "" : "warn"}`}>{have[idx] ? "in fridge" : "missing"}</span>
        </div>
      ))}
    </section>
  );
}
