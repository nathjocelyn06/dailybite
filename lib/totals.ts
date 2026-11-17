import { daysBetween } from "./dates";

export type MealLike = {
  status: string;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
};

export type Totals = { kcal: number; protein_g: number; carbs_g: number; fat_g: number; meals: number };

/** Only eaten meals count. Planned and pending AI estimates never do. */
export function sumEaten(meals: MealLike[]): Totals {
  return meals
    .filter((m) => m.status === "eaten")
    .reduce<Totals>(
      (a, m) => ({
        kcal: a.kcal + Number(m.kcal ?? 0),
        protein_g: round1(a.protein_g + Number(m.protein_g ?? 0)),
        carbs_g: round1(a.carbs_g + Number(m.carbs_g ?? 0)),
        fat_g: round1(a.fat_g + Number(m.fat_g ?? 0)),
        meals: a.meals + 1
      }),
      { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, meals: 0 }
    );
}

export type ItemNutrition = { kcal?: number | null; protein_g?: number | null; carbs_g?: number | null; fat_g?: number | null };

export type Nutrition = { kcal: number; protein_g: number; carbs_g: number; fat_g: number };

export function sumItems(items: ItemNutrition[]): Nutrition {
  return items.reduce<Nutrition>(
    (a, i) => ({
      kcal: a.kcal + Number(i.kcal ?? 0),
      protein_g: round1(a.protein_g + Number(i.protein_g ?? 0)),
      carbs_g: round1(a.carbs_g + Number(i.carbs_g ?? 0)),
      fat_g: round1(a.fat_g + Number(i.fat_g ?? 0))
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );
}

export function sumAmounts(list: { amount: number | string | null }[]): number {
  return round2(list.reduce((a, e) => a + Number(e.amount ?? 0), 0));
}

export type ExpiryState = "expired" | "use_soon" | "ok" | "unknown";

/** use_soon = expires today or within `soonDays` days. */
export function expiryState(expiresOn: string | null | undefined, today: string, soonDays = 2): ExpiryState {
  if (!expiresOn) return "unknown";
  const left = daysBetween(today, expiresOn);
  if (left < 0) return "expired";
  if (left <= soonDays) return "use_soon";
  return "ok";
}

export function isLowStock(qty: number | string, lowAt: number | string): boolean {
  return Number(qty) <= Number(lowAt);
}

export function budgetState(spent: number, budget: number): "ok" | "warn" | "over" {
  if (budget <= 0) return "ok";
  if (spent >= budget) return "over";
  if (spent >= budget * 0.8) return "warn";
  return "ok";
}

export function round1(n: number) {
  return Math.round(n * 10) / 10;
}
export function round2(n: number) {
  return Math.round(n * 100) / 100;
}
