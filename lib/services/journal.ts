import "server-only";
import { type Db, must, clean } from "./db";
import { dayKey } from "../dates";
import { listMeals, type Meal } from "./meals";
import type { ElementInputT } from "../schemas";

export type JournalPage = {
  id: string;
  date: string;
  kind: "day" | "week_plan";
  title: string | null;
  review: string | null;
  mood: string | null;
  fullness: string | null;
  layout: string;
};

export type JournalElement = ElementInputT & { id: string; page_id: string };

const PAGE_COLS = "id,date,kind,title,review,mood,fullness,layout";
const EL_COLS = "id,page_id,kind,x,y,w,h,rot,z,text,data,meal_id,photo_path";

/** Read a day page without creating it. Meals of that day are always included. */
export async function getJournalDay(
  db: Db,
  date?: string
): Promise<{ date: string; page: JournalPage | null; elements: JournalElement[]; meals: Meal[] }> {
  const d = date ?? dayKey(new Date(), db.tz);
  const [page, meals] = await Promise.all([
    db.sb.from("journal_pages").select(PAGE_COLS).eq("user_id", db.userId).eq("date", d).eq("kind", "day").maybeSingle(),
    listMeals(db, { from: d })
  ]);
  const p = must(page, "load page") as JournalPage | null;
  const elements = p
    ? (must(
        await db.sb.from("journal_elements").select(EL_COLS).eq("user_id", db.userId).eq("page_id", p.id).order("z"),
        "load elements"
      ) as JournalElement[])
    : [];
  return { date: d, page: p, elements, meals };
}

export async function ensurePage(db: Db, date?: string, kind: JournalPage["kind"] = "day"): Promise<JournalPage> {
  const d = date ?? dayKey(new Date(), db.tz);
  return must(
    await db.sb
      .from("journal_pages")
      .upsert({ user_id: db.userId, date: d, kind }, { onConflict: "user_id,date,kind", ignoreDuplicates: false })
      .select(PAGE_COLS)
      .single(),
    "ensure page"
  ) as JournalPage;
}

export async function writeReview(
  db: Db,
  input: { date?: string; title?: string; review?: string; mood?: string; fullness?: string; layout?: string }
): Promise<JournalPage> {
  const page = await ensurePage(db, input.date);
  const { date: _d, ...rest } = input;
  return must(
    await db.sb.from("journal_pages").update(clean(rest)).eq("user_id", db.userId).eq("id", page.id).select(PAGE_COLS).single(),
    "write review"
  ) as JournalPage;
}

export async function addElement(db: Db, date: string | undefined, el: ElementInputT): Promise<JournalElement> {
  const page = await ensurePage(db, date);
  return must(
    await db.sb
      .from("journal_elements")
      .insert({ ...clean(el), page_id: page.id, user_id: db.userId })
      .select(EL_COLS)
      .single(),
    "add element"
  ) as JournalElement;
}

export async function updateElement(db: Db, id: string, patch: Partial<ElementInputT>): Promise<JournalElement> {
  return must(
    await db.sb.from("journal_elements").update(clean(patch)).eq("user_id", db.userId).eq("id", id).select(EL_COLS).single(),
    "update element"
  ) as JournalElement;
}

export async function deleteElement(db: Db, id: string): Promise<void> {
  must(await db.sb.from("journal_elements").delete().eq("user_id", db.userId).eq("id", id), "delete element");
}
