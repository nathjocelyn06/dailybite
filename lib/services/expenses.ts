import "server-only";
import { type Db, must, clean } from "./db";
import { addDays, dayKey, monthOf, monthRange, weekdayIndex } from "../dates";
import { budgetState, round2, sumAmounts } from "../totals";
import { addFridgeItems, type FridgeItem } from "./fridge";
import { getSettings } from "./settings";
import type { AddExpenseInputT } from "../schemas";

export type Expense = {
  id: string;
  date: string;
  merchant: string;
  category: "daily_food" | "groceries" | "snacks_drinks" | "other";
  amount: number;
  items: { name: string; qty?: number; unit?: string; price?: number; fridge_category?: string; expires_in_days?: number }[];
  receipt_path: string | null;
  note: string | null;
  meal_id: string | null;
  created_at: string;
};

export const EXPENSE_LABEL: Record<Expense["category"], string> = {
  daily_food: "Daily food",
  groceries: "Groceries",
  snacks_drinks: "Snacks & drinks",
  other: "Other"
};

const COLS = "id,date,merchant,category,amount,items,receipt_path,note,meal_id,created_at";

export async function listExpenses(db: Db, q: { from: string; to?: string }): Promise<Expense[]> {
  const rows = must(
    await db.sb
      .from("expenses")
      .select(COLS)
      .eq("user_id", db.userId)
      .gte("date", q.from)
      .lte("date", q.to ?? q.from)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
    "list expenses"
  ) as Expense[];
  return rows.map((e) => ({ ...e, amount: Number(e.amount) }));
}

export async function addExpense(
  db: Db,
  input: AddExpenseInputT
): Promise<{ expense: Expense; pending_fridge_items: FridgeItem[] }> {
  const row = {
    user_id: db.userId,
    date: input.date ?? dayKey(new Date(), db.tz),
    merchant: input.merchant,
    category: input.category,
    amount: input.amount,
    items: input.items ?? [],
    note: input.note ?? null,
    receipt_path: input.receipt_path ?? null
  };
  const expense = must(await db.sb.from("expenses").insert(row).select(COLS).single(), "add expense") as Expense;
  let pending: FridgeItem[] = [];
  if (input.send_items_to_fridge) {
    const forFridge = (input.items ?? []).filter((i) => i.fridge_category);
    pending = await addFridgeItems(
      db,
      forFridge.map((i) => ({
        name: i.name,
        category: i.fridge_category!,
        qty: i.qty ?? 1,
        unit: i.unit ?? "pcs",
        expires_in_days: i.expires_in_days
      })),
      { status: "pending", source_expense_id: expense.id }
    );
  }
  return { expense: { ...expense, amount: Number(expense.amount) }, pending_fridge_items: pending };
}

export async function updateExpense(db: Db, id: string, patch: Partial<AddExpenseInputT>): Promise<Expense> {
  const { send_items_to_fridge: _ignored, ...rest } = patch;
  const row = must(
    await db.sb.from("expenses").update(clean(rest)).eq("user_id", db.userId).eq("id", id).select(COLS).single(),
    "update expense"
  ) as Expense;
  return { ...row, amount: Number(row.amount) };
}

export async function deleteExpense(db: Db, id: string): Promise<void> {
  must(await db.sb.from("expenses").delete().eq("user_id", db.userId).eq("id", id), "delete expense");
}

export async function expenseSummary(db: Db, month?: string) {
  const m = month ?? monthOf(dayKey(new Date(), db.tz));
  const { from, to } = monthRange(m);
  const [list, settings] = await Promise.all([listExpenses(db, { from, to }), getSettings(db)]);
  const total = sumAmounts(list);
  const byCategory = (Object.keys(EXPENSE_LABEL) as Expense["category"][]).map((c) => ({
    category: c,
    label: EXPENSE_LABEL[c],
    total: sumAmounts(list.filter((e) => e.category === c))
  }));
  const byDay: Record<string, number> = {};
  for (const e of list) byDay[e.date] = round2((byDay[e.date] ?? 0) + e.amount);
  const budget = settings.monthly_budget;
  return {
    month: m,
    currency: settings.currency,
    budget,
    spent: total,
    remaining: round2(budget - total),
    state: budgetState(total, budget),
    by_category: byCategory,
    by_day: byDay,
    recent: list.slice(0, 10)
  };
}

/**
 * Budget page: the same numbers as expenseSummary but over a chosen period.
 * A week has no budget of its own, so it gets the monthly budget's share of that
 * many days — labelled as such on the page, never presented as a separate budget.
 */
export async function spendSummary(db: Db, period: "week" | "month", anchor?: string) {
  const today = dayKey(new Date(), db.tz);
  const a = anchor ?? today;
  const month = monthOf(a);
  const { from: mFrom, to: mTo } = monthRange(month);
  const from = period === "month" ? mFrom : addDays(a, -weekdayIndex(a));
  const to = period === "month" ? mTo : addDays(from, 6);

  const [list, settings] = await Promise.all([listExpenses(db, { from, to }), getSettings(db)]);
  const total = sumAmounts(list);
  const daysInMonth = Number(mTo.slice(8, 10));
  const budget = period === "month" ? settings.monthly_budget : round2((settings.monthly_budget / daysInMonth) * 7);

  const byCategory = (Object.keys(EXPENSE_LABEL) as Expense["category"][]).map((c) => ({
    category: c,
    label: EXPENSE_LABEL[c],
    total: sumAmounts(list.filter((e) => e.category === c))
  }));
  // Every day in the range, spent or not: a week with one bar in it is a bar chart of
  // nothing. Days with no expenses are zeros so the chart has a shape to read.
  const byDay: Record<string, number> = {};
  for (let d = from; d <= to; d = addDays(d, 1)) byDay[d] = 0;
  for (const e of list) byDay[e.date] = round2((byDay[e.date] ?? 0) + e.amount);

  return {
    period,
    from,
    to,
    month,
    currency: settings.currency,
    budget,
    monthly_budget: settings.monthly_budget,
    spent: total,
    remaining: round2(budget - total),
    state: budgetState(total, budget),
    by_category: byCategory,
    by_day: byDay,
    recent: list.slice(0, 20),
    today
  };
}

/**
 * An expense already filed for the same shop, day and amount — which is what a receipt
 * scanned twice looks like. Used to keep one receipt from being charged to the budget twice.
 */
export async function findExpense(
  db: Db,
  key: { date: string; merchant: string; amount: number }
): Promise<{ id: string } | null> {
  const rows = must(
    await db.sb
      .from("expenses")
      .select("id,amount")
      .eq("user_id", db.userId)
      .eq("date", key.date)
      .ilike("merchant", key.merchant)
      .limit(20),
    "find expense"
  ) as { id: string; amount: number | string }[];
  return rows.find((r) => Math.abs(Number(r.amount) - key.amount) < 0.5) ?? null;
}
