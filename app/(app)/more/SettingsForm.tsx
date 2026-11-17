"use client";
import { useState, useTransition } from "react";
import { settingsAction } from "../actions";

type S = { timezone: string; kcal_goal: number; water_goal: number; monthly_budget: number; currency: string };

export function SettingsForm({ s }: { s: S }) {
  const [f, setF] = useState({ ...s, monthly_budget: String(s.monthly_budget), kcal_goal: String(s.kcal_goal), water_goal: String(s.water_goal) });
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      try {
        await settingsAction(f);
        setMsg("Saved.");
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Could not save");
      }
    });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 420 }}>
      <label className="field">Time zone (sets when your day starts)<input className="input" value={f.timezone} onChange={(e) => setF({ ...f, timezone: e.target.value })} /></label>
      <label className="field">Daily calorie goal<input className="input" inputMode="numeric" value={f.kcal_goal} onChange={(e) => setF({ ...f, kcal_goal: e.target.value })} /></label>
      <label className="field">Water goal (glasses)<input className="input" inputMode="numeric" value={f.water_goal} onChange={(e) => setF({ ...f, water_goal: e.target.value })} /></label>
      <label className="field">Monthly food budget<input className="input" inputMode="decimal" value={f.monthly_budget} onChange={(e) => setF({ ...f, monthly_budget: e.target.value })} /></label>
      <button className="btn pri" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save settings"}</button>
      {msg && <p className="muted" role="status">{msg}</p>}
    </div>
  );
}
