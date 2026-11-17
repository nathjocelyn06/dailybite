import { webDb } from "@/lib/services/db";
import { EXPENSE_LABEL, spendSummary } from "@/lib/services/expenses";
import { addDays, addMonths, isDayKey, isMonthKey, prettyDay } from "@/lib/dates";
import Link from "next/link";
import { ActionButton } from "@/components/ActionButton";
import { deleteExpenseAction } from "../actions";
import { ExpenseForm } from "./ExpenseForm";

type Period = "week" | "month";

export default async function BudgetPage({
  searchParams
}: {
  searchParams: Promise<{ month?: string; date?: string; period?: string; expense?: string }>;
}) {
  const sp = await searchParams;
  const db = await webDb();
  const period: Period = sp.period === "week" ? "week" : "month";
  const anchor = isDayKey(sp.date) ? sp.date : isMonthKey(sp.month) ? `${sp.month}-01` : undefined;
  const s = await spendSummary(db, period, anchor);

  const w = (n: number) => `₩${Math.round(n).toLocaleString()}`;
  const days = Object.entries(s.by_day).sort(([a], [b]) => (a < b ? -1 : 1));
  const max = Math.max(1, ...days.map(([, v]) => v));
  const editing = sp.expense ? s.recent.find((e) => e.id === sp.expense) : undefined;

  const link = (next: { date?: string; period?: Period }) => {
    const p = next.period ?? period;
    const q = new URLSearchParams();
    if (next.date) q.set("date", next.date);
    if (p !== "month") q.set("period", p);
    const str = q.toString();
    return `/budget${str ? `?${str}` : ""}`;
  };
  const step = (dir: -1 | 1) =>
    period === "month" ? link({ date: `${addMonths(s.month, dir)}-01` }) : link({ date: addDays(s.from, dir * 7) });

  const heading = period === "month" ? `Food spending · ${s.month}` : `Food spending · ${prettyDay(s.from)} – ${prettyDay(s.to)}`;

  return (
    <>
      <header className="head">
        <div className="titles"><span className="lbl">Budgeting</span><h1 className="h1">{heading}</h1></div>
        <Link className="btn" href={step(-1)} aria-label={`Previous ${period}`}>‹</Link>
        <Link className="btn" href={link({})}>{period === "month" ? "This month" : "This week"}</Link>
        <Link className="btn" href={step(1)} aria-label={`Next ${period}`}>›</Link>
        <Link className="btn pri" href="/snap?mode=receipt">Scan receipt</Link>
      </header>

      <nav className="seg-links" aria-label="Budget period">
        <Link href={link({ period: "week", date: s.from })} aria-current={period === "week" ? "page" : undefined}>Weekly</Link>
        <Link href={link({ period: "month", date: `${s.month}-01` })} aria-current={period === "month" ? "page" : undefined}>Monthly</Link>
      </nav>

      <div className="split">
        <section className="card grow" aria-label="Overview" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
            <div><div className="lbl">Spent</div><div style={{ fontSize: 28, fontWeight: 700 }}>{w(s.spent)}</div></div>
            <div><div className="lbl">Remaining</div><div style={{ fontSize: 28, fontWeight: 700 }}>{w(s.remaining)}</div></div>
            <div>
              <div className="lbl">{period === "month" ? "Budget" : "Week's share"}</div>
              <div style={{ fontSize: 18 }}>{w(s.budget)}</div>
            </div>
            {s.state !== "ok" && <span className="chip warn" style={{ alignSelf: "center" }}>{s.state === "over" ? "Over budget" : "80% used"}</span>}
          </div>
          {period === "week" && (
            <p className="muted" style={{ fontSize: 12 }}>
              Seven days&apos; share of your {w(s.monthly_budget)} monthly budget. The budget itself is monthly — change it in Settings.
            </p>
          )}
          <div className="bar" style={{ height: 14 }}><span style={{ width: `${Math.min(100, (s.spent / Math.max(1, s.budget)) * 100)}%` }} /></div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
            {s.by_category.map((c) => (
              <div key={c.category} style={{ background: "var(--bg)", borderRadius: 12, padding: 12 }}>
                <div className="muted">{c.label}</div><strong>{w(c.total)}</strong>
              </div>
            ))}
          </div>
          <span className="lbl">Daily spend</span>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 140, borderBottom: "1px solid var(--line)" }} role="img" aria-label="Daily spending chart">
            {days.length === 0 && <span className="muted">No expenses in this {period}.</span>}
            {days.map(([d, v]) => (
              <div key={d} title={`${d}: ${w(v)}`} style={{ flex: 1, height: `${(v / max) * 100}%`, background: "var(--sage)", borderRadius: "4px 4px 0 0", minWidth: 4 }} />
            ))}
          </div>
        </section>
        <aside className="side-col">
          <section className="card">
            <h2 className="h2" style={{ marginBottom: 10 }}>{editing ? "Edit expense" : "Add expense"}</h2>
            <ExpenseForm
              key={editing?.id ?? "new"}
              expense={editing ? { id: editing.id, merchant: editing.merchant, amount: editing.amount, category: editing.category, date: editing.date } : undefined}
            />
          </section>
        </aside>
      </div>

      <section className="card" aria-label="History">
        <h2 className="h2" style={{ marginBottom: 6 }}>History</h2>
        {s.recent.length === 0 && <p className="muted">Nothing yet.</p>}
        {s.recent.map((e) => (
          <div className="row" key={e.id} style={{ outline: sp.expense === e.id ? "2px dashed var(--ink)" : "none" }}>
            <span style={{ width: 90 }} className="muted">{e.date}</span>
            <span style={{ flex: 1 }}>{e.merchant}</span>
            <span className="chip">{EXPENSE_LABEL[e.category]}</span>
            <strong style={{ width: 100, textAlign: "right" }}>{w(e.amount)}</strong>
            <Link
              className="btn"
              href={`${link({})}${link({}).includes("?") ? "&" : "?"}expense=${e.id}`}
              aria-label={`Edit ${e.merchant}`}
            >
              Edit
            </Link>
            <ActionButton action={deleteExpenseAction} args={[e.id]} confirm={`Delete ${e.merchant}?`} label={`Delete ${e.merchant}`}>×</ActionButton>
          </div>
        ))}
      </section>
    </>
  );
}
