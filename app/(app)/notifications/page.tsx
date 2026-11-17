import Link from "next/link";
import { webDb } from "@/lib/services/db";
import { listNotifications, refreshNotifications, type Notification } from "@/lib/services/notifications";
import { ActionButton } from "@/components/ActionButton";
import { dismissAction, readAllAction } from "../actions";

const KINDS: { k: Notification["kind"] | "all"; label: string }[] = [
  { k: "all", label: "All" },
  { k: "expiry", label: "Expiry" },
  { k: "low_stock", label: "Low stock" },
  { k: "meal_plan", label: "Meal plan" },
  { k: "budget", label: "Budget" }
];

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind = "all" } = await searchParams;
  const db = await webDb();
  await refreshNotifications(db).catch(() => undefined);
  const list = await listNotifications(db, { kind: kind === "all" ? undefined : (kind as Notification["kind"]) });
  return (
    <>
      <header className="head">
        <div className="titles"><span className="lbl">Notifications</span><h1 className="h1">Reminders &amp; alerts</h1></div>
        <ActionButton action={readAllAction} args={[]} className="btn">Mark all as read</ActionButton>
      </header>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {KINDS.map((x) => <Link key={x.k} href={x.k === "all" ? "/notifications" : `/notifications?kind=${x.k}`} className={`chip ${kind === x.k ? "on" : ""}`} style={{ minHeight: 36, textDecoration: "none" }}>{x.label}</Link>)}
      </div>
      <section className="card" aria-label="Notifications">
        {list.length === 0 && <p className="muted">You&apos;re all caught up.</p>}
        {list.map((n) => (
          <div className="row" key={n.id} style={{ background: n.read_at ? "transparent" : "var(--paper)" }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: n.read_at ? "transparent" : "var(--ink)" }} />
            <span style={{ flex: 1 }}><strong style={{ fontWeight: n.read_at ? 400 : 600 }}>{n.title}</strong><br /><span className="muted">{n.kind.replace("_", " ")} · {n.body}</span></span>
            {n.href && <Link className="btn sm" href={n.href}>Open</Link>}
            <ActionButton action={dismissAction} args={[n.id]} label="Dismiss">×</ActionButton>
          </div>
        ))}
      </section>
    </>
  );
}
