import { describe, expect, it } from "vitest";
import { formatAmount, parseAmount, scaleIngredients, scaleMeasure, scaleTotal } from "@/lib/scale";

describe("parseAmount", () => {
  it("reads integers, decimals and glued units", () => {
    expect(parseAmount("2 cups")).toEqual({ value: 2, rest: "cups" });
    expect(parseAmount("1.5 cups")).toEqual({ value: 1.5, rest: "cups" });
    expect(parseAmount("200g")).toEqual({ value: 200, rest: "g" });
  });
  it("reads fractions and mixed numbers", () => {
    expect(parseAmount("1/2 tsp")).toEqual({ value: 0.5, rest: "tsp" });
    expect(parseAmount("1 1/2 tbsp")).toEqual({ value: 1.5, rest: "tbsp" });
    expect(parseAmount("½ cup")).toEqual({ value: 0.5, rest: "cup" });
    expect(parseAmount("1½ cup")).toEqual({ value: 1.5, rest: "cup" });
  });
  it("returns null when there is no amount", () => {
    expect(parseAmount("to taste")).toBeNull();
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("1/0 cup")).toBeNull();
  });
});

describe("formatAmount", () => {
  it("prints whole numbers plainly", () => {
    expect(formatAmount(2)).toBe("2");
    expect(formatAmount(0)).toBe("0");
  });
  it("prefers cooking fractions", () => {
    expect(formatAmount(0.5)).toBe("½");
    expect(formatAmount(1.5)).toBe("1½");
    expect(formatAmount(0.75)).toBe("¾");
    expect(formatAmount(1 / 3)).toBe("⅓");
  });
  it("falls back to two decimals", () => {
    expect(formatAmount(1.27)).toBe("1.27");
  });
});

describe("scaleMeasure", () => {
  it("scales the leading amount and keeps the unit", () => {
    expect(scaleMeasure("2 cups", 2)).toBe("4 cups");
    expect(scaleMeasure("200g", 0.5)).toBe("100 g");
    expect(scaleMeasure("1 1/2 tbsp", 2)).toBe("3 tbsp");
    expect(scaleMeasure("1 cup", 0.5)).toBe("½ cup");
  });
  it("leaves measures it cannot read alone", () => {
    expect(scaleMeasure("to taste", 3)).toBe("to taste");
    expect(scaleMeasure("a pinch", 2)).toBe("a pinch");
  });
  it("is a no-op at factor 1 and refuses nonsense factors", () => {
    expect(scaleMeasure("2 cups", 1)).toBe("2 cups");
    expect(scaleMeasure("2 cups", 0)).toBe("2 cups");
    expect(scaleMeasure("2 cups", -1)).toBe("2 cups");
  });
});

describe("scaleIngredients / scaleTotal", () => {
  it("scales a list without touching names", () => {
    const out = scaleIngredients([{ name: "Rice", measure: "1 cup" }, { name: "Salt", measure: "to taste" }], 3);
    expect(out).toEqual([{ name: "Rice", measure: "3 cup" }, { name: "Salt", measure: "to taste" }]);
  });
  it("multiplies per-serving calories by servings", () => {
    expect(scaleTotal(420, 3)).toBe(1260);
    expect(scaleTotal(null, 3)).toBeNull();
  });
});
