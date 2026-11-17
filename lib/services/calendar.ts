import "server-only";
import { type Db, must } from "./db";
import { addDays, dayKey, monthOf, monthRange, weekdayIndex } from "../dates";
import { sumEaten } from "../totals";
import { listMeals, type Meal } from "./meals";
import { listExpenses } from "./expenses";
import { getJournalDay } from "./journal";

export type CalendarDay = {
  date: string;
  kcal: number;
  meals_eaten: number;
  planned: number;
  spend: number;
  photo_path: string | null;
  has_journal: boolean;
};

export async function monthOverview(db: Db, month?: string): Promise<{ month: string; today: string; days: CalendarDay[] }> {
  const today = dayKey(new Date(), db.tz);
  const m = month ?? monthOf(today);
  const { from, to } = monthRange(m);
  const [meals, expenses, pages] = await Promise.all([
    listMeals(db, { from, to }),
    listExpenses(db, { from, to }),
    db.sb.from("journal_pages").select("date").eq("user_id", db.userId).gte("date", from).lte("date", to)
  ]);
  const journalDates = new Set((must(pages, "journal dates") as { date: string }[]).map((p) => p.date));
  const days: CalendarDay[] = [];
  const last = Number(to.slice(8, 10));
  for (let i = 1; i <= last; i++) {
    const date = `${m}-${String(i).padStart(2, "0")}`;
    const dm = meals.filter((x) => x.date === date);
    const t = sumEaten(dm);
    days.push({
      date,
      kcal: t.kcal,
      meals_eaten: t.meals,
      planned: dm.filter((x) => x.status === "planned").length,
      spend: expenses.filter((e) => e.date === date).reduce((a, e) => a + e.amount, 0),
      photo_path: dm.find((x) => x.photo_path)?.photo_path ?? null,
      has_journal: journalDates.has(date)
    });
  }
  return { month: m, today, days };
}

export async function dayDetail(db: Db, date: string) {
  const [journal, expenses, events] = await Promise.all([
    getJournalDay(db, date),
    listExpenses(db, { from: date }),
    db.sb
      .from("fridge_events")
      .select("item_name,kind,delta,created_at")
      .eq("user_id", db.userId)
      .gte("created_at", `${date}T00:00:00`)
      .lte("created_at", `${date}T23:59:59`)
  ]);
  const t = sumEaten(journal.meals);
  return {
    date,
    totals: t,
    meals: journal.meals,
    journal: journal.page,
    expenses,
    spend: expenses.reduce((a, e) => a + e.amount, 0),
    fridge_events: must(events, "fridge events")
  };
}

export type WeekDay = {
  date: string;
  kcal: number;
  spend: number;
  planned: number;
  has_journal: boolean;
  meals: Meal[];
};

/**
 * Archive › Calendar, week view. Monday-first, seven days around `anchor`.
 * Same rows as the month view and the day view — no copies (see CLAUDE.md).
 */
export async function weekOverview(
  db: Db,
  anchor?: string
): Promise<{ from: string; to: string; today: string; days: WeekDay[] }> {
  const today = dayKey(new Date(), db.tz);
  const a = anchor ?? today;
  const from = addDays(a, -weekdayIndex(a));
  const to = addDays(from, 6);
  const [meals, expenses, pages] = await Promise.all([
    listMeals(db, { from, to }),
    listExpenses(db, { from, to }),
    db.sb.from("journal_pages").select("date").eq("user_id", db.userId).gte("date", from).lte("date", to)
  ]);
  const journalDates = new Set((must(pages, "journal dates") as { date: string }[]).map((p) => p.date));
  const days: WeekDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(from, i);
    const dm = meals.filter((m) => m.date === date);
    days.push({
      date,
      kcal: sumEaten(dm).kcal,
      spend: expenses.filter((e) => e.date === date).reduce((acc, e) => acc + e.amount, 0),
      planned: dm.filter((m) => m.status === "planned").length,
      has_journal: journalDates.has(date),
      meals: dm
    });
  }
  return { from, to, today, days };
}
