# MCP tools

Endpoint: `{APP_URL}/api/mcp?key=MCP_ACCESS_KEY` (Streamable HTTP). Every tool runs as `OWNER_USER_ID` and returns a short summary, a link into the web app and the JSON record(s).

| Tool | What it does |
|---|---|
| `get_daily_summary` | Today's (or a given day's) calories eaten vs goal, macros, meals by slot, pending AI estimates, planned meals, food spend, budget and reminders. |
| `log_meal` | Create a meal record. Use status pending_confirm for photo estimates (user must confirm), eaten for meals the user confirmed, planned for meal plans. |
| `update_meal` | Change any field of a meal: portions/items, totals, slot, date, status, place, notes. |
| `confirm_meal` | Mark a planned or pending_confirm meal as eaten so it counts toward today's calories. |
| `plan_meal` | Add a planned meal to the meal plan / calendar. It does not count as eaten. |
| `list_meals` | Meals between two dates, optionally filtered by status. |
| `delete_meal` | Permanently delete a meal record. Ask the user first. |
| `get_journal_page` | A day's journal page: review, mood, stickers/photos/text elements and that day's meals. |
| `write_journal_review` | Set the day's reflection text, mood and fullness on the journal page (creates the page if needed). |
| `add_journal_element` | Add a sticker, text box, tape, mood/habit sticker or meal card to a day page. |
| `update_journal_element` | Move, resize, rotate or change text of a journal element. |
| `delete_journal_element` | Remove an element from a journal page. |
| `month_overview` | Per-day calories eaten, meals, planned meals, food spend and journal flag for a month. |
| `day_detail` | Everything recorded on one date: meals, journal, expenses, fridge changes. |
| `search_recipes` | Search the recipe bank: TheMealDB (photos, YouTube videos, times estimated) plus a free bank whose recipes state real prep/cook time, difficulty and calories per serving. Filter by text, category, max minutes or difficulty. Empty = random picks. Every result carries its own `source`. |
| `get_recipe` | Full recipe: ingredients with measures, steps, YouTube video, time and difficulty, calories per serving where the source states them, and which ingredients are already in the fridge. Takes `source` alongside `external_id`. |
| `find_recipe_videos` | YouTube videos for a dish (needs YOUTUBE_API_KEY; otherwise returns a YouTube search link). |
| `save_recipe` | Save a recipe from the bank into the user's collection folder. TheMealDB recipes are kept as a reference and take your calorie estimate; free-bank recipes are copied in whole with the calories they already carry. |
| `list_saved_recipes` | Recipes the user saved, optionally one folder. |
| `delete_saved_recipe` | Remove a recipe from the collection. |
| `recipes_from_ingredients` | AI ingredient scanner backend: given ingredient names (e.g. from a photo), rank recipes that use them plus fridge stock (expiring first). |
| `add_missing_to_shopping` | Compare a recipe's ingredients with the fridge and add the missing ones to the shopping list. Takes `source` alongside `external_id`. |
| `list_fridge` | Items in the fridge/pantry with qty, unit, expiry state and low-stock flag. include_pending shows scanned items waiting for confirmation. |
| `add_fridge_items` | Add items to the fridge. Use status pending for anything recognised from a photo or receipt so the user can check it. |
| `confirm_fridge_items` | Approve pending fridge items (all, or by id) after the user checked them. |
| `use_fridge_item` | Decrease quantity (e.g. after cooking). At 0 the item is marked used up. |
| `restock_fridge_item` | Increase quantity of an item. |
| `update_fridge_item` | Change name, shelf/category, qty, unit, expiry date or low-stock threshold. |
| `remove_fridge_item` | Remove an item from the fridge (thrown away / gone). |
| `get_fridge_decor` | Stickers, photos, post-its on the fridge door, plus fridge colour. |
| `save_fridge_decor` | Replace the door layout and/or fridge colour (hex). |
| `list_shopping` | Grocery list with qty, estimated price, reason and bought status. |
| `add_to_shopping` | Add items (duplicates of open items are skipped). |
| `mark_bought` | Tick (or untick) shopping items. |
| `move_bought_to_fridge` | Move all ticked shopping items into the fridge as pending items for the user to confirm. |
| `add_expense` | Record a food expense (manual or from a receipt photo). Categories: daily_food, groceries, snacks_drinks, other. For grocery receipts set fridge_category per item and send_items_to_fridge=true. |
| `update_expense` | Edit merchant, date, category, items or amount. |
| `delete_expense` | Delete an expense. Ask the user first. |
| `expense_summary` | Month spend vs budget, by category and by day, plus recent expenses. |
| `get_settings` | Time zone, calorie and macro goals, monthly food budget, currency. |
| `update_settings` | Change goals, budget or time zone (IANA name, e.g. Asia/Seoul). |
| `nutrition_trends` | Daily calories/macros for the last N days, averages, logging streak, goal hit rate. |
| `list_goals` | The user's goals and progress. |
| `upsert_goal` | Create a goal (title required) or update one by id. |
| `add_reflection` | Add a reflection note to the progress timeline. |
| `list_notifications` | Expiry reminders, low-stock alerts, meal-plan reminders and budget alerts (refreshed from current data). |
| `mark_notifications_read` | Mark notifications read (all if no ids). |
| `dismiss_notification` | Hide a notification. |
| `search_archive` | Search past journal pages, meals, expenses, fridge history, recipes, photos and receipts. Results link to the original records. |
| `get_kitchen_overview` | **v3.** My Kitchen in one call (food at home): fridge stock count, use soon, running low, the To buy list, saved recipe count and "What can I cook tonight?" recipes ranked by fridge stock (expiring first). `suggestions=false` skips the TheMealDB lookups. Links to `/kitchen`. |
| `get_progress_overview` | **New (v3).** AI progress overview for `period` week (7 days) or month (30 days): headline, summary, going well, I noticed, try next (whitelisted in-app link). Written by Claude from a fact sheet of the user's own logs; rule-based without an API key. Cached per day; `refresh=true` regenerates. Never comments on weight or appearance. |
| `get_app_map` | The 4 main tabs (Home, My Kitchen, Journal, Archive), every feature under each with a description and deep link (Fridge + Recipes in My Kitchen, Calendar in Archive, My progress + Budget + Notifications under Home), plus Settings. |
| `today` | The user's current local date and time zone. |

53 tools (v3: −`add_water`, +`get_progress_overview`). Source: `lib/mcp/tools.ts`. Server instructions (sent to Claude on connect): `SERVER_INSTRUCTIONS` in the same file.
