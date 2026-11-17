import "server-only";
import { type Db, must, clean } from "./db";
import { addDays, dayKey } from "../dates";
import { expiryState, isLowStock } from "../totals";
import type { DecorInputT, FridgeItemInputT } from "../schemas";

export type FridgeItem = {
  id: string;
  name: string;
  category: "veg_fruit" | "protein" | "dairy_eggs" | "frozen" | "pantry" | "other";
  qty: number;
  unit: string;
  purchased_on: string | null;
  expires_on: string | null;
  low_at: number;
  status: "pending" | "stocked" | "used_up" | "removed";
  source_expense_id: string | null;
  created_at: string;
};

export type FridgeItemView = FridgeItem & { expiry: ReturnType<typeof expiryState>; low: boolean; days_left: number | null };

const COLS = "id,name,category,qty,unit,purchased_on,expires_on,low_at,status,source_expense_id,created_at";

export const CATEGORY_LABEL: Record<FridgeItem["category"], string> = {
  veg_fruit: "Vegetables & fruits",
  protein: "Proteins",
  dairy_eggs: "Dairy & eggs",
  frozen: "Frozen",
  pantry: "Pantry",
  other: "Other"
};

export async function listFridge(
  db: Db,
  q: { status?: FridgeItem["status"][]; category?: FridgeItem["category"] } = {}
): Promise<FridgeItemView[]> {
  let query = db.sb.from("fridge_items").select(COLS).eq("user_id", db.userId).in("status", q.status ?? ["stocked"]);
  if (q.category) query = query.eq("category", q.category);
  const rows = must(await query.order("expires_on", { ascending: true, nullsFirst: false }), "list fridge") as FridgeItem[];
  const today = dayKey(new Date(), db.tz);
  return rows.map((r) => view(r, today));
}

export function view(r: FridgeItem, today: string): FridgeItemView {
  const qty = Number(r.qty);
  const lowAt = Number(r.low_at);
  const daysLeft = r.expires_on ? Math.round((Date.parse(r.expires_on) - Date.parse(today)) / 86_400_000) : null;
  return { ...r, qty, low_at: lowAt, expiry: expiryState(r.expires_on, today), low: isLowStock(qty, lowAt), days_left: daysLeft };
}

export async function addFridgeItems(
  db: Db,
  items: FridgeItemInputT[],
  opts: { status?: "pending" | "stocked"; source_expense_id?: string } = {}
): Promise<FridgeItem[]> {
  if (!items.length) return [];
  const today = dayKey(new Date(), db.tz);
  const rows = items.map((i) => ({
    user_id: db.userId,
    name: i.name,
    category: i.category ?? "other",
    qty: i.qty ?? 1,
    unit: i.unit ?? "pcs",
    purchased_on: i.purchased_on ?? today,
    expires_on: i.expires_on ?? (i.expires_in_days !== undefined ? addDays(today, i.expires_in_days) : null),
    low_at: i.low_at ?? 1,
    status: opts.status ?? "stocked",
    source_expense_id: opts.source_expense_id ?? null
  }));
  const created = must(await db.sb.from("fridge_items").insert(rows).select(COLS), "add fridge items") as FridgeItem[];
  await logEvents(db, created.map((c) => ({ item_id: c.id, item_name: c.name, kind: "add" as const, delta: Number(c.qty) })));
  return created;
}

/** Approve items waiting from a receipt/ingredient scan. No ids = approve all pending. */
export async function confirmPending(db: Db, ids?: string[]): Promise<FridgeItem[]> {
  let q = db.sb.from("fridge_items").update({ status: "stocked" }).eq("user_id", db.userId).eq("status", "pending");
  if (ids?.length) q = q.in("id", ids);
  const rows = must(await q.select(COLS), "confirm pending") as FridgeItem[];
  await logEvents(db, rows.map((c) => ({ item_id: c.id, item_name: c.name, kind: "confirm" as const, delta: null })));
  return rows;
}

export async function adjustQty(db: Db, id: string, delta: number): Promise<FridgeItem> {
  const cur = must(
    await db.sb.from("fridge_items").select(COLS).eq("user_id", db.userId).eq("id", id).single(),
    "load item"
  ) as FridgeItem;
  const qty = Math.max(0, Number(cur.qty) + delta);
  const status = qty === 0 ? "used_up" : "stocked";
  const row = must(
    await db.sb.from("fridge_items").update({ qty, status }).eq("user_id", db.userId).eq("id", id).select(COLS).single(),
    "update qty"
  ) as FridgeItem;
  await logEvents(db, [{ item_id: id, item_name: cur.name, kind: delta < 0 ? "use" : "restock", delta }]);
  return row;
}

export async function updateFridgeItem(db: Db, id: string, patch: Partial<FridgeItemInputT>): Promise<FridgeItem> {
  const { expires_in_days, ...rest } = patch;
  const p: Record<string, unknown> = clean(rest);
  if (expires_in_days !== undefined) p.expires_on = addDays(dayKey(new Date(), db.tz), expires_in_days);
  const row = must(
    await db.sb.from("fridge_items").update(p).eq("user_id", db.userId).eq("id", id).select(COLS).single(),
    "edit item"
  ) as FridgeItem;
  await logEvents(db, [{ item_id: id, item_name: row.name, kind: "edit", delta: null }]);
  return row;
}

export async function removeFridgeItem(db: Db, id: string): Promise<void> {
  const row = must(
    await db.sb.from("fridge_items").update({ status: "removed" }).eq("user_id", db.userId).eq("id", id).select("name").single(),
    "remove item"
  ) as { name: string };
  await logEvents(db, [{ item_id: id, item_name: row.name, kind: "remove", delta: null }]);
}

async function logEvents(
  db: Db,
  events: { item_id: string; item_name: string; kind: "add" | "confirm" | "use" | "restock" | "edit" | "remove"; delta: number | null }[]
) {
  if (!events.length) return;
  must(await db.sb.from("fridge_events").insert(events.map((e) => ({ ...e, user_id: db.userId }))), "log fridge event");
}

// ---- door decorations ------------------------------------------------------

export type Decor = DecorInputT & { id: string };

export async function getDecor(db: Db): Promise<Decor[]> {
  return must(
    await db.sb.from("fridge_decor").select("id,kind,x,y,rot,z,text,color,photo_path").eq("user_id", db.userId).order("z"),
    "load decor"
  ) as Decor[];
}

/** Replace the whole door layout (simple + avoids partial-update races while dragging). */
export async function saveDecor(db: Db, decor: DecorInputT[]): Promise<Decor[]> {
  must(await db.sb.from("fridge_decor").delete().eq("user_id", db.userId), "clear decor");
  if (!decor.length) return [];
  const rows = decor.map((d, i) => ({ ...clean(d), z: i, user_id: db.userId }));
  return must(await db.sb.from("fridge_decor").insert(rows).select("id,kind,x,y,rot,z,text,color,photo_path"), "save decor") as Decor[];
}
