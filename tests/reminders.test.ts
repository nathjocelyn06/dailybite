import { describe, expect, it } from "vitest";
import { DEFAULT_PREFS, dueReminders, parsePrefs, serialisePrefs, type ReminderFacts } from "../lib/reminders";

const facts = (over: Partial<ReminderFacts> = {}): ReminderFacts => ({
  date: "2026-11-19",
  logged: {},
  journal_written: false,
  budget: { spent: 0, budget: 400000, currency: "KRW", month: "2026-11" },
  ...over
});

describe("reminder preferences", () => {
  it("falls back to the defaults for junk", () => {
    expect(parsePrefs(undefined)).toEqual(DEFAULT_PREFS);
    expect(parsePrefs("not json")).toEqual(DEFAULT_PREFS);
  });

  it("keeps only clock times", () => {
    const p = parsePrefs(encodeURIComponent(JSON.stringify({ meal_times: { lunch: "25:00", dinner: "18:15" } })));
    expect(p.meal_times.lunch).toBe(DEFAULT_PREFS.meal_times.lunch);
    expect(p.meal_times.dinner).toBe("18:15");
  });

  it("survives a round trip through the cookie", () => {
    const mine = { ...DEFAULT_PREFS, journal_time: "22:30", budget_threshold: 65 };
    expect(parsePrefs(serialisePrefs(mine))).toEqual(mine);
  });
});

describe("what is due", () => {
  it("asks about a meal from its time until the window closes", () => {
    const at = (t: string) => dueReminders(DEFAULT_PREFS, t, facts()).map((r) => r.key);
    expect(at("12:29")).not.toContain("reminder:meal:lunch:2026-11-19");
    expect(at("12:30")).toContain("reminder:meal:lunch:2026-11-19");
    expect(at("14:30")).toContain("reminder:meal:lunch:2026-11-19");
    expect(at("14:31")).not.toContain("reminder:meal:lunch:2026-11-19");
  });

  it("stays quiet about a meal that is already logged", () => {
    const due = dueReminders(DEFAULT_PREFS, "12:45", facts({ logged: { lunch: true } }));
    expect(due.map((r) => r.key)).not.toContain("reminder:meal:lunch:2026-11-19");
  });

  it("says nothing at all when every reminder is off", () => {
    const off = { ...DEFAULT_PREFS, meals: false, journal: false, budget: false };
    expect(dueReminders(off, "12:45", facts({ budget: { spent: 400000, budget: 400000, currency: "KRW", month: "2026-11" } }))).toEqual([]);
  });

  it("warns once near the budget and again over it", () => {
    const near = dueReminders(DEFAULT_PREFS, "12:00", facts({ budget: { spent: 340000, budget: 400000, currency: "KRW", month: "2026-11" } }));
    expect(near.find((r) => r.kind === "budget")?.key).toBe("reminder:budget:2026-11:near");
    const over = dueReminders(DEFAULT_PREFS, "12:00", facts({ budget: { spent: 420000, budget: 400000, currency: "KRW", month: "2026-11" } }));
    expect(over.find((r) => r.kind === "budget")?.key).toBe("reminder:budget:2026-11:over");
  });

  it("leaves the budget alone below the threshold, and with no budget set", () => {
    const quiet = dueReminders(DEFAULT_PREFS, "12:00", facts({ budget: { spent: 100000, budget: 400000, currency: "KRW", month: "2026-11" } }));
    expect(quiet.some((r) => r.kind === "budget")).toBe(false);
    const none = dueReminders(DEFAULT_PREFS, "12:00", facts({ budget: { spent: 5, budget: 0, currency: "KRW", month: "2026-11" } }));
    expect(none.some((r) => r.kind === "budget")).toBe(false);
  });

  it("asks for the journal only while it is empty", () => {
    expect(dueReminders(DEFAULT_PREFS, "21:30", facts()).map((r) => r.key)).toContain("reminder:journal:2026-11-19");
    expect(dueReminders(DEFAULT_PREFS, "21:30", facts({ journal_written: true })).map((r) => r.key)).not.toContain("reminder:journal:2026-11-19");
  });
});
