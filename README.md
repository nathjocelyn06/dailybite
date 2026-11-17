# DailyBite

_Formerly Nutrigo. See `CHANGELOG.md` for what changed._

Food journal, digital fridge, recipes and food budget in one live app, with an MCP server so Claude can use it too.

- **Web app** (Next.js): works on desktop and phone (installable PWA), live-synced across devices.
- **Data**: Supabase (Postgres, Storage for photos). **No sign-in**: the app opens straight on Home after a logo opening and acts as one owner (`OWNER_USER_ID`). All data access is server-side with the service-role key.
- **MCP server**: `/api/mcp`, 53 tools. Add it to claude.ai as a custom connector to use it in Claude web, desktop and mobile.
- **Recipes**: TheMealDB (free, includes YouTube videos) + optional YouTube Data API for more videos.
- **AI camera**: optional Claude vision via the Anthropic API for calorie, receipt and ingredient scans. The user always confirms before anything is saved.

## Quick start

```bash
npm install
cp .env.example .env.local     # fill it in (below)
npm run dev                    # http://localhost:3000
npm run check                  # typecheck + tests + build
```

### 1. Supabase
1. Create a project at supabase.com.
2. SQL Editor → paste and run `supabase/migrations/0001_init.sql`, then `0002_v3_ai_overviews.sql`.
3. Project Settings → API: copy the URL, anon key and service role key into `.env.local`.
4. Project Settings → API keys: copy the **secret** key into `SUPABASE_SERVICE_ROLE_KEY`. The app cannot read anything without it.
5. Create the one owner user (Authentication → Users → Add user → *Auto confirm*), then copy its id into `OWNER_USER_ID` and set `OWNER_EMAIL` to the same address. Nobody ever signs in as it; the rows just need an owner, because every table's `user_id` points at `auth.users`. Leave new sign-ups off.
6. There is no login screen, so **anyone who can open the URL can read and edit the data.** Keep it on localhost, or put the deployment behind something (Vercel password protection, an allowlist, or bring the sign-in back) before sharing the link.

### 2. MCP access key
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Put it in `MCP_ACCESS_KEY`. Treat the connector URL like a password.

### 3. Optional keys
- `ANTHROPIC_API_KEY` (+ `ANTHROPIC_MODEL`): AI scans on `/snap` and the **AI progress overview** on My progress. Without it, scans open an editable empty form and the overview uses a rule-based summary.
- `YOUTUBE_API_KEY`: "More videos" on recipe pages. Without it, you get TheMealDB's video and a "Search on YouTube" link.

### 4. Connect Claude
- **Local, during development** (Claude Desktop, `claude_desktop_config.json`):
  ```json
  { "mcpServers": { "dailybite": { "command": "npx", "args": ["-y", "mcp-remote@0.16.6", "http://localhost:3000/api/mcp?key=YOUR_KEY"] } } }
  ```
  **Edit the config the app actually reads.** `claude_desktop_config.json` lives in more than one place and older copies are ignored, so the server never appears and nothing explains why. Use **Settings → Developer → Local MCP servers → Edit config** rather than guessing a path. On this machine the live one is:
  ```
  %LOCALAPPDATA%\Claude-Data\claude_<id>\claude_desktop_config.json      <- read
  %APPDATA%\Claude\claude_desktop_config.json                            <- ignored
  ```

  Absolute paths are optional but steadier than a bare `npx`, which has to resolve on PATH and may re-download the bridge at every launch:
  ```bash
  npm install -g mcp-remote@0.16.6
  ```
  ```json
  { "mcpServers": { "dailybite": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": ["C:\\Users\\<you>\\AppData\\Roaming\\npm\\node_modules\\mcp-remote\\dist\\proxy.js",
               "http://localhost:3000/api/mcp?key=YOUR_KEY"] } } }
  ```
  Restart Claude Desktop after editing, and start the dev server **before** Claude — connectors only dial at launch, and the URL points at localhost, so the server shows as failed whenever it is down. `Start DailyBite.cmd` in the parent folder runs it outside Claude, so an app restart does not kill it.
- **Live (web + desktop + phone)**: deploy to Vercel, then claude.ai → Settings → Connectors → Add custom connector →
  `https://YOUR-APP.vercel.app/api/mcp?key=YOUR_KEY`.
- Test anytime with `npm run inspect` (Streamable HTTP, same URL).

### 5. Phone
Open your deployed URL in Safari/Chrome → Share → **Add to Home Screen**.

## Project map
```
app/
  (app)/            the app. 4 tabs: / (Home), /kitchen (My Kitchen), /journal, /archive. Logo opening in layout.tsx
                    Under Home: /progress (AI overview), /budget, /notifications. Under My Kitchen: /fridge, /recipes.
                    Under Archive: /calendar. Settings: /more. /snap = AI camera. /messages, /insights redirect
  (app)/actions.ts  server actions → lib/services
  api/[transport]/  MCP endpoint (/api/mcp)
  api/recipes       TheMealDB search with filters
  api/videos        YouTube search
  api/scan          AI photo → editable draft
components/         AppShell (4-tab sidebar + bottom bar + AI camera), Services (service grid + More sheet), NavIcon, LiveSync, …
lib/
  services/         ALL data access (shared by web + MCP), incl. kitchen.ts (My Kitchen) and overview.ts (AI progress overview)
  mcp/tools.ts      MCP tool definitions
  schemas.ts        zod input shapes
  dates.ts totals.ts mealdb.ts youtube.ts nav.ts (tabs, services, breadcrumbs) overview-facts.ts (pure overview logic)
supabase/migrations/0001_init.sql, 0002_v3_ai_overviews.sql
design/wireframes/  every screen as an HTML wireframe (open in a browser)
docs/PLAN.md        phases, status, acceptance checks
docs/MCP_TOOLS.md   tool reference
tests/              vitest unit tests
CLAUDE.md           rules for Claude Code
```
