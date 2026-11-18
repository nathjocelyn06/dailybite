import { webDb } from "@/lib/services/db";
import { listShopping } from "@/lib/services/shopping";
import { ActionButton } from "@/components/ActionButton";
import { boughtAction, deleteShoppingAction, moveBoughtAction } from "../actions";
import { AddShoppingForm } from "../fridge/forms";

/**
 * To buy — its own page, and its own card on My Kitchen. It used to be a tab inside
 * Fridge, which made the fridge screen two screens wearing one title.
 * Bought items move into the fridge from here.
 */
export default async function ToBuyPage() {
  const db = await webDb();
  const shopping = await listShopping(db);
  const open = shopping.filter((s) => !s.bought);

  return (
    <>
      <header className="head">
        <div className="titles">
          <span className="lbl">My Kitchen</span>
          <h1 className="h1">To Buy</h1>
        </div>
      </header>

      <div className="split">
        <section className="card grow" aria-label="Shopping list">
          <div className="head" style={{ marginBottom: 6 }}>
            <h2 className="h2" style={{ flex: 1 }}>{open.length} to buy</h2>
            <span className="muted">Est. {open.reduce((a, s) => a + (s.est_price ?? 0), 0).toLocaleString("en-US")}</span>
          </div>
          {shopping.length === 0 && <p className="muted">Nothing to buy. Add something on the right, or let a recipe add what you are missing.</p>}
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
        </aside>
      </div>
    </>
  );
}
