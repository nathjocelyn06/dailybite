# Prompt to give Claude Code

Unzip `dailybite.zip`, open the folder in Claude Code, then paste:

---

This is my DailyBite project : a Next.js + Supabase app with a remote MCP server. Read `CLAUDE.md`, `README.md`, `CHANGELOG.md` and `docs/PLAN.md` before changing anything.

1. Do **Phase 0** of `docs/PLAN.md`: run `npm install` and `npm run check`, and fix every type, test or build error. The code was written without being able to install packages, so library APIs (`mcp-handler`, `@modelcontextprotocol/sdk`, `@supabase/ssr`, zod version) may need small adjustments. Keep the architecture rules in `CLAUDE.md`.
2. Walk me through creating the Supabase project and filling `.env.local` (stop and ask me for keys). Then run the app, help me sign in, and set `OWNER_USER_ID`.
3. Run the MCP smoke test in Phase 0 step 6 with the MCP Inspector and show me the results. There should be **53 tools**; try `get_app_map`, `get_kitchen_overview` and `get_progress_overview`.
4. Check the **v3 navigation, look and AI overview** sections of `docs/PLAN.md`: exactly four tabs (Home, My Kitchen, Journal, Archive); My Kitchen has only Fridge and Recipes; Calendar sits in Archive; Notifications and Settings in the account area; the Chroma colours match the wireframes; My progress shows the AI overview (with and without `ANTHROPIC_API_KEY`). Run migration `0002_v3_ai_overviews.sql`. Check at 1440 px, 1000 px and 390 px wide.
5. Then continue phase by phase (2 → 3 → 4 → 5). After each phase: `npm run check`, check desktop and 390px mobile in the browser, tick the boxes in `docs/PLAN.md`, add a line to `CHANGELOG.md`, and tell me what to test.

Design references for every screen are in `design/wireframes/` (open the `.dc.html` files in a browser). Home follows `D01-Dashboard` / `M01-Home` (Gojek-style home), My Kitchen follows `D00-Kitchen` / `M07-Kitchen`, My progress follows `D08-Progress`, and Archive follows `D09-Archive` + `D02-Calendar` (phone `M08` + `M06`).

---
