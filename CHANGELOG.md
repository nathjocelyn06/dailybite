# Changelog

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
