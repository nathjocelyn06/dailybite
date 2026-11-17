import "server-only";
import { type Db, must } from "./db";
import { addFridgeItems } from "./fridge";
import type { ShoppingItemInputT } from "../schemas";

export type ShoppingItem = {
  id: string;
  name: string;
  qty: number;
  unit: string;
  est_price: number | null;
  reason: string | null;
  recipe_id: string | null;
  bought: boolean;
  bought_at: string | null;
  created_at: string;
};

const COLS = "id,name,qty,unit,est_price,reason,recipe_id,bought,bought_at,created_at";

export async function listShopping(db: Db, includeBought = true): Promise<ShoppingItem[]> {
  let q = db.sb.from("shopping_items").select(COLS).eq("user_id", db.userId);
  if (!includeBought) q = q.eq("bought", false);
  const rows = must(await q.order("bought").order("created_at"), "list shopping") as ShoppingItem[];
  return rows.map((r) => ({ ...r, qty: Number(r.qty), est_price: r.est_price === null ? null : Number(r.est_price) }));
}

export async function addShopping(db: Db, items: ShoppingItemInputT[]): Promise<ShoppingItem[]> {
  if (!items.length) return [];
  // Skip names already on the open list (case-insensitive) to avoid duplicates.
  const open = await listShopping(db, false);
  const have = new Set(open.map((o) => o.name.trim().toLowerCase()));
  const fresh = items.filter((i) => !have.has(i.name.trim().toLowerCase()));
  if (!fresh.length) return [];
  return must(
    await db.sb
      .from("shopping_items")
      .insert(fresh.map((i) => ({ ...i, user_id: db.userId })))
      .select(COLS),
    "add shopping"
  ) as ShoppingItem[];
}

export async function setBought(db: Db, ids: string[], bought: boolean): Promise<void> {
  if (!ids.length) return;
  must(
    await db.sb
      .from("shopping_items")
      .update({ bought, bought_at: bought ? new Date().toISOString() : null })
      .eq("user_id", db.userId)
      .in("id", ids),
    "mark bought"
  );
}

export async function deleteShopping(db: Db, id: string): Promise<void> {
  must(await db.sb.from("shopping_items").delete().eq("user_id", db.userId).eq("id", id), "delete shopping item");
}

/** Bought items become PENDING fridge items (user confirms shelf + expiry), then leave the list. */
export async function moveBoughtToFridge(db: Db): Promise<number> {
  const bought = (await listShopping(db)).filter((i) => i.bought);
  if (!bought.length) return 0;
  await addFridgeItems(
    db,
    bought.map((b) => ({ name: b.name, category: "other", qty: b.qty, unit: b.unit })),
    { status: "pending" }
  );
  must(
    await db.sb.from("shopping_items").delete().eq("user_id", db.userId).in("id", bought.map((b) => b.id)),
    "clear bought"
  );
  return bought.length;
}
