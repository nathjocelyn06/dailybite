import { describe, expect, it } from "vitest";
import { budgetState, expiryState, isLowStock, sumEaten, sumItems } from "@/lib/totals";

describe("sumEaten", () => {
  it("never counts planned or pending meals", () => {
    const t = sumEaten([
      { status: "eaten", kcal: 400, protein_g: 20, carbs_g: 50, fat_g: 10 },
      { status: "planned", kcal: 700, protein_g: 30, carbs_g: 80, fat_g: 20 },
      { status: "pending_confirm", kcal: 500, protein_g: 10, carbs_g: 60, fat_g: 15 },
      { status: "eaten", kcal: 250.5 as unknown as number, protein_g: null, carbs_g: 30, fat_g: null }
    ]);
    expect(t.meals).toBe(2);
    expect(t.kcal).toBeCloseTo(650.5);
    expect(t.protein_g).toBe(20);
    expect(t.carbs_g).toBe(80);
  });
  it("a new day with no records is zero", () => {
    expect(sumEaten([])).toEqual({ kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, meals: 0 });
  });
});

describe("sumItems", () => {
  it("adds item nutrition, treating missing as 0", () => {
    expect(sumItems([{ kcal: 300, protein_g: 10.25 }, { kcal: 120, fat_g: 4 }])).toEqual({ kcal: 420, protein_g: 10.3, carbs_g: 0, fat_g: 4 });
  });
});

describe("fridge rules", () => {
  it("expiry state", () => {
    expect(expiryState("2026-10-28", "2026-10-29")).toBe("expired");
    expect(expiryState("2026-10-29", "2026-10-29")).toBe("use_soon");
    expect(expiryState("2026-10-31", "2026-10-29")).toBe("use_soon");
    expect(expiryState("2026-11-01", "2026-10-29")).toBe("ok");
    expect(expiryState(null, "2026-10-29")).toBe("unknown");
  });
  it("low stock", () => {
    expect(isLowStock(1, 1)).toBe(true);
    expect(isLowStock("2", "1")).toBe(false);
  });
});

describe("budget", () => {
  it("warns at 80% and flags over", () => {
    expect(budgetState(100, 400)).toBe("ok");
    expect(budgetState(320, 400)).toBe("warn");
    expect(budgetState(400, 400)).toBe("over");
    expect(budgetState(10, 0)).toBe("ok");
  });
});
