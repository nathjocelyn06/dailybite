# DailyBite — instructions for Claude Code

DailyBite is a personal food journal + wellness app. One Next.js app gives you:
1. **A live web app** (desktop sidebar + phone layout, installable as a PWA) at `APP_URL`.
2. **A remote MCP server** at `/api/mcp` so Claude (web, desktop, mobile) can read and edit the same data.
3. **Supabase** as the single source of truth (Postgres + Storage).

The app has **no sign-in** (v3.1): opening it plays a logo opening and lands on Home. It is a single-user app and every request acts as `OWNER_USER_ID`.

Read `docs/PLAN.md` first. It lists the phases, what is already built, and the acceptance checks.

## Commands
```
npm install
npm run dev          # http://localhost:3000
npm run typecheck    # tsc --noEmit
npm test             # vitest (pure logic in lib/)
npm run build        # next build
npm run check        # all three; must pass before you say a phase is done
npm run inspect      # MCP Inspector → connect to http://localhost:3000/api/mcp?key=...
```
**Stop `npm run dev` before `npm run build` / `npm run check`.** They share `.next`, so a build under a running dev server leaves it serving 500s with `Cannot find module './123.js'`. Restart `npm run dev` afterwards.

## Architecture (do not break these rules)
- **All data access goes through `lib/services/*`.** Pages, server actions (`app/(app)/actions.ts`) and MCP tools (`lib/mcp/tools.ts`) are thin wrappers. Never query Supabase directly from a page or tool.
- Every service takes a `Db` (`lib/services/db.ts`): `webDb()` for the web app, `ownerDb()` for MCP. Since v3.1 **both are the same thing** — the service-role client scoped to `OWNER_USER_ID`. **Every query must `.eq("user_id", db.userId)` and every insert must set `user_id: db.userId`**: the service-role client bypasses RLS, so that filter is now the *only* thing keeping the data to one user. Keep the two names so a signed-in mode can return without touching every call site.
- **No auth, no browser Supabase client.** There is no `/login`, no `/auth/callback`, no `middleware.ts` and no `lib/supabase/client.ts`. The browser never talks to Supabase: reads happen in server components, writes in server actions (`app/(app)/actions.ts`), photo uploads through `uploadScanPhotoAction`. Do not reintroduce a browser client or a sign-in screen unless asked — and if you do, restore the RLS path with it.
- The logo opening is the `.splash` block in `app/(app)/layout.tsx` plus `.splash*` rules in `app/globals.css`. Pure CSS: `pointer-events: none` from the first frame and it ends on `visibility: hidden`, so it can never trap the page. Keep it that way; no JS timers, no focus traps.
- **"Today" = `dayKey(new Date(), db.tz)`** (`lib/dates.ts`). Never use `new Date().toISOString().slice(0,10)` (that's UTC). Days are `date` columns (`YYYY-MM-DD`).
- **Meal status:** `planned` → `pending_confirm` (AI estimate) → `eaten`. Only `eaten` counts toward calories (`sumEaten`). AI results are never saved as eaten until the user confirms.
- **Shared records, no copies.** Calendar, Archive, Home and My progress read the same `meals` / `expenses` / `fridge_items` / `journal_*` rows. Archive results link to the original record.
- Receipts and photo scans create **pending** fridge items. The user confirms them (`confirm_fridge_items`, or the "Confirm all" banner).
- Zod input shapes live in `lib/schemas.ts` and are shared by MCP tools and server actions. Add fields there first.
- **Which Supabase project we talk to**: `supabaseTarget()` in `lib/supabase/admin.ts` reads `DAILYBITE_SUPABASE_URL` / `DAILYBITE_SUPABASE_SERVICE_KEY` first and only then the standard names. Vercel's Supabase storage connection overwrites `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` at deploy time with a project it provisioned itself — empty, so every page 500s with "Could not find the table … in the schema cache". The `DAILYBITE_*` pair is set in Vercel and pins production to the migrated project. Don't "simplify" it away.
- Secrets: `SUPABASE_SERVICE_ROLE_KEY`, `MCP_ACCESS_KEY`, `ANTHROPIC_API_KEY`, `YOUTUBE_API_KEY` are server-only. Never import `lib/supabase/admin.ts` or `lib/services/*` from a `"use client"` file (they import `server-only`, so the build fails if you do).
- Body photos are private: never expose them through MCP, never show them on Dashboard.
- Health text is general education. Show sources. Never present AI output as medical advice. No body-shaming language, no appearance scores.

## UI conventions
- Design tokens are CSS variables in `app/globals.css`: the **Chroma palette** (paper `#EDEDEB`, ink `#231F1C`, grid `#C9C9C6`; vermilion, signal red, amber, sun, coral rose, blush; lilac, periwinkle, cobalt, deep ocean, emerald). Use the variables, don't hard-code new colours. Bright hues (amber, sun, blush, lilac) are fills only, never text on light backgrounds. Meal colours: `--meal-breakfast|lunch|dinner|snack`. Service tiles: `.tone-*` classes from `SERVICES[].tone`.
- **Four destinations only**, defined once in `lib/nav.ts`: **Home** (`/`, plus My progress `/progress`, Budget `/budget`, Notifications `/notifications`), **My Kitchen** (`/kitchen`: Fridge `/fridge` with Stock · To buy, and Recipes `/recipes` with Find · Saved · Cook from my fridge — nothing else), **Journal** (`/journal`), **Archive** (`/archive` list + `/calendar`). Settings is behind the avatar. Do not add a fifth tab, a "More" tab, or budget/calendar back into My Kitchen; add new features to `SERVICES` under their parent so they show up in the Home "More" sheet, My Kitchen and `get_app_map`.
- Cut for now (don't re-add unless asked): health articles/workouts, water tracking, body photo journal UI, reflection notes on Progress.
- My progress opens with the **AI overview** (`lib/services/overview.ts`). The model only sees the fact sheet from `buildFacts` (never photos or body data), replies as JSON, and links are whitelisted (`NEXT_LINKS`). Keep the rule-based fallback working without an API key.
- Same four items in the desktop sidebar (icon rail at 861–1100 px) and the phone bottom bar (≤ 860 px). Active tab colour: `--sage-ink` (deep ocean) on `--accent-soft` (cobalt tint).
- Icons: `components/NavIcon.tsx` is the single icon slot (simple stroke SVGs). Keep every icon going through `NavIcon` so swapping the set is a one-file change.
- Global AI camera: the floating button in `components/AppShell.tsx` opens `/snap`, with the mode chosen by the current page (fridge → ingredient scan, budget → receipt, recipes → recipe finder, journal → journal).
- Wireframes for every screen are in `design/wireframes/*.dc.html` (open in a browser). Match their layout and hierarchy. Home = `D01-Dashboard` / `M01-Home` (Gojek-style), My Kitchen = `D00-Kitchen` / `M07-Kitchen`, My progress = `D08-Progress`, Archive = `D09-Archive` + `D02-Calendar` / `M08` + `M06`, Notifications = `D11-Notifications`.
- Accessibility: real `<button>`/`<a>`/`<label>`, touch targets ≥ 44px, text contrast ≥ 4.5:1, inline validation messages on forms.

## Definition of done (every task)
1. `npm run check` passes.
2. Manually verify the feature in the browser at desktop width and at 390px wide.
3. If you touched data: verify the same change shows on the other device/tab within ~10 s (`LiveSync` polls; Realtime needs a session, which the app no longer has) and through the matching MCP tool.
4. Update `docs/PLAN.md` checkboxes, `docs/MCP_TOOLS.md` if tools changed, and add a line to `CHANGELOG.md`.
