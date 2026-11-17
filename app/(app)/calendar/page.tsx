import Link from "next/link";
import { webDb } from "@/lib/services/db";
import { dayDetail, monthOverview, weekOverview } from "@/lib/services/calendar";
import type { Meal } from "@/lib/services/meals";
import { addDays, addMonths, isDayKey, isMonthKey, prettyDay, timeKey, weekdayIndex } from "@/lib/dates";
import { ActionButton } from "@/components/ActionButton";
import { confirmMealAction } from "../actions";

type View = "month" | "week" | "day";

/** Where a meal sits on the day timeline when it was never marked eaten at a time. */
const SLOT_HOUR: Record<Meal["slot"], number> = { breakfast: 8, lunch: 12, snack: 16, dinner: 19 };
const SLOT_LABEL: Record<Meal["slot"], string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };

function hourOf(m: Meal, tz: string): number {
  if (m.eaten_at) return Number(timeKey(new Date(m.eaten_at), tz).slice(0, 2));
  return SLOT_HOUR[m.slot];
}

function mealColor(slot: Meal["slot"]): string {
  return `var(--meal-${slot})`;
}

/** Archive › Calendar: month, week and day views over the same meals / expenses / journal rows. */
export default async function CalendarPage({
  searchParams
}: {
  searchParams: Promise<{ month?: string; date?: string; view?: string }>;
}) {
  const sp = await searchParams;
  const db = await webDb();
  const view: View = sp.view === "week" || sp.view === "day" ? sp.view : "month";

  const month = isMonthKey(sp.month) ? sp.month : isDayKey(sp.date) ? sp.date.slice(0, 7) : undefined;
  // The month view is the only one that needs the whole grid; the others need their own range.
  const o = await monthOverview(db, month);
  const selected = isDayKey(sp.date) ? sp.date : o.today.startsWith(o.month) ? o.today : `${o.month}-01`;
  const [d, week] = await Promise.all([
    dayDetail(db, selected),
    view === "week" ? weekOverview(db, selected) : Promise.resolve(null)
  ]);
  const lead = weekdayIndex(`${o.month}-01`);

  const link = (next: { date?: string; month?: string; view?: View }) => {
    const v = next.view ?? view;
    const q = new URLSearchParams();
    if (next.month) q.set("month", next.month);
    if (next.date) q.set("date", next.date);
    if (v !== "month") q.set("view", v);
    const s = q.toString();
    return `/calendar${s ? `?${s}` : ""}`;
  };

  const prev =
    view === "month" ? link({ month: addMonths(o.month, -1) }) : link({ date: addDays(selected, view === "week" ? -7 : -1) });
  const next =
    view === "month" ? link({ month: addMonths(o.month, 1) }) : link({ date: addDays(selected, view === "week" ? 7 : 1) });

  const heading =
    view === "month"
      ? new Date(`${o.month}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })
      : view === "week" && week
        ? `Week of ${prettyDay(week.from)}`
        : prettyDay(selected);

  // Day view: one row per hour, widened to fit anything logged outside 06:00–22:00.
  const dayMeals = d.meals.map((m) => ({ meal: m, hour: hourOf(m, db.tz) }));
  const firstHour = Math.min(6, ...dayMeals.map((x) => x.hour));
  const lastHour = Math.max(22, ...dayMeals.map((x) => x.hour));
  const hours = Array.from({ length: lastHour - firstHour + 1 }, (_, i) => firstHour + i);

  return (
    <>
      <header className="head">
        <div className="titles">
          <span className="lbl">Archive · Calendar</span>
          <h1 className="h1">{heading}</h1>
        </div>
        <Link className="btn" href={prev} aria-label={`Previous ${view}`}>‹</Link>
        <Link className="btn" href={link({ view })}>Today</Link>
        <Link className="btn" href={next} aria-label={`Next ${view}`}>›</Link>
      </header>

      <nav className="seg-links" aria-label="Archive views">
        <Link href="/archive">List</Link>
        <Link href="/calendar" aria-current="page">Calendar</Link>
      </nav>

      <nav className="seg-links" aria-label="Calendar view">
        {(["month", "week", "day"] as View[]).map((v) => (
          <Link key={v} href={link({ date: selected, view: v })} aria-current={v === view ? "page" : undefined}>
            {v[0].toUpperCase() + v.slice(1)}
          </Link>
        ))}
      </nav>

      <div className="split">
        {view === "month" && (
          <section className="card grow" aria-label="Month" style={{ padding: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))", gap: 6 }}>
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w) => (
                <span key={w} className="lbl" style={{ textAlign: "center" }}>{w}</span>
              ))}
              {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} />)}
              {o.days.map((day) => {
                const isToday = day.date === o.today;
                const isSel = day.date === selected;
                const future = day.date > o.today;
                return (
                  <Link
                    key={day.date}
                    href={link({ date: day.date })}
                    aria-current={isSel ? "date" : undefined}
                    style={{
                      minHeight: 92, borderRadius: 10, padding: 6, textDecoration: "none", display: "flex", flexDirection: "column", gap: 2, fontSize: 11,
                      background: isSel ? "var(--accent-soft)" : future ? "#fff" : "var(--side)",
                      border: isToday ? "1.5px solid var(--ink)" : "1px solid var(--line-soft)"
                    }}
                  >
                    <strong style={{ fontSize: 13 }}>{Number(day.date.slice(8))}</strong>
                    {day.kcal > 0 && <span>{day.kcal} kcal</span>}
                    {day.spend > 0 && <span className="muted" style={{ fontSize: 11 }}>₩{Math.round(day.spend).toLocaleString()}</span>}
                    {day.planned > 0 && <span className="chip" style={{ minHeight: 18, fontSize: 10, padding: "0 6px", alignSelf: "flex-start" }}>{day.planned} planned</span>}
                    {day.has_journal && <span aria-label="journal page">✎</span>}
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {view === "week" && week && (
          <section className="card grow" aria-label="Week" style={{ padding: 12, overflowX: "auto" }}>
            <div className="week-grid">
              {week.days.map((day) => {
                const isToday = day.date === week.today;
                const isSel = day.date === selected;
                return (
                  <div
                    key={day.date}
                    className="week-col"
                    style={{
                      background: isSel ? "var(--accent-soft)" : "var(--side)",
                      border: isToday ? "1.5px solid var(--ink)" : "1px solid var(--line-soft)"
                    }}
                  >
                    <Link href={link({ date: day.date, view: "day" })} className="week-head">
                      <span className="lbl">{prettyDay(day.date).slice(0, 3)}</span>
                      <span style={{ fontSize: 20, fontWeight: 700 }}>{Number(day.date.slice(8))}</span>
                      <span style={{ fontSize: 11, color: "var(--ink-2)" }}>{day.kcal > 0 ? `${day.kcal} kcal` : "—"}</span>
                    </Link>
                    {(["breakfast", "lunch", "dinner", "snack"] as Meal["slot"][]).map((slot) => {
                      const items = day.meals.filter((m) => m.slot === slot);
                      return (
                        <div
                          key={slot}
                          className="week-slot"
                          style={{
                            borderStyle: items.some((m) => m.status === "planned") || !items.length ? "dashed" : "solid",
                            borderColor: items.length ? mealColor(slot) : "var(--grid)"
                          }}
                        >
                          <span className="lbl" style={{ fontSize: 10 }}>{SLOT_LABEL[slot]}</span>
                          {items.map((m) => (
                            <Link key={m.id} href={`/journal?date=${day.date}&meal=${m.id}`} className="week-meal">
                              {m.name}
                              {m.status === "planned" && <span className="muted"> · planned</span>}
                            </Link>
                          ))}
                        </div>
                      );
                    })}
                    <span style={{ fontSize: 11, color: "var(--ink-2)", marginTop: "auto" }}>
                      {day.spend > 0 ? `₩${Math.round(day.spend).toLocaleString()}` : "—"}
                      {day.has_journal && <span aria-label="journal page"> ✎</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {view === "day" && (
          <section className="card grow" aria-label="Day timeline" style={{ padding: "6px 10px" }}>
            {hours.map((h) => {
              const at = dayMeals.filter((x) => x.hour === h);
              return (
                <div key={h} className="hour-row">
                  <span className="hour-label">{String(h).padStart(2, "0")}:00</span>
                  <div className="hour-body">
                    {at.map(({ meal: m }) => (
                      <div key={m.id} className="hour-entry" style={{ borderColor: mealColor(m.slot) }}>
                        <span className="hour-dot" style={{ background: mealColor(m.slot) }} aria-hidden="true" />
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                          <span style={{ fontSize: 14, fontWeight: 600 }}>{SLOT_LABEL[m.slot]} · {m.name}</span>
                          <span style={{ fontSize: 12, color: "var(--muted)" }}>
                            {m.kcal ? `${m.kcal} kcal` : "no calories yet"}
                            {m.place ? ` · ${m.place}` : ""}
                          </span>
                        </div>
                        {m.status === "eaten" ? (
                          <span className="chip">eaten</span>
                        ) : selected <= o.today ? (
                          <ActionButton action={confirmMealAction} args={[m.id]}>Mark eaten</ActionButton>
                        ) : (
                          <span className="chip">planned</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {!d.meals.length && <p className="muted" style={{ padding: 12 }}>Nothing logged for this day yet.</p>}
          </section>
        )}

        <aside className="card side-col" aria-label="Day summary" style={{ gap: 10 }}>
          <span className="lbl">{selected === o.today ? "Today" : selected > o.today ? "Upcoming" : "Past day"}</span>
          <h2 className="h2" style={{ fontSize: 20 }}>{prettyDay(selected)}</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <span className="chip">{d.totals.kcal} kcal eaten</span>
            <span className="chip">₩{Math.round(d.spend).toLocaleString()}</span>
          </div>
          <span className="lbl">Meals</span>
          {d.meals.length ? d.meals.map((m) => (
            <div className="row" key={m.id}>
              <span style={{ flex: 1 }}>{m.slot}: {m.name}</span>
              {m.status === "eaten" ? <span className="chip">eaten</span> : selected <= o.today ? <ActionButton action={confirmMealAction} args={[m.id]}>Mark eaten</ActionButton> : <span className="chip">planned</span>}
            </div>
          )) : <p className="muted">No meals.</p>}
          <span className="lbl">Expenses</span>
          {d.expenses.length ? d.expenses.map((e) => <div className="row" key={e.id}><span style={{ flex: 1 }}>{e.merchant}</span><span>₩{Math.round(e.amount).toLocaleString()}</span></div>) : <p className="muted">No food spend.</p>}
          {d.journal?.review && <><span className="lbl">Journal</span><p className="hand">{d.journal.review.slice(0, 140)}</p></>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link className="btn pri" href={`/journal?date=${selected}`}>Open day page</Link>
            <Link className="btn" href="/recipes">Plan a meal</Link>
          </div>
        </aside>
      </div>
    </>
  );
}
