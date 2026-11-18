import Link from "next/link";
import { webDb } from "@/lib/services/db";
import { CATEGORY_LABEL, getDecor, listFridge, type FridgeItemView } from "@/lib/services/fridge";
import { signedUrls } from "@/lib/services/photos";
import { listShopping } from "@/lib/services/shopping";
import { getSettings } from "@/lib/services/settings";
import { ActionButton } from "@/components/ActionButton";
import { confirmPendingAction, fridgeQtyAction, fridgeRemoveAction, boughtAction, deleteShoppingAction, moveBoughtAction } from "../actions";
import { AddFridgeForm, AddShoppingForm } from "./forms";
import { Fridge } from "@/components/fridge/Fridge";

/**
 * Stock as the interactive fridge (Phase 4, design/wireframes/D06-Fridge): a door you
 * decorate, handles that swing it open, shelves you tap. Plus the To buy list.
 */
export default async function FridgePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "fridge" } = await searchParams;
  const db = await webDb();
  const [stock, pending, shopping, settings, decor] = await Promise.all([
    listFridge(db),
    listFridge(db, { status: ["pending"] }),
    listShopping(db),
    getSettings(db),
    getDecor(db)
  ]);
  const stickerUrls = await signedUrls(db, decor.map((d) => d.photo_path));
  const groups = (Object.keys(CATEGORY_LABEL) as FridgeItemView["category"][])
    .map((c) => ({ c, label: CATEGORY_LABEL[c], items: stock.filter((s) => s.category === c) }))
    .filter((g) => g.items.length);

  return (
    <>
      <header className="head">
        <div className="titles">
          <span className="lbl">Fridge</span>
          <h1 className="h1">{tab === "list" ? "To buy" : "What I have"}</h1>
        </div>
      </header>
      <nav className="tabs" aria-label="Fridge sections">
        <Link href="/fridge" aria-current={tab === "fridge" ? "page" : undefined}>Stock</Link>
        <Link href="/fridge?tab=list" aria-current={tab === "list" ? "page" : undefined}>To buy ({shopping.filter((s) => !s.bought).length})</Link>
      </nav>

      {pending.length > 0 && (
        <section className="card paper" style={{ borderStyle: "dashed" }} aria-label="Waiting for confirmation">
          <div className="head" style={{ marginBottom: 8 }}>
            <span style={{ flex: 1 }}><strong>{pending.length} items</strong> from a scan or receipt are waiting. Check them, then confirm.</span>
            <ActionButton action={confirmPendingAction} args={[undefined]} className="btn pri">Confirm all</ActionButton>
          </div>
          {pending.map((p) => (
            <div className="row" key={p.id}>
              <span style={{ flex: 2 }}>{p.name}</span>
              <span style={{ flex: 1 }}>{p.qty} {p.unit}</span>
              <span style={{ flex: 1 }}>{CATEGORY_LABEL[p.category]}</span>
              <span style={{ flex: 1 }} className="muted">{p.expires_on ? `exp ${p.expires_on}` : "no expiry"}</span>
              <ActionButton action={confirmPendingAction} args={[[p.id]]}>OK</ActionButton>
              <ActionButton action={fridgeRemoveAction} args={[p.id]} label={`Discard ${p.name}`}>×</ActionButton>
            </div>
          ))}
        </section>
      )}

      {tab === "fridge" ? (
        <div className="split">
          <section className="grow" aria-label="Stock" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {stock.length === 0 && <p className="muted">Your fridge is empty. Add items, scan groceries or a receipt — then open the door.</p>}
            <Fridge items={stock} initialDecor={decor} initialColor={settings.fridge_color} initialUrls={stickerUrls} />
          </section>
          <aside className="side-col">
            <section className="card"><h2 className="h2" style={{ marginBottom: 10 }}>Add item</h2><AddFridgeForm /></section>
            <Link className="btn" href="/recipes?tab=scanner">Cook from my fridge</Link>
          </aside>
        </div>
      ) : (
        <div className="split">
          <section className="card grow" aria-label="Shopping list">
            <div className="head" style={{ marginBottom: 6 }}>
              <h2 className="h2" style={{ flex: 1 }}>To buy</h2>
              <span className="muted">Est. {shopping.filter((s) => !s.bought).reduce((a, s) => a + (s.est_price ?? 0), 0).toLocaleString()}</span>
            </div>
            {shopping.length === 0 && <p className="muted">Nothing to buy.</p>}
            {shopping.map((s) => (
              <div className="row" key={s.id}>
                <ActionButton action={boughtAction} args={[s.id, !s.bought]} className="btn sm" label={s.bought ? "Mark not bought" : "Mark bought"}>{s.bought ? "✓" : "○"}</ActionButton>
                <span style={{ flex: 2, textDecoration: s.bought ? "line-through" : "none" }}>{s.name}</span>
                <span style={{ flex: 1 }}>{s.qty} {s.unit}</span>
                <span style={{ flex: 1 }} className="muted">{s.reason}</span>
                <ActionButton action={deleteShoppingAction} args={[s.id]} label={`Delete ${s.name}`}>×</ActionButton>
              </div>
            ))}
            {shopping.some((s) => s.bought) && (
              <div style={{ paddingTop: 12 }}><ActionButton action={moveBoughtAction} args={[]} className="btn pri">Move bought items to fridge</ActionButton></div>
            )}
          </section>
          <aside className="side-col">
            <section className="card"><h2 className="h2" style={{ marginBottom: 10 }}>Add to list</h2><AddShoppingForm /></section>
            <p className="muted">Store price comparison is a later phase. It should only show prices with a source and update date.</p>
          </aside>
        </div>
      )}
    </>
  );
}
