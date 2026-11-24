import "server-only";
import { type Db, must } from "./db";
import { addDays, dayKey, monthOf } from "../dates";
import { listFridge } from "./fridge";
import { listMeals } from "./meals";
import { expenseSummary } from "./expenses";

export type Notification = {
  id: string;
  kind: "expiry" | "low_stock" | "meal_plan" | "budget";
  title: string;
  body: string | null;
  href: string | null;
  read_at: string | null;
  dismissed_at: string | null;
  created_at: string;
};

const COLS = "id,kind,title,body,href,read_at,dismissed_at,created_at";

/**
 * Derive reminders from current data. Idempotent: dedupe_key keeps one row per
 * (item, day) so calling this on every page load or tool call is safe. No cron needed.
 */
/**
 * Deriving reminders means reading the fridge, the meals and the month's expenses and
 * then writing — six round trips in front of a page that only wanted to show a badge.
 * Nothing it derives changes minute to minute, so a warm process does it at most every
 * five minutes. The Notifications page passes `force`, because that is the one screen
 * where the list itself is the point.
 */
const lastRefresh = new Map<string, number>();
const REFRESH_EVERY_MS = 5 * 60_000;

export async function refreshNotifications(db: Db, opts: { force?: boolean } = {}): Promise<void> {
  const now = Date.now();
  if (!opts.force && now - (lastRefresh.get(db.userId) ?? 0) < REFRESH_EVERY_MS) return;
  lastRefresh.set(db.userId, now);
  const today = dayKey(new Date(), db.tz);
  const [stock, plannedToday, budget] = await Promise.all([
    listFridge(db),
    listMeals(db, { from: today, status: "planned" }),
    expenseSummary(db)
  ]);
  const rows: Record<string, unknown>[] = [];
  for (const f of stock) {
    if (f.expiry === "use_soon" || f.expiry === "expired") {
      rows.push({
        kind: "expiry",
        title: f.expiry === "expired" ? `${f.name} has expired` : `${f.name} expires ${f.days_left === 0 ? "today" : `in ${f.days_left} day${f.days_left === 1 ? "" : "s"}`}`,
        body: "Use it first or find a recipe that needs it.",
        ref_table: "fridge_items",
        ref_id: f.id,
        href: "/fridge",
        dedupe_key: `expiry:${f.id}:${today}`
      });
    }
    if (f.low) {
      rows.push({
        kind: "low_stock",
        title: `Only ${f.qty} ${f.unit} of ${f.name} left`,
        body: "Add it to your shopping list?",
        ref_table: "fridge_items",
        ref_id: f.id,
        href: "/fridge",
        dedupe_key: `low:${f.id}:${today}`
      });
    }
  }
  for (const m of plannedToday) {
    rows.push({
      kind: "meal_plan",
      title: `${cap(m.slot)} plan: ${m.name}`,
      body: "Mark it as eaten when you have it.",
      ref_table: "meals",
      ref_id: m.id,
      href: "/journal",
      dedupe_key: `plan:${m.id}:${today}`
    });
  }
  if (budget.state !== "ok") {
    const pct = budget.budget > 0 ? Math.round((budget.spent / budget.budget) * 100) : 0;
    rows.push({
      kind: "budget",
      title: budget.state === "over" ? `Food budget exceeded (${pct}%)` : `Food budget at ${pct}%`,
      body: `Spent ${budget.spent.toLocaleString()} of ${budget.budget.toLocaleString()} ${budget.currency} this month.`,
      href: "/budget",
      dedupe_key: `budget:${monthOf(today)}:${budget.state}`
    });
  }
  if (!rows.length) return;
  must(
    await db.sb
      .from("notifications")
      .upsert(rows.map((r) => ({ ...r, user_id: db.userId })), { onConflict: "user_id,dedupe_key", ignoreDuplicates: true }),
    "refresh notifications"
  );
  // Drop stale expiry/low rows from earlier days that were never read.
  must(
    await db.sb
      .from("notifications")
      .delete()
      .eq("user_id", db.userId)
      .is("read_at", null)
      .in("kind", ["expiry", "low_stock", "meal_plan"])
      .lt("created_at", `${addDays(today, -7)}T00:00:00Z`),
    "prune notifications"
  );
}

export async function listNotifications(db: Db, opts: { unreadOnly?: boolean; kind?: Notification["kind"] } = {}) {
  let q = db.sb.from("notifications").select(COLS).eq("user_id", db.userId).is("dismissed_at", null);
  if (opts.unreadOnly) q = q.is("read_at", null);
  if (opts.kind) q = q.eq("kind", opts.kind);
  return must(await q.order("created_at", { ascending: false }).limit(50), "list notifications") as Notification[];
}

export async function unreadCount(db: Db): Promise<number> {
  const { count, error } = await db.sb
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", db.userId)
    .is("read_at", null)
    .is("dismissed_at", null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function markRead(db: Db, ids?: string[]) {
  let q = db.sb.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", db.userId).is("read_at", null);
  if (ids?.length) q = q.in("id", ids);
  must(await q, "mark read");
}

/**
 * Clear the list. Everything is dismissed rather than deleted, so a reminder that is
 * still true (something expiring, the budget) does not simply reappear on the next
 * refresh: its dedupe key is already taken.
 */
export async function dismissAll(db: Db) {
  const now = new Date().toISOString();
  must(
    await db.sb
      .from("notifications")
      .update({ dismissed_at: now, read_at: now })
      .eq("user_id", db.userId)
      .is("dismissed_at", null),
    "clear notifications"
  );
}

export async function dismiss(db: Db, id: string) {
  must(
    await db.sb.from("notifications").update({ dismissed_at: new Date().toISOString() }).eq("user_id", db.userId).eq("id", id),
    "dismiss"
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
