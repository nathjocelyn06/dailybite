# Changelog

## v4.1 · 2026-11-17 — Phase 4: the scrapbook journal page
`app/(app)/journal/Scrapbook.tsx`, from `D05-Journal`. The day page is now something you make rather than fill in.
- **Decorate page** turns the page into a canvas: six food stickers, mood stamps, washi tape, handwriting text and freehand doodles.
- **Drag to move, corner handle to resize, top handle to rotate, × to delete.** Saves 500 ms after you stop, debounced *per element*, so moving one sticker never rewrites the rest of the page.
- **Doodles are drawn freehand** on the page and stored as an SVG path in `data.path`, exactly as the plan specified.
- Positions use the schema as designed — x and width as percentages of the page, y in pixels — so a page made on a laptop still reads on a phone.
- **Photo** opens the AI camera at `/snap?mode=journal` rather than duplicating a picker; cropping and linking a photo to a meal from inside the editor are still to come, as are mood stickers feeding Progress habits and the week-plan page kind.
- Verified end to end: two stickers placed in the browser arrived in `journal_elements` as `x=48.8% y=237px w=14% rot=-6 z=0`.

## v4.0 · 2026-11-17 — Phase 4: the digital fridge
`/fridge` is no longer a list. `components/fridge/Fridge.tsx` ports `D06-Fridge` / `M05-Fridge`:
- **Doors that open.** Handles swing the freezer and fridge on a CSS 3D `rotateY(-112deg)` (104° on phones, instant under `prefers-reduced-motion`), revealing shelves — freezer, dairy & eggs, proteins, crisper drawers, shelf — with the pantry cupboard beside the fridge.
- **A door you decorate.** Post-its, notes, badges, magnets and tape, dragged with pointer events, tilted, retyped or removed, plus seven fridge colours. Saved through the existing `saveDecorAction` 600 ms after a drag ends.
- **Positions are percentages of the door, not pixels**, so a door arranged on a laptop still looks right on a phone.
- **A status magnet** on the door counts what needs attention: use-soon and low-stock items.
- **Tap an item** for Use 1 / Restock / Remove / Recipes using this; items expiring or low are flagged on the shelf itself.
- Verified end to end: a post-it dropped on the door appears in `fridge_decor` with its percent coordinates, rotation and colour a second later.

## v3.11 · 2026-11-17 — Fix the scan that hung on "Analysing your meal…"
Measured against the same pizza photo: `gemini-flash-latest` **timed out at 15 s** (Google is saturating it), while `gemini-3.1-flash-lite` answered in **4.2 s**. The spinner was simply waiting on a model that never replied.
- **Model chain instead of one model**: `gemini-3.1-flash-lite` first, `gemini-flash-latest` as backstop, 13 s per attempt so the whole chain fits inside the serverless budget. A rejected key still fails immediately — only timeouts, 404s, rate limits and outages move to the next model.
- `GEMINI_MODEL` now *leads* the chain rather than replacing it, so pinning a model never removes the fallback.
- **The spinner can no longer hang**: the browser aborts the scan request after 75 s and says so, instead of spinning forever if the response is lost.

## v3.10.1 · 2026-11-17 — Food search uses the endpoint that works
- Open Food Facts `/api/v2/search` was returning 503 HTML while the long-standing `cgi/search.pl` answered fine and ranked better ("nutella" → Nutella, not bottled water). Search now calls the legacy endpoint first and falls back to v2.
- The relevance filter no longer empties the list: if scoring discards everything, the raw results are shown instead.

## v3.10 · 2026-11-17 — Barcode scanning and food search (the MyFitnessPal part)
Photo analysis only covers cooked meals. The everyday case — a packaged food with a barcode — now works like MyFitnessPal, and **needs no API key at all**.
- **Open Food Facts** (`lib/nutrition/openfoodfacts.ts`, free and open, no account): barcode lookup and free-text search, with kJ→kcal conversion for entries that only carry kilojoules, and products with no calorie data dropped rather than shown as blanks.
- **Relevance ranking of our own.** Their search sorts by popularity, so "greek yogurt" returns bottled water; results are now scored by how much of the query appears in the product name and unmatched entries are discarded.
- **`/api/food`**: `?barcode=` or `?q=`. Read-only, sends nothing about the user beyond the search text, and identifies the app generically in the User-Agent.
- **New "Barcode & search" mode in `/snap`**: live barcode scanning through `BarcodeDetector`, with typing the digits as the fallback everywhere it is missing (Safari has no support). Then a serving picker — the pack serving, 100 g, or grams you type, times a quantity — that recalculates kcal and macros live.
- Picks collect into a basket, then **Review & save** drops them into the same editable meal form as a photo scan, marked **from food database**.
- Every failure degrades to something usable: no barcode match, rate limiting, no camera.

## v3.9 · 2026-11-17 — Nutrition from a database, not the model memory
Borrowed the one good idea from `sunilpowar5/LangGraph-MCP-Nutrition-Analyzer` (a Streamlit demo, no licence, nothing to port): split identification from nutrition.
- New `lib/nutrition/nutritionix.ts`. The vision model names the food and judges the portion; **Nutritionix supplies the calories and macros**. Where a lookup succeeds its numbers win; where it fails the model estimate is kept, so a lookup outage never costs a scan. Returns `[]` and degrades silently when the keys are absent.
- Rows now carry `source: "db" | "ai"`, and the review form marks looked-up items **from food database** so an estimate is never mistaken for a measurement.
- 12 s timeout on the lookup, inside the existing serverless budget.
- Needs `NUTRITIONIX_APP_ID` / `NUTRITIONIX_API_KEY` (free tier). Without them nothing changes.

## v3.8.1 · 2026-11-17 — Scans fail fast instead of timing out
- A Gemini outage used to hang the request until Vercel killed the function at 60 s and returned an opaque 504. Each attempt now aborts after 22 s, with **one retry** on 429/5xx, so the worst case still fits inside the serverless limit and the user gets a sentence instead of a gateway error.
- **Thinking disabled** (`thinkingBudget: 0`): reading a plate is perception, not reasoning, and thinking tokens only spent latency we do not have in a single serverless call.
- Added the 503 case to the error messages ("Gemini is overloaded right now — try again in a moment").

## v3.8 · 2026-11-17 — Food recognition switched on (Gemini)
- The food camera now really analyses photos: Gemini is the configured provider, on the free tier, with the key server-side only.
- **Default model is the `gemini-flash-latest` alias, not a pinned version.** Google now returns 404 for `gemini-2.5-flash` to new keys ("no longer available to new users"), so a pinned number is a time bomb; the alias always resolves to the current flash model. `GEMINI_MODEL` still overrides.
- Verified on a real meal photo: one plate of pasta came back as "Penne alla Vodka", dinner, 280 g, 520 kcal, 14 g protein, 66 g carbs, 22 g fat, with ingredients listed and a note explaining the portion assumption.

## v3.7 · 2026-11-17 — Automatic in-app food recognition
- **Gemini vision provider** (`lib/vision/gemini.ts`), now the default pick because its free tier needs no card. `getVisionProvider()` chooses by whichever key is set — `GEMINI_API_KEY` first, then `ANTHROPIC_API_KEY` — or `VISION_PROVIDER` to force one. The key stays server-side; the browser never sees it.
- **Removed the "Let Claude read it instead" panel.** Taking or uploading a photo analyses it automatically: upload → "Analysing your meal…" → the form arrives filled with meal name, slot, and one card per food with portion, grams, kcal, protein, carbs, fat and ingredients. Nothing is clicked to start it, and nothing is saved until **Save to my journal**.
- Gemini failures read like instructions rather than status codes: rejected key, model not found, free-tier rate limit, blocked photo, service down.
- `.env.example` documents the provider choice.

## v3.6 · 2026-11-17 — Correcting AI estimates, and the no-key route
**Meals can finally be edited.** A meal could be confirmed or deleted but never corrected, which made an AI estimate all-or-nothing. New `app/(app)/journal/MealEditor.tsx`: meal name, slot, and per-item food / portion / grams / kcal / protein / carbs / fat, add and remove items, totals recomputing as you type, then **Save & mark eaten** or **Save changes**. Opens at `/journal?meal=<id>&edit=1`; Home's **Edit** on "Check these AI estimates" now goes straight there. Totals are recomputed server-side by `updateMeal`, so the saved numbers always match the items.
- Meals estimated by AI now carry an **AI estimate** chip in the journal.
- **No vision key, no dead end.** With no provider configured, `/snap` now explains the route that needs no API key: send the photo in the Claude app and say "log this meal in DailyBite" — Claude reads it and writes it through the MCP connector as `pending_confirm`, and it appears on Home for you to correct and confirm. The vision provider layer stays in place, so dropping in a key later turns the in-app analysis on with no other changes.

## v3.5 · 2026-11-17 — Real AI food recognition on the camera
- **Swappable vision provider** (`lib/vision/`): `VisionProvider` contract, an Anthropic implementation, and `getVisionProvider()` chosen by `VISION_PROVIDER` (default `anthropic`). `/api/scan` no longer knows who answers; changing provider is one new file. The key stays server-side, as before.
- **Per-item recognition.** The calorie prompt now asks for every distinct food separately with portion text, **grams**, kcal, protein, carbs, fat, visible **ingredients**, an `unsure` flag, and which **meal slot** the photo looks like. Model output is validated field by field (`cleanRow`) — a model returning a string where a number belongs can no longer poison the form.
- **A real editing step.** Each item is now a card with its own kcal / protein / carbs / fat inputs plus portion and grams; ingredients are listed; items can be added or removed; **meal totals recompute on every keystroke** across all four macros, not just calories.
- **Retry without re-uploading**: "Analyse the photo again" re-runs the scan on the photo already in storage.
- Honest copy: figures are labelled estimates from the photo, the save button reads "Save to my journal", and nothing is written until it is pressed.
- `MealItem` in `lib/schemas.ts` gained `grams` and `ingredients`, so what the AI estimated is kept on the saved meal and is visible to MCP tools too.

## v3.4 · 2026-11-17 — The AI camera opens a real camera
- **`/snap` now opens the device camera** (laptop webcam, iPad, phone) instead of only a file picker: live preview, a shutter button, and a Flip control when the device has more than one camera. New `app/(app)/snap/CameraCapture.tsx`.
- The still is drawn to a canvas at the camera's own resolution and uploaded as JPEG (quality 0.9) through the existing `uploadScanPhotoAction`, so nothing else in the scan flow changed.
- Camera tracks are stopped on cancel, after a capture and on unmount — the camera light never stays on.
- Honest fallbacks instead of a dead button: separate messages for a blocked permission, no camera on the device, a camera already in use by another app, and a non-HTTPS page (getUserMedia needs a secure context; localhost and the Vercel site both qualify). **Upload a photo** stays available in every case.
- iOS specifics handled: `playsInline` + `muted` so Safari renders the preview inline, and the stream only starts from a tap.

## v3.3 · 2026-11-17 — Phase 3: live on Vercel
**https://dailybite-ten.vercel.app** — the app and its 53-tool MCP server now run without anything on the laptop.
- **Pinned the database with `DAILYBITE_SUPABASE_URL` / `DAILYBITE_SUPABASE_SERVICE_KEY`** (`supabaseTarget()` in `lib/supabase/admin.ts`). A Supabase connection added through Vercel provisions its own empty Supabase project and injects `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` at deploy time, overwriting the dashboard values — so every page 500d with "Could not find the table in the schema cache" while `/api/mcp` kept answering 401. The `DAILYBITE_*` pair wins when set.
- Turned off Vercel Authentication, which is on by default for new projects and blocks the MCP connector as well as the browser. The app has no sign-in, so **the deployed URL is open to anyone who has it**.
- `APP_URL` set, so MCP tool results deep-link to the live app instead of localhost.
- Verified live: 13 routes return 200, `tools/list` → 53, and `today` / `get_daily_summary` / `get_kitchen_overview` answer from the migrated project.

## v3.2.1 · 2026-11-17 — Phase 3: source control
- First commit and push: **github.com/nathjocelyn06/dailybite** (private). 120 files, no secrets — `.env.local` is covered by `.gitignore` and nothing tracked contains a key.
- Recorded which environment variables the deployed app actually reads: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OWNER_USER_ID`, `MCP_ACCESS_KEY`, `DEFAULT_TIMEZONE`, `APP_URL`, plus the optional AI/YouTube/MealDB keys. `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `OWNER_EMAIL` have been dead since v3.1 and are now marked as such in `.env.example`.

## v3.2 · 2026-11-16 — Phase 2 polish
**Calendar (Archive) grew week and day views** (`?view=month|week|day`, wireframe `D02-Calendar`). Week: seven columns, one box per meal slot — dashed while planned, meal-coloured once filled — with kcal and spend per day. Day: an hour timeline that places each meal by its `eaten_at` time, falling back to a sensible hour for its slot when it was never timed. Prev/next step by whichever view you are in. New `weekOverview` in `lib/services/calendar.ts`.

**Write your own recipes.** `/recipes/edit` creates, `/recipes/edit?id=` edits: ingredient rows you can add and remove, steps one per line, servings, time, calories, difficulty, cuisine, folder and links. Reachable from Saved → **+ New recipe**, from each own-recipe card, and from **Edit recipe** on the detail page. `MyRecipeInput` lives in `lib/schemas.ts`; `createMyRecipeAction` / `updateMyRecipeAction` wrap the existing services. TheMealDB recipes stay read-only and say why. `saveRecipe` now accepts a partial own-recipe instead of demanding every column.

**Serving scaler** on every recipe. `lib/scale.ts` (pure, 11 new tests) reads "1 cup", "200g", "1 1/2 tbsp" and "½ cup", scales them, and prints cooking fractions back — ½, 1½, ⅔. Anything it cannot read, like "to taste", is left exactly as written rather than guessed at. Scaling is display-only; nothing is saved. Recipes without a stated serving count assume 4 and say so.

**Budget weekly/monthly toggle and expense editing.** `?period=week|month`, with prev/next stepping by the chosen period. A week has no budget of its own, so it shows seven days' share of the monthly budget, labelled as such. History rows gained **Edit**, which fills the side form (`?expense=`); new `spendSummary` service and `updateExpenseAction`.

**Archive month/year browser.** A side panel grouped by year, with a record count per month, filtering the list to that month. Only months that actually hold records are listed, so there are no dead links. New `archiveMonths` service.

`npm run check` passes (36 tests, up from 25). Verified in the browser at desktop and 390 px: a recipe was created, scaled 2 → 4 servings (200 g → 400 g) and deleted again.

## v3.1.2 · 2026-11-16 — Phase 0 complete, first run against real Supabase
- **Fixed a race in `getSettings`** found the moment the app first loaded: Home reaches it through both `getDailySummary` and `expenseSummary`, so on an account with no settings row yet, two inserts collided and the page died with `duplicate key value violates unique constraint "settings_pkey"`. It now does insert-or-ignore (`upsert … ignoreDuplicates`) and reads back whichever call won. This was latent from the start, not caused by v3.1.
- Supabase live: both migrations run, all 16 tables verified over REST, owner user created through the Auth admin API and auto-confirmed, `.env.local` complete.
- **MCP smoke test passed:** 53 tools over Streamable HTTP, 401 without `?key=`, `today` → 2026-11-16 (Asia/Seoul), `log_meal` → `confirm_meal` → `get_daily_summary` → 620/1800 kcal. `get_app_map`, `get_kitchen_overview` and `get_progress_overview` all return the v3 shape.
- **Layout verified** at 1440 px (sidebar), 1000 px (icon rail) and 390 px (bottom bar with the AI camera above it): four tabs only, Chroma palette, Home matching `D01-Dashboard` / `M01-Home`.

## v3.1.1 · 2026-11-16 — Real logo in the opening
- The logo opening now shows the brand lockup from `Dailybite logo.png` (the lower of the two in that sheet: the `DailyBite` wordmark over the blue gradient bowl), cropped to its ink box and saved with a transparent background as `public/logo-dailybite.png` (1199 × 463). It scales to `min(320px, 66vw)`, pops in once and fades out — the drawn placeholder mark, wordmark and Caveat tagline are gone.

## v3.1 · 2026-11-16 — No sign-in, logo opening
**The app opens on Home.** A CSS logo opening (`.splash` in `app/(app)/layout.tsx`, `.splash*` in `app/globals.css`) fades itself out over ~1.5 s — `pointer-events: none` from the first frame, ending on `visibility: hidden`, so it can never block the page. Reduced-motion users get a short fade and no movement.
- **Removed:** `app/login/`, `app/auth/callback/`, `middleware.ts`, `lib/supabase/server.ts`, `lib/supabase/client.ts`, and the Sign out button in Settings. No magic links, no session cookie, no owner-email gate.
- **One owner, server-side only.** `webDb()` now returns `ownerDb()`: the service-role client scoped to `OWNER_USER_ID`. RLS is still on every table but dormant — the `.eq("user_id", db.userId)` filter in `lib/services/*` is now the only thing scoping the data, so that rule matters more than before. `SUPABASE_SERVICE_ROLE_KEY` and `OWNER_USER_ID` are now required for the web app, not just MCP.
- **The browser no longer talks to Supabase at all.** Photo uploads from `/snap` go through the new `uploadScanPhotoAction` (server action → `uploadPhoto` → private bucket) instead of the anon-key storage client; the anon key is unused. `/snap` lost 69 kB of JS (175 kB → 106 kB first load).
- **LiveSync polls instead of subscribing.** Realtime needs an authenticated client, so `components/LiveSync.tsx` re-renders every 10 s while the tab is visible, on focus, and at local midnight. Cross-device and MCP changes still land within a few seconds.
- **Trade-off, on purpose:** there is no access control left in the app. On localhost that is fine; a deployment needs Vercel password protection, an allowlist, or the sign-in brought back (Phase 3 notes this).

## Unreleased · 2026-11-16 — Phase 0: first real install
- First `npm install` against the real registry: `@modelcontextprotocol/sdk` pinned to **1.26.0** and `mcp-handler` to **1.1.0** (mcp-handler 1.1.0 declares an exact peer on SDK 1.26.0; 2.x is a different API on `@modelcontextprotocol/server@^2`). Everything else resolved inside its range (next 15.5.29, react 19.3.1, @supabase/ssr 0.6.1, supabase-js 2.119.0, zod 3.25.76, vitest 3.2.7, typescript 5.9.3).
- `npm run check` now passes: typecheck clean, 25 tests pass, `next build` succeeds (22 routes + middleware).
- Fixes for the real library types: explicit `setAll(list: Parameters<SetAllCookies>[0])` in `lib/supabase/server.ts` and `middleware.ts` (the overloaded `createServerClient` in @supabase/ssr 0.6.1 gives no contextual parameter types), and `.single<Settings>()` in `lib/services/settings.ts` (an untyped `SupabaseClient` infers `data: null` for insert/update + select). No change needed in `lib/mcp/tools.ts` or the MCP route. (Both cookie fixes were superseded hours later: v3.1 deletes those two files with the sign-in.)

## v3 · 2026-11-04 — Narrowed DailyBite, Chroma palette, AI progress overview
**Scope: four destinations, one job each.**
- **Home** = today. Also holds **My progress** (`/progress`), **Budget** (`/budget`) and **Notifications** (`/notifications`, bell icon). Quick actions: Log meal, Scan receipt, Cook, My progress. Water card and reminders card removed (the bell shows reminders).
- **My Kitchen** = food at home only. Budget and Calendar moved out. Two cards: **Fridge** (Stock · To buy · Scan groceries) and **Recipes** (Find · Saved · Cook from my fridge), then *What can I cook tonight?*, Use soon and a To buy preview.
- **Journal** unchanged.
- **Archive** = the past: **List** and **Calendar** (`/calendar` now belongs to Archive) behind a List / Calendar switch.
- Messages renamed **Notifications** (`/messages` redirects). Settings stays behind the avatar.
- **Cut for now:** health articles + workout videos (`/insights` → `/progress`), water tracking (`add_water` removed; table kept), body photo journal UI (table kept), reflection notes on Progress.

**Look: Chroma palette** (`app/globals.css`). Paper `#EDEDEB`, ink `#231F1C`, grid `#C9C9C6`; vermilion, signal red, amber, sun, coral rose, blush; lilac, periwinkle, cobalt, deep ocean, emerald. Home hero pastel yellow `#FDF1B8`, Today's tip `#F2D04A`, primary buttons sun yellow, active nav cobalt tint / deep ocean. The calorie ring is now the plate: one segment per meal (breakfast amber, lunch vermilion, dinner lilac, snack blush). Service tiles get a colour each via `SERVICES[].tone` → `.tone-*`.

**AI progress overview** (My progress)
- `lib/overview-facts.ts` (pure): `buildFacts`, `fallbackOverview`, `parseOverview`, `NEXT_LINKS`.
- `lib/services/overview.ts`: `getProgressOverview(db, "week" | "month", { refresh })` → Claude writes headline, summary, going well, I noticed, try next (JSON, whitelisted links); rule-based fallback without `ANTHROPIC_API_KEY`; cached per day.
- Migration `supabase/migrations/0002_v3_ai_overviews.sql` (table `ai_overviews`, RLS).
- Page: overview on deep ocean with This week / This month, Refresh overview, "not medical advice" line; averages, 30-day chart and goals below. `refreshOverviewAction` in `app/(app)/actions.ts`.

**Code**
- `lib/nav.ts` rewritten (sections, groups, tones, Archive owns `/calendar`, Home owns `/budget`, `/progress`, `/notifications`).
- `lib/services/kitchen.ts` rewritten: fridge + To buy + saved count + cook-tonight suggestions (network lookups never break the page).
- New routes: `/notifications`; redirects: `/messages`, `/insights`. Labels: Fridge tabs Stock / To buy; Recipes tabs Find / Saved / Cook from my fridge.
- `components/NavIcon.tsx` new icons (notifications, receipt, saved, cook, search); `components/Services.tsx` uses tones.

**MCP: still 53 tools.** Removed `add_water`. Added `get_progress_overview`. `get_kitchen_overview` now returns fridge, To buy, saved count and cook-tonight ideas (no budget, no week plan). Server instructions describe the v3 app map.

**Wireframes** replaced with the v3 canvas (D10 Insights removed, D11 is Notifications, D08 My progress with the AI overview, Archive + Calendar switch).

**Verified here:** 25 unit tests pass (nav + AI overview facts/fallback/parser); changed files type-check against stubbed library types. **Not yet:** `npm install`, `next build`, a run against Supabase, or a live call to the Anthropic API (no npm access here). Phase 0 covers it.

## v2 · 2026-11-04 — DailyBite, 4-tab navigation, Gojek-style Home
**Renamed** Nutrigo → **DailyBite** (app title, PWA manifest, login, MCP server text, package name). Database tables, env vars and the `/api/mcp` URL are unchanged, so an existing Supabase project and Claude connector keep working.

**Navigation: four destinations only**
- `lib/nav.ts` rewritten: `TABS` (Home, My Kitchen, Journal, Archive), `SERVICES` (every feature with its parent tab, short label, icon, description), `HOME_GRID`, `KITCHEN_SERVICES`, `sectionOf()`, `breadcrumbFor()`.
- `components/AppShell.tsx`: sidebar with the 4 tabs + an Account section (Messages with unread badge, Settings); breadcrumb on secondary pages; phone bottom bar with exactly 4 tabs, safe-area padding, active tab in sage.
- `app/globals.css`: compact icon rail at 861–1100 px, fixed bottom bar ≤ 860 px, service grid, hero, tip banner, sheet styles. New tokens `--sage-ink`, `--deep`.
- `components/NavIcon.tsx`: real stroke icons for every key (still the one icon slot).
- All existing routes kept. `/more` is now the Account page (Messages + Settings), not a tab.

**New pages / components**
- `app/(app)/kitchen/page.tsx` — **My Kitchen** hub: service grid with live counts (Recipes, Digital fridge, Grocery list, Budgeting, Meal planning), use soon + low stock, tick-off grocery list, 7-day meal strip, budget card.
- `lib/services/kitchen.ts` — `getKitchenOverview(db)` (shared by the page and MCP).
- `components/Services.tsx` — `ServiceTile`, `ServiceGrid` (with a **More** tile) and the all-services sheet ("Top services" + "Other services" grouped by tab; Escape/backdrop closes, focus moves to Close).

**Home redesigned** (`app/(app)/page.tsx`, inspired by Gojek's home): sage hero with search (→ Archive) and account avatar, "today" card (calories ring + macros → Progress, budget, water) with quick actions (Log meal, Add expense, Plan meal, Insights), service grid + More sheet, one data-driven tip banner (expiring item → recipes; low stock → grocery list; nothing planned → calendar), pending AI estimates, What have I eaten today?, Up next, reminders, water, discover saved recipes. Nothing from the old dashboard was removed.

**MCP: 51 → 53 tools**
- `get_kitchen_overview` — the My Kitchen hub in one call.
- `get_app_map` — the 4 tabs, every feature under them and the account menu, with deep links.
- Server instructions and result links now say DailyBite.

**Wireframes** (`design/wireframes/`): replaced with the v2 canvas — new D00 My Kitchen, M07 My Kitchen (was M07 More), M08 Archive; D01/M01 Home redesigned; every desktop screen has the 4-tab sidebar and breadcrumbs.

**Docs**: PLAN.md (new "Navigation v2" section, page table, tool count), MCP_TOOLS.md, CLAUDE.md (nav rules), README.md, CLAUDE_CODE_PROMPT.md.

**Verified here**: 21 unit tests pass (5 new for navigation); new and changed files type-check against stubbed library types. **Not yet**: `npm install`, `next build`, or a run against Supabase (no npm access in this environment) — Phase 0 covers it.

## v1 · 2026-10-29 — Nutrigo starter
Next.js 15 + Supabase app with 10-item sidebar, phone tab bar with More, 51 MCP tools, SQL migration with RLS, wireframes D01–D13 / M01–M07, build plan.
