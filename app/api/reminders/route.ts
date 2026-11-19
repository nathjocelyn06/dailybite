import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { webDb } from "@/lib/services/db";
import { listMeals } from "@/lib/services/meals";
import { getJournalDay } from "@/lib/services/journal";
import { expenseSummary } from "@/lib/services/expenses";
import { dueReminders, parsePrefs, REMINDER_COOKIE, type ReminderFacts } from "@/lib/reminders";
import { dayKey } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "What should I be told right now?"
 *
 * The caller — an open tab, or the service worker waking on a periodic sync —
 * sends its own local date and clock. The answer is filed in `notifications`
 * first, so the dedupe is the database's unique (user_id, dedupe_key) and not a
 * flag in one browser: the same reminder can never be delivered twice, on this
 * device or another, and it shows up in the in-app list either way.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { date?: string; time?: string; dry?: boolean };
  const db = await webDb();

  const date = /^\d{4}-\d{2}-\d{2}$/.test(body.date ?? "") ? body.date! : dayKey(new Date(), db.tz);
  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(body.time ?? "")
    ? body.time!
    : new Date().toLocaleTimeString("en-GB", { timeZone: db.tz, hour: "2-digit", minute: "2-digit" });

  const prefs = parsePrefs((await cookies()).get(REMINDER_COOKIE)?.value);

  const [meals, day, budget] = await Promise.all([
    listMeals(db, { from: date, status: "eaten" }),
    getJournalDay(db, date),
    expenseSummary(db)
  ]);

  const logged: ReminderFacts["logged"] = {};
  for (const m of meals) logged[m.slot as keyof ReminderFacts["logged"]] = true;

  const facts: ReminderFacts = {
    date,
    logged,
    journal_written: day.elements.length > 0 || !!day.page?.review || meals.length > 0,
    budget: { spent: budget.spent, budget: budget.budget, currency: budget.currency, month: budget.month }
  };

  const due = dueReminders(prefs, time, facts);
  if (body.dry) return NextResponse.json({ date, time, prefs, facts, due });
  if (!due.length) return NextResponse.json({ date, time, show: [] });

  // ignoreDuplicates + select returns only the rows this call actually created, so
  // whatever comes back is exactly what has not been delivered yet.
  const { data, error } = await db.sb
    .from("notifications")
    .upsert(
      due.map((r) => ({
        user_id: db.userId,
        kind: r.kind,
        title: r.title,
        body: r.body,
        href: r.href,
        dedupe_key: r.key
      })),
      { onConflict: "user_id,dedupe_key", ignoreDuplicates: true }
    )
    .select("id,title,body,href,dedupe_key");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    date,
    time,
    show: (data ?? []).map((r) => ({ id: r.id, tag: r.dedupe_key, title: r.title, body: r.body, href: r.href ?? "/" }))
  });
}
