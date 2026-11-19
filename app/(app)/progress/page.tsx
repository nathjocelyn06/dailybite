import Link from "next/link";
import { webDb } from "@/lib/services/db";
import { habitCounts, listGoals, nutritionTrends } from "@/lib/services/progress";
import { getProgressOverview } from "@/lib/services/overview";
import { getSettings } from "@/lib/services/settings";
import { prettyDay } from "@/lib/dates";
import { ActionButton } from "@/components/ActionButton";
import { NavIcon } from "@/components/NavIcon";
import { refreshOverviewAction } from "../actions";
import { ProgressForms } from "./ProgressForms";

/**
 * My progress (Home › My progress), v3:
 *  1. AI progress overview (week / month): headline, summary, going well, I noticed, try next.
 *     Written by Claude from a fact sheet of the user's own records (lib/services/overview.ts),
 *     cached per day, rule-based fallback without ANTHROPIC_API_KEY.
 *  2. Supporting detail: averages, 30-day calories chart, goals.
 * Removed in v3: reflection notes, body photo journal, health articles.
 */
export default async function ProgressPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period: p } = await searchParams;
  const period = p === "month" ? "month" : "week";
  const db = await webDb();
  const [o, t, goals, s, habits] = await Promise.all([
    getProgressOverview(db, period),
    nutritionTrends(db, 30),
    listGoals(db),
    getSettings(db),
    habitCounts(db, 30)
  ]);
  const max = Math.max(s.kcal_goal, ...t.series.map((d) => d.kcal), 1);
  const when = new Date(o.generated_at).toLocaleString("en-GB", { timeZone: db.tz, hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });

  return (
    <>
      <header className="head"><div className="titles"><span className="lbl">My progress</span><h1 className="h1">How am I doing?</h1></div></header>

      <section className="overview" aria-label="AI progress overview">
        <div className="head">
          <span className="overview-mark" aria-hidden="true"><NavIcon name="progress" size={22} /></span>
          <div className="titles" style={{ gap: 2 }}>
            <span className="lbl" style={{ color: "var(--overview-label)" }}>{o.source === "ai" ? "AI progress overview" : "Progress overview"}</span>
            <h2 style={{ fontSize: 20, fontWeight: 700 }}>{o.headline}</h2>
          </div>
          <nav className="seg-links on-dark" aria-label="Overview period">
            <Link href="/progress" aria-current={period === "week" ? "page" : undefined}>This week</Link>
            <Link href="/progress?period=month" aria-current={period === "month" ? "page" : undefined}>This month</Link>
          </nav>
        </div>
        <p style={{ fontSize: 15, lineHeight: 1.55, maxWidth: 820 }}>{o.summary}</p>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {o.wins.length > 0 && (
            <div className="overview-box"><span className="lbl" style={{ color: "var(--overview-label)" }}>Going well</span>{o.wins.map((w) => <span key={w}>· {w}</span>)}</div>
          )}
          {o.noticed.length > 0 && (
            <div className="overview-box"><span className="lbl" style={{ color: "var(--overview-label)" }}>I noticed</span>{o.noticed.map((w) => <span key={w}>· {w}</span>)}</div>
          )}
          <Link href={o.next.href} className="overview-next"><span className="lbl" style={{ color: "inherit" }}>Try next</span><strong>{o.next.text}</strong><span style={{ textDecoration: "underline", textUnderlineOffset: 3, fontSize: 12 }}>Go</span></Link>
        </div>
        <div className="head" style={{ fontSize: 12 }}>
          <span style={{ flex: "1 1 320px", color: "var(--overview-label)" }}>
            {o.source === "ai" ? "Written by AI" : "Summarised"} from {o.basis} · {when} · general guidance, not medical advice
          </span>
          <ActionButton action={refreshOverviewAction} args={[period]} className="btn sm on-dark">Refresh overview</ActionButton>
        </div>
      </section>

      <div className="grid">
        <div className="card"><div className="lbl">Avg calories</div><strong style={{ fontSize: 24 }}>{t.averages.kcal}</strong><div className="muted">on {t.days_logged} logged days</div></div>
        <div className="card"><div className="lbl">Logging streak</div><strong style={{ fontSize: 24 }}>{t.streak} days</strong></div>
        <div className="card"><div className="lbl">Protein goal hit</div><strong style={{ fontSize: 24 }}>{t.goal_hit_rate.protein}%</strong><div className="muted">of logged days</div></div>
      </div>
      {habits.length > 0 && (
        <section className="card" aria-label="Moods and habits">
          <div className="head" style={{ marginBottom: 10 }}>
            <h2 className="h2" style={{ flex: 1 }}>Moods &amp; habits (30 days)</h2>
            <span className="muted">from your journal pages</span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {habits.map((h) => (
              <span key={`${h.kind}-${h.label}`} className="chip" title={`last on ${h.lastOn}`}>
                {h.label} · <strong>{h.count}</strong>
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="card" aria-label="Calories per day">
        <div className="head" style={{ marginBottom: 10 }}><h2 className="h2" style={{ flex: 1 }}>Calories per day (30 days)</h2><span className="muted">dashed line = goal {s.kcal_goal}</span></div>
        <div style={{ position: "relative", display: "flex", alignItems: "flex-end", gap: 3, height: 160, borderBottom: "1px solid var(--line)" }} role="img" aria-label="Calories per day chart">
          <div style={{ position: "absolute", left: 0, right: 0, bottom: `${(s.kcal_goal / max) * 100}%`, borderTop: "1.5px dashed var(--muted)" }} />
          {t.series.map((d) => <div key={d.date} title={`${prettyDay(d.date)}: ${d.kcal} kcal`} style={{ flex: 1, height: `${(d.kcal / max) * 100}%`, background: d.meals ? "var(--cobalt)" : "transparent", borderRadius: "3px 3px 0 0" }} />)}
        </div>
      </section>
      <div className="split">
        <section className="card grow" aria-label="Goals">
          <h2 className="h2" style={{ marginBottom: 6 }}>Goals &amp; milestones</h2>
          {goals.length === 0 && <p className="muted">No goals yet.</p>}
          {goals.map((g) => (
            <div className="row" key={g.id}><span style={{ flex: 1 }}>{g.title}</span><span className="chip">{g.progress}{g.target ? ` / ${g.target}` : ""} {g.unit ?? ""}</span></div>
          ))}
        </section>
        <aside className="side-col"><ProgressForms /></aside>
      </div>
    </>
  );
}
