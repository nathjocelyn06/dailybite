"use client";
import { useState, useTransition } from "react";
import { reviewAction } from "../actions";

type Page = { review: string | null; mood: string | null; fullness: string | null; title: string | null } | null;

export function ReviewForm({ date, page }: { date: string; page: Page }) {
  const [review, setReview] = useState(page?.review ?? "");
  const [title, setTitle] = useState(page?.title ?? "");
  const [fullness, setFullness] = useState(page?.fullness ?? "");
  const [mood, setMood] = useState(page?.mood ?? "");
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const save = () => start(async () => { await reviewAction({ date, review, title, fullness, mood }); setSaved(true); });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <label className="field">Page title<input className="input" value={title} onChange={(e) => { setTitle(e.target.value); setSaved(false); }} placeholder="thursday ~ cozy food day" /></label>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} role="group" aria-label="Fullness">
        {[["light", "Light"], ["just_right", "Just right"], ["too_full", "Too full"]].map(([v, l]) => (
          <button key={v} type="button" className={`chip ${fullness === v ? "on" : ""}`} onClick={() => { setFullness(v); setSaved(false); }}>{l}</button>
        ))}
      </div>
      <label className="field">Mood<input className="input" value={mood} onChange={(e) => { setMood(e.target.value); setSaved(false); }} placeholder="calm, happy, tired…" /></label>
      <label className="field">How was today?<textarea className="input" value={review} onChange={(e) => { setReview(e.target.value); setSaved(false); }} /></label>
      <button className="btn pri" onClick={save} disabled={pending}>{pending ? "Saving…" : saved ? "Saved ✓" : "Save"}</button>
    </div>
  );
}
