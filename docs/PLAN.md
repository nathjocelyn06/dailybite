# DailyBite build plan (formerly Nutrigo)

Goal: a live app you can use and edit anywhere (phone + laptop), with everything saved in Supabase, and an MCP server so Claude can log meals, read your fridge, plan recipes and check your budget from any Claude app.

```
 Phone (PWA)  ─┐                         ┌─ Claude web / desktop / mobile
 Laptop        ├─ Next.js on Vercel ─────┤   (custom connector → /api/mcp)
               │   ├ pages + server actions
               │   ├ /api/mcp  (53 MCP tools)
               │   ├ /api/recipes (TheMealDB) · /api/videos (YouTube) · /api/scan (Claude vision)
               │   └ lib/services/*  ← single data layer
               └─────────────── Supabase (Postgres · Storage) — service role, single owner, no sign-in
```

Legend: ✅ written in this starter · 🔲 to build · 🧪 must be verified by running it.

> The starter was written without access to npm, so it has **not been installed, built, or run against a real Supabase project yet**. What *was* verified:
> the SQL migration (run twice on Postgres 16 with Supabase stubs, RLS tested), the pure logic (25 unit tests pass, incl. navigation and the AI overview facts), and a type-check of all app code against
> stubbed library types. Phase 0 exists to catch anything that differs in the real library versions.

## Navigation (v3, Nov 2026) ✅ — four destinations, one job each
| Tab | Route | Holds |
|---|---|---|
| Home | `/` | today: Gojek-style hero, today card (meal-coloured calorie ring, macros, budget), quick actions, service grid + More sheet, tip, today's meals, up next · **My progress** `/progress` (AI overview) · **Budget** `/budget` · **Notifications** `/notifications` (bell) |
| My Kitchen | `/kitchen` | food at home only. **Fridge** `/fridge` (Stock · To buy `?tab=list` · Scan groceries) and **Recipes** `/recipes` (Find · Saved `?tab=collection` · Cook from my fridge `?tab=scanner`); What can I cook tonight?, Use soon, To buy preview |
| Journal | `/journal` | today's page: photos, meals, kcal, stickers, notes, mood, reflection, previous days |
| Archive | `/archive` | **List** (search + type + date filters) and **Calendar** `/calendar` (month/week/day, planned meals) behind a List / Calendar switch |

- Settings `/more` sits behind the profile avatar and in the sidebar Account section, next to Notifications. No "More" tab.
- **Cut for now** (v3): health articles + workout videos (`/insights` redirects to `/progress`), water tracking (UI + `add_water` tool removed; table kept), body photo journal (UI removed; table kept, still never exposed via MCP), reflection notes on Progress.
- One source: `lib/nav.ts` (`TABS`, `SERVICES` with `tone`, `sectionOf`, `breadcrumbFor`). Secondary pages highlight their parent tab and show a breadcrumb ("Archive / Calendar").
- Desktop sidebar → 96 px icon rail at 861–1100 px → fixed 4-tab bottom bar at ≤ 860 px (safe-area padding, content padded so nothing hides behind it).
- **Kitchen loop:** use soon → What can I cook tonight? → recipe → "I cooked this" (uses stock, logs to Journal). Missing items → To buy → scan the receipt → back into the fridge (pending until confirmed).
- 🧪 Acceptance: ✅ checked at 1440 px (full sidebar), 1000 px (96 px icon rail) and 390 px (bottom bar, AI camera above it, nothing covered). Exactly four tabs — `/`, `/kitchen`, `/journal`, `/archive` — with Notifications and Settings in the Account section. 🔲 old-route redirects (`/messages`, `/insights`) not re-checked since v3.1.

## Look (v3) ✅ — Chroma palette
Tokens in `app/globals.css`. Neutrals: paper `#EDEDEB`, ink `#231F1C`, grid gray `#C9C9C6`. Warm: vermilion `#E8401C`, signal red `#E5192B`, amber `#F29A0F`, sun `#F9D312`, coral rose `#EE6F83`, blush `#F3A9C8`. Cool: lilac `#9A80BD`, periwinkle `#4F6FB5`, cobalt `#0A73B8`, deep ocean `#0F5C85`, emerald `#038248`.
- Home hero pastel yellow `#FDF1B8`; Today's tip `#F2D04A` with ink text; primary buttons sun yellow with ink text; active nav cobalt tint + deep ocean text.
- Calorie ring = the plate: one segment per meal (breakfast amber, lunch vermilion, dinner lilac, snack blush). Macro bars: protein vermilion, carbs amber, fat lilac.
- Service tiles use `.tone-*` (pale tint + darker shade of the hue for the icon). Bright hues (amber, sun, blush, lilac) are fills only, never text on light backgrounds.

## My progress: AI overview (v3) ✅ written / 🧪 verify
- `lib/overview-facts.ts` (pure, tested): `buildFacts` → small fact sheet (days logged, avg kcal vs goal, protein goal days, weekday vs weekend protein, late dinners, meals by slot, moods, food spend vs budget, use-soon names). No photos, no body data.
- `lib/services/overview.ts`: `getProgressOverview(db, "week" | "month", { refresh })`. Claude writes `{ headline, summary, wins[], noticed[], next { text, link } }` as JSON (`parseOverview` validates; links are whitelisted). No `ANTHROPIC_API_KEY` or an API error → `fallbackOverview` (rule-based, same shape). Cached once per period per local day in `ai_overviews` (migration `0002_v3_ai_overviews.sql`); **Refresh overview** forces a new one.
- Page: overview on deep ocean with This week / This month, Going well / I noticed / Try next (links into the app), "Written by AI from … · not medical advice". Below: averages, 30-day chart, goals. Reflection notes removed.
- MCP: `get_progress_overview`.
- 🧪 Acceptance: ✅ without a key the rules version shows (`source: "rules"`, no weight/body/score language), on the page and through `get_progress_overview`. 🔲 with a key — still to check (no `ANTHROPIC_API_KEY` set). Note the cache is per period per local day, so the overview can read "nothing logged" after you log the day's first meal until **Refresh overview**.
---

## Phase 0 — Install, connect, verify (do this first) 🧪

1. ✅ `npm install` — clean on Node v26.8.2 / npm 11.19.1. Versions noted: `@modelcontextprotocol/sdk` **pinned to 1.26.0** and `mcp-handler` **pinned to 1.1.0**, because mcp-handler 1.1.0 declares an *exact* peer on SDK 1.26.0 (mcp-handler 2.x is a different API built on `@modelcontextprotocol/server@^2`, so this stays on 1.x). Resolved elsewhere: next 15.5.29, react 19.3.1, @supabase/ssr 0.6.1, supabase-js 2.119.0, zod 3.25.76, vitest 3.2.7, typescript 5.9.3.
2. ✅ Supabase project created; both migrations run in the SQL Editor. Verified from outside: all 16 tables answer over REST (`settings` … `ai_overviews`).
   - Authentication: nothing to configure — the app has no sign-in (v3.1). Create a single user (Authentication → Users → Add user, auto-confirm) so the `user_id` foreign keys have an owner, and keep new sign-ups off.
   - Database → Replication: not needed any more (the browser has no session, so it cannot subscribe to Realtime; `LiveSync` polls instead). The publication is harmless if it is already set up.
3. ✅ `.env.local` filled: project URL, publishable key (now unused — see v3.1), secret key as `SUPABASE_SERVICE_ROLE_KEY`, `OWNER_USER_ID`, `OWNER_EMAIL`, `DEFAULT_TIMEZONE=Asia/Seoul`, and a generated 64-char `MCP_ACCESS_KEY`.
4. ✅ `npm run dev`: the logo opening plays and Home loads, local date Mon 16 Nov (Asia/Seoul). The owner user was created through the Auth admin API and auto-confirmed; its id is in `OWNER_USER_ID`. Nobody signs in as it.
   - 🐛 Fixed on first run: `getSettings` raced itself. Home calls it through both the daily summary and the expense summary, so on a cold account two inserts collided and the page died with `duplicate key value violates unique constraint "settings_pkey"`. It now insert-or-ignores and reads back the winner.
5. ✅ `npm run check` passes (typecheck + 25 tests + build). Real-library fixes that were needed: `setAll(list: Parameters<SetAllCookies>[0])` in `lib/supabase/server.ts` and `middleware.ts` (overloaded `createServerClient` gives no contextual param types in @supabase/ssr 0.6.1), and `.single<Settings>()` in `lib/services/settings.ts` (an untyped `SupabaseClient` infers `data: null` for insert/update + select). `mcp-handler` + SDK 1.26 needed no code change. The two cookie fixes no longer apply: v3.1 removed `middleware.ts` and `lib/supabase/server.ts` along with the sign-in. Original notes:
   - `app/api/[transport]/route.ts`: `createMcpHandler(init, serverOptions, { basePath })` from `mcp-handler`. Endpoint must be `/api/mcp`.
   - `lib/mcp/tools.ts`: `server.registerTool(name, { title, description, inputSchema: <zod raw shape> }, handler)` (MCP TypeScript SDK ≥ 1.17). If the SDK in use expects zod v4, switch imports to the version it needs.
   - `@supabase/ssr` cookie API (`getAll`/`setAll`) in `lib/supabase/server.ts` and `middleware.ts`.
6. ✅ MCP smoke test, run against `http://localhost:3000/api/mcp?key=…` over Streamable HTTP with the SDK client:
   - ✅ `tools/list` → **53 tools**, including `get_kitchen_overview`, `get_progress_overview` and `get_app_map`.
   - ✅ `today` → `Today is 2026-11-16 (Asia/Seoul).`
   - ✅ `log_meal` (`pending_confirm`) → `confirm_meal` → `get_daily_summary` → `620 / 1800 kcal eaten (1180 left), 1 meals`. One test meal ("Smoke test: kimchi fried rice") is in the account; delete it from Journal whenever.
   - ✅ no `?key=` → 401.
   - ✅ `get_app_map` lists the four v3 tabs; `get_kitchen_overview` returns the empty-fridge shape; `get_progress_overview` returns `source: "rules"` (no `ANTHROPIC_API_KEY` yet).

## Phase 1 — Core data + MCP ✅ (verify 🧪)
- ✅ Schema: settings, meals, water_logs, expenses, fridge_items, fridge_events, fridge_decor, shopping_items, journal_pages, journal_elements, recipes, goals, reflections, body_photos, notifications, ai_overviews. RLS on all of them (dormant in v3.1: the service role bypasses it, so `lib/services/*` does the scoping), plus a private `photos` storage bucket.
- ✅ Services in `lib/services/*`, shared by the web app and MCP.
- ✅ 53 MCP tools (`docs/MCP_TOOLS.md`) with server instructions (confirm-before-save, local date, no duplicates).
- ✅ Notifications are derived on read (expiry ≤ 2 days, low stock, today's planned meals, budget 80%/100%) and deduped by `dedupe_key`. No cron needed.
- 🧪 Acceptance: every tool in the Inspector returns without error on an empty account and after adding sample data.

## Phase 2 — Web app pages ✅ (polish done 16 Nov 2026; two 🧪 checks left)
| Page | Built | To do |
|---|---|---|
| **Home** `/` | v3: pastel-yellow hero with search (→ Archive), bell (→ Notifications) and avatar (→ Settings); today card (meal-coloured calorie ring + macros → My progress, budget → Budget) with quick actions (Log meal, Scan receipt, Cook, My progress); service grid + **More** sheet; data-driven tip (yellow); pending AI estimates; What have I eaten today?; Up next; discover saved recipes. Water and reminders cards removed | 🧪 check sheet focus/Escape on phone |
| **My Kitchen** `/kitchen` | v3: Fridge card (Stock · To buy · Scan groceries) + Recipes card (Find · Saved · Cook from my fridge) with live counts; What can I cook tonight? (TheMealDB ranked by fridge, expiring first, never blocks the page); Use soon; To buy (tick bought) | — |
| Calendar `/calendar` (Archive) | v3: lives in Archive behind a List / Calendar switch. Month grid with kcal / spend / planned / journal, prev/next/today, day summary with meals (mark eaten), expenses, review | ✅ Month / Week / Day switch (`?view=`). Week = 7 columns with a box per meal slot (dashed when planned, meal-coloured when filled), kcal and spend per day; Day = an hour timeline placing each meal by `eaten_at`, or by its slot when it was never timed. Prev/next step by the view you are in. `weekOverview` in `lib/services/calendar.ts` |
| Recipes `/recipes` | Discover (search, meal type/diet, cuisine, main ingredient, time, difficulty) · My collection (folders) · AI ingredient scanner (typed ingredients + fridge, expiring first) | ✅ `/recipes/edit` (new) and `/recipes/edit?id=` (edit), reachable from Saved → **+ New recipe**, each own-recipe card, and **Edit recipe** on the detail page. `MyRecipeInput` in `lib/schemas.ts`; `createMyRecipeAction` / `updateMyRecipeAction`. TheMealDB recipes stay read-only and say so |
| Recipe detail `/recipes/themealdb/:id` | YouTube video embedded, ingredients with in-fridge/missing, steps, estimated time/difficulty, save, add to meal plan (date + meal), add missing to shopping list, more YouTube videos | ✅ Serving stepper on the ingredients card. `lib/scale.ts` (pure, 11 tests) parses "1 cup", "200g", "1 1/2 tbsp", "½ cup", scales, and prints cooking fractions back (½, 1½, ⅔). Measures it cannot read ("to taste") are left exactly as written. Display only — nothing is saved |
| Food journal `/journal` | day page with meals (photo, place, status, nutrition), confirm/delete, review (title, fullness, mood, text), prev/next day | 🔲 **Phase 4 scrapbook editor** |
| Fridge `/fridge` (My Kitchen) | v3 labels: Stock · To buy. Stock by shelf with expiry/low flags, use 1 / +1 / remove, pending confirm banner, add item; To buy (bought, delete, move bought → fridge) | 🔲 **Phase 4 interactive fridge** |
| Budget `/budget` (Home) | spent / remaining / budget, 4 categories, daily chart, month nav, history, manual entry, receipt scan link | ✅ Weekly / Monthly switch (`?period=`), prev/next by week or month. A week shows seven days' share of the monthly budget, labelled as such. Edit from History → **Edit** (`?expense=`), which fills the side form; `spendSummary` in `lib/services/expenses.ts`, `updateExpenseAction` |
| My progress `/progress` (Home) | v3: **AI progress overview** (week/month, cached daily, refresh) + averages, 30-day chart, goals. Reflections and body photo journal removed | 🧪 verify with and without `ANTHROPIC_API_KEY` |
| ~~Health insights~~ `/insights` | cut in v3: redirects to `/progress` (patterns from your own logs now live in the AI overview) | — |
| Notifications `/notifications` (Home bell) | expiry / low stock / meal plan / budget, filters, open, dismiss, mark all read. `/messages` redirects here | — |
| Archive `/archive` | v3: List / Calendar switch. Search + type + date filters; links to original records | ✅ "Browse by month" side panel, grouped by year with a record count per month, filtering the list to that month (and a clear link). Only months that actually hold records appear. `archiveMonths` in `lib/services/archive.ts` |
| Settings `/more` | reached from the avatar / sidebar Account section; link to Notifications; settings (time zone, goals, budget). Sign out removed in v3.1 | — |
| AI camera `/snap` | 6 modes, context-aware order. **Live camera** (`CameraCapture.tsx`: getUserMedia preview, shutter, flip, fallbacks) or upload → Supabase Storage → `/api/scan` → editable per-item draft (portion, grams, kcal, P/C/F, ingredients, live totals) → confirm → shared records | 🔲 in-app analysis needs a vision key (`lib/vision/`, provider-swappable). Without one the photo is not analysed here: send it in the Claude app and say "log this meal in DailyBite" — Claude writes it through MCP as `pending_confirm` and Home shows it under *Check these AI estimates*, editable at `/journal?meal=<id>&edit=1` |
- ✅ Live sync: `components/LiveSync.tsx` re-renders every 10 s while the tab is visible, on tab focus, and at local midnight. (Realtime push needs an authenticated browser client; v3.1 has none, so this polls instead.)
- ✅ PWA manifest + icons: "Add to Home Screen" on iPhone/Android puts DailyBite on the phone like an app.

## Phase 3 — Deploy (makes it live everywhere) ✅ 17 Nov 2026

**Live: https://dailybite-ten.vercel.app** · repo: **github.com/nathjocelyn06/dailybite** (private)

1. ✅ Pushed to GitHub, imported into Vercel (project `dailybite`, Next.js auto-detected, Node 26.x).
2. ✅ Env vars in Vercel: `DAILYBITE_SUPABASE_URL`, `DAILYBITE_SUPABASE_SERVICE_KEY`, `OWNER_USER_ID`, `MCP_ACCESS_KEY`, `APP_URL`, `DEFAULT_TIMEZONE`, `MEALDB_API_KEY`. Optional AI/YouTube keys still unset.
   - 🐛 **The trap that cost an hour:** a Supabase connection added through Vercel provisions its *own* Supabase project and injects `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` at deploy time, overwriting whatever you set in the dashboard. Every page 500s with "Could not find the table 'public.settings' in the schema cache" while `/api/mcp` still answers. Fix: `supabaseTarget()` reads `DAILYBITE_*` first (`lib/supabase/admin.ts`).
   - Vercel Authentication is **on by default** for new projects and blocks the MCP connector as well as the browser. Turned off (`ssoProtection: null`).
3. ✅ No Supabase Auth URL config needed (no sign-in since v3.1). **The deployed app is open** — anyone with the URL can read and edit. Re-enable Vercel Authentication if that stops being acceptable, knowing it also blocks Claude.
4. 🔲 Phone: open the URL in Safari/Chrome → Share → Add to Home Screen.
5. 🧪 Acceptance: 13 routes return 200; the live MCP server lists 53 tools and `today` / `get_daily_summary` / `get_kitchen_overview` all answer from the migrated project. Still to try: log a meal in Claude mobile and watch it appear on the laptop.

Claude connectors now point at `https://dailybite-ten.vercel.app/api/mcp?key=…` — the laptop dev server is no longer needed for Claude to work.

## Phase 4 — Signature interactions 🔲
- **Interactive fridge** (`/fridge`): port `design/wireframes/D06-Fridge.dc.html` (desktop) and `M05-Fridge.dc.html` (phone) into `components/fridge/Fridge.tsx`.
  - The door is closed in decorate mode: drag stickers, photos, post-its, badges and magnets, edit text/colour/tilt, add from the tray, pick the fridge colour.
  - The handles swing the freezer and fridge doors open (CSS 3D `rotateY`) to show shelves: freezer, dairy & eggs, proteins, crisper drawers. Pantry sits beside the fridge.
  - Tap an item for use / restock / edit / remove. A status magnet on the door shows use-soon and low-stock counts.
  - Persist with `saveDecorAction` (debounce 600 ms after drag end) and `settings.fridge_color`. The wireframe's pointer-drag code (`down/move/up` with `getBoundingClientRect` scaling) can be reused almost directly.
- **Scrapbook journal editor** (`/journal`): port `D05-Journal.dc.html`. Elements live in `journal_elements` (x as % of width, y in px, w %, rot, z).
  - Toolbar: Select, Photo, Sticker, Doodle (store SVG path in `data.path`), Tape, Text, Mood, Layout.
  - Photo flow: camera/gallery → crop → link to a meal → place on the page.
  - Drag/resize/rotate with pointer events, saved via `updateElementAction`.
  - Mood and habit stickers count toward Progress habits.
  - A week-plan page kind (`journal_pages.kind = 'week_plan'`).

## Phase 5 — Later (cut from v3, keep out unless asked) 🔲
- Body photo journal (tables + services still exist; UI removed; never exposed via MCP).
- Health articles / workout videos (`/insights` currently redirects to `/progress`).
- Water tracking (table + service kept; UI and `add_water` removed).
- Supermarket price comparison: only prices with a source and last-updated date.

## Phase 6 — Optional: MCP Apps widgets 🔲
Show the dashboard / fridge / meal-confirm as interactive widgets inside Claude. Use the official MCP Apps extension (`@modelcontextprotocol/ext-apps`): register `ui://nutrigo/<name>.html` resources and point tools at them via `_meta.ui.resourceUri`. Follow that package's current quickstart; don't guess the API. Keep every tool's text result as the fallback, because not every Claude surface renders widgets (test on the phone app). Until then, each tool result already includes an "Open in DailyBite" link.

## Requirement 6 — daily date change checklist 🧪
- [ ] Dashboard shows the device's local date (Settings time zone) and greets by local time.
- [ ] At local midnight an open dashboard refreshes to the new day with 0 kcal eaten and ₩0 spent (LiveSync checks every 30 s).
- [ ] Planned meals for the new day show as planned and don't count until marked eaten.
- [ ] Previous days stay browsable (journal ‹ ›, calendar) and editable.
- [ ] Every record has a UUID, a `date` and a `created_at`/`updated_at` timestamp.
- [ ] Editing a meal updates Dashboard, Journal, Calendar and Progress (same row).
- [ ] Data survives refresh, a restart and another device.
- [ ] MCP `today` and `get_daily_summary` agree with the web app.
