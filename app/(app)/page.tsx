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
import { CalorieRing } from "@/components/CalorieRing";
import { confirmMealAction } from "./actions";

/**
 * Home — the daily overview, rebuilt from the Figma:
 *   a yellow gradient greeting card holding the daily balance (calories left, eaten of
 *   goal, macro bars and the ring), then Today's Meal Plan beside Today Food Spend on
 *   their own pink and green gradients, Other Services as illustrated icons, and saved
 *   recipes to browse.
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
  const money = (n: number) => `${s.budget.currency === "KRW" ? "₩" : ""}${Math.round(n).toLocaleString("en-US")}`;
  const monthPct = Math.min(100, (s.budget.spent / Math.max(1, s.budget.budget)) * 100);
  const logged = s.slots.filter((x) => x.eaten.length || x.pending.length).length;

  return (
    <>
      {/* ---------- greeting ---------- */}
      {/* ---------- greeting ---------- */}
      <section className="home-hero" aria-label="Today">
        <div className="home-hero-top">
          <div className="home-greet">
            <h1 className="h1">{greeting(new Date(), db.tz)}</h1>
            <p className="home-sub">Your daily balance</p>
          </div>
          <div className="home-hero-tools">
            <Link href="/calendar" className="home-date">{prettyDay(s.date)}</Link>
            <Link href="/notifications" className="avatar phone-only" aria-label={`Notifications${unread ? `, ${unread} new` : ""}`}>
              <NavIcon name="notifications" size={20} />
              {unread > 0 && <span className="dot">{unread}</span>}
            </Link>
            <Link href="/more" className="avatar phone-only" aria-label="Account and settings">
              <NavIcon name="settings" size={20} />
            </Link>
          </div>
        </div>

        <Link href="/progress" className="cal-card" aria-label="Today's calories and nutrition, open My progress">
          <div className="cal-meta">
            <span className="cal-left">{Math.max(0, s.remaining_kcal)} remaining</span>
            <strong className="cal-total">{s.eaten.kcal.toLocaleString("en-US")}/{s.goals.kcal.toLocaleString("en-US")}</strong>
            <div className="macros">
              {([["Protein", s.eaten.protein_g, s.goals.protein_g], ["Carbs", s.eaten.carbs_g, s.goals.carbs_g], ["Fat", s.eaten.fat_g, s.goals.fat_g]] as const).map(([label, v, goal]) => (
                <div key={label} className="macro">
                  <span className="macro-head">{label}<em>{v} / {goal} g</em></span>
                  <div className="bar"><span style={{ width: `${Math.min(100, (v / Math.max(1, goal)) * 100)}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
          <CalorieRing eaten={s.eaten.kcal} goal={s.goals.kcal} />
        </Link>
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
        <section className="card home-card card-meal" aria-label="Today's meal plan">
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

        <section className="card home-card card-spend" aria-label="Today food spend">
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
        <ServiceGrid hrefs={HOME_GRID} />
      </section>

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

