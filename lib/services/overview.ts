import "server-only";
import { type Db, must } from "./db";
import { addDays, dayKey } from "../dates";
import { optionalEnv } from "../env";
import { listMeals } from "./meals";
import { listExpenses } from "./expenses";
import { listFridge } from "./fridge";
import { getSettings } from "./settings";
import { PERIOD_DAYS, basisLine, buildFacts, fallbackOverview, parseOverview, type Facts, type Overview, type Period } from "../overview-facts";

/**
 * AI progress overview for My progress (web /progress) and MCP get_progress_overview.
 * 1. Collect the user's own records for the last 7 or 30 days (meals, journal moods, food spend, use-soon items).
 * 2. Reduce them to a small fact sheet (lib/overview-facts.ts). Photos and body data are never included.
 * 3. Ask Claude to write a short, kind overview as JSON. No key or an API error → rule-based fallback.
 * 4. Cache one overview per period per local day in `ai_overviews`. "Refresh overview" forces a new one.
 */
export type ProgressOverview = Overview & { period: Period; source: "ai" | "rules"; basis: string; generated_at: string; facts: Facts };

const SYSTEM = `You write a short progress overview for a personal food journal app called DailyBite.
Use ONLY the facts given. Never invent numbers. Be warm, specific and brief, like a friend who looked at the log.
Rules: no medical advice or diagnoses; never mention body weight, body shape, appearance or scores;
no moralising words like "bad", "cheat" or "guilty"; British or American spelling is fine.
Reply with ONLY one JSON object:
{"headline": string (max 8 words),
 "summary": string (2-3 sentences, mention real numbers from the facts),
 "wins": string[] (1-3 short items, things going well),
 "noticed": string[] (1-3 short neutral observations, patterns worth knowing),
 "next": {"text": string (one concrete, doable step for the next few days), "link": "kitchen"|"cook"|"to_buy"|"journal"|"budget"|"calendar"|"camera"}}`;

export async function collectFacts(db: Db, period: Period): Promise<Facts> {
  const to = dayKey(new Date(), db.tz);
  const from = addDays(to, -(PERIOD_DAYS[period] - 1));
  const [settings, meals, expenses, stock, pages] = await Promise.all([
    getSettings(db),
    listMeals(db, { from, to, status: "eaten" }),
    listExpenses(db, { from, to }),
    listFridge(db),
    db.sb.from("journal_pages").select("date,mood,review").eq("user_id", db.userId).gte("date", from).lte("date", to)
      .then((r) => must(r, "journal pages for overview") as { date: string; mood: string | null; review: string | null }[])
  ]);
  return buildFacts({
    period,
    to,
    goals: { kcal: settings.kcal_goal, protein_g: settings.protein_goal_g },
    meals: meals.map((m) => ({ date: m.date, slot: m.slot, kcal: m.kcal, protein_g: m.protein_g, eaten_at: m.eaten_at, recipe_id: m.recipe_id, place: m.place })),
    pages: pages.map((p) => ({ date: p.date, mood: p.mood, has_review: !!p.review?.trim() })),
    spent: expenses.reduce((a, e) => a + Number(e.amount || 0), 0),
    budget: period === "week" ? Math.round((settings.monthly_budget * 7) / 30) : settings.monthly_budget,
    currency: settings.currency,
    use_soon: stock.filter((s) => s.expiry === "use_soon").map((s) => s.name)
  });
}

async function askClaude(facts: Facts): Promise<Overview | null> {
  const key = optionalEnv("ANTHROPIC_API_KEY");
  if (!key || facts.meals_logged === 0) return null;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: optionalEnv("ANTHROPIC_MODEL") ?? "claude-sonnet-5-5",
      max_tokens: 700,
      system: SYSTEM,
      messages: [{ role: "user", content: `Facts for the ${facts.period === "week" ? "last 7 days" : "last 30 days"}:\n${JSON.stringify(facts)}` }]
    })
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  return parseOverview(data.content?.find((c) => c.type === "text")?.text ?? "");
}

export async function getProgressOverview(db: Db, period: Period = "week", opts: { refresh?: boolean } = {}): Promise<ProgressOverview> {
  const today = dayKey(new Date(), db.tz);
  if (!opts.refresh) {
    const cached = await db.sb.from("ai_overviews").select("content,source,basis,facts,updated_at")
      .eq("user_id", db.userId).eq("period", period).eq("for_date", today).maybeSingle();
    if (cached.data) {
      const c = cached.data as { content: Overview; source: "ai" | "rules"; basis: string; facts: Facts; updated_at: string };
      return { ...c.content, period, source: c.source, basis: c.basis, facts: c.facts, generated_at: c.updated_at };
    }
  }
  const facts = await collectFacts(db, period);
  let content: Overview | null = null;
  let source: "ai" | "rules" = "ai";
  try { content = await askClaude(facts); } catch { content = null; }
  if (!content) { content = fallbackOverview(facts); source = "rules"; }
  const basis = basisLine(facts);
  const row = { user_id: db.userId, period, for_date: today, content, source, basis, facts };
  const saved = await db.sb.from("ai_overviews").upsert(row, { onConflict: "user_id,period,for_date" }).select("updated_at").single();
  const generated_at = (saved.data as { updated_at?: string } | null)?.updated_at ?? new Date().toISOString();
  return { ...content, period, source, basis, facts, generated_at };
}
