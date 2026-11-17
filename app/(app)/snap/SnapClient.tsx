"use client";
/* eslint-disable @next/next/no-img-element */
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import type { ScanDraft, ScanMode, ScanRow } from "@/lib/scan-types";
import { confirmScanAction, uploadScanPhotoAction } from "../actions";
import { CameraCapture } from "./CameraCapture";

const MODES: { k: ScanMode; label: string; desc: string }[] = [
  { k: "calorie", label: "Calorie scan", desc: "Identify food and estimate nutrition" },
  { k: "receipt", label: "Receipt scan", desc: "Extract purchase details and expenses" },
  { k: "ingredient", label: "Ingredient scan", desc: "Identify groceries and update the fridge" },
  { k: "recipe_finder", label: "AI recipe finder", desc: "Recipes from the ingredients in the photo" },
  { k: "journal", label: "Food journal", desc: "Add a meal photo to a journal page" },
  { k: "grocery", label: "Grocery scan", desc: "Tick bought items and stock the fridge" }
];

/** Global AI camera: pick a mode → take/upload a photo → AI draft → user edits → confirm → shared records. */
export function SnapClient({ initialMode, initialSlot, date }: { initialMode?: string; initialSlot?: string; date: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<ScanMode>((MODES.find((m) => m.k === initialMode)?.k ?? "calorie") as ScanMode);
  const [preview, setPreview] = useState<string | null>(null);
  const [path, setPath] = useState<string | undefined>();
  const [draft, setDraft] = useState<ScanDraft | null>(null);
  const [slot, setSlot] = useState(initialSlot ?? guessSlot());
  const [step, setStep] = useState<"choose" | "analysing" | "review">("choose");
  const [camOpen, setCamOpen] = useState(false);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  // Context-aware order: the mode you came from is first.
  const ordered = [...MODES.filter((m) => m.k === mode), ...MODES.filter((m) => m.k !== mode)];

  async function onFile(f: File | undefined) {
    if (!f) return;
    if (!f.type.startsWith("image/")) return setErr("Choose an image file.");
    if (f.size > 8 * 1024 * 1024) return setErr("Image is over 8 MB.");
    setErr("");
    setPreview(URL.createObjectURL(f));
    setStep("analysing");
    // No signed-in browser client since v3.1: the file goes to a server action,
    // which writes it to the private bucket with the service-role client.
    let stored: string;
    try {
      const fd = new FormData();
      fd.append("file", f);
      stored = (await uploadScanPhotoAction(fd)).path;
    } catch (e) {
      setErr(`Upload failed: ${e instanceof Error ? e.message : "please try again"}`);
      setStep("choose");
      return;
    }
    setPath(stored);
    const res = await fetch("/api/scan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: stored, mode }) });
    const d = (await res.json()) as ScanDraft;
    setDraft({ ...d, rows: d.rows.length ? d.rows : [{ name: "" }] });
    setStep("review");
  }

  function manual() {
    setDraft({ mode, rows: [{ name: "" }], ai: false });
    setStep("review");
  }

  const setRow = (i: number, patch: Partial<ScanRow>) => draft && setDraft({ ...draft, rows: draft.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const n = (v: string) => (v === "" ? undefined : Number(v));

  function confirm() {
    if (!draft) return;
    const rows = draft.rows.filter((r) => r.name.trim());
    if (!rows.length && mode !== "journal") return setErr("Add at least one item.");
    setErr("");
    start(async () => {
      try {
        const r = await confirmScanAction({
          mode, photo_path: path, date, slot, title: draft.title, merchant: draft.merchant, total: draft.total, category: draft.category,
          rows: rows.map((x) => ({ ...x, fridge_category: x.fridge_category ?? undefined }))
        });
        router.push(r.redirect);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Could not save");
      }
    });
  }

  const totalKcal = draft?.rows.reduce((a, r) => a + (r.kcal ?? 0), 0) ?? 0;

  return (
    <>
      <header className="head">
        <div className="titles"><span className="lbl">AI camera</span><h1 className="h1">{MODES.find((m) => m.k === mode)?.label}</h1></div>
        <button className="btn" onClick={() => router.back()}>Close</button>
      </header>

      {step === "choose" && (
        <div className="split">
          <section className="grow" aria-label="What are you scanning?" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span className="lbl">What are you scanning?</span>
            {ordered.map((m, i) => (
              <button key={m.k} className="card" onClick={() => setMode(m.k)} aria-pressed={mode === m.k}
                style={{ textAlign: "left", cursor: "pointer", padding: 14, borderWidth: mode === m.k ? 2 : 1, borderColor: mode === m.k ? "var(--ink)" : "var(--line)", background: mode === m.k ? "#f4f7e6" : "#fff" }}>
                <strong>{m.label}</strong> {i === 0 && <span className="chip" style={{ minHeight: 20, fontSize: 10 }}>suggested here</span>}
                <div className="muted">{m.desc}</div>
              </button>
            ))}
          </section>
          <section className="card side-col" style={{ gap: 10 }}>
            {camOpen ? (
              <CameraCapture
                onCapture={(file) => { setCamOpen(false); void onFile(file); }}
                onClose={() => setCamOpen(false)}
              />
            ) : (
              <>
                <div className="thumb" style={{ aspectRatio: "3/4", display: "grid", placeItems: "center", color: "var(--muted)" }}>Photo preview</div>
                <button className="btn pri" onClick={() => { setErr(""); setCamOpen(true); }}>Open camera</button>
                <input ref={fileRef} type="file" accept="image/*" className="sr" onChange={(e) => onFile(e.target.files?.[0])} aria-label="Choose a photo" />
                <button className="btn" onClick={() => fileRef.current?.click()}>Upload a photo</button>
                <button className="btn" onClick={manual}>Enter by hand</button>
              </>
            )}
            {err && <p style={{ color: "#a32d2d", fontSize: 13 }}>{err}</p>}
          </section>
        </div>
      )}

      {step === "analysing" && (
        <section className="card" style={{ display: "flex", gap: 16, alignItems: "center" }}>
          {preview && <img src={preview} alt="Your photo" style={{ width: 160, borderRadius: 12 }} />}
          <p>Analysing your photo…</p>
          {err && <p style={{ color: "#a32d2d", fontSize: 13 }}>{err}</p>}
        </section>
      )}

      {step === "review" && draft && (
        <div className="split">
          <section className="side-col">
            {preview ? <img src={preview} alt="Your photo" style={{ width: "100%", borderRadius: 14 }} /> : <div className="thumb" />}
            <button className="btn" onClick={() => { setStep("choose"); setDraft(null); setPreview(null); }}>Retake</button>
          </section>
          <section className="card grow" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span className="lbl">{draft.ai ? "AI suggestion · please check" : "Fill in the details"}</span>
            {draft.note && <p className="muted">{draft.note}</p>}

            {(mode === "calorie" || mode === "journal") && (
              <label className="field">{mode === "journal" ? "Caption" : "Meal name"}<input className="input" value={draft.title ?? ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
            )}
            {mode === "calorie" && (
              <label className="field">Meal
                <select className="input" value={slot} onChange={(e) => setSlot(e.target.value)}>
                  <option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option><option value="snack">Snack</option>
                </select>
              </label>
            )}
            {mode === "receipt" && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <label className="field" style={{ flex: 2 }}>Merchant<input className="input" value={draft.merchant ?? ""} onChange={(e) => setDraft({ ...draft, merchant: e.target.value })} /></label>
                <label className="field" style={{ flex: 1 }}>Total<input className="input" inputMode="decimal" value={draft.total ?? ""} onChange={(e) => setDraft({ ...draft, total: n(e.target.value) })} /></label>
                <label className="field" style={{ flex: 1 }}>Category
                  <select className="input" value={draft.category ?? "groceries"} onChange={(e) => setDraft({ ...draft, category: e.target.value as ScanDraft["category"] })}>
                    <option value="groceries">Groceries</option><option value="daily_food">Daily food</option><option value="snacks_drinks">Snacks & drinks</option><option value="other">Other</option>
                  </select>
                </label>
              </div>
            )}

            {mode !== "journal" && draft.rows.map((r, i) => (
              <div key={i} className="row" style={{ flexWrap: "wrap" }}>
                <input className="input" style={{ flex: "2 1 140px" }} placeholder="Item" value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} aria-label="Item name" />
                {mode === "calorie" && <>
                  <input className="input" style={{ flex: "1 1 80px" }} placeholder="Portion" value={r.portion ?? ""} onChange={(e) => setRow(i, { portion: e.target.value })} aria-label="Portion" />
                  <input className="input" style={{ width: 80 }} placeholder="kcal" inputMode="numeric" value={r.kcal ?? ""} onChange={(e) => setRow(i, { kcal: n(e.target.value) })} aria-label="Calories" />
                </>}
                {(mode === "receipt" || mode === "ingredient" || mode === "grocery") && <>
                  <input className="input" style={{ width: 64 }} placeholder="Qty" inputMode="decimal" value={r.qty ?? ""} onChange={(e) => setRow(i, { qty: n(e.target.value) })} aria-label="Quantity" />
                  <select className="input" value={r.fridge_category ?? ""} onChange={(e) => setRow(i, { fridge_category: (e.target.value || undefined) as ScanRow["fridge_category"] })} aria-label="Shelf">
                    <option value="">{mode === "receipt" ? "Not for fridge" : "Shelf"}</option>
                    <option value="veg_fruit">Veg & fruit</option><option value="protein">Protein</option><option value="dairy_eggs">Dairy & eggs</option>
                    <option value="frozen">Frozen</option><option value="pantry">Pantry</option><option value="other">Other</option>
                  </select>
                </>}
                {mode === "receipt" && <input className="input" style={{ width: 90 }} placeholder="Price" inputMode="decimal" value={r.price ?? ""} onChange={(e) => setRow(i, { price: n(e.target.value) })} aria-label="Price" />}
                {r.unsure && <span className="chip warn">unsure</span>}
                <button className="btn sm" onClick={() => setDraft({ ...draft, rows: draft.rows.filter((_, j) => j !== i) })} aria-label="Remove row">×</button>
              </div>
            ))}
            {mode !== "journal" && <button className="btn sm" style={{ alignSelf: "flex-start" }} onClick={() => setDraft({ ...draft, rows: [...draft.rows, { name: "" }] })}>+ Add something it missed</button>}
            {mode === "calorie" && <p style={{ fontWeight: 700 }}>Total ≈ {totalKcal} kcal</p>}
            <p className="muted">Photo estimates can be off. Nothing is saved until you confirm.</p>
            {err && <p style={{ color: "#a32d2d", fontSize: 13 }}>{err}</p>}
            <button className="btn pri" onClick={confirm} disabled={pending}>{pending ? "Saving…" : "Confirm & save"}</button>
          </section>
        </div>
      )}
    </>
  );
}

function guessSlot() {
  const h = new Date().getHours();
  return h < 11 ? "breakfast" : h < 16 ? "lunch" : h < 21 ? "dinner" : "snack";
}
