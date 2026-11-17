import { describe, expect, it } from "vitest";
import { buildFacts, fallbackOverview, parseOverview, NEXT_LINKS, type FactMeal } from "../lib/overview-facts";

const meal = (date: string, slot: FactMeal["slot"], kcal: number, protein_g: number, hour = 12): FactMeal =>
  ({ date, slot, kcal, protein_g, eaten_at: `${date}T${String(hour).padStart(2, "0")}:00:00+09:00`, recipe_id: null, place: null });

// 2026-11-02 is a Monday; the week runs 2026-10-30 (Fri) … 2026-11-05 (Thu).
const base = { period: "week" as const, to: "2026-11-05", goals: { kcal: 1800, protein_g: 80 }, pages: [], spent: 0, budget: 70000, currency: "KRW", use_soon: [] };

describe("AI overview facts", () => {
  it("counts logged days, weekend vs weekday protein and late dinners", () => {
    const f = buildFacts({
      ...base,
      meals: [
        meal("2026-11-02", "breakfast", 500, 40), meal("2026-11-02", "dinner", 1300, 50, 21),
        meal("2026-11-03", "lunch", 900, 45),
        meal("2026-10-31", "lunch", 800, 20), meal("2026-11-01", "dinner", 700, 20, 22)
      ]
    });
    expect(f.days).toBe(7);
    expect(f.days_logged).toBe(4);
    expect(f.meals_logged).toBe(5);
    expect(f.weekday_avg_protein_g).toBe(68); // (90 + 45) / 2 → 67.5 → 68
    expect(f.weekend_avg_protein_g).toBe(20);
    expect(f.late_dinners).toBe(2);
    expect(f.days_within_goal).toBe(1); // 1800 kcal on Monday
  });

  it("falls back to a kind, data-only overview", () => {
    const empty = fallbackOverview(buildFacts({ ...base, meals: [] }));
    expect(empty.headline).toBe("Nothing logged yet");
    expect(empty.next.href).toBe(NEXT_LINKS.camera);
    const f = buildFacts({ ...base, use_soon: ["spinach"], meals: [meal("2026-11-02", "lunch", 600, 30)] });
    const o = fallbackOverview(f);
    expect(o.summary).toContain("1 meals on 1 of 7 days");
    expect(o.next.href).toBe(NEXT_LINKS.cook);
    expect(JSON.stringify(o)).not.toMatch(/weight|body|fat loss/i);
  });

  it("parses model JSON and never trusts free-form links", () => {
    const o = parseOverview('Sure! {"headline":"Good week","summary":"You logged 19 meals.","wins":["a","b","c","d"],"noticed":[],"next":{"text":"Cook spinach","link":"https://evil.example"}}');
    expect(o?.wins).toHaveLength(3);
    expect(o?.next.href).toBe(NEXT_LINKS.kitchen);
    expect(parseOverview("not json")).toBeNull();
    expect(parseOverview('{"headline":"","summary":"x","next":{"text":"y"}}')).toBeNull();
  });
});
