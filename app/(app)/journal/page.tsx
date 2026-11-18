import Link from "next/link";
import { webDb } from "@/lib/services/db";
import { getJournalDay } from "@/lib/services/journal";
import { signedUrls } from "@/lib/services/photos";
import { addDays, dayKey, isDayKey, prettyDay } from "@/lib/dates";
import { sumEaten } from "@/lib/totals";
import { MealPhoto } from "@/components/journal/MealPhoto";
import { ActionButton } from "@/components/ActionButton";
import { confirmMealAction, deleteMealAction } from "../actions";
import { MealEditor } from "./MealEditor";
import { Scrapbook } from "./Scrapbook";

/**
 * The day page: the day's totals, then the journal itself — a ring binder holding the
 * meals as polaroids and a page you can decorate (journal_elements). Full width: the
 * binder is the page, so there is no side column beside it.
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
      <section className="card day-summary" aria-label="Day summary">
        <h2 className="h2">Day summary</h2>
        <p className="day-kcal">{t.kcal} <span className="muted">kcal</span></p>
        <p className="muted">{t.meals} meals eaten · P {t.protein_g} g · C {t.carbs_g} g · F {t.fat_g} g</p>
      </section>

      <Scrapbook
          date={date}
          initial={j.elements}
          photoUrls={urls}
          meals={j.meals.map((m) => ({ id: m.id, slot: m.slot, name: m.name }))}
          addMealHref={`/snap?mode=calorie&date=${date}`}
          left={
            <div className="polaroids">
              {j.page?.title && <p className="hand polaroid-day">{j.page.title}</p>}
              {j.meals.length === 0 && <p className="muted">No meals yet today.</p>}
              {j.meals.map((m, i) => (
                <article
                  key={m.id}
                  id={m.id}
                  className={`polaroid ${sp.meal === m.id ? "is-open" : ""}`}
                  style={{ transform: `rotate(${i % 2 ? 1.6 : -1.8}deg)` }}
                >
                  <MealPhoto mealId={m.id} src={m.photo_path ? urls[m.photo_path] : null} alt={m.name} />
                  <p className="polaroid-caption">{m.notes?.trim() || m.name}</p>
                  <p className="polaroid-meta">
                    {[m.slot, m.place, `${m.kcal ?? "?"} kcal`].filter(Boolean).join(" \u00b7 ")}
                  </p>
                  {editingId === m.id ? (
                    <MealEditor
                      meal={{ id: m.id, name: m.name, slot: m.slot, status: m.status, items: m.items }}
                      backHref={`/journal?date=${date}&meal=${m.id}`}
                    />
                  ) : (
                    m.status !== "eaten" && (
                      <div className="polaroid-actions">
                        <ActionButton action={confirmMealAction} args={[m.id]} className="btn sm pri">Confirm eaten</ActionButton>
                      </div>
                    )
                  )}
                  {/* delete lives in the corner, as asked — no edit button on the photo */}
                  <ActionButton
                    action={deleteMealAction}
                    args={[m.id]}
                    confirm={`Delete ${m.name}?`}
                    className="polaroid-x"
                    label={`Delete ${m.name}`}
                  >
                    ×
                  </ActionButton>
                </article>
              ))}
            </div>
          }
      />
    </>
  );
}
