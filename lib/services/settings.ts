import "server-only";
import { type Db, must, clean } from "./db";
import { DEFAULT_TZ } from "../env";

export type Settings = {
  user_id: string;
  timezone: string;
  kcal_goal: number;
  protein_goal_g: number;
  carbs_goal_g: number;
  fat_goal_g: number;
  water_goal: number;
  monthly_budget: number;
  currency: string;
  fridge_color: string;
  show_insights: boolean;
  personalize_insights: boolean;
};

/**
 * Returns the user's settings, creating the default row the first time.
 *
 * A page loads several services at once (Home alone calls this through the daily
 * summary and the expense summary), so on a brand-new account two of them can find
 * no row and both try to insert it. The loser used to blow up with
 * "duplicate key value violates unique constraint settings_pkey" and take the whole
 * page down. Insert-or-ignore, then read back whoever won.
 */
export async function getSettings(db: Db): Promise<Settings> {
  const found = must(await db.sb.from("settings").select("*").eq("user_id", db.userId).maybeSingle<Settings>(), "load settings");
  if (found) return normalise(found);

  const { data, error } = await db.sb
    .from("settings")
    .upsert({ user_id: db.userId, timezone: DEFAULT_TZ }, { onConflict: "user_id", ignoreDuplicates: true })
    .select("*")
    .maybeSingle<Settings>();
  if (data) return normalise(data);

  const existing = must(await db.sb.from("settings").select("*").eq("user_id", db.userId).maybeSingle<Settings>(), "load settings");
  if (existing) return normalise(existing);
  throw new Error(`create settings failed: ${error?.message ?? "no row returned"}`);
}

export async function updateSettings(db: Db, patch: Partial<Omit<Settings, "user_id">>): Promise<Settings> {
  await getSettings(db);
  const row = must(
    await db.sb.from("settings").update(clean(patch)).eq("user_id", db.userId).select("*").single<Settings>(),
    "update settings"
  );
  return normalise(row as Settings);
}

function normalise(s: Settings): Settings {
  return { ...s, monthly_budget: Number(s.monthly_budget) };
}
