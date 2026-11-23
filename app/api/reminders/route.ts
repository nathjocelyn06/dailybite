import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { webDb } from "@/lib/services/db";
import { listMeals } from "@/lib/services/meals";
import { getSettings } from "@/lib/services/settings";
import { expenseSummary } from "@/lib/services/expenses";
import { sumEaten } from "@/lib/totals";
import { dueReminders, parsePrefs, REMINDER_COOKIE, type ReminderFacts } from "@/lib/reminders";
import { dayKey } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Is anything over the line right now?"
 *
 * The caller — an open tab, or the service worker waking on a periodic sync —
 * sends its own local date. The answer is filed in `notifications` first, so the
 * dedupe is the database's unique (user_id, dedupe_key) and not a flag in one
 * browser: the same alert can never be delivered twice, on this device or
 * another, and it shows up in the in-app list either way.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { date?: string; dry?: boolean };
  // The service worker calls this with whatever cookies it has; signed out there is
  // simply nothing due, which is not an error worth logging.
  const db = await webDb().catch(() => null);
  if (!db) return NextResponse.json({ show: [] });

  const date = /^\d{4}-\d{2}-\d{2}$/.test(body.date ?? "") ? body.date! : dayKey(new Date(), db.tz);
  const prefs = parsePrefs((await cookies()).get(REMINDER_COOKIE)?.value);

  const [meals, settings, budget] = await Promise.all([
    listMeals(db, { from: date, status: "eaten" }),
    getSettings(db),
    expenseSummary(db)
  ]);

  const facts: ReminderFacts = {
    date,
    calories: { eaten: sumEaten(meals).kcal, goal: settings.kcal_goal },
    budget: { spent: budget.spent, budget: budget.budget, currency: budget.currency, month: budget.month }
  };

  const due = dueReminders(prefs, facts);
  if (body.dry) return NextResponse.json({ date, prefs, facts, due });
  if (!due.length) return NextResponse.json({ date, show: [] });

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
    show: (data ?? []).map((r) => ({ id: r.id, tag: r.dedupe_key, title: r.title, body: r.body, href: r.href ?? "/" }))
  });
}
