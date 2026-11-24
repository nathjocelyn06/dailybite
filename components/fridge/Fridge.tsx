"use client";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import type { FridgeItemView } from "@/lib/services/fridge";
import { FreezerDoorArt, MainDoorArt } from "./FridgeArt";
import { MagnetArt, MAGNETS, MAGNET_LABEL, isMagnet, type MagnetKey } from "./MagnetArt";
import { saveDecorAction, fridgeQtyAction, fridgeRemoveAction } from "@/app/(app)/actions";

export type DecorPiece = {
  id?: string;
  kind: "photo" | "strip" | "postit" | "note" | "badge" | "magnet" | "calendar" | "receipt";
  /** Percent of the door, 0–100, so the door stays responsive at any width. */
  x: number;
  y: number;
  rot: number;
  z: number;
  /** A magnet's width, as a percent of the door. */
  text?: string | null;
  /** Which magnet this is (see MagnetArt). `color` is free text in the schema. */
  color?: string | null;
  photo_path?: string | null;
};

type Door = "none" | "freezer" | "fridge";

/** The vector's own natural size, so the layers line up exactly. */
const ART = { w: 386, h: 710, dividerPct: 34 };

/** Where each kind of food lives, behind the door it belongs to. */
const SHELVES: { key: FridgeItemView["category"]; label: string; door: "freezer" | "fridge" }[] = [
  { key: "frozen", label: "Freezer", door: "freezer" },
  { key: "dairy_eggs", label: "Dairy & eggs", door: "fridge" },
  { key: "protein", label: "Proteins", door: "fridge" },
  { key: "veg_fruit", label: "Crisper drawers", door: "fridge" },
  { key: "other", label: "Shelf", door: "fridge" }
];

/** The six brand colours. "Original" keeps the vector's own finish. */
const COLOURS: { value: string; label: string }[] = [
  { value: "#F7EFE3", label: "Cream" },
  { value: "#FFCAD4", label: "Blush" },
  { value: "#D9EFFD", label: "Sky" },
  { value: "#C2FFE5", label: "Mint" },
  { value: "#FF877E", label: "Coral" },
  { value: "#FFDBA7", label: "Apricot" },
  { value: "#EDD4FF", label: "Lilac" }
];

const clamp = (v: number, lo = 2, hi = 98) => Math.min(hi, Math.max(lo, v));
const sizeOf = (d: DecorPiece) => {
  const n = Number(d.text);
  return Number.isFinite(n) && n > 0 ? n : 22;
};

/**
 * The fridge, built on the supplied vector (`public/fridge/*`).
 *
 * The artwork is sliced into its two doors so they can actually open: each door is an
 * image layer hinged on its right edge (the handles are on the left) and swung away on
 * a CSS 3D rotateY, revealing shelves drawn behind it.
 *
 * Colour is applied as a tint masked to the door's own shape and blended with
 * `mix-blend-mode: color`, which replaces the hue while keeping the chrome highlights
 * and shading of the original art — a flat fill would throw that detail away.
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
  /**
   * The magnets and the colours belong beside the fridge, not under it — the third
   * column of /fridge is empty below "Cook from my fridge" and the door is right there
   * to drop a magnet on. The page leaves an element for them; if it is not there (any
   * other page that mounts a fridge) they fall back to sitting under the unit.
   */
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const portal = (node: React.ReactNode) => (slot ? createPortal(node, slot) : node);
  useEffect(() => {
    setSlot(document.getElementById("fridge-decor-slot"));
  }, []);
  // Magnets are the only decoration now: uploaded stickers, post-its and tape are gone,
  // so leftover rows from the old tray are ignored and fall away on the next save.
  const [decor, setDecor] = useState<DecorPiece[]>(initialDecor.filter((d) => isMagnet(d.color)));
  const [color, setColor] = useState(initialColor?.startsWith("#") ? initialColor : "");
  const [selected, setSelected] = useState<FridgeItemView | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [pending, start] = useTransition();

  const doorRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ index: number; mode: "move" | "size"; dx: number; dy: number } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback((next: DecorPiece[], nextColor: string) => {
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
            nextColor || "original"
          );
          setStatus("Saved");
          setTimeout(() => setStatus(""), 1500);
        } catch {
          setStatus("Could not save");
        }
      });
    }, 600);
  }, []);

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  function onPointerDown(e: React.PointerEvent, index: number, mode: "move" | "size") {
    if (!decorating) return;
    e.stopPropagation();
    const box = doorRef.current?.getBoundingClientRect();
    if (!box) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const piece = decor[index];
    setPicked(index);
    drag.current = {
      index,
      mode,
      dx: ((e.clientX - box.left) / box.width) * 100 - piece.x,
      dy: ((e.clientY - box.top) / box.height) * 100 - piece.y
    };
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    const box = doorRef.current?.getBoundingClientRect();
    if (!d || !box) return;
    e.preventDefault();
    const xPct = ((e.clientX - box.left) / box.width) * 100;
    const yPct = ((e.clientY - box.top) / box.height) * 100;
    setDecor((list) =>
      list.map((p, i) => {
        if (i !== d.index) return p;
        if (d.mode === "move") return { ...p, x: clamp(xPct - d.dx), y: clamp(yPct - d.dy) };
        return { ...p, text: String(Math.min(80, Math.max(8, Math.round((xPct - p.x) * 2)))) };
      })
    );
  }

  function onPointerUp() {
    if (!drag.current) return;
    drag.current = null;
    persist(decor, color);
  }

  function addMagnet(name: MagnetKey) {
    const next = [
      ...decor,
      {
        kind: "magnet" as const,
        x: 50,
        y: 45,
        rot: Math.round(Math.random() * 16 - 8),
        z: decor.length,
        color: name,
        text: "20"
      }
    ];
    setDecor(next);
    setPicked(next.length - 1);
    persist(next, color);
    setStatus(`${MAGNET_LABEL[name]} added`);
  }

  const removeAt = (index: number) => {
    const next = decor.filter((_, i) => i !== index);
    setDecor(next);
    setPicked(null);
    persist(next, color);
  };

  const pickColour = (c: string) => {
    setColor(c);
    persist(decor, c);
  };

  const finish = color || "#F7EFE3";
  const shelfItems = (key: FridgeItemView["category"]) => items.filter((i) => i.category === key);
  const doorStyle = (which: "freezer" | "fridge") => ({
    transform: open === which ? "rotateY(118deg)" : "rotateY(0deg)"
  });

  return (
    <div className="fridge-wrap">
      <div className="fridge-scene">
        <div className="fridge-unit" style={{ aspectRatio: `${ART.w} / ${ART.h}` }}>
          {/* interior, revealed as the doors swing away */}
          <div className="fridge-inside">
            <div className="inside-part part-freezer" style={{ height: `${ART.dividerPct}%` }}>
              {SHELVES.filter((s) => s.door === "freezer").map((s) => (
                <Shelf key={s.key} label={s.label} items={shelfItems(s.key)} onPick={setSelected} />
              ))}
            </div>
            <div className="inside-part part-main" style={{ height: `${100 - ART.dividerPct}%` }}>
              {SHELVES.filter((s) => s.door === "fridge").map((s) => (
                <Shelf key={s.key} label={s.label} items={shelfItems(s.key)} onPick={setSelected} />
              ))}
            </div>
          </div>

          {/* freezer door */}
          <div className="door-layer door-freezer" style={{ height: `${ART.dividerPct}%`, ...doorStyle("freezer") }}>
            <FreezerDoorArt color={finish} idPrefix="fridge" />
          </div>

          {/* fridge door — the one you decorate */}
          <div
            ref={doorRef}
            className={`door-layer door-main ${decorating ? "is-decorating" : ""}`}
            style={{ top: `${ART.dividerPct}%`, height: `${100 - ART.dividerPct}%`, ...doorStyle("fridge") }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <MainDoorArt color={finish} idPrefix="fridge" />


            {decor.map((d, i) => {
              if (!isMagnet(d.color)) return null;
              return (
                <div
                  key={d.id ?? `s-${i}`}
                  className={`sticker magnet ${decorating && picked === i ? "is-picked" : ""}`}
                  style={{
                    left: `${d.x}%`,
                    top: `${d.y}%`,
                    width: `${sizeOf(d)}%`,
                    transform: `translate(-50%, -50%) rotate(${d.rot}deg)`,
                    cursor: decorating ? "grab" : "default"
                  }}
                  onPointerDown={(e) => onPointerDown(e, i, "move")}
                >
                  <MagnetArt name={d.color} />
                  {decorating && picked === i && (
                    <>
                      <button className="sticker-handle size" onPointerDown={(e) => onPointerDown(e, i, "size")} aria-label="Resize magnet" />
                      <button className="sticker-handle del" onClick={() => removeAt(i)} aria-label="Remove magnet">×</button>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* the handles are the way you open it, as on a real fridge */}
          <button
            className="handle-hit hit-freezer"
            onClick={() => setOpen(open === "freezer" ? "none" : "freezer")}
            aria-label={open === "freezer" ? "Close the freezer" : "Open the freezer"}
            aria-expanded={open === "freezer"}
          />
          <button
            className="handle-hit hit-main"
            onClick={() => setOpen(open === "fridge" ? "none" : "fridge")}
            aria-label={open === "fridge" ? "Close the fridge" : "Open the fridge"}
            aria-expanded={open === "fridge"}
          />
        </div>
      </div>

      <div className="fridge-controls">
        <button className="btn" onClick={() => setOpen(open === "none" ? "fridge" : "none")}>
          {open === "none" ? "Open the fridge" : "Close the doors"}
        </button>
        <button className="btn" onClick={() => { setDecorating(!decorating); setOpen("none"); setPicked(null); }} aria-pressed={decorating}>
          {decorating ? "Done decorating" : "Decorate your fridge"}
        </button>
        {(status || pending) && <span className="muted" role="status">{pending ? "Saving…" : status}</span>}
      </div>

      {decorating && portal(
        <section className="card" aria-label="Decorate the fridge" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <span className="lbl">Magnets</span>
          <div className="magnet-tray">
            {MAGNETS.map((m) => (
              <button key={m} className="magnet-pick" onClick={() => addMagnet(m)} aria-label={`Add the ${MAGNET_LABEL[m].toLowerCase()} magnet`} title={MAGNET_LABEL[m]}>
                <MagnetArt name={m} />
              </button>
            ))}
          </div>
          <span className="muted" style={{ fontSize: 12 }}>
            Tap a magnet to put it on the door. Drag to move it, the corner to resize, × to remove.
          </span>

          <span className="lbl">Fridge colour</span>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {COLOURS.map((c) => (
              <button
                key={c.label}
                className="swatch"
                style={{
                  background: c.value || "linear-gradient(135deg,#cfe6f5,#eaf6ff)",
                  outline: c.value === color ? "2px solid var(--ink)" : "1px solid var(--line)"
                }}
                onClick={() => pickColour(c.value)}
                aria-label={`Fridge colour ${c.label}`}
                aria-pressed={c.value === color}
                title={c.label}
              />
            ))}
          </div>
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

/**
 * A thing on a shelf. Tapping it opens what you can do with it; the x takes it off the
 * shelf there and then, for when it is finished and there is nothing to decide. The two
 * are separate elements because a button cannot live inside a button.
 */
function ItemChip({ item, onPick }: { item: FridgeItemView; onPick: (i: FridgeItemView) => void }) {
  const warn = item.expiry === "use_soon" || item.expiry === "expired" || item.low;
  const [pending, start] = useTransition();
  return (
    <span className={`item-chip-wrap ${warn ? "warn" : ""} ${pending ? "is-going" : ""}`}>
      <button className={`item-chip ${warn ? "warn" : ""}`} onClick={() => onPick(item)} title={item.name}>
        <span className="item-name">{item.name}</span>
        <span className="item-qty">{item.qty}{item.unit === "pcs" ? "" : ` ${item.unit}`}</span>
      </button>
      <button
        className="item-x"
        aria-label={`Remove ${item.name} from the fridge`}
        title={`Remove ${item.name}`}
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`Remove ${item.name} from your fridge?`)) return;
          start(async () => { await fridgeRemoveAction(item.id); });
        }}
      >
        ×
      </button>
    </span>
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
