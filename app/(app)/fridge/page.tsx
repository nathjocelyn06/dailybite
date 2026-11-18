import Link from "next/link";
import { webDb } from "@/lib/services/db";
import { CATEGORY_LABEL, getDecor, listFridge, type FridgeItemView } from "@/lib/services/fridge";
import { signedUrls } from "@/lib/services/photos";
import { getSettings } from "@/lib/services/settings";
import { ActionButton } from "@/components/ActionButton";
import { confirmPendingAction, fridgeRemoveAction } from "../actions";
import { AddFridgeForm } from "./forms";
import { Fridge } from "@/components/fridge/Fridge";

/**
 * The fridge, and only the fridge: a door you decorate, handles that swing it open,
 * shelves you tap, the pantry cupboard beside it. To buy is its own page now.
 */
export default async function FridgePage() {
  const db = await webDb();
  const [stock, pending, settings, decor] = await Promise.all([
    listFridge(db),
    listFridge(db, { status: ["pending"] }),
    getSettings(db),
    getDecor(db)
  ]);
  const stickerUrls = await signedUrls(db, decor.map((d) => d.photo_path));
  // The pantry is a cupboard beside the fridge, not a shelf inside it.
  const pantry = stock.filter((s) => s.category === "pantry");
  const groups = (Object.keys(CATEGORY_LABEL) as FridgeItemView["category"][])
    .map((c) => ({ c, label: CATEGORY_LABEL[c], items: stock.filter((s) => s.category === c) }))
    .filter((g) => g.items.length);

  return (
    <>
      <header className="head">
        <div className="titles">
          <span className="lbl">Fridge</span>
          <h1 className="h1">What I have</h1>
        </div>
      </header>

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

        <div className="fridge-columns">
          <section aria-label="Stock" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {stock.length === 0 && <p className="muted">Your fridge is empty. Add items, scan groceries or a receipt — then open the door.</p>}
            <Fridge items={stock} initialDecor={decor} initialColor={settings.fridge_color} initialUrls={stickerUrls} />
          </section>

          <section className="pantry-panel" aria-label="Pantry cupboard">
            <h2>Pantry Cupboard</h2>
            {pantry.length === 0 && <p className="muted">Nothing in the cupboard yet.</p>}
            {pantry.map((i) => (
              <div className="row" key={i.id}>
                <span style={{ flex: 1 }}>{i.name}</span>
                <span className="muted">{i.qty} {i.unit}</span>
                {i.low && <span className="chip warn">low</span>}
              </div>
            ))}
          </section>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <section className="form-card" aria-label="Add item">
              <h2>Add item</h2>
              <AddFridgeForm />
            </section>
            <Link className="btn" href="/recipes?tab=scanner" style={{ justifyContent: "center" }}>Cook from my fridge</Link>
          </div>
        </div>
    </>
  );
}
