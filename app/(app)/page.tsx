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
 * Home: the daily overview, laid out like a super-app home screen (inspired by Gojek):
 * hero band (search + account) → "today" card with quick actions → service grid with More →
 * one tip banner → what I've eaten → up next + reminders → discover recipes.
 * My progress (AI overview), Budget and Notifications are reached from here.
 * v3: no water card, no reminders card (the bell shows them), no health articles.
 */
export default async function HomePage() {
  const db = await webDb();
  const [s, saved, unread] = await Promise.all([
    getDailySummary(db),
    listSaved(db).catch(() => []),
    unreadCount(db).catch(() => 0)
  ]);
  const urls = await signedUrls(db, s.slots.flatMap((x) => [...x.eaten, ...x.pending].map((m) => m.photo_path)));
  // Calorie ring = the plate: one coloured segment per meal (breakfast amber, lunch vermilion, dinner lilac, snack blush).
  const ring = mealRing(s.slots.map((x) => ({ slot: x.slot, kcal: x.eaten.reduce((n, m) => n + (m.kcal ?? 0), 0) })), s.goals.kcal);
  const money = (n: number) => `${s.budget.currency === "KRW" ? "₩" : ""}${Math.round(n).toLocaleString()}`;
  const tip = makeTip(s);

  return (
    <>
      <section className="hero" aria-label="Today">
        <header className="head">
          <div className="titles" style={{ gap: 2 }}>
            <Link href="/calendar" style={{ fontSize: 12, fontWeight: 600, textUnderlineOffset: 3, alignSelf: "flex-start" }}>{prettyDay(s.date)}</Link>
            <h1 className="h1" style={{ fontSize: 26 }}>{greeting(new Date(), db.tz)}</h1>
          </div>
          <form action="/archive" className="hero-search" role="search">
            <NavIcon name="archive" size={18} />
            <label className="sr" htmlFor="home-search">Search your records</label>
            <input id="home-search" type="search" name="q" placeholder="Search meals, recipes, notes" />
          </form>
          <Link href="/notifications" className="avatar" aria-label={`Notifications${unread ? `, ${unread} new` : ""}`}>
            <NavIcon name="notifications" size={20} />
            {unread > 0 && <span className="dot">{unread}</span>}
          </Link>
          <Link href="/more" className="avatar" aria-label="Account and settings">
            <span aria-hidden="true" />
          </Link>
        </header>

        <div className="today">
          <Link href="/progress" aria-label="Today's calories and nutrition, open Progress" style={{ flex: "2 1 360px", display: "flex", alignItems: "center", gap: 18, textDecoration: "none" }}>
            <div aria-hidden="true" style={{ width: 104, height: 104, borderRadius: "50%", flex: "none", background: ring, display: "grid", placeItems: "center" }}>
              <div style={{ width: 82, height: 82, borderRadius: "50%", background: "#fff", display: "grid", placeItems: "center", textAlign: "center" }}>
                <div><div style={{ fontSize: 20, fontWeight: 700 }}>{Math.max(0, s.remaining_kcal)}</div><div className="muted" style={{ fontSize: 11 }}>kcal left</div></div>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              <span className="muted">Eaten {s.eaten.kcal} / {s.goals.kcal} kcal · <span style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>Progress</span></span>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
                {([["Protein", s.eaten.protein_g, s.goals.protein_g], ["Carbs", s.eaten.carbs_g, s.goals.carbs_g], ["Fat", s.eaten.fat_g, s.goals.fat_g]] as const).map(([label, v, goal]) => (
                  <div key={label} style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                    <span>{label} · {v}/{goal} g</span>
                    <div className="bar" style={{ height: 8 }}><span style={{ width: `${Math.min(100, (v / Math.max(1, goal)) * 100)}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>
          </Link>
          <Link href="/budget" aria-label="Food budget, open Budgeting" style={{ flex: "1 1 170px", display: "flex", flexDirection: "column", gap: 4, textDecoration: "none" }}>
            <span className="lbl">Food budget {s.budget.state !== "ok" && <span className="chip warn" style={{ minHeight: 20, marginLeft: 4 }}>{s.budget.state === "over" ? "over" : "80%+"}</span>}</span>
            <span style={{ fontSize: 20, fontWeight: 700 }}>{money(s.budget.remaining)} left</span>
            <span className="muted" style={{ fontSize: 12 }}>Today {money(s.spend_today)} · this month</span>
          </Link>
          <nav aria-label="Quick actions" style={{ flex: "1 1 260px", display: "flex", justifyContent: "space-around", gap: 8 }}>
            <Link className="act" href="/snap?mode=calorie"><span className="act-icon"><NavIcon name="camera" size={18} /></span>Log meal</Link>
            <Link className="act" href="/snap?mode=receipt"><span className="act-icon"><NavIcon name="receipt" size={18} /></span>Scan receipt</Link>
            <Link className="act" href="/recipes?tab=scanner"><span className="act-icon"><NavIcon name="cook" size={18} /></span>Cook</Link>
            <Link className="act" href="/progress"><span className="act-icon"><NavIcon name="progress" size={18} /></span>My progress</Link>
          </nav>
        </div>
      </section>

      {s.pending_confirm.length > 0 && (
        <section className="card paper" aria-label="Meals to confirm" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="lbl">Check these AI estimates</span>
          {s.pending_confirm.map((m) => (
            <div className="row" key={m.id}>
              <span style={{ flex: 1 }}>{m.slot}: <strong>{m.name}</strong> · {m.kcal ?? "?"} kcal</span>
              <Link className="btn sm" href={`/journal?meal=${m.id}`}>Edit</Link>
              <ActionButton action={confirmMealAction} args={[m.id]} className="btn sm pri">Confirm</ActionButton>
            </div>
          ))}
        </section>
      )}

      <ServiceGrid hrefs={HOME_GRID} />

      <Link href={tip.href} className="tip" aria-label={`Today's tip: ${tip.title}`}>
        <span style={{ flex: "1 1 auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 6, justifyContent: "center" }}>
          <span className="lbl" style={{ color: "var(--tip-label)" }}>Today&apos;s tip</span>
          <span style={{ fontSize: 20, fontWeight: 700 }}>{tip.title}</span>
          <span style={{ fontSize: 14 }}>{tip.body}</span>
          <span className="tip-cta">{tip.cta}</span>
        </span>
      </Link>

      <div className="split">
        <section className="card grow" aria-label="What have I eaten today">
          <div className="head" style={{ marginBottom: 14 }}>
            <h2 className="h2" style={{ flex: 1 }}>What have I eaten today?</h2>
            <Link href="/journal" className="muted">Open today&apos;s journal</Link>
          </div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
            {s.slots.map((slot) => {
              const shown = [...slot.eaten, ...slot.pending];
              if (!shown.length)
                return (
                  <div key={slot.slot} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <Link className="empty" href={`/snap?mode=calorie&slot=${slot.slot}`}>+ Log {slot.slot}</Link>
                    <span className="lbl">{slot.slot}</span>
                    <span className="muted">{slot.planned[0] ? `Planned: ${slot.planned[0].name}` : "Nothing yet"}</span>
                  </div>
                );
              const m = shown[0];
              return (
                <Link key={slot.slot} href={`/journal?date=${s.date}&meal=${m.id}`} style={{ display: "flex", flexDirection: "column", gap: 6, textDecoration: "none" }}>
                  <Photo src={m.photo_path ? urls[m.photo_path] : null} alt={m.name} />
                  <span className="lbl">{slot.slot}{shown.length > 1 ? ` · +${shown.length - 1}` : ""}</span>
                  <span style={{ fontWeight: 600 }}>{m.name}</span>
                  <span className="muted">{shown.reduce((a, x) => a + (x.kcal ?? 0), 0)} kcal{m.status === "pending_confirm" ? " · to confirm" : ""}</span>
                </Link>
              );
            })}
          </div>
        </section>

        <div className="side-col">
          <section className="card" aria-label="Up next">
            <div className="head"><h2 className="h2" style={{ flex: 1 }}>Up next</h2><Link href="/calendar" className="muted">Meal plan</Link></div>
            {s.upcoming.length ? s.upcoming.map((m) => (
              <div className="row" key={m.id}><span style={{ flex: 1 }}>{prettyDay(m.date)} · {m.slot}: {m.name}</span><span className="chip">planned</span></div>
            )) : <p className="muted" style={{ paddingTop: 8 }}>No meals planned. <Link href="/recipes">Find a recipe</Link></p>}
          </section>
        </div>
      </div>

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
          <Link href="/recipes" className="empty" style={{ minHeight: 150 }}>Browse recipes →</Link>
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
  stops.push(`#dcdcd9 ${at}deg 360deg`);
  return `conic-gradient(${stops.join(", ")})`;
}
