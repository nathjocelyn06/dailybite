"use server";
/**
 * Server actions for the web app. They call the SAME services as the MCP tools,
 * so a change made here or by Claude lands in the same Supabase rows.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { webDb } from "@/lib/services/db";
import { AddExpenseInput, DecorInput, FridgeItemInput, LogMealInput, MyRecipeInput, ShoppingItemInput, Slot, UpdateMealInput } from "@/lib/schemas";
import { confirmMeal, deleteMeal, findMealByPhoto, logMeal, updateMeal } from "@/lib/services/meals";
import { addWater } from "@/lib/services/water";
import { addExpense, deleteExpense, findExpense, updateExpense } from "@/lib/services/expenses";
import { addFridgeItems, adjustQty, confirmPending, removeFridgeItem, saveDecor, updateFridgeItem } from "@/lib/services/fridge";
import { updateSettings } from "@/lib/services/settings";
import { addShopping, deleteShopping, moveBoughtToFridge, setBought } from "@/lib/services/shopping";
import { writeReview, addElement, updateElement, deleteElement } from "@/lib/services/journal";
import { addMissingToShopping, deleteSaved, saveRecipe } from "@/lib/services/recipes";
import { getRecipeDetail } from "@/lib/recipe-bank";
import { dismiss, dismissAll, markRead } from "@/lib/services/notifications";
import { addReflection, upsertGoal } from "@/lib/services/progress";
import { ElementInput } from "@/lib/schemas";

const all = () => revalidatePath("/", "layout");

// ---- meals / water ----
export async function logMealAction(input: unknown) {
  const db = await webDb();
  const m = await logMeal(db, LogMealInput.parse(input));
  all();
  return m;
}
export async function confirmMealAction(id: string) {
  await confirmMeal(await webDb(), z.string().uuid().parse(id));
  all();
}
export async function updateMealAction(input: unknown) {
  await updateMeal(await webDb(), UpdateMealInput.parse(input));
  all();
}
export async function deleteMealAction(id: string) {
  await deleteMeal(await webDb(), z.string().uuid().parse(id));
  all();
}
export async function waterAction(delta: number) {
  await addWater(await webDb(), Math.sign(delta) || 1);
  all();
}

// ---- expenses ----
export async function addExpenseAction(input: unknown) {
  const r = await addExpense(await webDb(), AddExpenseInput.parse(input));
  all();
  return r;
}
export async function deleteExpenseAction(id: string) {
  await deleteExpense(await webDb(), z.string().uuid().parse(id));
  all();
}
export async function setBudgetAction(monthly_budget: number) {
  await updateSettings(await webDb(), { monthly_budget: z.number().nonnegative().parse(monthly_budget) });
  all();
}

// ---- fridge ----
export async function addFridgeAction(input: unknown) {
  await addFridgeItems(await webDb(), [FridgeItemInput.parse(input)], { status: "stocked" });
  all();
}
export async function addPendingFridgeAction(items: unknown) {
  await addFridgeItems(await webDb(), z.array(FridgeItemInput).parse(items), { status: "pending" });
  all();
}
export async function fridgeQtyAction(id: string, delta: number) {
  await adjustQty(await webDb(), id, delta);
  all();
}
export async function fridgeEditAction(id: string, patch: unknown) {
  await updateFridgeItem(await webDb(), id, FridgeItemInput.partial().parse(patch));
  all();
}
export async function fridgeRemoveAction(id: string) {
  await removeFridgeItem(await webDb(), id);
  all();
}
export async function confirmPendingAction(ids?: string[]) {
  await confirmPending(await webDb(), ids);
  all();
}
export async function saveDecorAction(decor: unknown, color?: string) {
  const db = await webDb();
  await saveDecor(db, z.array(DecorInput).parse(decor));
  if (color) await updateSettings(db, { fridge_color: color });
}

// ---- shopping ----
export async function addShoppingAction(input: unknown) {
  await addShopping(await webDb(), [ShoppingItemInput.parse(input)]);
  all();
}
export async function boughtAction(id: string, bought: boolean) {
  await setBought(await webDb(), [id], bought);
  all();
}
export async function deleteShoppingAction(id: string) {
  await deleteShopping(await webDb(), id);
  all();
}
export async function moveBoughtAction() {
  await moveBoughtToFridge(await webDb());
  all();
}

// ---- journal ----
export async function reviewAction(input: { date?: string; review?: string; mood?: string; fullness?: string; title?: string }) {
  await writeReview(await webDb(), input);
  all();
}
export async function addElementAction(date: string | undefined, el: unknown) {
  const r = await addElement(await webDb(), date, ElementInput.parse(el));
  all();
  return r;
}
export async function updateElementAction(id: string, patch: unknown) {
  await updateElement(await webDb(), id, ElementInput.partial().parse(patch));
}
export async function deleteElementAction(id: string) {
  await deleteElement(await webDb(), id);
  all();
}

// ---- recipes ----
export async function saveRecipeAction(source: "themealdb", externalId: string, folder?: string) {
  await saveRecipe(await webDb(), { source, external_id: externalId, folder });
  all();
}
export async function deleteRecipeAction(id: string) {
  await deleteSaved(await webDb(), id);
  all();
}
export async function planRecipeAction(input: { source: "themealdb"; external_id: string; date: string; slot: string }) {
  const db = await webDb();
  const r = await getRecipeDetail(input.source, input.external_id);
  if (!r) throw new Error("Recipe not found");
  const saved = await saveRecipe(db, { source: input.source, external_id: input.external_id, folder: "Meal plan" });
  await logMeal(db, {
    date: input.date,
    slot: Slot.parse(input.slot),
    name: r.title,
    items: [],
    status: "planned",
    recipe_id: saved.id,
    kcal: saved.kcal_per_serving ?? undefined,
    estimate_source: "recipe"
  });
  all();
}
export async function missingToShoppingAction(source: "themealdb", externalId: string) {
  const db = await webDb();
  const r = await getRecipeDetail(source, externalId);
  if (!r) throw new Error("Recipe not found");
  const res = await addMissingToShopping(db, r);
  all();
  return res;
}

// ---- messages / progress / settings ----
export async function dismissAction(id: string) {
  await dismiss(await webDb(), id);
  all();
}

/** Empty the notification list in one go. */
export async function clearNotificationsAction() {
  await dismissAll(await webDb());
  all();
}
export async function readAllAction() {
  await markRead(await webDb());
  all();
}
export async function reflectionAction(text: string) {
  await addReflection(await webDb(), z.string().min(1).parse(text));
  all();
}
export async function goalAction(input: { id?: string; title?: string; target?: number; progress?: number; unit?: string }) {
  await upsertGoal(await webDb(), input);
  all();
}
export async function settingsAction(patch: Record<string, unknown>) {
  const p = z
    .object({
      timezone: z.string().optional(),
      kcal_goal: z.coerce.number().int().positive().optional(),
      water_goal: z.coerce.number().int().positive().optional(),
      monthly_budget: z.coerce.number().nonnegative().optional(),
      currency: z.string().optional(),
      show_insights: z.boolean().optional()
    })
    .parse(patch);
  if (p.timezone) new Intl.DateTimeFormat("en", { timeZone: p.timezone });
  await updateSettings(await webDb(), p);
  all();
}

export async function goTo(path: string) {
  redirect(path);
}

export async function scannerAction(ingredients: string[], useFridge: boolean) {
  const { recipesFromIngredients } = await import("@/lib/services/recipes");
  return recipesFromIngredients(await webDb(), {
    ingredients: z.array(z.string()).parse(ingredients),
    use_fridge: useFridge,
    limit: 12
  });
}

/** AI camera confirm step: the user has checked/edited the draft; now write the shared records. */
export async function confirmScanAction(input: {
  mode: "calorie" | "receipt" | "ingredient" | "recipe_finder" | "journal" | "grocery";
  photo_path?: string;
  date?: string;
  slot?: string;
  title?: string;
  merchant?: string;
  total?: number;
  category?: string;
  time?: string;
  subtotal?: number;
  tax?: number;
  discount?: number;
  payment_method?: string;
  rows: {
    name: string; portion?: string; grams?: number; ingredients?: string[];
    qty?: number; unit?: string; kcal?: number; protein_g?: number; carbs_g?: number; fat_g?: number;
    price?: number; fridge_category?: string; expires_in_days?: number;
  }[];
}): Promise<{ redirect: string }> {
  const db = await webDb();
  const rows = input.rows.filter((r) => r.name && r.name.trim());
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
  switch (input.mode) {
    case "calorie": {
      // The same photo scanned twice is the same meal. Nothing else identifies a meal
      // reliably, and a double tap on Save should not double your calories.
      if (input.photo_path) {
        const twin = await findMealByPhoto(db, input.photo_path);
        if (twin) return { redirect: `/journal?date=${twin.date}&meal=${twin.id}` };
      }
      const m = await logMeal(db, LogMealInput.parse({
        date: input.date || undefined,
        slot: input.slot ?? "lunch",
        name: input.title?.trim() || rows.map((r) => r.name).join(", ") || "Meal",
        items: rows.map((r) => ({
          name: r.name,
          portion: r.portion,
          grams: num(r.grams),
          ingredients: r.ingredients?.length ? r.ingredients : undefined,
          kcal: num(r.kcal),
          protein_g: num(r.protein_g),
          carbs_g: num(r.carbs_g),
          fat_g: num(r.fat_g)
        })),
        status: "eaten",
        photo_path: input.photo_path,
        estimate_source: "ai"
      }));
      all();
      return { redirect: `/journal?date=${m.date}&meal=${m.id}` };
    }
    case "receipt": {
      const amount = num(input.total) ?? rows.reduce((a, x) => a + (num(x.price) ?? 0), 0);
      const merchant = input.merchant?.trim() || "Receipt";
      const { dayKey } = await import("@/lib/dates");
      const on = input.date || dayKey(new Date(), db.tz);
      // Scanning the same receipt twice must not charge the budget twice.
      const twin = await findExpense(db, { date: on, merchant, amount });
      if (twin) return { redirect: `/budget?expense=${twin.id}&duplicate=1` };
      // The receipt's small print has no columns of its own, so it is written into the
      // note where it stays readable and editable on the expense.
      const note = [
        input.time ? `at ${input.time}` : null,
        input.payment_method ? `paid by ${input.payment_method}` : null,
        num(input.subtotal) !== undefined ? `subtotal ${input.subtotal}` : null,
        num(input.tax) !== undefined ? `tax ${input.tax}` : null,
        num(input.discount) !== undefined ? `discount -${input.discount}` : null
      ].filter(Boolean).join(" · ");
      const r = await addExpense(db, AddExpenseInput.parse({
        date: on,
        merchant,
        category: input.category ?? "groceries",
        amount,
        items: rows.map((x) => ({ name: x.name, qty: num(x.qty), unit: x.unit, price: num(x.price), fridge_category: x.fridge_category || undefined, expires_in_days: num(x.expires_in_days) })),
        note: note || undefined,
        receipt_path: input.photo_path,
        send_items_to_fridge: true
      }));
      all();
      return { redirect: r.pending_fridge_items.length ? "/fridge" : `/budget?expense=${r.expense.id}` };
    }
    case "ingredient":
    case "grocery": {
      await addFridgeItems(
        db,
        rows.map((x) => FridgeItemInput.parse({ name: x.name, category: x.fridge_category || "other", qty: num(x.qty) ?? 1, unit: x.unit || "pcs", expires_in_days: num(x.expires_in_days) })),
        { status: "stocked" }
      );
      if (input.mode === "grocery") {
        const { listShopping } = await import("@/lib/services/shopping");
        const open = await listShopping(db, false);
        const names = rows.map((r) => r.name.toLowerCase());
        const hit = open.filter((o) => names.some((n) => n.includes(o.name.toLowerCase()) || o.name.toLowerCase().includes(n))).map((o) => o.id);
        await setBought(db, hit, true);
      }
      all();
      return { redirect: "/fridge" };
    }
    case "recipe_finder":
      return { redirect: `/recipes?tab=scanner&ingredients=${encodeURIComponent(rows.map((r) => r.name).join(", "))}` };
    case "journal": {
      const { dayKey } = await import("@/lib/dates");
      const date = input.date || dayKey(new Date(), db.tz);
      await addElement(db, date, ElementInput.parse({ kind: "photo", photo_path: input.photo_path ?? null, text: input.title ?? null, x: 8, y: 60, w: 36 }));
      all();
      return { redirect: `/journal?date=${date}` };
    }
  }
}

// ---------- My progress: AI overview ----------
export async function refreshOverviewAction(period: "week" | "month") {
  const { getProgressOverview } = await import("@/lib/services/overview");
  await getProgressOverview(await webDb(), period === "month" ? "month" : "week", { refresh: true });
  revalidatePath("/progress");
}

// ---------- AI camera upload ----------
/**
 * Uploads a scan photo from /snap. v3.1: with no sign-in there is no authenticated
 * browser client, so the file comes through this action and `uploadPhoto` writes it
 * with the service-role client under `<owner id>/scans/`. The bucket stays private
 * and the anon key is never used. Limit matches next.config.mjs (8 mb).
 */
export async function uploadScanPhotoAction(fd: FormData): Promise<{ path: string }> {
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose an image file.");
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  if (file.size > 8 * 1024 * 1024) throw new Error("Image is over 8 MB.");
  const { uploadPhoto } = await import("@/lib/services/photos");
  const path = await uploadPhoto(await webDb(), "scans", await file.arrayBuffer(), file.type);
  return { path };
}

export async function updateExpenseAction(id: string, patch: unknown) {
  await updateExpense(await webDb(), z.string().uuid().parse(id), AddExpenseInput.partial().parse(patch));
  all();
}

// ---------- my own recipes ----------
/** Create one of the user's own recipes (source "mine"). Returns the new id so the form can open it. */
export async function createMyRecipeAction(input: unknown): Promise<{ id: string }> {
  const parsed = MyRecipeInput.parse(input);
  const r = await saveRecipe(await webDb(), {
    source: "mine",
    ...parsed,
    folder: parsed.folder || "My recipes"
  });
  all();
  return { id: r.id };
}

export async function updateMyRecipeAction(id: string, patch: unknown): Promise<{ id: string }> {
  const { updateSaved } = await import("@/lib/services/recipes");
  const r = await updateSaved(await webDb(), z.string().uuid().parse(id), MyRecipeInput.partial().parse(patch));
  all();
  return { id: r.id };
}

/** A short-lived signed URL for a photo we just uploaded, so the page can show it at once. */
export async function photoUrlAction(path: string): Promise<string | null> {
  const { signedUrls } = await import("@/lib/services/photos");
  const map = await signedUrls(await webDb(), [path]);
  return map[path] ?? null;
}
