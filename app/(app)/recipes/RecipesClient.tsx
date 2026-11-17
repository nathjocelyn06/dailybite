"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { scannerAction, deleteRecipeAction } from "../actions";

type Card = {
  external_id: string;
  title: string;
  thumb_url: string | null;
  category: string | null;
  area: string | null;
  est_minutes?: number;
  est_difficulty?: string;
  youtube_id?: string | null;
};
type Saved = { id: string; title: string; thumb_url: string | null; folder: string; source: string; external_id: string | null; video: boolean; minutes: number | null };
type Tab = "discover" | "collection" | "scanner";

export function RecipesClient(props: {
  initialTab: Tab;
  initialQuery: { query: string; category: string; area: string; ingredient: string };
  initialIngredients: string;
  saved: Saved[];
}) {
  const [tab, setTab] = useState<Tab>(props.initialTab);
  return (
    <>
      <header className="head">
        <div className="titles">
          <span className="lbl">Recipes</span>
          <h1 className="h1">What should I cook?</h1>
        </div>
      </header>
      <nav className="tabs" aria-label="Recipe areas">
        {([
          ["discover", "Find"],
          ["collection", "Saved"],
          ["scanner", "Cook from my fridge"]
        ] as const).map(([k, label]) => (
          <a key={k} href={`?tab=${k}`} aria-current={tab === k ? "page" : undefined} onClick={(e) => { e.preventDefault(); setTab(k); history.replaceState(null, "", `?tab=${k}`); }}>
            {label}
          </a>
        ))}
      </nav>
      {tab === "discover" && <Discover initial={props.initialQuery} />}
      {tab === "collection" && <Collection saved={props.saved} />}
      {tab === "scanner" && <Scanner initial={props.initialIngredients} />}
    </>
  );
}

function RecipeGrid({ list }: { list: Card[] }) {
  if (!list.length) return <p className="muted">No recipes match. Try fewer filters.</p>;
  return (
    <div className="grid">
      {list.map((r) => (
        <Link key={r.external_id} href={`/recipes/themealdb/${r.external_id}`} className="card" style={{ padding: 0, overflow: "hidden", textDecoration: "none" }}>
          <div style={{ position: "relative" }}>
            {r.thumb_url ? <img src={`${r.thumb_url}/preview`} alt="" style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover" }} loading="lazy" /> : <div className="thumb" />}
            {r.youtube_id && <span className="chip" style={{ position: "absolute", left: 10, bottom: 10 }}>▶ video</span>}
          </div>
          <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontWeight: 600 }}>{r.title}</span>
            <span className="muted">
              {[r.category, r.area, r.est_minutes ? `~${r.est_minutes} min` : null, r.est_difficulty].filter(Boolean).join(" · ") || "Tap for ingredients & video"}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}

function Discover({ initial }: { initial: { query: string; category: string; area: string; ingredient: string } }) {
  const [q, setQ] = useState({ ...initial, maxMinutes: "", difficulty: "" });
  const [meta, setMeta] = useState<{ categories: string[]; areas: string[] }>({ categories: [], areas: [] });
  const [list, setList] = useState<Card[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    fetch("/api/recipes?meta=1").then((r) => r.json()).then(setMeta).catch(() => undefined);
  }, []);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => v && p.set(k, v));
    return p.toString();
  }, [q]);

  useEffect(() => {
    let alive = true;
    setState("loading");
    const t = setTimeout(() => {
      fetch(`/api/recipes?${params}`)
        .then((r) => r.json())
        .then((d: { recipes?: Card[]; error?: string }) => {
          if (!alive) return;
          setList(d.recipes ?? []);
          setState(d.error ? "error" : "ok");
        })
        .catch(() => alive && setState("error"));
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [params]);

  const set = (k: keyof typeof q) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setQ({ ...q, [k]: e.target.value });
  const mealTypes = ["Breakfast", "Starter", "Side", "Dessert", "Vegetarian", "Vegan", "Seafood", "Chicken", "Pasta"];

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="card" style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
        <label className="field" style={{ flex: "2 1 240px" }}>
          Search
          <input className="input" type="search" placeholder="e.g. curry, salmon, pancakes" value={q.query} onChange={set("query")} />
        </label>
        <label className="field">
          Meal type / diet
          <select className="input" value={q.category} onChange={set("category")}>
            <option value="">Any</option>
            {(meta.categories.length ? meta.categories : mealTypes).map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="field">
          Cuisine
          <select className="input" value={q.area} onChange={set("area")}>
            <option value="">Any</option>
            {meta.areas.map((a) => <option key={a}>{a}</option>)}
          </select>
        </label>
        <label className="field">
          Main ingredient
          <input className="input" placeholder="e.g. tofu" value={q.ingredient} onChange={set("ingredient")} />
        </label>
        <label className="field">
          Cooking time
          <select className="input" value={q.maxMinutes} onChange={set("maxMinutes")}>
            <option value="">Any</option>
            <option value="20">Under 20 min</option>
            <option value="30">Under 30 min</option>
            <option value="60">Under 1 hr</option>
          </select>
        </label>
        <label className="field">
          Difficulty
          <select className="input" value={q.difficulty} onChange={set("difficulty")}>
            <option value="">Any</option>
            <option>Easy</option>
            <option>Medium</option>
            <option>Hard</option>
          </select>
        </label>
      </div>
      <div className="muted">
        {state === "loading" ? "Loading recipes…" : state === "error" ? "Couldn't reach the recipe service. Try again." : `${list.length} recipes`}
        {(q.maxMinutes || q.difficulty) && " · time and difficulty are estimates"}
      </div>
      {state !== "loading" && <RecipeGrid list={list} />}
    </section>
  );
}

function Collection({ saved }: { saved: Saved[] }) {
  const folders = [...new Set(saved.map((s) => s.folder))];
  const [folder, setFolder] = useState<string>("");
  const [pending, start] = useTransition();
  const shown = folder ? saved.filter((s) => s.folder === folder) : saved;
  if (!saved.length)
    return (
      <section style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
        <p className="muted">Nothing saved yet. Open a recipe and tap “Save to collection” — or write one of your own.</p>
        <Link className="btn pri" href="/recipes/edit">+ New recipe</Link>
      </section>
    );
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className={`chip ${folder === "" ? "on" : ""}`} onClick={() => setFolder("")}>All ({saved.length})</button>
        {folders.map((f) => (
          <button key={f} className={`chip ${folder === f ? "on" : ""}`} onClick={() => setFolder(f)}>
            {f} ({saved.filter((s) => s.folder === f).length})
          </button>
        ))}
        <Link className="btn sm" href="/recipes/edit" style={{ marginLeft: "auto" }}>+ New recipe</Link>
      </div>
      <div className="grid">
        {shown.map((r) => (
          <div key={r.id} className="card" style={{ display: "flex", gap: 12, alignItems: "center", padding: 10 }}>
            {r.thumb_url ? <img src={`${r.thumb_url}/preview`} alt="" style={{ width: 64, height: 64, borderRadius: 10, objectFit: "cover" }} /> : <div className="ph" style={{ width: 64, height: 64 }} />}
            <Link href={r.source === "themealdb" ? `/recipes/themealdb/${r.external_id}` : `/recipes/mine/${r.id}`} style={{ flex: 1, textDecoration: "none" }}>
              <div style={{ fontWeight: 600 }}>{r.title}</div>
              <div className="muted">{r.folder}{r.video ? " · video" : ""}{r.minutes ? ` · ~${r.minutes} min` : ""}</div>
            </Link>
            {r.source === "mine" && <Link className="btn sm" href={`/recipes/edit?id=${r.id}`} aria-label={`Edit ${r.title}`}>Edit</Link>}
            <button className="btn sm" disabled={pending} onClick={() => start(() => deleteRecipeAction(r.id))} aria-label={`Remove ${r.title}`}>×</button>
          </div>
        ))}
      </div>
    </section>
  );
}

function Scanner({ initial }: { initial: string }) {
  const [text, setText] = useState(initial);
  const [useFridge, setUseFridge] = useState(true);
  const [res, setRes] = useState<Awaited<ReturnType<typeof scannerAction>> | null>(null);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const run = () => {
    const ingredients = text.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    if (!ingredients.length && !useFridge) {
      setErr("Add at least one ingredient or use your fridge.");
      return;
    }
    setErr("");
    start(async () => setRes(await scannerAction(ingredients, useFridge)));
  };
  useEffect(() => { if (initial) run(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="split">
      <section className="card side-col" aria-label="Ingredients" style={{ gap: 12 }}>
        <h2 className="h2">1 · What do you have?</h2>
        <Link className="btn pri" href="/snap?mode=recipe_finder">Take or upload a photo</Link>
        <label className="field">
          Or type ingredients (comma separated)
          <textarea className="input" value={text} onChange={(e) => { setText(e.target.value); setErr(""); }} placeholder="eggs, spinach, rice" />
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, minHeight: 40 }}>
          <input type="checkbox" checked={useFridge} onChange={(e) => setUseFridge(e.target.checked)} /> Also use my fridge (expiring first)
        </label>
        {err && <p style={{ color: "#a32d2d", fontSize: 13 }}>{err}</p>}
        <button className="btn" onClick={run} disabled={pending}>{pending ? "Finding…" : "Suggest recipes"}</button>
      </section>
      <section className="grow" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 className="h2">2 · Suggested recipes</h2>
        {res && <p className="muted">Using: {res.used_ingredients.join(", ") || "—"}</p>}
        {res && <RecipeGrid list={res.recipes.map((r) => ({ ...r, category: `uses ${r.matches.length}: ${r.matches.slice(0, 3).join(", ")}` }))} />}
        {!res && !pending && <p className="muted">Results appear here.</p>}
        <p className="muted">Suggestions are estimates. Check ingredients and allergens before cooking.</p>
      </section>
    </div>
  );
}
