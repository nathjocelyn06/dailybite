"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { addElementAction, deleteElementAction, updateElementAction } from "../actions";
import Link from "next/link";
import { PhotoDrop } from "./PhotoDrop";
import { Book } from "@/components/journal/Book";

type Kind = "photo" | "sticker" | "tape" | "text" | "doodle" | "meal_card" | "mood" | "habit";

export type Element = {
  id: string;
  kind: Kind;
  /** x and w are percentages of the page width; y is pixels from the top. */
  x: number;
  y: number;
  w: number;
  h?: number | null;
  rot: number;
  z: number;
  text?: string | null;
  data?: Record<string, unknown>;
  photo_path?: string | null;
  meal_id?: string | null;
};

type Tool = "select" | "text" | "doodle";

const STICKERS = ["🍓", "🥑", "☕", "🍞", "🌶️", "🥕", "⭐", "♥"];
/** Post-it papers and the pin that holds each one up. */
const POSTITS: { paper: string; pin: string; label: string }[] = [
  { paper: "#FFD84A", pin: "#C9960B", label: "Yellow" },
  { paper: "#FF9DC0", pin: "#E0417F", label: "Pink" },
  { paper: "#BFA6F5", pin: "#6C4BC4", label: "Lilac" },
  { paper: "#A8E6CF", pin: "#2C8F6B", label: "Mint" }
];
/** A post-it is a text element carrying its paper colour — no new kind, so no migration. */
const isPostit = (el: Element) => el.kind === "text" && !!el.data?.postit;

const clampX = (v: number) => Math.min(96, Math.max(0, v));
const clampY = (v: number) => Math.max(0, v);

/**
 * The scrapbook page (docs/PLAN.md Phase 4, design/wireframes/D05-Journal).
 *
 * Stickers, tape, text, mood stamps and doodles on the day page, dragged, resized and
 * rotated with pointer events. Stored in `journal_elements` with x and w as percentages
 * of the page width and y in pixels, so a page made on a laptop still reads on a phone.
 * Edits save 500 ms after you stop moving things.
 */
export function Scrapbook({
  date,
  initial,
  photoUrls,
  meals,
  left,
  addMealHref
}: {
  date: string;
  initial: Element[];
  photoUrls: Record<string, string>;
  meals: { id: string; slot: string; name: string }[];
  /** The left-hand page: the day's meals, rendered on the server. */
  left: React.ReactNode;
  addMealHref: string;
}) {
  const [els, setEls] = useState<Element[]>(initial);
  const [tool, setTool] = useState<Tool>("select");
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState("");
  const [photoOpen, setPhotoOpen] = useState(false);
  // Signed URLs for photos added in this session, on top of the ones the page sent.
  const [urls, setUrls] = useState<Record<string, string>>(photoUrls);
  const [, start] = useTransition();

  const pageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; mode: "move" | "resize" | "rotate"; dx: number; dy: number } | null>(null);
  const stroke = useRef<{ points: [number, number][]; y0: number } | null>(null);
  const [drawing, setDrawing] = useState<string>("");
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((t) => clearTimeout(t));
  }, []);

  /** Debounced per element, so dragging one thing doesn't rewrite the others. */
  const persist = useCallback((el: Element) => {
    const map = timers.current;
    const existing = map.get(el.id);
    if (existing) clearTimeout(existing);
    map.set(
      el.id,
      setTimeout(() => {
        start(async () => {
          try {
            await updateElementAction(el.id, {
              x: Math.round(el.x * 10) / 10,
              y: Math.round(el.y),
              w: Math.round(el.w * 10) / 10,
              rot: Math.round(el.rot),
              z: el.z,
              text: el.text ?? null,
              data: el.data ?? {}
            });
            setStatus("Saved");
            setTimeout(() => setStatus(""), 1200);
          } catch {
            setStatus("Could not save");
          }
        });
      }, 500)
    );
  }, []);

  const patch = (id: string, p: Partial<Element>) => {
    setEls((list) => {
      const next = list.map((e) => (e.id === id ? { ...e, ...p } : e));
      const changed = next.find((e) => e.id === id);
      if (changed) persist(changed);
      return next;
    });
  };

  async function addEl(kind: Kind, extra: Partial<Element> = {}) {
    const base = {
      kind,
      x: 12 + Math.random() * 50,
      y: 40 + Math.random() * 240,
      w: kind === "tape" ? 22 : kind === "text" ? 34 : 14,
      rot: Math.round(Math.random() * 12 - 6),
      z: els.length,
      data: {},
      ...extra
    };
    try {
      const created = (await addElementAction(date, base)) as Element;
      setEls((l) => [...l, { ...base, ...created } as Element]);
      setSelected(created.id);
      setTool("select");
    } catch {
      setStatus("Could not add that");
    }
  }

  function remove(id: string) {
    setEls((l) => l.filter((e) => e.id !== id));
    setSelected(null);
    start(async () => { await deleteElementAction(id); });
  }

  // ---- pointer handling on the page ----
  function pagePos(e: React.PointerEvent) {
    const box = pageRef.current?.getBoundingClientRect();
    if (!box) return null;
    return { xPct: ((e.clientX - box.left) / box.width) * 100, yPx: e.clientY - box.top, box };
  }

  function onElementDown(e: React.PointerEvent, el: Element, mode: "move" | "resize" | "rotate") {
    if (!editing || tool !== "select") return;
    e.stopPropagation();
    const pos = pagePos(e);
    if (!pos) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setSelected(el.id);
    drag.current = { id: el.id, mode, dx: pos.xPct - el.x, dy: pos.yPx - el.y };
  }

  function onPageMove(e: React.PointerEvent) {
    const pos = pagePos(e);
    if (!pos) return;

    if (stroke.current) {
      stroke.current.points.push([pos.xPct, pos.yPx - stroke.current.y0]);
      setDrawing(toPath(stroke.current.points));
      return;
    }

    const d = drag.current;
    if (!d) return;
    e.preventDefault();
    const el = els.find((x) => x.id === d.id);
    if (!el) return;

    if (d.mode === "move") {
      patch(el.id, { x: clampX(pos.xPct - d.dx), y: clampY(pos.yPx - d.dy) });
    } else if (d.mode === "resize") {
      patch(el.id, { w: Math.min(90, Math.max(6, pos.xPct - el.x)) });
    } else {
      const cx = el.x + el.w / 2;
      const deg = (Math.atan2(pos.yPx - el.y, pos.xPct - cx) * 180) / Math.PI;
      patch(el.id, { rot: Math.round(deg) });
    }
  }

  function onPageDown(e: React.PointerEvent) {
    if (!editing) return;
    const pos = pagePos(e);
    if (!pos) return;

    if (tool === "doodle") {
      stroke.current = { points: [[pos.xPct, 0]], y0: pos.yPx };
      setDrawing("");
      return;
    }
    if (tool === "text") {
      void addEl("text", { x: clampX(pos.xPct), y: clampY(pos.yPx), text: "write here" });
      return;
    }
    setSelected(null);
  }

  function onPageUp() {
    if (stroke.current) {
      const path = toPath(stroke.current.points);
      const y0 = stroke.current.y0;
      const pts = stroke.current.points;
      stroke.current = null;
      setDrawing("");
      if (pts.length > 2) {
        const xs = pts.map((p) => p[0]);
        void addEl("doodle", {
          x: clampX(Math.min(...xs)),
          y: clampY(y0),
          w: Math.min(90, Math.max(10, Math.max(...xs) - Math.min(...xs))),
          rot: 0,
          data: { path, minX: Math.min(...xs) }
        });
      }
      return;
    }
    if (drag.current) drag.current = null;
  }

  const sel = els.find((e) => e.id === selected) ?? null;

  return (
    <div className="scrapbook">
      <Book
        left={left}
        right={
          <>
      <div className="scrap-toolbar">
        {editing && (
          <>
            {(["select", "text", "doodle"] as Tool[]).map((t) => (
              <button key={t} className={`btn sm ${tool === t ? "pri" : ""}`} onClick={() => setTool(t)} aria-pressed={tool === t}>
                {t === "select" ? "Select" : t === "text" ? "Text" : "Doodle"}
              </button>
            ))}
            <span className="scrap-sep" aria-hidden="true" />
            {POSTITS.map((n) => (
              <button
                key={n.paper}
                className="postit-pick"
                style={{ background: n.paper }}
                onClick={() => void addEl("text", { text: "", w: 42, data: { postit: true, paper: n.paper, pin: n.pin } })}
                aria-label={`Add a ${n.label.toLowerCase()} post-it`}
                title={`${n.label} post-it`}
              />
            ))}
            <span className="scrap-sep" aria-hidden="true" />
            {STICKERS.slice(0, 6).map((s) => (
              <button key={s} className="btn sm" onClick={() => void addEl("sticker", { text: s })} aria-label={`Add sticker ${s}`}>{s}</button>
            ))}
            <button className="btn sm" onClick={() => setPhotoOpen(true)}>Photo</button>
            <span className="muted" role="status" style={{ fontSize: 12 }}>{status}</span>
          </>
        )}
      </div>

      {editing && tool === "doodle" && <p className="muted" style={{ fontSize: 12 }}>Drag on the page to draw.</p>}

      <div
        ref={pageRef}
        className={`scrap-page ${editing ? "is-editing" : ""}`}
        onPointerDown={onPageDown}
        onPointerMove={onPageMove}
        onPointerUp={onPageUp}
        onPointerCancel={onPageUp}
      >
        {els.length === 0 && !editing && (
          <p className="hand scrap-empty">Nothing on today&apos;s page yet — press Decorate page.</p>
        )}

        {els.filter((el) => el.kind !== "tape" && el.kind !== "mood").map((el) => {
          const isSel = editing && el.id === selected;
          const url = el.photo_path ? urls[el.photo_path] : null;
          const note = isPostit(el);
          return (
            <div
              key={el.id}
              className={`scrap-el scrap-${el.kind} ${note ? "scrap-postit" : ""} ${isSel ? "is-selected" : ""}`}
              style={{
                left: `${el.x}%`,
                top: `${el.y}px`,
                width: `${el.w}%`,
                transform: `rotate(${el.rot}deg)`,
                zIndex: el.z,
                background: note ? ((el.data?.paper as string) ?? POSTITS[0].paper) : undefined,
                cursor: editing && tool === "select" ? "grab" : "default"
              }}
              onPointerDown={(e) => onElementDown(e, el, "move")}
            >
              {note && <span className="postit-pin" style={{ background: (el.data?.pin as string) ?? POSTITS[0].pin }} aria-hidden="true" />}
              {note ? (
                <textarea
                  className="postit-text"
                  value={el.text ?? ""}
                  placeholder={editing ? "Write a note…" : ""}
                  readOnly={!editing}
                  onChange={(e) => patch(el.id, { text: e.target.value })}
                  onPointerDown={(e) => { if (editing) e.stopPropagation(); }}
                  aria-label="Post-it note"
                />
              ) : el.kind === "doodle" ? (
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="scrap-doodle">
                  <path d={(el.data?.path as string) ?? ""} fill="none" stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              ) : el.kind === "photo" && url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt={el.text ?? "Journal photo"} />
              ) : isSel && el.kind === "text" ? (
                <input
                  className="scrap-input"
                  value={el.text ?? ""}
                  onChange={(e) => patch(el.id, { text: e.target.value })}
                  onPointerDown={(e) => e.stopPropagation()}
                  aria-label="Edit text"
                />
              ) : (
                <span>{el.text}</span>
              )}

              {isSel && (
                <>
                  <button className="scrap-handle resize" onPointerDown={(e) => onElementDown(e, el, "resize")} aria-label="Resize" />
                  <button className="scrap-handle rotate" onPointerDown={(e) => onElementDown(e, el, "rotate")} aria-label="Rotate" />
                  <button className="scrap-handle del" onClick={() => remove(el.id)} aria-label="Delete">×</button>
                </>
              )}
            </div>
          );
        })}

        {drawing && (
          <svg className="scrap-live" viewBox="0 0 100 400" preserveAspectRatio="none">
            <path d={drawing} fill="none" stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
      </div>

          </>
        }
      />

      <div className="book-actions">
        <button className="btn pri" onClick={() => { setEditing(!editing); setSelected(null); setTool("select"); }} aria-pressed={editing}>
          {editing ? "Done editing" : "Edit Journal"}
        </button>
        <Link className="btn pri" href={addMealHref}>Add meal</Link>
      </div>

      {photoOpen && (
        <PhotoDrop
          onCancel={() => setPhotoOpen(false)}
          onPlaced={(path, url) => {
            setPhotoOpen(false);
            if (url) setUrls((m) => ({ ...m, [path]: url }));
            void addEl("photo", { photo_path: path, w: 30 });
          }}
        />
      )}

      {sel?.kind === "photo" && meals.length > 0 && (
        <label className="field" style={{ maxWidth: 360 }}>
          Which meal is this?
          <select
            className="input"
            value={sel.meal_id ?? ""}
            onChange={(e) => {
              const meal_id = e.target.value || null;
              setEls((l) => l.map((x) => (x.id === sel.id ? { ...x, meal_id } : x)));
              start(async () => { await updateElementAction(sel.id, { meal_id }); });
            }}
          >
            <option value="">Not linked</option>
            {meals.map((m) => (
              <option key={m.id} value={m.id}>{m.slot}: {m.name}</option>
            ))}
          </select>
        </label>
      )}

      {sel && (
        <p className="muted" style={{ fontSize: 12 }}>
          {sel.kind} selected — drag to move, corner to resize, top dot to rotate, × to delete.
        </p>
      )}
    </div>
  );
}

/** Points are [x%, yOffsetPx]; the doodle SVG uses a 0–100 box in both directions. */
function toPath(points: [number, number][]): string {
  if (!points.length) return "";
  return points.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
}
