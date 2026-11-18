import { describe, it, expect } from "vitest";
import { estimateRecipeKcal, estimateKcalPerServing } from "../lib/nutrition/estimate";

describe("estimateRecipeKcal", () => {
  it("reads weights, volumes and counts", () => {
    const kcal = estimateRecipeKcal([
      { name: "chicken breasts", measure: "2" }, // 340 g at 170/100 = 578
      { name: "olive oil", measure: "2 tbsp" }, //  30 g at 850/100 = 255
      { name: "brown rice", measure: "200 g" } // 200 g at 355/100 = 710
    ]);
    expect(kcal).toBeGreaterThan(1300);
    expect(kcal).toBeLessThan(1700);
    expect(kcal! % 25).toBe(0);
  });

  it("treats seasoning as free rather than guessing at it", () => {
    const seasoned = estimateRecipeKcal([
      { name: "potato", measure: "500 g" },
      { name: "salt", measure: "1 tsp" },
      { name: "black pepper", measure: "1 tsp" },
      { name: "paprika", measure: "2 tsp" }
    ]);
    const plain = estimateRecipeKcal([
      { name: "potato", measure: "500 g" },
      { name: "water", measure: "1 cup" }
    ]);
    expect(seasoned).toBe(plain);
  });

  it("scales with the amount", () => {
    const one = estimateRecipeKcal([{ name: "butter", measure: "100 g" }, { name: "flour", measure: "100 g" }])!;
    const two = estimateRecipeKcal([{ name: "butter", measure: "200 g" }, { name: "flour", measure: "200 g" }])!;
    expect(two).toBeCloseTo(one * 2, -2);
  });

  it("gives up rather than guess when the measures are unreadable", () => {
    expect(
      estimateRecipeKcal([
        { name: "chicken", measure: "to taste" },
        { name: "spices", measure: "" },
        { name: "oil", measure: "a drizzle" }
      ])
    ).toBeNull();
    expect(estimateRecipeKcal([])).toBeNull();
  });

  it("divides per serving and rounds to a readable number", () => {
    const per = estimateKcalPerServing(
      [{ name: "beef", measure: "500 g" }, { name: "potato", measure: "500 g" }],
      4
    )!;
    expect(per).toBeGreaterThan(0);
    expect(per % 5).toBe(0);
    expect(estimateKcalPerServing([{ name: "beef", measure: "500 g" }], 0)).toBeNull();
  });
});
