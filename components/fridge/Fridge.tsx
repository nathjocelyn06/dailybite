"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTransition } from "react";
import type { FridgeItemView } from "@/lib/services/fridge";
import { saveDecorAction, fridgeQtyAction, fridgeRemoveAction } from "@/app/(app)/actions";

export type DecorPiece = {
  id?: string;
  kind: "photo" | "strip" | "postit" | "note" | "badge" | "magnet" | "calendar" | "receipt";
  /** Percent of the door, 0–100, so the door stays responsive at any width. */
  x: number;
  y: number;
  rot: number;
  z: number;
  text?: string | null;
  color?: string | null;
  photo_path?: string | null;
};

type Door = "none" | "freezer" | "fridge";

/** Which shelf each kind of food lives on, top to bottom, as in D06-Fridge. */
const SHELVES: { key: FridgeItemView["category"]; label: string; door: Exclude<Door, "none"> | "pantry" }[] = [
  { key: "frozen", label: "Freezer", door: "freezer" },
  { key: "dairy_eggs", label: "Dairy & eggs", door: "fridge" },
  { key: "protein", label: "Proteins", door: "fridge" },
  { key: "veg_fruit", label: "Crisper drawers", door: "fridge" },
  { key: "other", label: "Shelf", door: "fridge" },
  { key: "pantry", label: "Pantry cupboard", door: "pantry" }
];

const TRAY: { kind: DecorPiece["kind"]; label: string; text: string; color: string }[] = [
  { kind: "postit", label: "Post-it", text: "buy milk", color: "#FFDBA7" },
  { kind: "note", label: "Note", text: "eat me first", color: "#FFCAD4" },
  { kind: "badge", label: "Badge", text: "★", color: "#FF877E" },
  { kind: "magnet", label: "Magnet", text: "●", color: "#D9EFFD" }
];

/** The six brand colours — the only fridge colours offered. */
const COLOURS = ["#FFCAD4", "#D9EFFD", "#C2FFE5", "#FF877E", "#FFDBA7", "#EDD4FF"];
const clamp = (v: number, lo = 2, hi = 98) => Math.min(hi, Math.max(lo, v));

/**
 * The digital fridge (docs/PLAN.md Phase 4, design/wireframes/D06-Fridge).
 *
 * Closed, the door is a surface you decorate: drag post-its, notes, badges and magnets
 * around, change the fridge colour. The handles swing the freezer and fridge doors open
 * on a CSS 3D rotateY to show the shelves, with the pantry beside them.
 *
 * Decor positions are percentages of the door, not pixels, so a door arranged on a
 * laptop still looks right on a phone. Layout is saved 600 ms after a drag ends.
 */
export function Fridge({
  items,
  initialDecor,
  initialColor
}: {
  items: FridgeItemView[];
  initialDecor: DecorPiece[];
  initialColor: string;
}) {
  const [open, setOpen] = useState<Door>("none");
  const [decorating, setDecorating] = useState(false);
  const [decor, setDecor] = useState<DecorPiece[]>(initialDecor);
  const [color, setColor] = useState(initialColor);
  const [selected, setSelected] = useState<FridgeItemView | null>(null);
  const [saved, setSaved] = useState("");
  const [pending, start] = useTransition();

  const doorRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<{ index: number; dx: number; dy: number } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const useSoon = items.filter((i) => i.expiry === "use_soon" || i.expiry === "expired").length;
  const lowStock = items.filter((i) => i.low).length;

  /** Debounced so a drag writes once, not on every frame. */
  const persist = useCallback(
    (next: DecorPiece[], nextColor: string) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        start(async () => {
          try {
            await saveDecorAction(
              next.map((d, i) => ({
                kind: d.kind,
                x: Math.round(d.x),
                y: Math.round(d.y),
                rot: Math.round(d.rot),
                z: i,
                text: d.text ?? null,
                color: d.color ?? null,
                photo_path: d.photo_path ?? null
              })),
              nextColor
            );
            setSaved("Door saved");
            setTimeout(() => setSaved(""), 1600);
          } catch {
            setSaved("Could not save the door");
          }
        });
      }, 600);
    },
    []
  );

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  function onPointerDown(e: React.PointerEvent, index: number) {
    if (!decorating) return;
    const box = doorRef.current?.getBoundingClientRect();
    if (!box) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const piece = decor[index];
    dragging.current = {
      index,
      dx: ((e.clientX - box.left) / box.width) * 100 - piece.x,
      dy: ((e.clientY - box.top) / box.height) * 100 - piece.y
    };
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragging.current;
    const box = doorRef.current?.getBoundingClientRect();
    if (!drag || !box) return;
    e.preventDefault();
    const x = clamp(((e.clientX - box.left) / box.width) * 100 - drag.dx);
    const y = clamp(((e.clientY - box.top) / box.height) * 100 - drag.dy);
    setDecor((list) => list.map((d, i) => (i === drag.index ? { ...d, x, y } : d)));
  }

  function onPointerUp() {
    if (!dragging.current) return;
    dragging.current = null;
    persist(decor, color);
  }

  const update = (index: number, patch: Partial<DecorPiece>) => {
    const next = decor.map((d, i) => (i === index ? { ...d, ...patch } : d));
    setDecor(next);
    persist(next, color);
  };

  const add = (t: (typeof TRAY)[number]) => {
    const next = [...decor, { kind: t.kind, x: 50, y: 40, rot: Math.round(Math.random() * 10 - 5), z: decor.length, text: t.text, color: t.color }];
    setDecor(next);
    persist(next, color);
  };

  const removeAt = (index: number) => {
    const next = decor.filter((_, i) => i !== index);
    setDecor(next);
    persist(next, color);
  };

  const pickColour = (c: string) => {
    setColor(c);
    persist(decor, c);
  };

  const shelfItems = (key: FridgeItemView["category"]) => items.filter((i) => i.category === key);

  return (
    <div className="fridge-wrap">
      <div className="fridge-scene">
        <div className="fridge-body" style={{ background: color }}>
          {/* ---- freezer ---- */}
          <section className="fridge-compartment freezer" aria-label="Freezer">
            <div className="shelves">
              {SHELVES.filter((s) => s.door === "freezer").map((s) => (
                <Shelf key={s.key} label={s.label} items={shelfItems(s.key)} onPick={setSelected} />
              ))}
            </div>
            <div
              className={`door ${open === "freezer" ? "is-open" : ""}`}
              style={{ background: color }}
              aria-hidden={open === "freezer"}
            >
              <button
                className="handle"
                onClick={() => setOpen(open === "freezer" ? "none" : "freezer")}
                aria-label={open === "freezer" ? "Close the freezer" : "Open the freezer"}
                aria-expanded={open === "freezer"}
              />
              <span className="door-label">Freezer</span>
            </div>
          </section>

          {/* ---- fridge ---- */}
          <section className="fridge-compartment main" aria-label="Fridge">
            <div className="shelves">
              {SHELVES.filter((s) => s.door === "fridge").map((s) => (
                <Shelf key={s.key} label={s.label} items={shelfItems(s.key)} onPick={setSelected} />
              ))}
            </div>
            <div
              ref={doorRef}
              className={`door ${open === "fridge" ? "is-open" : ""} ${decorating ? "is-decorating" : ""}`}
              style={{ background: color }}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              aria-hidden={open === "fridge"}
            >
              <button
                className="handle"
                onClick={() => setOpen(open === "fridge" ? "none" : "fridge")}
                aria-label={open === "fridge" ? "Close the fridge" : "Open the fridge"}
                aria-expanded={open === "fridge"}
              />

              {/* status magnet — the door tells you what needs attention */}
              <span className="status-magnet" aria-label={`${useSoon} to use soon, ${lowStock} running low`}>
                <strong>{useSoon}</strong> use soon
                <br />
                <strong>{lowStock}</strong> low
              </span>

              {decor.map((d, i) => (
                <div
                  key={d.id ?? `${d.kind}-${i}`}
                  className={`decor decor-${d.kind}`}
                  style={{
                    left: `${d.x}%`,
                    top: `${d.y}%`,
                    transform: `translate(-50%, -50%) rotate(${d.rot}deg)`,
                    background: d.color ?? undefined,
                    cursor: decorating ? "grab" : "default"
                  }}
                  onPointerDown={(e) => onPointerDown(e, i)}
                >
                  {d.text}
                  {decorating && (
                    <button className="decor-x" onClick={() => removeAt(i)} aria-label={`Remove ${d.kind}`}>×</button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ---- pantry, beside the fridge ---- */}
        <section className="pantry" aria-label="Pantry cupboard">
          <span className="lbl">Pantry cupboard</span>
          {shelfItems("pantry").length === 0 && <p className="muted" style={{ fontSize: 12 }}>Empty</p>}
          {shelfItems("pantry").map((i) => (
            <ItemChip key={i.id} item={i} onPick={setSelected} />
          ))}
        </section>
      </div>

      <div className="fridge-controls">
        <button className="btn" onClick={() => setOpen(open === "none" ? "fridge" : "none")}>
          {open === "none" ? "Open the fridge" : "Close the doors"}
        </button>
        <button className="btn" onClick={() => { setDecorating(!decorating); setOpen("none"); }} aria-pressed={decorating}>
          {decorating ? "Done decorating" : "Decorate your fridge"}
        </button>
        {saved && <span className="muted" role="status">{pending ? "Saving…" : saved}</span>}
      </div>

      {decorating && (
        <section className="card" aria-label="Decorate" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span className="lbl">Add to the door</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {TRAY.map((t) => (
              <button key={t.kind} className="btn sm" onClick={() => add(t)}>+ {t.label}</button>
            ))}
          </div>
          <span className="lbl">Fridge colour</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {COLOURS.map((c) => (
              <button
                key={c}
                className="swatch"
                style={{ background: c, outline: c === color ? "2px solid var(--ink)" : "1px solid var(--line)" }}
                onClick={() => pickColour(c)}
                aria-label={`Fridge colour ${c}`}
                aria-pressed={c === color}
              />
            ))}
          </div>
          {decor.length > 0 && (
            <>
              <span className="lbl">Edit text</span>
              {decor.map((d, i) => (
                <div className="row" key={d.id ?? `edit-${i}`}>
                  <span className="chip">{d.kind}</span>
                  <input
                    className="input"
                    style={{ flex: 1 }}
                    value={d.text ?? ""}
                    onChange={(e) => update(i, { text: e.target.value })}
                    aria-label={`Text on ${d.kind} ${i + 1}`}
                  />
                  <button className="btn sm" onClick={() => update(i, { rot: d.rot + 5 })} aria-label="Tilt">⟳</button>
                  <button className="btn sm" onClick={() => removeAt(i)} aria-label="Remove">×</button>
                </div>
              ))}
            </>
          )}
          <p className="muted" style={{ fontSize: 12 }}>Drag anything on the door to move it. Saved automatically.</p>
        </section>
      )}

      {selected && <SelectedItem item={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function Shelf({ label, items, onPick }: { label: string; items: FridgeItemView[]; onPick: (i: FridgeItemView) => void }) {
  return (
    <div className="shelf">
      <span className="shelf-label">{label}</span>
      <div className="shelf-items">
        {items.length === 0 && <span className="muted" style={{ fontSize: 11 }}>empty</span>}
        {items.map((i) => (
          <ItemChip key={i.id} item={i} onPick={onPick} />
        ))}
      </div>
    </div>
  );
}

function ItemChip({ item, onPick }: { item: FridgeItemView; onPick: (i: FridgeItemView) => void }) {
  const warn = item.expiry === "use_soon" || item.expiry === "expired" || item.low;
  return (
    <button className={`item-chip ${warn ? "warn" : ""}`} onClick={() => onPick(item)} title={item.name}>
      <span className="item-name">{item.name}</span>
      <span className="item-qty">{item.qty}{item.unit === "pcs" ? "" : ` ${item.unit}`}</span>
    </button>
  );
}

function SelectedItem({ item, onClose }: { item: FridgeItemView; onClose: () => void }) {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); onClose(); });
  return (
    <section className="card" aria-label="Selected item" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="head" style={{ marginBottom: 0 }}>
        <div className="titles">
          <span className="lbl">Selected item</span>
          <h2 className="h2">{item.name}</h2>
        </div>
        <button className="btn" onClick={onClose}>Close</button>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <span className="chip">{item.qty} {item.unit}</span>
        {item.expires_on && (
          <span className={`chip ${item.expiry === "ok" || item.expiry === "unknown" ? "" : "warn"}`}>
            {item.expiry === "expired" ? "expired" : item.expiry === "use_soon" ? `use within ${item.days_left}d` : "expires"} {item.expires_on}
          </span>
        )}
        {item.low && <span className="chip warn">running low</span>}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn" disabled={pending} onClick={() => run(() => fridgeQtyAction(item.id, -1))}>Use 1</button>
        <button className="btn" disabled={pending} onClick={() => run(() => fridgeQtyAction(item.id, 1))}>Restock</button>
        <button className="btn" disabled={pending} onClick={() => run(() => fridgeRemoveAction(item.id))}>Remove</button>
        <a className="btn" href={`/recipes?tab=scanner&ingredients=${encodeURIComponent(item.name)}`}>Recipes using this</a>
      </div>
    </section>
  );
}
