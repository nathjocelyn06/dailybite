import Link from "next/link";
import { webDb } from "@/lib/services/db";
import { getJournalDay } from "@/lib/services/journal";
import { signedUrls } from "@/lib/services/photos";
import { addDays, dayKey, isDayKey, prettyDay } from "@/lib/dates";
import { sumEaten } from "@/lib/totals";
import { Photo } from "@/components/Photo";
import { ActionButton } from "@/components/ActionButton";
import { confirmMealAction, deleteMealAction } from "../actions";
import { ReviewForm } from "./ReviewForm";
import { MealEditor } from "./MealEditor";

/**
 * Phase 1: day page with meals (photo, place, time, nutrition) + daily review.
 * Phase 4 (docs/PLAN.md): the scrapbook editor (drag/resize photos, stickers, tape, doodles)
 * from design/wireframes/D05-Journal.dc.html, stored in journal_elements.
 */
export default async function JournalPage({ searchParams }: { searchParams: Promise<{ date?: string; meal?: string; edit?: string }> }) {
  const sp = await searchParams;
  const db = await webDb();
  const today = dayKey(new Date(), db.tz);
  const date = isDayKey(sp.date) ? sp.date : today;
  const j = await getJournalDay(db, date);
  const urls = await signedUrls(db, [...j.meals.map((m) => m.photo_path), ...j.elements.map((e) => e.photo_path)]);
  const t = sumEaten(j.meals);
  // ?edit=1&meal=<id> opens that meal for correction — the path Home's "Edit" uses
  // for the estimates Claude logs through MCP.
  const editingId = sp.edit === "1" ? sp.meal : undefined;

  return (
    <>
      <header className="head">
        <Link className="btn" href={`/journal?date=${addDays(date, -1)}`} aria-label="Previous day">‹</Link>
        <div className="titles"><span className="lbl">Food journal{date === today ? " · today" : ""}</span><h1 className="h1">{prettyDay(date)}</h1></div>
        <Link className="btn" href={`/journal?date=${addDays(date, 1)}`} aria-label="Next day">›</Link>
        <Link className="btn pri" href={`/snap?mode=calorie&date=${date}`}>+ Add meal</Link>
      </header>
      <div className="split">
        <section
          className="grow"
          aria-label="Journal page"
          style={{
            background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 6, padding: 24, display: "flex", flexDirection: "column", gap: 22,
            backgroundImage: "repeating-linear-gradient(0deg, transparent 0 31px, #edebe3 31px 32px)"
          }}
        >
          {j.page?.title && <p className="hand" style={{ fontSize: 28, color: "var(--ink)" }}>{j.page.title}</p>}
          {j.meals.length === 0 && <p className="hand">No meals yet. Snap one!</p>}
          {j.meals.map((m, i) => (
            <article
              key={m.id}
              id={m.id}
              style={{
                display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start",
                flexDirection: i % 2 ? "row-reverse" : "row",
                outline: sp.meal === m.id ? "2px dashed var(--ink)" : "none", outlineOffset: 6, borderRadius: 4
              }}
            >
              <div style={{ width: 240, background: "#fff", border: "1px solid var(--line)", padding: "8px 8px 12px", transform: `rotate(${i % 2 ? 2 : -2}deg)`, boxShadow: "0 1px 3px rgba(0,0,0,.07)" }}>
                <Photo src={m.photo_path ? urls[m.photo_path] : null} alt={m.name} style={{ borderRadius: 2 }} />
                <p className="hand" style={{ textAlign: "center", fontSize: 18, marginTop: 6 }}>{m.notes ?? ""}</p>
              </div>
              {editingId === m.id ? (
                <MealEditor
                  meal={{ id: m.id, name: m.name, slot: m.slot, status: m.status, items: m.items }}
                  backHref={`/journal?date=${date}&meal=${m.id}`}
                />
              ) : (
                <div style={{ flex: "1 1 220px", display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span className="chip">{m.slot}</span>
                    {m.place && <span className="chip">{m.place}</span>}
                    <span className={`chip ${m.status !== "eaten" ? "warn" : ""}`}>{m.status.replace("_", " ")}</span>
                    {m.estimate_source === "ai" && <span className="chip">AI estimate</span>}
                  </div>
                  <h2 className="h2" style={{ fontSize: 20 }}>{m.name}</h2>
                  <span className="muted">{m.kcal ?? "?"} kcal · P {m.protein_g ?? 0} · C {m.carbs_g ?? 0} · F {m.fat_g ?? 0}</span>
                  {m.items.length > 0 && <span className="muted">{m.items.map((x) => `${x.name}${x.portion ? ` (${x.portion})` : ""}`).join(", ")}</span>}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {m.status !== "eaten" && <ActionButton action={confirmMealAction} args={[m.id]} className="btn sm pri">Confirm eaten</ActionButton>}
                    <Link className="btn sm" href={`/journal?date=${date}&meal=${m.id}&edit=1`}>Edit</Link>
                    <ActionButton action={deleteMealAction} args={[m.id]} confirm={`Delete ${m.name}?`}>Delete</ActionButton>
                  </div>
                </div>
              )}
            </article>
          ))}
        </section>
        <aside className="side-col">
          <section className="card">
            <h2 className="h2">Day summary</h2>
            <p style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>{t.kcal} <span className="muted">kcal</span></p>
            <p className="muted">{t.meals} meals eaten · P {t.protein_g} g · C {t.carbs_g} g · F {t.fat_g} g</p>
          </section>
          <section className="card"><h2 className="h2" style={{ marginBottom: 10 }}>Daily review</h2><ReviewForm date={date} page={j.page} /></section>
        </aside>
      </div>
    </>
  );
}
