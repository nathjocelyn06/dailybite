/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { webDb } from "@/lib/services/db";
import { getDailySummary } from "@/lib/services/dashboard";
import { listSaved } from "@/lib/services/recipes";
import { unreadCount } from "@/lib/services/notifications";
import { signedUrls } from "@/lib/services/photos";
import { greeting, prettyDay } from "@/lib/dates";
import { HOME_GRID } from "@/lib/nav";
import { ActionButton } from "@/components/ActionButton";
import { NavIcon } from "@/components/NavIcon";
import { Photo } from "@/components/Photo";
import { ServiceGrid } from "@/components/Services";
import { confirmMealAction } from "./actions";

/**
 * Home — the daily overview, rebuilt from the Figma:
 *   a gradient greeting card (date, greeting, search, bell) holding the calorie ring,
 *   a row of quick actions, then Today's Meal Plan beside Today Food Spend,
 *   Other Services as gradient tiles, one tip, and saved recipes to browse.
 * My progress, Budget and Notifications are reached from here; the four tabs never change.
 */
export default async function HomePage() {
  const db = await webDb();
  const [s, saved, unread] = await Promise.all([
    getDailySummary(db),
    listSaved(db).catch(() => []),
    unreadCount(db).catch(() => 0)
  ]);
  const urls = await signedUrls(db, s.slots.flatMap((x) => [...x.eaten, ...x.pending].map((m) => m.photo_path)));
  // The ring is the plate: one coloured arc per meal (breakfast apricot, lunch coral, dinner lilac, snack blush).
  const ring = mealRing(s.slots.map((x) => ({ slot: x.slot, kcal: x.eaten.reduce((n, m) => n + (m.kcal ?? 0), 0) })), s.goals.kcal);
  const money = (n: number) => `${s.budget.currency === "KRW" ? "₩" : ""}${Math.round(n).toLocaleString()}`;
  const tip = makeTip(s);
  const monthPct = Math.min(100, (s.budget.spent / Math.max(1, s.budget.budget)) * 100);
  const logged = s.slots.filter((x) => x.eaten.length || x.pending.length).length;

  return (
    <>
      {/* ---------- greeting ---------- */}
      <section className="home-hero" aria-label="Today">
        <div className="home-hero-top">
          <div className="home-greet">
            <Link href="/calendar" className="home-date">{prettyDay(s.date)}</Link>
            <h1 className="h1">{greeting(new Date(), db.tz)}</h1>
            <p className="home-sub">
              {logged === 0
                ? "Nothing logged yet — start with your first meal."
                : `${logged} of 4 meals logged · ${Math.max(0, s.remaining_kcal)} kcal still to go.`}
            </p>
          </div>
          <div className="home-hero-tools">
            <form action="/archive" className="hero-search" role="search">
              <NavIcon name="search" size={18} />
              <label className="sr" htmlFor="home-search">Search your records</label>
              <input id="home-search" type="search" name="q" placeholder="Search meals, recipes, notes" />
            </form>
            <Link href="/notifications" className="avatar" aria-label={`Notifications${unread ? `, ${unread} new` : ""}`}>
              <NavIcon name="notifications" size={20} />
              {unread > 0 && <span className="dot">{unread}</span>}
            </Link>
            <Link href="/more" className="avatar" aria-label="Account and settings">
              <NavIcon name="settings" size={20} />
            </Link>
          </div>
        </div>

        <Link href="/progress" className="cal-card" aria-label="Today's calories and nutrition, open My progress">
          <div className="ring" style={{ background: ring }} aria-hidden="true">
            <span className="ring-hole">
              <strong>{Math.max(0, s.remaining_kcal)}</strong>
              <span className="muted">kcal left</span>
            </span>
          </div>
          <div className="cal-meta">
            <span className="lbl">Calories today</span>
            <strong className="cal-total">{s.eaten.kcal} <span>/ {s.goals.kcal} kcal</span></strong>
            <div className="macros">
              {([["Protein", s.eaten.protein_g, s.goals.protein_g], ["Carbs", s.eaten.carbs_g, s.goals.carbs_g], ["Fat", s.eaten.fat_g, s.goals.fat_g]] as const).map(([label, v, goal]) => (
                <div key={label} className="macro">
                  <span>{label}<em>{v}/{goal} g</em></span>
                  <div className="bar"><span style={{ width: `${Math.min(100, (v / Math.max(1, goal)) * 100)}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
        </Link>

        <nav className="quick" aria-label="Quick actions">
          <Link className="act" href="/snap?mode=calorie"><span className="act-icon"><NavIcon name="camera" size={18} /></span>Log meal</Link>
          <Link className="act" href="/snap?mode=receipt"><span className="act-icon"><NavIcon name="receipt" size={18} /></span>Scan receipt</Link>
          <Link className="act" href="/recipes?tab=scanner"><span className="act-icon"><NavIcon name="cook" size={18} /></span>Cook</Link>
          <Link className="act" href="/progress"><span className="act-icon"><NavIcon name="progress" size={18} /></span>My progress</Link>
        </nav>
      </section>

      {s.pending_confirm.length > 0 && (
        <section className="card paper" aria-label="Meals to confirm" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="lbl">Check these AI estimates</span>
          {s.pending_confirm.map((m) => (
            <div className="row" key={m.id}>
              <span style={{ flex: 1 }}>{m.slot}: <strong>{m.name}</strong> &middot; {m.kcal ?? "?"} kcal</span>
              <Link className="btn sm" href={`/journal?date=${m.date}&meal=${m.id}&edit=1`}>Edit</Link>
              <ActionButton action={confirmMealAction} args={[m.id]} className="btn sm pri">Confirm</ActionButton>
            </div>
          ))}
        </section>
      )}

      {/* ---------- meal plan + spend ---------- */}
      <div className="home-two">
        <section className="card home-card" aria-label="Today's meal plan">
          <div className="head">
            <h2 className="h2" style={{ flex: 1 }}>Today&apos;s Meal Plan</h2>
            <Link href="/journal" className="muted">Journal</Link>
          </div>
          <div className="slots">
            {s.slots.map((slot) => {
              const shown = [...slot.eaten, ...slot.pending];
              if (!shown.length)
                return (
                  <Link key={slot.slot} className="slot slot-empty" href={`/snap?mode=calorie&slot=${slot.slot}`}>
                    <span className={`slot-dot slot-${slot.slot}`} aria-hidden="true" />
                    <span className="slot-text">
                      <strong>{slot.slot}</strong>
                      <span className="muted">{slot.planned[0] ? `Planned: ${slot.planned[0].name}` : "Nothing yet"}</span>
                    </span>
                    <span className="slot-add" aria-hidden="true">+</span>
                  </Link>
                );
              const m = shown[0];
              const kcal = shown.reduce((a, x) => a + (x.kcal ?? 0), 0);
              return (
                <Link key={slot.slot} className="slot" href={`/journal?date=${s.date}&meal=${m.id}`}>
                  <span className={`slot-dot slot-${slot.slot}`} aria-hidden="true" />
                  <span className="slot-thumb"><Photo src={m.photo_path ? urls[m.photo_path] : null} alt={m.name} /></span>
                  <span className="slot-text">
                    <strong>{m.name}{shown.length > 1 ? ` +${shown.length - 1}` : ""}</strong>
                    <span className="muted">{slot.slot} &middot; {kcal} kcal{m.status === "pending_confirm" ? " · to confirm" : ""}</span>
                  </span>
                </Link>
              );
            })}
          </div>
          {s.upcoming.length > 0 && (
            <p className="muted slots-next">
              Up next &middot; {prettyDay(s.upcoming[0].date)} {s.upcoming[0].slot}: {s.upcoming[0].name} &middot; <Link href="/calendar">Meal plan</Link>
            </p>
          )}
        </section>

        <section className="card home-card" aria-label="Today food spend">
          <div className="head">
            <h2 className="h2" style={{ flex: 1 }}>Today Food Spend</h2>
            <Link href="/budget" className="muted">Budget</Link>
          </div>
          <strong className="spend-today">{money(s.spend_today)}</strong>
          <span className="muted">spent today</span>
          <div className="spend-bar">
            <div className="bar"><span className={s.budget.state === "over" ? "over" : ""} style={{ width: `${monthPct}%` }} /></div>
            <span className="muted">
              {money(s.budget.spent)} of {money(s.budget.budget)} this month
              {s.budget.state !== "ok" && <span className="chip warn" style={{ minHeight: 20, marginLeft: 6 }}>{s.budget.state === "over" ? "over" : "80%+"}</span>}
            </span>
          </div>
          <div className="spend-left">
            <span className="lbl">Left this month</span>
            <strong>{money(s.budget.remaining)}</strong>
          </div>
          <Link className="btn" href="/snap?mode=receipt" style={{ justifyContent: "center" }}>Scan a receipt</Link>
        </section>
      </div>

      {/* ---------- services ---------- */}
      <section aria-label="Other services" className="home-services">
        <h2 className="h2">Other Services</h2>
        <ServiceGrid hrefs={HOME_GRID} />
      </section>

      <Link href={tip.href} className="tip" aria-label={`Today's tip: ${tip.title}`}>
        <span className="tip-body">
          <span className="lbl" style={{ color: "var(--tip-label)" }}>Today&apos;s tip</span>
          <span className="tip-title">{tip.title}</span>
          <span style={{ fontSize: 14 }}>{tip.body}</span>
          <span className="tip-cta">{tip.cta}</span>
        </span>
      </Link>

      <section aria-label="Discover recipes" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="head"><h2 className="h2" style={{ flex: 1 }}>Discover good eats</h2><Link href="/recipes" className="muted">See all recipes</Link></div>
        <div className="hscroll">
          {saved.slice(0, 8).map((r) => (
            <Link key={r.id} href={r.source === "themealdb" ? `/recipes/themealdb/${r.external_id}` : `/recipes/mine/${r.id}`} style={{ display: "flex", flexDirection: "column", gap: 6, textDecoration: "none" }}>
              {r.thumb_url ? <img className="thumb" src={r.thumb_url} alt="" loading="lazy" /> : <div className="thumb" aria-hidden="true" />}
              <span style={{ fontWeight: 600, fontSize: 14 }}>{r.title}</span>
              <span className="muted" style={{ fontSize: 12 }}>{[r.category, r.minutes ? `${r.minutes} min` : null, r.video_url ? "video" : null].filter(Boolean).join(" · ")}</span>
            </Link>
          ))}
          <Link href="/recipes" className="empty" style={{ minHeight: 150 }}>Browse recipes &rarr;</Link>
        </div>
      </section>
    </>
  );
}

type Summary = Awaited<ReturnType<typeof getDailySummary>>;

/** One actionable tip from the user's own data (never generic health claims). */
function makeTip(s: Summary): { title: string; body: string; cta: string; href: string } {
  const soon = s.use_soon[0];
  if (soon) {
    const when = soon.days_left !== null && soon.days_left > 0 ? `in ${soon.days_left} day${soon.days_left === 1 ? "" : "s"}` : "today";
    return { title: `${soon.name} expires ${when}`, body: "Find a recipe that uses what is already in your fridge.", cta: "Cook with it", href: "/recipes?tab=scanner" };
  }
  if (s.low_stock[0]) return { title: `${s.low_stock[0].name} is running low`, body: "Add it to your grocery list so you don't forget.", cta: "Open grocery list", href: "/fridge?tab=list" };
  if (!s.upcoming.length) return { title: "Nothing planned yet", body: "Plan tomorrow's meals so shopping and budgeting are easier.", cta: "Plan a meal", href: "/calendar" };
  return { title: "Write today's reflection", body: "A line or two about how today's food felt goes into your journal.", cta: "Open journal", href: "/journal" };
}

/** conic-gradient with one segment per meal, sized against the day's calorie goal. */
function mealRing(slots: { slot: string; kcal: number }[], goal: number): string {
  let at = 0;
  const stops: string[] = [];
  for (const s of slots) {
    if (!s.kcal) continue;
    const end = Math.min(360, at + (s.kcal / Math.max(1, goal)) * 360);
    stops.push(`var(--meal-${s.slot}) ${at}deg ${end}deg`);
    at = end;
  }
  stops.push(`var(--ring-rest) ${at}deg 360deg`);
  return `conic-gradient(${stops.join(", ")})`;
}
