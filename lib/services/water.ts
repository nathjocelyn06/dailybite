import "server-only";
import { type Db, must } from "./db";
import { dayKey } from "../dates";

export async function getWater(db: Db, date?: string): Promise<number> {
  const d = date ?? dayKey(new Date(), db.tz);
  const row = must(
    await db.sb.from("water_logs").select("glasses").eq("user_id", db.userId).eq("date", d).maybeSingle(),
    "load water"
  ) as { glasses: number } | null;
  return row?.glasses ?? 0;
}

export async function addWater(db: Db, delta: number, date?: string): Promise<number> {
  const d = date ?? dayKey(new Date(), db.tz);
  const next = Math.max(0, (await getWater(db, d)) + delta);
  must(
    await db.sb.from("water_logs").upsert({ user_id: db.userId, date: d, glasses: next }, { onConflict: "user_id,date" }),
    "save water"
  );
  return next;
}
