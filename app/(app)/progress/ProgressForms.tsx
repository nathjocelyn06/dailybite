"use client";
import { useState, useTransition } from "react";
import { goalAction } from "../actions";

export function ProgressForms() {
  const [goal, setGoal] = useState({ title: "", target: "" });
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  return (
    <>
      <section className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 className="h2">Add goal</h2>
        <label className="field">Goal<input className="input" value={goal.title} onChange={(e) => { setGoal({ ...goal, title: e.target.value }); setErr(""); }} placeholder="Eat breakfast 5× a week" /></label>
        <label className="field">Target (optional)<input className="input" inputMode="numeric" value={goal.target} onChange={(e) => setGoal({ ...goal, target: e.target.value })} /></label>
        {err && <p style={{ color: "#a32d2d", fontSize: 13 }}>{err}</p>}
        <button className="btn" disabled={pending} onClick={() => {
          if (!goal.title.trim()) return setErr("Name your goal.");
          start(async () => { await goalAction({ title: goal.title.trim(), ...(goal.target ? { target: Number(goal.target) } : {}) }); setGoal({ title: "", target: "" }); });
        }}>Add goal</button>
      </section>
    </>
  );
}
