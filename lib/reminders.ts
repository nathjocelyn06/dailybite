/**
 * Alerts: the two things worth interrupting someone for.
 *
 *   · the day's calories have gone past the goal, and
 *   · the month's food spend has passed the threshold they set.
 *
 * Both are about a number crossing a line the user drew themselves, so neither is a
 * nag on a timer — there is nothing here that fires just because it is 8am.
 *
 * The rules are pure so they can be tested and so the same answer comes out whether
 * the question is asked by an open tab, by the service worker's periodic sync, or
 * later by a push job on a server. The caller passes the facts in.
 *
 * Preferences live in a cookie rather than a table: they belong to the browser that
 * shows the alerts, they must be readable by the server route that decides what is
 * due, and a cookie travels with the service worker's own fetches.
 */

export const REMINDER_COOKIE = "dailybite_reminders";

export type ReminderPrefs = {
  /** Tell me when today's calories go over my goal. */
  calories: boolean;
  /** Warn me as the month's food budget runs out. */
  budget: boolean;
  /** Percentage of the budget at which to warn (80 = four fifths spent). */
  budget_threshold: number;
};

export const DEFAULT_PREFS: ReminderPrefs = {
  calories: true,
  budget: true,
  budget_threshold: 80
};

export type ReminderFacts = {
  /** The user's local day, YYYY-MM-DD. */
  date: string;
  /** Calories eaten today against the daily goal. */
  calories: { eaten: number; goal: number };
  budget: { spent: number; budget: number; currency: string; month: string };
};

export type DueReminder = {
  /** Stable per day or per month, so the same alert is never delivered twice. */
  key: string;
  kind: "meal_plan" | "budget";
  title: string;
  body: string;
  href: string;
};

/** Read prefs out of a cookie value, falling back to the defaults field by field. */
export function parsePrefs(raw: string | undefined | null): ReminderPrefs {
  if (!raw) return DEFAULT_PREFS;
  let obj: unknown;
  try {
    obj = JSON.parse(decodeURIComponent(raw));
  } catch {
    return DEFAULT_PREFS;
  }
  if (!obj || typeof obj !== "object") return DEFAULT_PREFS;
  const p = obj as Partial<ReminderPrefs>;
  return {
    calories: p.calories !== false,
    budget: p.budget !== false,
    budget_threshold:
      typeof p.budget_threshold === "number" && p.budget_threshold >= 10 && p.budget_threshold <= 150
        ? Math.round(p.budget_threshold)
        : DEFAULT_PREFS.budget_threshold
  };
}

export function serialisePrefs(p: ReminderPrefs): string {
  return encodeURIComponent(JSON.stringify(p));
}

const n = (v: number) => Math.round(v).toLocaleString("en-US");

/**
 * Everything that is true right now and still unanswered. Callers deduplicate on
 * `key`; this function happily returns the same alert every time it is asked.
 */
export function dueReminders(prefs: ReminderPrefs, facts: ReminderFacts): DueReminder[] {
  const out: DueReminder[] = [];

  if (prefs.calories && facts.calories.goal > 0 && facts.calories.eaten > facts.calories.goal) {
    const over = Math.round(facts.calories.eaten - facts.calories.goal);
    out.push({
      key: `reminder:calories:${facts.date}`,
      kind: "meal_plan",
      title: `${n(facts.calories.eaten)} kcal today — ${n(over)} over your goal`,
      body: `Your goal is ${n(facts.calories.goal)} kcal. Worth knowing, not worth worrying about.`,
      href: "/journal"
    });
  }

  if (prefs.budget && facts.budget.budget > 0) {
    const pct = Math.round((facts.budget.spent / facts.budget.budget) * 100);
    const over = pct >= 100;
    if (pct >= prefs.budget_threshold) {
      out.push({
        // One warning for crossing the line, one more for going over: not one a day.
        key: `reminder:budget:${facts.budget.month}:${over ? "over" : "near"}`,
        kind: "budget",
        title: over ? `Food budget is spent (${pct}%)` : `Food budget is at ${pct}%`,
        body: `${n(facts.budget.spent)} of ${n(facts.budget.budget)} ${facts.budget.currency} this month.`,
        href: "/budget"
      });
    }
  }

  return out;
}
