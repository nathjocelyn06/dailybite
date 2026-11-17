import "server-only";
import type { Db } from "./db";
import { addDays, dayKey } from "../dates";
import { sumEaten } from "../totals";
import { listMeals, type Meal } from "./meals";
import { getSettings } from "./settings";
import { getWater } from "./water";
import { listExpenses, expenseSummary } from "./expenses";
import { listFridge } from "./fridge";
import { listNotifications, refreshNotifications } from "./notifications";

/**
 * Everything the Dashboard (web) and get_daily_summary (MCP) show.
 * A new day automatically starts at 0: totals only read rows whose date = that day.
 */
export async function getDailySummary(db: Db, date?: string) {
  const today = dayKey(new Date(), db.tz);
  const d = date ?? today;
  await refreshNotifications(db).catch(() => undefined);
  const [settings, meals, water, spendToday, month, stock, upcoming, reminders] = await Promise.all([
    getSettings(db),
    listMeals(db, { from: d }),
    getWater(db, d),
    listExpenses(db, { from: d }),
    expenseSummary(db, d.slice(0, 7)),
    listFridge(db),
    listMeals(db, { from: d, to: addDays(d, 3), status: "planned" }),
    listNotifications(db, { unreadOnly: true })
  ]);
  const eaten = sumEaten(meals);
  const slots = (["breakfast", "lunch", "dinner", "snack"] as const).map((slot) => ({
    slot,
    eaten: meals.filter((m) => m.slot === slot && m.status === "eaten"),
    pending: meals.filter((m) => m.slot === slot && m.status === "pending_confirm"),
    planned: meals.filter((m) => m.slot === slot && m.status === "planned")
  }));
  return {
    date: d,
    is_today: d === today,
    timezone: db.tz,
    goals: {
      kcal: settings.kcal_goal,
      protein_g: settings.protein_goal_g,
      carbs_g: settings.carbs_goal_g,
      fat_g: settings.fat_goal_g,
      water: settings.water_goal
    },
    eaten,
    remaining_kcal: settings.kcal_goal - eaten.kcal,
    water,
    slots,
    pending_confirm: meals.filter((m) => m.status === "pending_confirm"),
    spend_today: spendToday.reduce((a, e) => a + e.amount, 0),
    budget: { month: month.month, spent: month.spent, budget: month.budget, remaining: month.remaining, state: month.state, currency: month.currency },
    upcoming: upcoming.filter((m: Meal) => m.date > d || m.status === "planned").slice(0, 4),
    use_soon: stock.filter((s) => s.expiry === "use_soon" || s.expiry === "expired").slice(0, 5),
    low_stock: stock.filter((s) => s.low).slice(0, 5),
    reminders: reminders.slice(0, 5),
    show_insights: settings.show_insights
  };
}

export type DailySummary = Awaited<ReturnType<typeof getDailySummary>>;
