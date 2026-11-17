/**
 * Pure logic for the AI progress overview (no I/O, unit-tested in tests/overview.test.ts).
 * buildFacts() turns raw records into a small, privacy-safe fact sheet. The model only ever
 * sees these facts (never photos, never body data). fallbackOverview() writes the same shape
 * without AI, used when ANTHROPIC_API_KEY is missing or the API call fails.
 */
import { addDays, weekdayIndex } from "./dates";

export type Period = "week" | "month";
export const PERIOD_DAYS: Record<Period, number> = { week: 7, month: 30 };

export type FactMeal = { date: string; slot: "breakfast" | "lunch" | "dinner" | "snack"; kcal: number | null; protein_g: number | null; eaten_at: string | null; recipe_id: string | null; place: string | null };
export type FactPage = { date: string; mood: string | null; has_review: boolean };
export type FactInput = {
  period: Period;
  to: string; // today (local)
  goals: { kcal: number; protein_g: number };
  meals: FactMeal[]; // eaten only
  pages: FactPage[];
  spent: number;
  budget: number;
  currency: string;
  use_soon: string[]; // fridge items expiring soon, names only
};

export type Facts = ReturnType<typeof buildFacts>;

const r0 = (n: number) => Math.round(n);
const pct = (a: number, b: number) => (b ? r0((a / b) * 100) : 0);

export function buildFacts(i: FactInput) {
  const days = PERIOD_DAYS[i.period];
  const from = addDays(i.to, -(days - 1));
  const dates = Array.from({ length: days }, (_, k) => addDays(from, k));
  const perDay = dates.map((date) => {
    const m = i.meals.filter((x) => x.date === date);
    const kcal = m.reduce((a, x) => a + (x.kcal ?? 0), 0);
    const protein = m.reduce((a, x) => a + (x.protein_g ?? 0), 0);
    const wd = weekdayIndex(date); // 0 = Monday
    return { date, weekend: wd >= 5, meals: m.length, kcal, protein, breakfast: m.some((x) => x.slot === "breakfast") };
  });
  const logged = perDay.filter((d) => d.meals > 0);
  const avg = (xs: number[]) => (xs.length ? r0(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
  const weekdayProtein = avg(logged.filter((d) => !d.weekend).map((d) => d.protein));
  const weekendProtein = avg(logged.filter((d) => d.weekend).map((d) => d.protein));
  const lateDinners = i.meals.filter((m) => m.slot === "dinner" && m.eaten_at && Number(m.eaten_at.slice(11, 13)) >= 21).length;
  const moods = i.pages.map((p) => p.mood).filter((m): m is string => !!m);
  const moodCounts = moods.reduce<Record<string, number>>((a, m) => ((a[m] = (a[m] ?? 0) + 1), a), {});

  return {
    period: i.period,
    from,
    to: i.to,
    days,
    days_logged: logged.length,
    meals_logged: i.meals.length,
    meals_by_slot: (["breakfast", "lunch", "dinner", "snack"] as const).reduce<Record<string, number>>((a, s) => ((a[s] = i.meals.filter((m) => m.slot === s).length), a), {}),
    breakfast_days: perDay.filter((d) => d.breakfast).length,
    avg_kcal: avg(logged.map((d) => d.kcal)),
    kcal_goal: i.goals.kcal,
    days_within_goal: logged.filter((d) => Math.abs(d.kcal - i.goals.kcal) <= i.goals.kcal * 0.1).length,
    protein_goal_g: i.goals.protein_g,
    protein_goal_days: logged.filter((d) => d.protein >= i.goals.protein_g).length,
    weekday_avg_protein_g: weekdayProtein,
    weekend_avg_protein_g: weekendProtein,
    late_dinners: lateDinners,
    cooked_from_recipes: i.meals.filter((m) => m.recipe_id).length,
    journal_pages: i.pages.length,
    reflections_written: i.pages.filter((p) => p.has_review).length,
    moods: moodCounts,
    food_spend: r0(i.spent),
    food_budget: r0(i.budget),
    budget_used_pct: pct(i.spent, i.budget),
    currency: i.currency,
    use_soon: i.use_soon.slice(0, 5)
  };
}

export type Overview = {
  headline: string;
  summary: string;
  wins: string[];
  noticed: string[];
  next: { text: string; href: string };
};

/** Where "Try next" may link. The model picks one of these keys; anything else falls back to /kitchen. */
export const NEXT_LINKS: Record<string, string> = {
  kitchen: "/kitchen",
  cook: "/recipes?tab=scanner",
  to_buy: "/fridge?tab=list",
  journal: "/journal",
  budget: "/budget",
  calendar: "/calendar",
  camera: "/snap?mode=calorie"
};

export function basisLine(f: Facts): string {
  const parts = [`${f.meals_logged} meals`, `${f.journal_pages} journal pages`];
  if (f.food_spend) parts.push(`${f.food_spend.toLocaleString()} ${f.currency} food spend`);
  return `${parts.join(", ")} (last ${f.days} days)`;
}

/** Rule-based overview with the same shape as the AI one. Never mentions weight or appearance. */
export function fallbackOverview(f: Facts): Overview {
  const span = f.period === "week" ? "this week" : "this month";
  if (f.meals_logged === 0) {
    return {
      headline: "Nothing logged yet",
      summary: `There are no meals logged ${span}, so there's nothing to look back on yet. Log one meal with the camera and your overview starts filling in.`,
      wins: [],
      noticed: [],
      next: { text: "Log your next meal with the AI camera.", href: NEXT_LINKS.camera }
    };
  }
  const wins: string[] = [];
  const noticed: string[] = [];
  if (f.days_logged >= Math.ceil(f.days * 0.7)) wins.push(`Logged meals on ${f.days_logged} of ${f.days} days`);
  else noticed.push(`Meals logged on ${f.days_logged} of ${f.days} days`);
  if (f.breakfast_days >= Math.ceil(f.days_logged * 0.7)) wins.push(`Breakfast on ${f.breakfast_days} days`);
  if (f.days_within_goal) wins.push(`Within 10% of your calorie goal on ${f.days_within_goal} days`);
  if (f.cooked_from_recipes) wins.push(`Cooked ${f.cooked_from_recipes} meal${f.cooked_from_recipes === 1 ? "" : "s"} from a recipe`);
  if (f.weekend_avg_protein_g && f.weekday_avg_protein_g && f.weekend_avg_protein_g < f.weekday_avg_protein_g * 0.8)
    noticed.push(`Protein is lower on weekends (${f.weekend_avg_protein_g} g vs ${f.weekday_avg_protein_g} g)`);
  if (f.late_dinners >= 2) noticed.push(`Dinner after 21:00 on ${f.late_dinners} days`);
  if (f.meals_by_slot.snack === 0) noticed.push("No snacks logged");
  if (f.budget_used_pct >= 80) noticed.push(`${f.budget_used_pct}% of your food budget used`);

  const next = f.use_soon.length
    ? { text: `Cook something with ${f.use_soon.slice(0, 2).join(" and ")} before it expires.`, href: NEXT_LINKS.cook }
    : f.days_logged < f.days * 0.7
      ? { text: "Log one meal a day with the camera, even a quick snap.", href: NEXT_LINKS.camera }
      : { text: "Plan tomorrow's dinner so the evening is easier.", href: NEXT_LINKS.calendar };
  const steady = f.days_logged >= Math.ceil(f.days * 0.7);
  return {
    headline: steady ? `A steady ${f.period}` : `A patchy ${f.period}, and that's okay`,
    summary: `You logged ${f.meals_logged} meals on ${f.days_logged} of ${f.days} days ${span}, averaging ${f.avg_kcal} kcal on logged days against a goal of ${f.kcal_goal}. Protein reached your goal on ${f.protein_goal_days} of those days.`,
    wins: wins.slice(0, 3),
    noticed: noticed.slice(0, 3),
    next
  };
}

/** Validate and clean a model reply into an Overview (never trusts free-form links). */
export function parseOverview(text: string): Overview | null {
  try {
    const j = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as Record<string, unknown>;
    const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
    const list = (v: unknown) => (Array.isArray(v) ? v.map((x) => str(x, 140)).filter(Boolean).slice(0, 3) : []);
    const nx = (j.next ?? {}) as Record<string, unknown>;
    const o: Overview = {
      headline: str(j.headline, 80),
      summary: str(j.summary, 600),
      wins: list(j.wins),
      noticed: list(j.noticed),
      next: { text: str(nx.text, 160), href: NEXT_LINKS[str(nx.link, 20)] ?? NEXT_LINKS.kitchen }
    };
    return o.headline && o.summary && o.next.text ? o : null;
  } catch {
    return null;
  }
}
