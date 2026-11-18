"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { missingToShoppingAction, planRecipeAction, saveRecipeAction } from "../../../actions";
import { dayKey } from "@/lib/dates";

export function RecipeActions({ externalId, savedId, missing }: { externalId: string | null; savedId: string | null; missing: number }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const [planOpen, setPlanOpen] = useState(false);
  const [date, setDate] = useState(dayKey());
  const [slot, setSlot] = useState("dinner");
  if (!externalId) return null;

  const run = (fn: () => Promise<unknown>, done: string) =>
    start(async () => {
      try {
        await fn();
        setMsg(done);
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Failed");
      }
    });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn" disabled={pending} onClick={() => run(() => saveRecipeAction("themealdb", externalId), "Saved to your collection.")}>
          {savedId ? "Saved ✓" : "Save to collection"}
        </button>
        <button className="btn pri" disabled={pending} onClick={() => setPlanOpen(!planOpen)}>Add to meal plan</button>
        <button className="btn" disabled={pending || missing === 0} onClick={() => run(() => missingToShoppingAction("themealdb", externalId), "Missing ingredients added to your shopping list.")}>
          {missing ? `Add ${missing} missing to list` : "You have everything"}
        </button>
      </div>
      {planOpen && (
        <div className="card paper" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", padding: 12 }}>
          <label className="field">Date<input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label className="field">Meal
            <select className="input" value={slot} onChange={(e) => setSlot(e.target.value)}>
              <option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option><option value="snack">Snack</option>
            </select>
          </label>
          <button className="btn pri" disabled={pending || !date} onClick={() => run(() => planRecipeAction({ source: "themealdb", external_id: externalId, date, slot }), `Planned for ${slot} on ${date}.`)}>
            Plan it
          </button>
        </div>
      )}
      {msg && <p className="muted" role="status">{msg} {msg.startsWith("Planned") && <Link href="/calendar">See calendar</Link>}</p>}
    </div>
  );
}
