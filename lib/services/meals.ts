import "server-only";
import { type Db, must, clean } from "./db";
import { dayKey } from "../dates";
import { sumItems } from "../totals";
import type { LogMealInputT, UpdateMealInputT } from "../schemas";

export type Meal = {
  id: string;
  date: string;
  slot: "breakfast" | "lunch" | "dinner" | "snack";
  status: "planned" | "pending_confirm" | "eaten";
  name: string;
  items: { name: string; portion?: string; kcal?: number; protein_g?: number; carbs_g?: number; fat_g?: number }[];
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  photo_path: string | null;
  place: string | null;
  notes: string | null;
  recipe_id: string | null;
  estimate_source: string | null;
  eaten_at: string | null;
  created_at: string;
};

const COLS =
  "id,date,slot,status,name,items,kcal,protein_g,carbs_g,fat_g,photo_path,place,notes,recipe_id,estimate_source,eaten_at,created_at";
const SLOT_ORDER = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 } as const;

export async function listMeals(
  db: Db,
  q: { from: string; to?: string; status?: Meal["status"] | Meal["status"][] }
): Promise<Meal[]> {
  let query = db.sb.from("meals").select(COLS).eq("user_id", db.userId).gte("date", q.from).lte("date", q.to ?? q.from);
  if (q.status) query = Array.isArray(q.status) ? query.in("status", q.status) : query.eq("status", q.status);
  const rows = must(await query.order("date").order("created_at"), "list meals") as Meal[];
  return rows.map(num).sort((a, b) => (a.date === b.date ? SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot] : a.date < b.date ? -1 : 1));
}

export async function getMeal(db: Db, id: string): Promise<Meal> {
  return num(must(await db.sb.from("meals").select(COLS).eq("user_id", db.userId).eq("id", id).single(), "get meal") as Meal);
}

export async function logMeal(db: Db, input: LogMealInputT): Promise<Meal> {
  const totals = sumItems(input.items ?? []);
  const status = input.status ?? "pending_confirm";
  const row = {
    user_id: db.userId,
    date: input.date ?? dayKey(new Date(), db.tz),
    slot: input.slot,
    status,
    name: input.name,
    items: input.items ?? [],
    kcal: input.kcal ?? (input.items?.length ? totals.kcal : null),
    protein_g: input.protein_g ?? (input.items?.length ? totals.protein_g : null),
    carbs_g: input.carbs_g ?? (input.items?.length ? totals.carbs_g : null),
    fat_g: input.fat_g ?? (input.items?.length ? totals.fat_g : null),
    place: input.place ?? null,
    notes: input.notes ?? null,
    photo_path: input.photo_path ?? null,
    recipe_id: input.recipe_id ?? null,
    estimate_source: input.estimate_source ?? null,
    eaten_at: status === "eaten" ? new Date().toISOString() : null
  };
  return num(must(await db.sb.from("meals").insert(row).select(COLS).single(), "log meal") as Meal);
}

export async function updateMeal(db: Db, input: UpdateMealInputT): Promise<Meal> {
  const { id, ...rest } = input;
  const patch: Record<string, unknown> = clean(rest);
  // If items changed and totals weren't given, recompute totals from items.
  if (rest.items && rest.kcal === undefined) Object.assign(patch, sumItems(rest.items));
  if (rest.status === "eaten") patch.eaten_at = new Date().toISOString();
  return num(
    must(await db.sb.from("meals").update(patch).eq("user_id", db.userId).eq("id", id).select(COLS).single(), "update meal") as Meal
  );
}

/** planned / pending_confirm -> eaten */
export async function confirmMeal(db: Db, id: string): Promise<Meal> {
  return updateMeal(db, { id, status: "eaten" });
}

export async function deleteMeal(db: Db, id: string): Promise<void> {
  must(await db.sb.from("meals").delete().eq("user_id", db.userId).eq("id", id), "delete meal");
}

function num(m: Meal): Meal {
  return {
    ...m,
    kcal: m.kcal === null ? null : Number(m.kcal),
    protein_g: m.protein_g === null ? null : Number(m.protein_g),
    carbs_g: m.carbs_g === null ? null : Number(m.carbs_g),
    fat_g: m.fat_g === null ? null : Number(m.fat_g)
  };
}

/**
 * The meal a photo was already filed as, if any. One photo is one meal: it is what
 * lets a re-submitted scan land on the meal it created instead of a copy of it.
 */
export async function findMealByPhoto(db: Db, photoPath: string): Promise<{ id: string; date: string } | null> {
  const rows = must(
    await db.sb
      .from("meals")
      .select("id,date")
      .eq("user_id", db.userId)
      .eq("photo_path", photoPath)
      .limit(1),
    "find meal by photo"
  ) as { id: string; date: string }[];
  return rows[0] ?? null;
}
