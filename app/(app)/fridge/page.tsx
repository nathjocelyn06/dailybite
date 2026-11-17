import Link from "next/link";
import { webDb } from "@/lib/services/db";
import { CATEGORY_LABEL, getDecor, listFridge, type FridgeItemView } from "@/lib/services/fridge";
import { listShopping } from "@/lib/services/shopping";
import { getSettings } from "@/lib/services/settings";
import { ActionButton } from "@/components/ActionButton";
import { confirmPendingAction, fridgeQtyAction, fridgeRemoveAction, boughtAction, deleteShoppingAction, moveBoughtAction } from "../actions";
import { AddFridgeForm, AddShoppingForm } from "./forms";

/**
 * Phase 1: list view of stock + shopping list (fully working).
 * Phase 4 (see docs/PLAN.md): replace the "Stock" section with the interactive decorated fridge
 * from design/wireframes/D06-Fridge.dc.html, using getDecor/saveDecorAction for the door.
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
            <div className="card" style={{ background: settings.fridge_color, borderRadius: 28 }}>
              <p className="muted" style={{ color: "var(--ink-2)" }}>
                Fridge door: {decor.length} decorations saved. The interactive door (decorate + open) is built in Phase 4.
              </p>
            </div>
            {groups.length === 0 && <p className="muted">Your fridge is empty. Add items, scan groceries or a receipt.</p>}
            {groups.map((g) => (
              <div key={g.c} className="card">
                <h2 className="h2" style={{ marginBottom: 6 }}>{g.label}</h2>
                {g.items.map((f) => (
                  <div className="row" key={f.id}>
                    <span style={{ flex: 2 }}>{f.name}</span>
                    <span style={{ flex: 1 }}>{f.qty} {f.unit}</span>
                    <span style={{ flex: 1 }}>
                      {f.expiry === "use_soon" || f.expiry === "expired" ? (
                        <span className="chip warn">{f.expiry === "expired" ? "expired" : `use in ${f.days_left}d`}</span>
                      ) : f.low ? (
                        <span className="chip warn">low</span>
                      ) : (
                        <span className="muted">{f.expires_on ? `exp ${f.expires_on}` : ""}</span>
                      )}
                    </span>
                    <ActionButton action={fridgeQtyAction} args={[f.id, -1]}>Use 1</ActionButton>
                    <ActionButton action={fridgeQtyAction} args={[f.id, 1]} label={`Restock ${f.name}`}>+1</ActionButton>
                    <ActionButton action={fridgeRemoveAction} args={[f.id]} label={`Remove ${f.name}`} confirm={`Remove ${f.name}?`}>×</ActionButton>
                  </div>
                ))}
              </div>
            ))}
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
