import "server-only";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ownerDb, type Db } from "../services/db";
import { appUrl } from "../env";
import { dayKey } from "../dates";
import {
  Day, Month, Slot, MealStatus, ExpenseCategory, FridgeCategory, ArchiveType,
  logMealShape, updateMealShape, addExpenseShape, FridgeItemInput, ShoppingItemInput, ElementInput, DecorInput
} from "../schemas";
import { getDailySummary } from "../services/dashboard";
import { listMeals, logMeal, updateMeal, confirmMeal, deleteMeal } from "../services/meals";
import { getJournalDay, writeReview, addElement, updateElement, deleteElement } from "../services/journal";
import { monthOverview, dayDetail } from "../services/calendar";
import { browseRecipes, getRecipeDetail } from "../recipe-bank";
import {
  saveRecipe, listSaved, deleteSaved, recipesFromIngredients, addMissingToShopping, matchFridge
} from "../services/recipes";
import { searchVideos, youtubeSearchUrl } from "../youtube";
import {
  listFridge, addFridgeItems, confirmPending, adjustQty, updateFridgeItem, removeFridgeItem, getDecor, saveDecor, CATEGORY_LABEL
} from "../services/fridge";
import { listShopping, addShopping, setBought, moveBoughtToFridge } from "../services/shopping";
import { addExpense, updateExpense, deleteExpense, expenseSummary } from "../services/expenses";
import { getSettings, updateSettings } from "../services/settings";
import { nutritionTrends, listGoals, upsertGoal, addReflection } from "../services/progress";
import { listNotifications, refreshNotifications, dismiss, markRead } from "../services/notifications";
import { searchArchive } from "../services/archive";
import { getKitchenOverview } from "../services/kitchen";
import { getProgressOverview } from "../services/overview";
import { TABS, SERVICES } from "../nav";

type ToolOut = { content: { type: "text"; text: string }[]; isError?: boolean };
type Result = { text: string; data?: unknown; link?: string };

/** Every tool runs as the owner, returns a short human line + JSON + a deep link to the web app. */
async function run(fn: (db: Db) => Promise<Result>): Promise<ToolOut> {
  try {
    const db = await ownerDb();
    const r = await fn(db);
    const parts = [r.text];
    if (r.link) parts.push(`Open in DailyBite: ${appUrl(r.link)}`);
    if (r.data !== undefined) parts.push("```json\n" + JSON.stringify(r.data, null, 2) + "\n```");
    return { content: [{ type: "text", text: parts.join("\n\n") }] };
  } catch (e) {
    return { isError: true, content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }] };
  }
}

export const SERVER_INSTRUCTIONS = `DailyBite (formerly Nutrigo) is the user's personal food journal, fridge, recipe and food-budget app.
Rules:
- "Today" is the user's local date (get_daily_summary returns it). Never assume UTC.
- Meals have status planned | pending_confirm | eaten. Only eaten meals count toward calories.
- When estimating food from a photo, call log_meal with status "pending_confirm", show the estimate,
  ask the user to correct portions, then call confirm_meal (or update_meal then confirm_meal).
- Receipts: add_expense with send_items_to_fridge=true creates PENDING fridge items; the user approves
  them with confirm_fridge_items. Never mark AI guesses as confirmed without the user saying so.
- Records are shared: don't create duplicates. Search or list first, then update by id.
- Health info you give is general education, not medical advice.
- Body photos are private and are not available through this server.
- App map (v3): 4 tabs. Home (today, My progress with the AI overview, Budget, Notifications),
  My Kitchen (Fridge: Stock and To buy; Recipes: Find, Saved, Cook from my fridge), Journal, Archive (list + Calendar).
  Use get_app_map for deep links. Prefer get_kitchen_overview for "what can I cook?" and
  get_progress_overview for "how am I doing?".`;

export function registerTools(server: McpServer) {
  // ---------------- dashboard ----------------
  server.registerTool(
    "get_daily_summary",
    {
      title: "Daily summary",
      description: "Today's (or a given day's) calories eaten vs goal, macros, meals by slot, pending AI estimates, planned meals, food spend, budget and reminders.",
      inputSchema: { date: Day.optional() }
    },
    async ({ date }) =>
      run(async (db) => {
        const s = await getDailySummary(db, date);
        return {
          text: `${s.is_today ? "Today" : s.date}: ${s.eaten.kcal} / ${s.goals.kcal} kcal eaten (${s.remaining_kcal} left), ${s.eaten.meals} meals, spent ${s.spend_today.toLocaleString()} ${s.budget.currency} today.`,
          data: s,
          link: s.is_today ? "/" : `/journal?date=${s.date}`
        };
      })
  );

  // ---------------- meals ----------------
  server.registerTool(
    "log_meal",
    {
      title: "Log a meal",
      description: "Create a meal record. Use status pending_confirm for photo estimates (user must confirm), eaten for meals the user confirmed, planned for meal plans.",
      inputSchema: logMealShape
    },
    async (args) =>
      run(async (db) => {
        const m = await logMeal(db, args);
        const verb = m.status === "pending_confirm" ? "Saved as a draft to confirm" : m.status === "planned" ? "Planned" : "Logged";
        return { text: `${verb}: ${m.slot} · ${m.name} · ${m.kcal ?? "?"} kcal (id ${m.id}).`, data: m, link: `/journal?date=${m.date}&meal=${m.id}` };
      })
  );

  server.registerTool(
    "update_meal",
    { title: "Edit a meal", description: "Change any field of a meal: portions/items, totals, slot, date, status, place, notes.", inputSchema: updateMealShape },
    async (args) => run(async (db) => {
      const m = await updateMeal(db, args);
      return { text: `Updated ${m.name} (${m.kcal ?? "?"} kcal, ${m.status}).`, data: m };
    })
  );

  server.registerTool(
    "confirm_meal",
    { title: "Confirm meal eaten", description: "Mark a planned or pending_confirm meal as eaten so it counts toward today's calories.", inputSchema: { id: z.string().uuid() } },
    async ({ id }) => run(async (db) => {
      const m = await confirmMeal(db, id);
      return { text: `Confirmed: ${m.name} now counts (${m.kcal ?? 0} kcal).`, data: m };
    })
  );

  server.registerTool(
    "plan_meal",
    {
      title: "Plan a meal",
      description: "Add a planned meal to the meal plan / calendar. It does not count as eaten.",
      inputSchema: { date: Day, slot: Slot, name: z.string(), recipe_id: z.string().uuid().optional(), kcal: z.number().nonnegative().optional() }
    },
    async ({ date, slot, name, recipe_id, kcal }) =>
      run(async (db) => {
        const m = await logMeal(db, { date, slot, name, recipe_id, kcal, status: "planned", items: [], estimate_source: recipe_id ? "recipe" : "manual" });
        return { text: `Planned ${slot} on ${date}: ${name}.`, data: m, link: `/calendar?date=${date}` };
      })
  );

  server.registerTool(
    "list_meals",
    { title: "List meals", description: "Meals between two dates, optionally filtered by status.", inputSchema: { from: Day, to: Day.optional(), status: MealStatus.optional() } },
    async ({ from, to, status }) => run(async (db) => {
      const list = await listMeals(db, { from, to, status });
      return { text: `${list.length} meals.`, data: list };
    })
  );

  server.registerTool(
    "delete_meal",
    { title: "Delete a meal", description: "Permanently delete a meal record. Ask the user first.", inputSchema: { id: z.string().uuid() } },
    async ({ id }) => run(async (db) => { await deleteMeal(db, id); return { text: "Meal deleted." }; })
  );

  // ---------------- journal ----------------
  server.registerTool(
    "get_journal_page",
    { title: "Journal page", description: "A day's journal page: review, mood, stickers/photos/text elements and that day's meals.", inputSchema: { date: Day.optional() } },
    async ({ date }) => run(async (db) => {
      const j = await getJournalDay(db, date);
      return { text: j.page ? `Journal for ${j.date}.` : `No journal page yet for ${j.date}; ${j.meals.length} meals logged.`, data: j, link: `/journal?date=${j.date}` };
    })
  );

  server.registerTool(
    "write_journal_review",
    {
      title: "Write daily review",
      description: "Set the day's reflection text, mood and fullness on the journal page (creates the page if needed).",
      inputSchema: { date: Day.optional(), title: z.string().optional(), review: z.string().optional(), mood: z.string().optional(), fullness: z.enum(["light", "just_right", "too_full"]).optional() }
    },
    async (args) => run(async (db) => {
      const p = await writeReview(db, args);
      return { text: `Journal for ${p.date} saved.`, data: p, link: `/journal?date=${p.date}` };
    })
  );

  server.registerTool(
    "add_journal_element",
    { title: "Add to journal page", description: "Add a sticker, text box, tape, mood/habit sticker or meal card to a day page.", inputSchema: { date: Day.optional(), element: ElementInput } },
    async ({ date, element }) => run(async (db) => {
      const el = await addElement(db, date, element);
      return { text: `Added ${el.kind} to the journal.`, data: el };
    })
  );

  server.registerTool(
    "update_journal_element",
    { title: "Edit journal element", description: "Move, resize, rotate or change text of a journal element.", inputSchema: { id: z.string().uuid(), patch: ElementInput.partial() } },
    async ({ id, patch }) => run(async (db) => ({ text: "Element updated.", data: await updateElement(db, id, patch) }))
  );

  server.registerTool(
    "delete_journal_element",
    { title: "Remove journal element", description: "Remove an element from a journal page.", inputSchema: { id: z.string().uuid() } },
    async ({ id }) => run(async (db) => { await deleteElement(db, id); return { text: "Element removed." }; })
  );

  // ---------------- calendar ----------------
  server.registerTool(
    "month_overview",
    { title: "Calendar month", description: "Per-day calories eaten, meals, planned meals, food spend and journal flag for a month.", inputSchema: { month: Month.optional() } },
    async ({ month }) => run(async (db) => {
      const o = await monthOverview(db, month);
      return { text: `Calendar for ${o.month}.`, data: o, link: `/calendar?month=${o.month}` };
    })
  );

  server.registerTool(
    "day_detail",
    { title: "Day detail", description: "Everything recorded on one date: meals, journal, expenses, fridge changes.", inputSchema: { date: Day } },
    async ({ date }) => run(async (db) => {
      const d = await dayDetail(db, date);
      return { text: `${date}: ${d.totals.kcal} kcal, ${d.meals.length} meals, spent ${d.spend.toLocaleString()}.`, data: d, link: `/calendar?date=${date}` };
    })
  );

  // ---------------- recipes ----------------
  server.registerTool(
    "search_recipes",
    {
      title: "Search recipes",
      description:
        "Search the recipe bank: TheMealDB (photos, YouTube videos, times estimated) plus a free bank whose recipes state real prep/cook time, difficulty and calories per serving. Filter by text, category (e.g. Breakfast, Vegetarian, Dinner, Dessert, Seafood), max minutes or difficulty. Empty = random picks. Each result carries its own `source`; pass that to get_recipe.",
      inputSchema: {
        query: z.string().optional(),
        category: z.string().optional(),
        max_minutes: z.number().int().positive().optional(),
        difficulty: z.enum(["Easy", "Medium", "Hard"]).optional()
      }
    },
    async (args) => run(async () => {
      const { recipes, partial } = await browseRecipes({
        query: args.query, category: args.category, maxMinutes: args.max_minutes, difficulty: args.difficulty
      });
      const link = new URLSearchParams();
      if (args.query) link.set("query", args.query);
      if (args.category) link.set("category", args.category);
      return {
        text: `${recipes.length} recipes found.${partial ? " One source did not answer, so this is the rest." : ""}`,
        data: recipes.slice(0, 24),
        link: `/recipes?${link.toString()}`
      };
    })
  );

  server.registerTool(
    "get_recipe",
    {
      title: "Recipe detail",
      description: "Full recipe: ingredients with measures, steps, YouTube video, time and difficulty, calories per serving where the source states them, and which ingredients are already in the fridge.",
      inputSchema: {
        external_id: z.string().describe("The id from search_recipes")
      }
    },
    async ({ external_id }) => run(async (db) => {
      const r = await getRecipeDetail("themealdb", external_id);
      if (!r) throw new Error("Recipe not found");
      const fridge = await matchFridge(db, r.ingredients);
      return { text: `${r.title}${r.video_url ? ` · video: ${r.video_url}` : ""}`, data: { ...r, in_fridge: fridge }, link: `/recipes/themealdb/${external_id}` };
    })
  );

  server.registerTool(
    "find_recipe_videos",
    { title: "Recipe videos", description: "YouTube videos for a dish (needs YOUTUBE_API_KEY; otherwise returns a YouTube search link).", inputSchema: { query: z.string() } },
    async ({ query }) => run(async () => {
      const v = await searchVideos(`${query} recipe`);
      return v.length ? { text: `${v.length} videos.`, data: v } : { text: `Search YouTube: ${youtubeSearchUrl(`${query} recipe`)}` };
    })
  );

  server.registerTool(
    "save_recipe",
    {
      title: "Save recipe to collection",
      description:
        "Save a recipe from the bank into the user's collection folder. For a TheMealDB recipe you may also store your calorie estimate per serving; free-bank recipes already carry their own, and are copied in whole so they survive the source going away.",
      inputSchema: {
        external_id: z.string(),
        folder: z.string().optional(),
        kcal_per_serving: z.number().int().positive().optional(),
        servings: z.number().int().positive().optional()
      }
    },
    async ({ external_id, folder, kcal_per_serving, servings }) => run(async (db) => {
      const r = await saveRecipe(db, { source: "themealdb", external_id, folder, kcal_per_serving, servings });
      return { text: `Saved "${r.title}" to ${r.folder}.`, data: r, link: `/recipes?tab=collection` };
    })
  );

  server.registerTool(
    "list_saved_recipes",
    { title: "My recipe collection", description: "Recipes the user saved, optionally one folder.", inputSchema: { folder: z.string().optional() } },
    async ({ folder }) => run(async (db) => {
      const list = await listSaved(db, folder);
      return { text: `${list.length} saved recipes.`, data: list.map(({ steps: _s, ...r }) => r) };
    })
  );

  server.registerTool(
    "delete_saved_recipe",
    { title: "Remove saved recipe", description: "Remove a recipe from the collection.", inputSchema: { id: z.string().uuid() } },
    async ({ id }) => run(async (db) => { await deleteSaved(db, id); return { text: "Removed from collection." }; })
  );

  server.registerTool(
    "recipes_from_ingredients",
    {
      title: "Recipes from my ingredients",
      description: "AI ingredient scanner backend: given ingredient names (e.g. from a photo), rank recipes that use them plus fridge stock (expiring first).",
      inputSchema: { ingredients: z.array(z.string()).default([]), use_fridge: z.boolean().default(true), limit: z.number().int().min(1).max(24).default(10) }
    },
    async (args) => run(async (db) => {
      const r = await recipesFromIngredients(db, args);
      return { text: `${r.recipes.length} recipes use ${r.used_ingredients.slice(0, 5).join(", ")}.`, data: r, link: `/recipes?tab=scanner` };
    })
  );

  server.registerTool(
    "add_missing_to_shopping",
    {
      title: "Add missing ingredients",
      description: "Compare a recipe's ingredients with the fridge and add the missing ones to the shopping list.",
      inputSchema: { external_id: z.string() }
    },
    async ({ external_id }) => run(async (db) => {
      const r = await getRecipeDetail("themealdb", external_id);
      if (!r) throw new Error("Recipe not found");
      const res = await addMissingToShopping(db, r);
      return { text: `Missing: ${res.missing.join(", ") || "nothing"}. Added ${res.added} to the shopping list.`, data: res, link: "/fridge?tab=list" };
    })
  );

  // ---------------- fridge ----------------
  server.registerTool(
    "list_fridge",
    {
      title: "Fridge stock",
      description: "Items in the fridge/pantry with qty, unit, expiry state and low-stock flag. include_pending shows scanned items waiting for confirmation.",
      inputSchema: { category: FridgeCategory.optional(), include_pending: z.boolean().default(false) }
    },
    async ({ category, include_pending }) => run(async (db) => {
      const list = await listFridge(db, { category, status: include_pending ? ["stocked", "pending"] : ["stocked"] });
      const soon = list.filter((i) => i.expiry === "use_soon" || i.expiry === "expired").map((i) => i.name);
      return {
        text: `${list.length} items${category ? ` in ${CATEGORY_LABEL[category]}` : ""}. Use soon: ${soon.join(", ") || "none"}.`,
        data: list,
        link: "/fridge"
      };
    })
  );

  server.registerTool(
    "add_fridge_items",
    {
      title: "Add to fridge",
      description: "Add items to the fridge. Use status pending for anything recognised from a photo or receipt so the user can check it.",
      inputSchema: { items: z.array(FridgeItemInput).min(1), status: z.enum(["pending", "stocked"]).default("pending") }
    },
    async ({ items, status }) => run(async (db) => {
      const created = await addFridgeItems(db, items, { status });
      return { text: `${created.length} items added as ${status}.`, data: created, link: "/fridge" };
    })
  );

  server.registerTool(
    "confirm_fridge_items",
    { title: "Confirm pending items", description: "Approve pending fridge items (all, or by id) after the user checked them.", inputSchema: { ids: z.array(z.string().uuid()).optional() } },
    async ({ ids }) => run(async (db) => {
      const rows = await confirmPending(db, ids);
      return { text: `${rows.length} items moved into the fridge.`, data: rows, link: "/fridge" };
    })
  );

  server.registerTool(
    "use_fridge_item",
    { title: "Use item", description: "Decrease quantity (e.g. after cooking). At 0 the item is marked used up.", inputSchema: { id: z.string().uuid(), amount: z.number().positive().default(1) } },
    async ({ id, amount }) => run(async (db) => {
      const r = await adjustQty(db, id, -amount);
      return { text: `${r.name}: ${r.qty} ${r.unit} left${r.status === "used_up" ? " (used up)" : ""}.`, data: r };
    })
  );

  server.registerTool(
    "restock_fridge_item",
    { title: "Restock item", description: "Increase quantity of an item.", inputSchema: { id: z.string().uuid(), amount: z.number().positive().default(1) } },
    async ({ id, amount }) => run(async (db) => {
      const r = await adjustQty(db, id, amount);
      return { text: `${r.name}: now ${r.qty} ${r.unit}.`, data: r };
    })
  );

  server.registerTool(
    "update_fridge_item",
    { title: "Edit fridge item", description: "Change name, shelf/category, qty, unit, expiry date or low-stock threshold.", inputSchema: { id: z.string().uuid(), patch: FridgeItemInput.partial() } },
    async ({ id, patch }) => run(async (db) => ({ text: "Item updated.", data: await updateFridgeItem(db, id, patch) }))
  );

  server.registerTool(
    "remove_fridge_item",
    { title: "Remove item", description: "Remove an item from the fridge (thrown away / gone).", inputSchema: { id: z.string().uuid() } },
    async ({ id }) => run(async (db) => { await removeFridgeItem(db, id); return { text: "Item removed." }; })
  );

  server.registerTool(
    "get_fridge_decor",
    { title: "Fridge door decorations", description: "Stickers, photos, post-its on the fridge door, plus fridge colour.", inputSchema: {} },
    async () => run(async (db) => ({ text: "Fridge door layout.", data: { color: (await getSettings(db)).fridge_color, decor: await getDecor(db) }, link: "/fridge" }))
  );

  server.registerTool(
    "save_fridge_decor",
    { title: "Save fridge decorations", description: "Replace the door layout and/or fridge colour (hex).", inputSchema: { decor: z.array(DecorInput).optional(), color: z.string().optional() } },
    async ({ decor, color }) => run(async (db) => {
      if (color) await updateSettings(db, { fridge_color: color });
      const saved = decor ? await saveDecor(db, decor) : await getDecor(db);
      return { text: `Fridge door saved (${saved.length} decorations).`, data: saved, link: "/fridge" };
    })
  );

  // ---------------- shopping ----------------
  server.registerTool(
    "list_shopping",
    { title: "Shopping list", description: "Grocery list with qty, estimated price, reason and bought status.", inputSchema: { include_bought: z.boolean().default(true) } },
    async ({ include_bought }) => run(async (db) => {
      const list = await listShopping(db, include_bought);
      const est = list.filter((i) => !i.bought).reduce((a, i) => a + (i.est_price ?? 0), 0);
      return { text: `${list.filter((i) => !i.bought).length} to buy, est. ${est.toLocaleString()}.`, data: list, link: "/fridge?tab=list" };
    })
  );

  server.registerTool(
    "add_to_shopping",
    { title: "Add to shopping list", description: "Add items (duplicates of open items are skipped).", inputSchema: { items: z.array(ShoppingItemInput).min(1) } },
    async ({ items }) => run(async (db) => {
      const added = await addShopping(db, items);
      return { text: `Added ${added.length} items.`, data: added };
    })
  );

  server.registerTool(
    "mark_bought",
    { title: "Mark bought", description: "Tick (or untick) shopping items.", inputSchema: { ids: z.array(z.string().uuid()).min(1), bought: z.boolean().default(true) } },
    async ({ ids, bought }) => run(async (db) => { await setBought(db, ids, bought); return { text: `${ids.length} items updated.` }; })
  );

  server.registerTool(
    "move_bought_to_fridge",
    { title: "Bought items to fridge", description: "Move all ticked shopping items into the fridge as pending items for the user to confirm.", inputSchema: {} },
    async () => run(async (db) => ({ text: `${await moveBoughtToFridge(db)} items waiting in the fridge for confirmation.`, link: "/fridge" }))
  );

  // ---------------- budget ----------------
  server.registerTool(
    "add_expense",
    {
      title: "Add food expense",
      description: "Record a food expense (manual or from a receipt photo). Categories: daily_food, groceries, snacks_drinks, other. For grocery receipts set fridge_category per item and send_items_to_fridge=true.",
      inputSchema: addExpenseShape
    },
    async (args) => run(async (db) => {
      const r = await addExpense(db, args);
      const extra = r.pending_fridge_items.length ? ` ${r.pending_fridge_items.length} items are waiting in the fridge for confirmation.` : "";
      return { text: `Saved ${r.expense.merchant}: ${r.expense.amount.toLocaleString()} (${r.expense.category}).${extra}`, data: r, link: `/budget?expense=${r.expense.id}` };
    })
  );

  server.registerTool(
    "update_expense",
    { title: "Edit expense", description: "Edit merchant, date, category, items or amount.", inputSchema: { id: z.string().uuid(), patch: z.object(addExpenseShape).partial() } },
    async ({ id, patch }) => run(async (db) => ({ text: "Expense updated.", data: await updateExpense(db, id, patch) }))
  );

  server.registerTool(
    "delete_expense",
    { title: "Delete expense", description: "Delete an expense. Ask the user first.", inputSchema: { id: z.string().uuid() } },
    async ({ id }) => run(async (db) => { await deleteExpense(db, id); return { text: "Expense deleted." }; })
  );

  server.registerTool(
    "expense_summary",
    { title: "Budget summary", description: "Month spend vs budget, by category and by day, plus recent expenses.", inputSchema: { month: Month.optional() } },
    async ({ month }) => run(async (db) => {
      const s = await expenseSummary(db, month);
      return { text: `${s.month}: spent ${s.spent.toLocaleString()} of ${s.budget.toLocaleString()} ${s.currency} (${s.state}).`, data: s, link: "/budget" };
    })
  );

  // ---------------- settings ----------------
  server.registerTool(
    "get_settings",
    { title: "Settings", description: "Time zone, calorie and macro goals, monthly food budget, currency.", inputSchema: {} },
    async () => run(async (db) => ({ text: "Settings.", data: await getSettings(db) }))
  );

  server.registerTool(
    "update_settings",
    {
      title: "Update settings",
      description: "Change goals, budget or time zone (IANA name, e.g. Asia/Seoul).",
      inputSchema: {
        timezone: z.string().optional(), kcal_goal: z.number().int().positive().optional(), protein_goal_g: z.number().int().optional(),
        carbs_goal_g: z.number().int().optional(), fat_goal_g: z.number().int().optional(), water_goal: z.number().int().optional(),
        monthly_budget: z.number().nonnegative().optional(), currency: z.string().optional()
      }
    },
    async (args) => run(async (db) => {
      if (args.timezone) new Intl.DateTimeFormat("en", { timeZone: args.timezone }); // throws on invalid zone
      return { text: "Settings saved.", data: await updateSettings(db, args) };
    })
  );

  // ---------------- progress ----------------
  server.registerTool(
    "nutrition_trends",
    { title: "Nutrition trends", description: "Daily calories/macros for the last N days, averages, logging streak, goal hit rate.", inputSchema: { days: z.number().int().min(7).max(120).default(30) } },
    async ({ days }) => run(async (db) => {
      const t = await nutritionTrends(db, days);
      return { text: `Last ${days} days: logged ${t.days_logged} days, avg ${t.averages.kcal} kcal, streak ${t.streak}.`, data: t, link: "/progress" };
    })
  );

  server.registerTool(
    "list_goals",
    { title: "Goals", description: "The user's goals and progress.", inputSchema: {} },
    async () => run(async (db) => ({ text: "Goals.", data: await listGoals(db) }))
  );

  server.registerTool(
    "upsert_goal",
    {
      title: "Add or update goal",
      description: "Create a goal (title required) or update one by id.",
      inputSchema: { id: z.string().uuid().optional(), title: z.string().optional(), target: z.number().optional(), progress: z.number().optional(), unit: z.string().optional(), period: z.enum(["day", "week", "month", "once"]).optional(), active: z.boolean().optional() }
    },
    async (args) => run(async (db) => ({ text: "Goal saved.", data: await upsertGoal(db, args) }))
  );

  server.registerTool(
    "add_reflection",
    { title: "Add reflection", description: "Add a reflection note to the progress timeline.", inputSchema: { text: z.string().min(1), date: Day.optional() } },
    async ({ text, date }) => run(async (db) => ({ text: "Reflection added.", data: await addReflection(db, text, date) }))
  );

  // ---------------- messages ----------------
  server.registerTool(
    "list_notifications",
    {
      title: "Reminders & alerts",
      description: "Expiry reminders, low-stock alerts, meal-plan reminders and budget alerts (refreshed from current data).",
      inputSchema: { unread_only: z.boolean().default(false), kind: z.enum(["expiry", "low_stock", "meal_plan", "budget"]).optional() }
    },
    async ({ unread_only, kind }) => run(async (db) => {
      await refreshNotifications(db);
      const list = await listNotifications(db, { unreadOnly: unread_only, kind });
      return { text: `${list.length} notifications.`, data: list, link: "/notifications" };
    })
  );

  server.registerTool(
    "mark_notifications_read",
    { title: "Mark read", description: "Mark notifications read (all if no ids).", inputSchema: { ids: z.array(z.string().uuid()).optional() } },
    async ({ ids }) => run(async (db) => { await markRead(db, ids); return { text: "Marked as read." }; })
  );

  server.registerTool(
    "dismiss_notification",
    { title: "Dismiss", description: "Hide a notification.", inputSchema: { id: z.string().uuid() } },
    async ({ id }) => run(async (db) => { await dismiss(db, id); return { text: "Dismissed." }; })
  );

  // ---------------- archive ----------------
  server.registerTool(
    "search_archive",
    {
      title: "Search archive",
      description: "Search past journal pages, meals, expenses, fridge history, recipes, photos and receipts. Results link to the original records.",
      inputSchema: { query: z.string().optional(), type: ArchiveType.default("all"), from: Day.optional(), to: Day.optional(), limit: z.number().int().min(1).max(100).default(30) }
    },
    async (args) => run(async (db) => {
      const hits = await searchArchive(db, args);
      return { text: `${hits.length} results.`, data: hits, link: `/archive?q=${encodeURIComponent(args.query ?? "")}` };
    })
  );

  // ---------------- My Kitchen + navigation ----------------
  server.registerTool(
    "get_kitchen_overview",
    {
      title: "My Kitchen overview",
      description: "My Kitchen in one call (food at home): fridge stock count, items to use soon and running low, the To buy list, saved recipe count, and 'What can I cook tonight?' recipes ranked by what is already in the fridge (expiring first).",
      inputSchema: { suggestions: z.boolean().default(true).describe("Include cook-tonight recipe ideas (TheMealDB lookups)") }
    },
    async ({ suggestions }) => run(async (db) => {
      const k = await getKitchenOverview(db, { suggestions });
      const ideas = k.cook_tonight.slice(0, 3).map((r) => r.title).join(", ");
      return {
        text: `${k.fridge.total} items in the fridge, ${k.fridge.use_soon.length} to use soon, ${k.fridge.low_stock.length} running low, ${k.to_buy.open} on To buy.${ideas ? ` Cook tonight: ${ideas}.` : ""}`,
        data: k,
        link: "/kitchen"
      };
    })
  );

  server.registerTool(
    "get_progress_overview",
    {
      title: "AI progress overview",
      description: "The user's progress overview for the last 7 days (week) or 30 days (month): headline, summary, what's going well, patterns noticed and one thing to try next, written from their own logs (meals, journal moods, food spend). Cached per day; refresh=true writes a new one. Share it in your own words; it is general guidance, not medical advice. Never comment on body weight or appearance.",
      inputSchema: { period: z.enum(["week", "month"]).default("week"), refresh: z.boolean().default(false) }
    },
    async ({ period, refresh }) => run(async (db) => {
      const o = await getProgressOverview(db, period, { refresh });
      const { facts, ...overview } = o;
      return { text: `${o.headline}. ${o.summary}`, data: { ...overview, facts }, link: period === "month" ? "/progress?period=month" : "/progress" };
    })
  );

  server.registerTool(
    "get_app_map",
    {
      title: "App map",
      description: "DailyBite's 4 main tabs (Home, My Kitchen, Journal, Archive) and every feature under them (e.g. Fridge and Recipes in My Kitchen, Calendar in Archive, My progress and Budget under Home), with deep links. Use it to tell the user where to tap, or to link them straight to a page.",
      inputSchema: {}
    },
    async () => run(async () => {
      const map = TABS.map((tab) => ({
        tab: tab.label,
        link: appUrl(tab.href),
        features: SERVICES.filter((s) => s.section === tab.key && s.href !== tab.href).map((s) => ({ name: s.label, description: s.description, link: appUrl(s.href) }))
      }));
      const account = SERVICES.filter((s) => s.section === "account").map((s) => ({ name: s.label, description: s.description, link: appUrl(s.href) }));
      return { text: "Main tabs: Home, My Kitchen, Journal, Archive. Notifications open from the bell on Home; Settings from the profile avatar.", data: { tabs: map, account_menu: account } };
    })
  );

  server.registerTool(
    "today",
    { title: "Today's date", description: "The user's current local date and time zone.", inputSchema: {} },
    async () => run(async (db) => ({ text: `Today is ${dayKey(new Date(), db.tz)} (${db.tz}).` }))
  );
}

// Re-exported so the route can validate that categories etc. stay in sync with the DB checks.
export const _enums = { Slot, MealStatus, ExpenseCategory, FridgeCategory };
