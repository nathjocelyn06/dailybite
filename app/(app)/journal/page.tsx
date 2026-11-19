import Link from "next/link";
import { webDb } from "@/lib/services/db";
import { getJournalDay } from "@/lib/services/journal";
import { signedUrls } from "@/lib/services/photos";
import { addDays, dayKey, isDayKey, prettyDay } from "@/lib/dates";
import { sumEaten } from "@/lib/totals";
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
      </header>
      {editingId && j.meals.some((m) => m.id === editingId) && (
        <section className="card" aria-label="Edit meal">
          {j.meals
            .filter((m) => m.id === editingId)
            .map((m) => (
              <MealEditor
                key={m.id}
                meal={{ id: m.id, name: m.name, slot: m.slot, status: m.status, items: m.items }}
                backHref={`/journal?date=${date}`}
              />
            ))}
        </section>
      )}

      <section className="card day-summary" aria-label="Day summary">
        <h2 className="h2">Day summary</h2>
        <p className="day-kcal">{t.kcal} <span className="muted">kcal</span></p>
        <p className="muted">{t.meals} meals eaten · P {t.protein_g} g · C {t.carbs_g} g · F {t.fat_g} g</p>
        <Link className="btn pri day-add" href={`/snap?mode=calorie&date=${date}`}>+ Add meal</Link>
      </section>

      <Scrapbook
        date={date}
        initial={j.elements}
        photoUrls={urls}
        title={j.page?.title}
        meals={j.meals.map((m) => ({
          id: m.id,
          slot: m.slot,
          name: m.name,
          notes: m.notes,
          place: m.place,
          kcal: m.kcal,
          status: m.status,
          photo_path: m.photo_path
        }))}
      />
    </>
  );
}
