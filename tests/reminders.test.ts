import { describe, expect, it } from "vitest";
import { DEFAULT_PREFS, dueReminders, parsePrefs, serialisePrefs, type ReminderFacts } from "../lib/reminders";

const facts = (over: Partial<ReminderFacts> = {}): ReminderFacts => ({
  date: "2026-11-19",
  calories: { eaten: 1200, goal: 1800 },
  budget: { spent: 0, budget: 400000, currency: "KRW", month: "2026-11" },
  ...over
});

describe("alert preferences", () => {
  it("falls back to the defaults for junk", () => {
    expect(parsePrefs(undefined)).toEqual(DEFAULT_PREFS);
    expect(parsePrefs("not json")).toEqual(DEFAULT_PREFS);
  });

  it("keeps a threshold only inside a sane range", () => {
    expect(parsePrefs(encodeURIComponent(JSON.stringify({ budget_threshold: 500 }))).budget_threshold).toBe(DEFAULT_PREFS.budget_threshold);
    expect(parsePrefs(encodeURIComponent(JSON.stringify({ budget_threshold: 65 }))).budget_threshold).toBe(65);
  });

  it("survives a round trip through the cookie", () => {
    const mine = { calories: false, budget: true, budget_threshold: 95 };
    expect(parsePrefs(serialisePrefs(mine))).toEqual(mine);
  });
});

describe("what is due", () => {
  it("says nothing while the day is inside the goal", () => {
    expect(dueReminders(DEFAULT_PREFS, facts())).toEqual([]);
    expect(dueReminders(DEFAULT_PREFS, facts({ calories: { eaten: 1800, goal: 1800 } }))).toEqual([]);
  });

  it("speaks up once the goal is passed", () => {
    const due = dueReminders(DEFAULT_PREFS, facts({ calories: { eaten: 2070, goal: 1800 } }));
    expect(due[0].key).toBe("reminder:calories:2026-11-19");
    expect(due[0].title).toContain("270 over");
  });

  it("leaves calories alone with no goal set, or with the alert off", () => {
    expect(dueReminders(DEFAULT_PREFS, facts({ calories: { eaten: 2000, goal: 0 } }))).toEqual([]);
    expect(dueReminders({ ...DEFAULT_PREFS, calories: false }, facts({ calories: { eaten: 2600, goal: 1800 } }))).toEqual([]);
  });

  it("warns once near the budget and again over it", () => {
    const near = dueReminders(DEFAULT_PREFS, facts({ budget: { spent: 340000, budget: 400000, currency: "KRW", month: "2026-11" } }));
    expect(near.find((r) => r.kind === "budget")?.key).toBe("reminder:budget:2026-11:near");
    const over = dueReminders(DEFAULT_PREFS, facts({ budget: { spent: 420000, budget: 400000, currency: "KRW", month: "2026-11" } }));
    expect(over.find((r) => r.kind === "budget")?.key).toBe("reminder:budget:2026-11:over");
  });

  it("leaves the budget alone below the threshold, with no budget, and when switched off", () => {
    expect(dueReminders(DEFAULT_PREFS, facts({ budget: { spent: 100000, budget: 400000, currency: "KRW", month: "2026-11" } }))).toEqual([]);
    expect(dueReminders(DEFAULT_PREFS, facts({ budget: { spent: 5, budget: 0, currency: "KRW", month: "2026-11" } }))).toEqual([]);
    const off = { ...DEFAULT_PREFS, budget: false };
    expect(dueReminders(off, facts({ budget: { spent: 400000, budget: 400000, currency: "KRW", month: "2026-11" } }))).toEqual([]);
  });

  it("can raise both at once", () => {
    const due = dueReminders(DEFAULT_PREFS, facts({
      calories: { eaten: 2600, goal: 1800 },
      budget: { spent: 390000, budget: 400000, currency: "KRW", month: "2026-11" }
    }));
    expect(due.map((r) => r.kind)).toEqual(["meal_plan", "budget"]);
  });
});
