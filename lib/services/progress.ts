import "server-only";
import { type Db, must, clean } from "./db";
import { addDays, dayKey } from "../dates";
import { round1, sumEaten } from "../totals";
import { listMeals } from "./meals";
import { getSettings } from "./settings";

export async function nutritionTrends(db: Db, days = 30) {
  const today = dayKey(new Date(), db.tz);
  const from = addDays(today, -(days - 1));
  const [meals, s] = await Promise.all([listMeals(db, { from, to: today, status: "eaten" }), getSettings(db)]);
  const series = Array.from({ length: days }, (_, i) => {
    const date = addDays(from, i);
    const t = sumEaten(meals.filter((m) => m.date === date));
    return { date, ...t };
  });
  const logged = series.filter((d) => d.meals > 0);
  const avg = (k: "kcal" | "protein_g" | "carbs_g" | "fat_g") =>
    logged.length ? round1(logged.reduce((a, d) => a + d[k], 0) / logged.length) : 0;
  let streak = 0;
  for (let i = series.length - 1; i >= 0 && series[i].meals > 0; i--) streak++;
  return {
    from,
    to: today,
    days_logged: logged.length,
    streak,
    averages: { kcal: avg("kcal"), protein_g: avg("protein_g"), carbs_g: avg("carbs_g"), fat_g: avg("fat_g") },
    goal_hit_rate: {
      protein: logged.length ? round1((logged.filter((d) => d.protein_g >= s.protein_goal_g).length / logged.length) * 100) : 0
    },
    series
  };
}

export type Goal = { id: string; title: string; target: number | null; progress: number; unit: string | null; period: string; active: boolean };

export async function listGoals(db: Db): Promise<Goal[]> {
  return must(
    await db.sb.from("goals").select("id,title,target,progress,unit,period,active").eq("user_id", db.userId).order("created_at"),
    "list goals"
  ) as Goal[];
}

export async function upsertGoal(db: Db, g: Partial<Goal> & { title?: string }): Promise<Goal> {
  if (g.id) {
    const { id, ...rest } = g;
    return must(
      await db.sb.from("goals").update(clean(rest)).eq("user_id", db.userId).eq("id", id).select("*").single(),
      "update goal"
    ) as Goal;
  }
  if (!g.title) throw new Error("Goal needs a title");
  return must(await db.sb.from("goals").insert({ ...clean(g), user_id: db.userId }).select("*").single(), "add goal") as Goal;
}

export async function addReflection(db: Db, text: string, date?: string) {
  return must(
    await db.sb
      .from("reflections")
      .insert({ user_id: db.userId, text, date: date ?? dayKey(new Date(), db.tz) })
      .select("id,date,text")
      .single(),
    "add reflection"
  ) as { id: string; date: string; text: string };
}

export async function listReflections(db: Db, limit = 20) {
  return must(
    await db.sb.from("reflections").select("id,date,text").eq("user_id", db.userId).order("date", { ascending: false }).limit(limit),
    "list reflections"
  ) as { id: string; date: string; text: string }[];
}

// Body photo journal: private, never exposed through MCP (photos stay in the web app).
export async function listBodyPhotos(db: Db) {
  return must(
    await db.sb.from("body_photos").select("id,date,photo_path,note,ai_comparison").eq("user_id", db.userId).order("date"),
    "list body photos"
  ) as { id: string; date: string; photo_path: string; note: string | null; ai_comparison: string | null }[];
}

export async function addBodyPhoto(db: Db, photo_path: string, date?: string, note?: string) {
  must(
    await db.sb.from("body_photos").insert({ user_id: db.userId, photo_path, note: note ?? null, date: date ?? dayKey(new Date(), db.tz) }),
    "add body photo"
  );
}

export async function deleteBodyPhoto(db: Db, id: string) {
  const row = must(
    await db.sb.from("body_photos").delete().eq("user_id", db.userId).eq("id", id).select("photo_path").single(),
    "delete body photo"
  ) as { photo_path: string };
  await db.sb.storage.from("photos").remove([row.photo_path]);
}

export type HabitCount = { kind: "mood" | "habit"; label: string; count: number; lastOn: string };

/**
 * Mood stamps and habit stickers from the scrapbook pages, counted over a window.
 *
 * The journal is where these are recorded, so Progress reads them rather than keeping a
 * second tally that could drift. Elements hang off `journal_pages`, so the date filter
 * goes through that join.
 */
export async function habitCounts(db: Db, days = 30): Promise<HabitCount[]> {
  const today = dayKey(new Date(), db.tz);
  const from = addDays(today, -days + 1);
  const rows = must(
    await db.sb
      .from("journal_elements")
      .select("kind,text,journal_pages!inner(date)")
      .eq("user_id", db.userId)
      .in("kind", ["mood", "habit"])
      .gte("journal_pages.date", from)
      .lte("journal_pages.date", today),
    "habit counts"
  ) as { kind: "mood" | "habit"; text: string | null; journal_pages: { date: string } | { date: string }[] }[];

  const tally = new Map<string, HabitCount>();
  for (const r of rows) {
    const label = (r.text ?? "").trim();
    if (!label) continue;
    const page = Array.isArray(r.journal_pages) ? r.journal_pages[0] : r.journal_pages;
    const date = page?.date ?? from;
    const key = `${r.kind}:${label}`;
    const cur = tally.get(key);
    if (cur) {
      cur.count += 1;
      if (date > cur.lastOn) cur.lastOn = date;
    } else {
      tally.set(key, { kind: r.kind, label, count: 1, lastOn: date });
    }
  }
  return [...tally.values()].sort((a, b) => b.count - a.count);
}
