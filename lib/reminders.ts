/**
 * Reminders: what to say, and when.
 *
 * The rules here are pure so they can be tested and so the same answer comes out
 * whether the question is asked by an open tab, by the service worker's periodic
 * sync, or later by a push job on a server. Nothing in this file touches the
 * network, the clock or the DOM — the caller passes the time and the facts in.
 *
 * Preferences live in a cookie rather than a table: they belong to the browser that
 * shows the notifications, they must be readable by the server route that decides
 * what is due, and a cookie travels with the service worker's own fetches.
 */

export const REMINDER_COOKIE = "dailybite_reminders";

export type Slot = "breakfast" | "lunch" | "dinner";

export type ReminderPrefs = {
  /** Remind me to log a meal I have not logged yet. */
  meals: boolean;
  /** "HH:MM" per meal, in the user's own local time. */
  meal_times: Record<Slot, string>;
  /** Remind me to write today's journal. */
  journal: boolean;
  journal_time: string;
  /** Warn me as the food budget runs out. */
  budget: boolean;
  /** Percentage of the budget at which to warn (80 = four fifths spent). */
  budget_threshold: number;
};

export const DEFAULT_PREFS: ReminderPrefs = {
  meals: true,
  meal_times: { breakfast: "08:30", lunch: "12:30", dinner: "19:00" },
  journal: true,
  journal_time: "21:00",
  budget: true,
  budget_threshold: 80
};

const SLOTS: Slot[] = ["breakfast", "lunch", "dinner"];
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** A reminder is only worth showing for a while after its time — not all evening. */
export const WINDOW_MINUTES = 120;

export type ReminderFacts = {
  /** The user's local day, YYYY-MM-DD. */
  date: string;
  /** Which meal slots already have something eaten on that day. */
  logged: Partial<Record<Slot | "snack", boolean>>;
  /** Whether anything at all is on today's journal page. */
  journal_written: boolean;
  budget: { spent: number; budget: number; currency: string; month: string };
};

export type DueReminder = {
  /** Stable per day, so the same reminder is never delivered twice. */
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
  const times = { ...DEFAULT_PREFS.meal_times };
  for (const s of SLOTS) {
    const t = p.meal_times?.[s];
    if (typeof t === "string" && TIME.test(t)) times[s] = t;
  }
  return {
    meals: p.meals !== false,
    meal_times: times,
    journal: p.journal !== false,
    journal_time: typeof p.journal_time === "string" && TIME.test(p.journal_time) ? p.journal_time : DEFAULT_PREFS.journal_time,
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

/** Minutes since midnight, or null if the string is not a clock time. */
export function minutesOf(hhmm: string): number | null {
  if (!TIME.test(hhmm)) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

const LABEL: Record<Slot, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };

/**
 * Everything that is due at `nowHHMM` on the user's own clock and still unanswered.
 * Callers deduplicate on `key`; this function happily returns the same reminder
 * every minute of its window.
 */
export function dueReminders(prefs: ReminderPrefs, nowHHMM: string, facts: ReminderFacts): DueReminder[] {
  const now = minutesOf(nowHHMM);
  if (now === null) return [];
  const out: DueReminder[] = [];

  if (prefs.meals) {
    for (const slot of SLOTS) {
      const at = minutesOf(prefs.meal_times[slot]);
      if (at === null || facts.logged[slot]) continue;
      if (now < at || now > at + WINDOW_MINUTES) continue;
      out.push({
        key: `reminder:meal:${slot}:${facts.date}`,
        kind: "meal_plan",
        title: `Did you have ${LABEL[slot].toLowerCase()}?`,
        body: "Snap it or add it, and today's calories stay honest.",
        href: `/snap?mode=calorie&slot=${slot}`
      });
    }
  }

  if (prefs.journal && !facts.journal_written) {
    const at = minutesOf(prefs.journal_time);
    if (at !== null && now >= at && now <= at + WINDOW_MINUTES) {
      out.push({
        key: `reminder:journal:${facts.date}`,
        kind: "meal_plan",
        title: "Today's journal is still empty",
        body: "A photo and a line is enough to remember the day by.",
        href: "/journal"
      });
    }
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
        body: `${Math.round(facts.budget.spent).toLocaleString("en-US")} of ${Math.round(facts.budget.budget).toLocaleString("en-US")} ${facts.budget.currency} this month.`,
        href: "/budget"
      });
    }
  }

  return out;
}
