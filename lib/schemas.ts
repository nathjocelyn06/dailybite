/**
 * Input shapes shared by MCP tools (which take a raw zod shape) and web server actions
 * (which use z.object(shape)). Keep descriptions short: Claude reads them.
 */
import { z } from "zod";

export const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
export const Month = z.string().regex(/^\d{4}-\d{2}$/, "Use YYYY-MM");
export const Slot = z.enum(["breakfast", "lunch", "dinner", "snack"]);
export const MealStatus = z.enum(["planned", "pending_confirm", "eaten"]);
export const ExpenseCategory = z.enum(["daily_food", "groceries", "snacks_drinks", "other"]);
export const FridgeCategory = z.enum(["veg_fruit", "protein", "dairy_eggs", "frozen", "pantry", "other"]);
export const DecorKind = z.enum(["photo", "strip", "postit", "note", "badge", "magnet", "calendar", "receipt"]);
export const ElementKind = z.enum(["photo", "sticker", "tape", "text", "doodle", "meal_card", "mood", "habit"]);

export const MealItem = z.object({
  name: z.string().min(1),
  portion: z.string().optional().describe("e.g. '1 bowl', 'small', '150 g'"),
  grams: z.number().nonnegative().optional().describe("Estimated weight of this item in grams"),
  ingredients: z.array(z.string()).optional().describe("Visible ingredients, when identifiable"),
  kcal: z.number().nonnegative().optional(),
  protein_g: z.number().nonnegative().optional(),
  carbs_g: z.number().nonnegative().optional(),
  fat_g: z.number().nonnegative().optional()
});
export type MealItemT = z.infer<typeof MealItem>;

export const logMealShape = {
  date: Day.optional().describe("Defaults to today in the user's time zone"),
  slot: Slot,
  name: z.string().min(1).describe("Short meal name, e.g. 'Kimchi fried rice'"),
  items: z.array(MealItem).default([]).describe("Foods in the meal with estimated nutrition"),
  status: MealStatus.default("pending_confirm").describe(
    "Use pending_confirm for AI estimates from a photo; eaten only after the user confirmed"
  ),
  kcal: z.number().nonnegative().optional().describe("Total; computed from items when omitted"),
  protein_g: z.number().nonnegative().optional(),
  carbs_g: z.number().nonnegative().optional(),
  fat_g: z.number().nonnegative().optional(),
  place: z.string().optional(),
  notes: z.string().optional(),
  photo_path: z.string().optional().describe("Storage path of an uploaded photo, if any"),
  recipe_id: z.string().uuid().optional(),
  estimate_source: z.enum(["ai", "manual", "recipe"]).optional()
};
export const LogMealInput = z.object(logMealShape);
export type LogMealInputT = z.infer<typeof LogMealInput>;

export const updateMealShape = {
  id: z.string().uuid(),
  date: Day.optional(),
  slot: Slot.optional(),
  name: z.string().min(1).optional(),
  items: z.array(MealItem).optional(),
  status: MealStatus.optional(),
  kcal: z.number().nonnegative().optional(),
  protein_g: z.number().nonnegative().optional(),
  carbs_g: z.number().nonnegative().optional(),
  fat_g: z.number().nonnegative().optional(),
  place: z.string().optional(),
  notes: z.string().optional(),
  photo_path: z.string().nullable().optional().describe("Storage path of a replacement photo; null takes the photo off")
};
export const UpdateMealInput = z.object(updateMealShape);
export type UpdateMealInputT = z.infer<typeof UpdateMealInput>;

export const ExpenseItem = z.object({
  name: z.string().min(1),
  qty: z.number().positive().optional(),
  unit: z.string().optional(),
  price: z.number().nonnegative().optional(),
  fridge_category: FridgeCategory.optional().describe("Set for grocery items that go in the fridge/pantry"),
  expires_in_days: z.number().int().nonnegative().optional()
});

export const addExpenseShape = {
  date: Day.optional(),
  merchant: z.string().min(1),
  category: ExpenseCategory,
  amount: z.number().nonnegative(),
  items: z.array(ExpenseItem).default([]),
  note: z.string().optional(),
  receipt_path: z.string().optional(),
  send_items_to_fridge: z
    .boolean()
    .default(false)
    .describe("Create PENDING fridge items from items that have fridge_category. User confirms them later.")
};
export const AddExpenseInput = z.object(addExpenseShape);
export type AddExpenseInputT = z.infer<typeof AddExpenseInput>;

export const FridgeItemInput = z.object({
  name: z.string().min(1),
  category: FridgeCategory.default("other"),
  qty: z.number().nonnegative().default(1),
  unit: z.string().default("pcs"),
  purchased_on: Day.optional(),
  expires_on: Day.optional(),
  expires_in_days: z.number().int().nonnegative().optional(),
  low_at: z.number().nonnegative().optional()
});
export type FridgeItemInputT = z.infer<typeof FridgeItemInput>;

export const ShoppingItemInput = z.object({
  name: z.string().min(1),
  qty: z.number().positive().default(1),
  unit: z.string().default("pcs"),
  est_price: z.number().nonnegative().optional(),
  reason: z.enum(["recipe", "low_stock", "meal_plan", "manual"]).default("manual"),
  recipe_id: z.string().uuid().optional()
});
export type ShoppingItemInputT = z.infer<typeof ShoppingItemInput>;

export const DecorInput = z.object({
  id: z.string().uuid().optional(),
  kind: DecorKind,
  x: z.number().int(),
  y: z.number().int(),
  rot: z.number().int().default(0),
  z: z.number().int().default(0),
  text: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  photo_path: z.string().nullable().optional()
});
export type DecorInputT = z.infer<typeof DecorInput>;

export const ElementInput = z.object({
  kind: ElementKind,
  x: z.number().default(10),
  y: z.number().default(10),
  w: z.number().default(30),
  h: z.number().nullable().optional(),
  rot: z.number().default(0),
  z: z.number().int().default(0),
  text: z.string().nullable().optional(),
  data: z.record(z.any()).default({}),
  meal_id: z.string().uuid().nullable().optional(),
  photo_path: z.string().nullable().optional()
});
export type ElementInputT = z.infer<typeof ElementInput>;

export const ArchiveType = z.enum(["all", "journal", "meal", "expense", "fridge", "recipe", "photo", "receipt"]);

/** The user's own recipe (Recipes › Saved › New recipe). Shared by the form action and any future MCP tool. */
export const MyRecipeInput = z.object({
  title: z.string().min(1, "Give the recipe a name"),
  category: z.string().optional().nullable(),
  area: z.string().optional().nullable(),
  thumb_url: z.string().url().optional().nullable(),
  video_url: z.string().url().optional().nullable(),
  source_url: z.string().url().optional().nullable(),
  ingredients: z.array(z.object({ name: z.string().min(1), measure: z.string().default("") })).default([]),
  steps: z.string().optional().nullable(),
  minutes: z.number().int().positive().optional().nullable(),
  difficulty: z.enum(["Easy", "Medium", "Hard"]).optional().nullable(),
  diet_tags: z.array(z.string()).default([]),
  kcal_per_serving: z.number().int().nonnegative().optional().nullable(),
  servings: z.number().int().positive().optional().nullable(),
  folder: z.string().optional().nullable()
});
export type MyRecipeInputT = z.infer<typeof MyRecipeInput>;
