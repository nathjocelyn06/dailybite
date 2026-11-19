"use client";
/* eslint-disable @next/next/no-img-element */
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import type { ScanDraft, ScanMode, ScanRow } from "@/lib/scan-types";
import { confirmScanAction, uploadScanPhotoAction } from "../actions";
import { CameraCapture } from "./CameraCapture";
import { FoodLookup } from "./FoodLookup";

/** The four meal categories, everywhere a meal is filed. */
const SLOTS = [
  { k: "breakfast", label: "Breakfast" },
  { k: "lunch", label: "Lunch" },
  { k: "dinner", label: "Dinner" },
  { k: "snack", label: "Snack" }
] as const;

const MODES: { k: ScanMode; label: string; desc: string }[] = [
  { k: "calorie", label: "Calorie scan", desc: "Identify food and estimate nutrition" },
  { k: "barcode", label: "Barcode & search", desc: "Look up a packaged food and pick a serving" },
  { k: "receipt", label: "Receipt scan", desc: "Extract purchase details and expenses" },
  { k: "ingredient", label: "Ingredient scan", desc: "Identify groceries and update the fridge" },
  { k: "recipe_finder", label: "AI recipe finder", desc: "Recipes from the ingredients in the photo" },
  { k: "journal", label: "Food journal", desc: "Photograph a meal for today's journal page" },
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
  const [step, setStep] = useState<"choose" | "analysing" | "review" | "confirm">("choose");
  const [camOpen, setCamOpen] = useState(false);
  // Arriving with ?mode= means the choice is already made (Scan a receipt, Log breakfast …),
  // so go straight to camera / upload / by hand. The list is one click away if it was wrong.
  const [picking, setPicking] = useState(!MODES.some((m) => m.k === initialMode));
  // Foods picked from the barcode/search panel, before they become a meal draft.
  const [picked, setPicked] = useState<ScanRow[]>([]);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  // The calorie camera and the journal camera are both food scans; the journal one
  // just asks for less, because the model names the food and does the nutrition.
  const foodMode = mode === "calorie" || mode === "journal";
  const suggested = guessSlot();
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
    await analyse(stored);
  }

  /** Runs the AI over an already-uploaded photo. Separate so "Analyse again" costs no second upload. */
  async function analyse(storedPath: string) {
    setStep("analysing");
    try {
      // The server has its own budget; this is the last line of defence so the
      // spinner can never run forever if the request is lost in transit.
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), 75_000);
      let res: Response;
      try {
        res = await fetch("/api/scan", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ path: storedPath, mode }),
          signal: abort.signal
        });
      } finally {
        clearTimeout(timer);
      }
      const d = (await res.json()) as ScanDraft & { error?: string };
      if (d.error) {
        setErr(d.error);
        setStep("choose");
        return;
      }
      if (d.slot) setSlot(d.slot);
      setDraft({ ...d, rows: d.rows.length ? d.rows : [{ name: "" }] });
      setStep("review");
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === "AbortError";
      setErr(aborted ? "The scan took too long. Try again, or enter the meal by hand." : "Could not reach the server. Check your connection and try again.");
      setStep("choose");
    }
  }

  function manual() {
    // The journal camera has no food fields of its own — the model fills them in. Typing
    // a meal out by hand is the calorie camera's job, so hand the person over to it.
    const m = mode === "journal" ? "calorie" : mode;
    setMode(m);
    setDraft({ mode: m, rows: [{ name: "" }], ai: false });
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
          // Barcode picks and journal photos are meals like any other; the camera is
          // only how they were entered.
          mode: mode === "barcode" || mode === "journal" ? "calorie" : mode,
          photo_path: path,
          // A receipt is filed on the day it was printed, not the day it was scanned.
          date: (mode === "receipt" && draft.date) || date,
          slot, title: draft.title, merchant: draft.merchant, total: draft.total, category: draft.category,
          time: draft.time, subtotal: draft.subtotal, tax: draft.tax, discount: draft.discount,
          payment_method: draft.payment_method,
          rows: rows.map((x) => ({ ...x, fridge_category: x.fridge_category ?? undefined }))
        });
        router.push(r.redirect);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Could not save");
      }
    });
  }

  // Recomputed on every keystroke, so editing a portion updates the meal total.
  const round1 = (v: number) => Math.round(v * 10) / 10;
  const totals = (draft?.rows ?? []).reduce(
    (a, r) => ({
      kcal: a.kcal + (r.kcal ?? 0),
      protein_g: round1(a.protein_g + (r.protein_g ?? 0)),
      carbs_g: round1(a.carbs_g + (r.carbs_g ?? 0)),
      fat_g: round1(a.fat_g + (r.fat_g ?? 0))
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );

  return (
    <>
      <header className="head">
        <div className="titles"><span className="lbl">AI camera</span><h1 className="h1">{MODES.find((m) => m.k === mode)?.label}</h1></div>
        <button className="btn" onClick={() => router.back()}>Close</button>
      </header>

      {step === "choose" && (
        <div className={picking ? "split" : "snap-single"}>
          {picking ? (
            <section className="grow" aria-label="What are you scanning?" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span className="lbl">What are you scanning?</span>
              {ordered.map((m, i) => (
                <button key={m.k} className="card" onClick={() => { setMode(m.k); setPicking(false); }} aria-pressed={mode === m.k}
                  style={{ textAlign: "left", cursor: "pointer", padding: 14, borderWidth: mode === m.k ? 2 : 1, borderColor: mode === m.k ? "var(--ink)" : "var(--line)", background: mode === m.k ? "#f4f7e6" : "#fff" }}>
                  <strong>{m.label}</strong> {i === 0 && <span className="chip" style={{ minHeight: 20, fontSize: 10 }}>suggested here</span>}
                  <div className="muted">{m.desc}</div>
                </button>
              ))}
            </section>
          ) : (
            <p className="muted snap-mode-line">
              {MODES.find((m) => m.k === mode)?.desc}. <button type="button" className="link-btn" onClick={() => setPicking(true)}>Scan something else</button>
            </p>
          )}
          {mode === "barcode" ? (
            <div className="side-col" style={{ gap: 10 }}>
              <FoodLookup onAdd={(row) => setPicked((p) => [...p, row])} />
              {picked.length > 0 && (
                <section className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <span className="lbl">{picked.length} added to this meal</span>
                  {picked.map((p, i) => (
                    <div className="row" key={i}>
                      <span style={{ flex: 1 }}>{p.name} <span className="muted">· {p.portion}</span></span>
                      <strong>{p.kcal} kcal</strong>
                      <button className="btn sm" onClick={() => setPicked(picked.filter((_, j) => j !== i))} aria-label={`Remove ${p.name}`}>×</button>
                    </div>
                  ))}
                  <button
                    className="btn pri"
                    onClick={() => {
                      setDraft({ mode: "calorie", rows: picked, ai: false });
                      setMode("calorie");
                      setStep("review");
                    }}
                  >
                    Review &amp; save
                  </button>
                </section>
              )}
            </div>
          ) : (
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
          )}
        </div>
      )}

      {step === "analysing" && (
        <section className="card" style={{ display: "flex", gap: 16, alignItems: "center" }}>
          {preview && <img src={preview} alt="Your photo" style={{ width: 160, borderRadius: 12 }} />}
          <p>Analysing your meal…</p>
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

            {mode === "calorie" && (
              <label className="field">Meal name<input className="input" value={draft.title ?? ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
            )}
            {mode === "journal" && draft.title && (
              <p className="recognised">Recognised: <strong>{draft.title}</strong></p>
            )}
            {foodMode && (
              <fieldset className="slot-pick">
                <legend className="lbl">Which meal is this?</legend>
                {SLOTS.map((sl) => (
                  <button
                    key={sl.k}
                    type="button"
                    className={`slot-chip ${slot === sl.k ? "on" : ""}`}
                    aria-pressed={slot === sl.k}
                    onClick={() => setSlot(sl.k)}
                  >
                    {sl.label}
                    {sl.k === suggested && <span className="slot-hint">now</span>}
                  </button>
                ))}
              </fieldset>
            )}
            {mode === "receipt" && (
              <div className="receipt-fields">
                <label className="field" style={{ flex: "2 1 180px" }}>Store<input className="input" value={draft.merchant ?? ""} onChange={(e) => setDraft({ ...draft, merchant: e.target.value })} /></label>
                <label className="field" style={{ flex: "1 1 150px" }}>Date<input className="input" type="date" value={draft.date ?? date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} /></label>
                <label className="field" style={{ flex: "0 1 110px" }}>Time<input className="input" type="time" value={draft.time ?? ""} onChange={(e) => setDraft({ ...draft, time: e.target.value })} /></label>
                <label className="field" style={{ flex: "1 1 160px" }}>Category
                  <select className="input" value={draft.category ?? "groceries"} onChange={(e) => setDraft({ ...draft, category: e.target.value as ScanDraft["category"] })}>
                    <option value="groceries">Groceries</option><option value="daily_food">Daily food</option><option value="snacks_drinks">Snacks & drinks</option><option value="other">Other</option>
                  </select>
                </label>
                <label className="field" style={{ flex: "1 1 150px" }}>Payment method<input className="input" placeholder="card, cash…" value={draft.payment_method ?? ""} onChange={(e) => setDraft({ ...draft, payment_method: e.target.value })} /></label>
                <label className="field" style={{ flex: "1 1 110px" }}>Subtotal<input className="input" inputMode="decimal" value={draft.subtotal ?? ""} onChange={(e) => setDraft({ ...draft, subtotal: n(e.target.value) })} /></label>
                <label className="field" style={{ flex: "1 1 100px" }}>Tax / VAT<input className="input" inputMode="decimal" value={draft.tax ?? ""} onChange={(e) => setDraft({ ...draft, tax: n(e.target.value) })} /></label>
                <label className="field" style={{ flex: "1 1 100px" }}>Discount<input className="input" inputMode="decimal" value={draft.discount ?? ""} onChange={(e) => setDraft({ ...draft, discount: n(e.target.value) })} /></label>
                <label className="field" style={{ flex: "1 1 120px" }}>Total paid<input className="input" inputMode="decimal" value={draft.total ?? ""} onChange={(e) => setDraft({ ...draft, total: n(e.target.value) })} /></label>
              </div>
            )}

            {mode !== "journal" && mode !== "calorie" && draft.rows.map((r, i) => (
              <div key={i} className="row" style={{ flexWrap: "wrap" }}>
                <input className="input" style={{ flex: "2 1 140px" }} placeholder="Item" value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} aria-label="Item name" />
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
            {foodMode && draft.rows.map((r, i) => (
              <div key={i} className="item-card">
                <div className="item-head">
                  {mode === "journal"
                    ? <strong style={{ flex: "2 1 160px" }}>{r.name || "Unnamed item"}</strong>
                    : <input className="input" style={{ flex: "2 1 160px" }} placeholder="Food" value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} aria-label={`Food ${i + 1}`} />}
                  <input className="input" style={{ flex: "1 1 110px" }} placeholder="Portion" value={r.portion ?? ""} onChange={(e) => setRow(i, { portion: e.target.value })} aria-label={`Portion of ${r.name || "item " + (i + 1)}`} />
                  <input className="input" style={{ width: 86 }} placeholder="grams" inputMode="numeric" value={r.grams ?? ""} onChange={(e) => setRow(i, { grams: n(e.target.value) })} aria-label={`Grams of ${r.name || "item " + (i + 1)}`} />
                  {r.source === "db" && <span className="chip">from food database</span>}
                  {r.unsure && <span className="chip warn">unsure</span>}
                  <button className="btn sm" onClick={() => setDraft({ ...draft, rows: draft.rows.filter((_, j) => j !== i) })} aria-label={`Remove ${r.name || "item " + (i + 1)}`}>×</button>
                </div>
                <div className="item-macros" hidden={mode === "journal"}>
                  <label className="field"><span className="lbl">kcal</span><input className="input" inputMode="numeric" value={r.kcal ?? ""} onChange={(e) => setRow(i, { kcal: n(e.target.value) })} /></label>
                  <label className="field"><span className="lbl">protein g</span><input className="input" inputMode="decimal" value={r.protein_g ?? ""} onChange={(e) => setRow(i, { protein_g: n(e.target.value) })} /></label>
                  <label className="field"><span className="lbl">carbs g</span><input className="input" inputMode="decimal" value={r.carbs_g ?? ""} onChange={(e) => setRow(i, { carbs_g: n(e.target.value) })} /></label>
                  <label className="field"><span className="lbl">fat g</span><input className="input" inputMode="decimal" value={r.fat_g ?? ""} onChange={(e) => setRow(i, { fat_g: n(e.target.value) })} /></label>
                </div>
                {r.ingredients?.length ? <p className="muted" style={{ fontSize: 12 }}>Ingredients: {r.ingredients.join(", ")}</p> : null}
              </div>
            ))}
            {mode !== "journal" && <button className="btn sm" style={{ alignSelf: "flex-start" }} onClick={() => setDraft({ ...draft, rows: [...draft.rows, { name: "" }] })}>+ Add something it missed</button>}
            {foodMode && (
              <div className="totals" aria-live="polite">
                <strong>Total ≈ {totals.kcal} kcal</strong>
                <span>protein {totals.protein_g} g</span>
                <span>carbs {totals.carbs_g} g</span>
                <span>fat {totals.fat_g} g</span>
              </div>
            )}
            <p className="muted">
              All nutrition figures are estimates from the photo, not measurements — correct anything that looks wrong.
              Nothing is saved until you press Save.
            </p>
            {path && (
              <button className="btn sm" style={{ alignSelf: "flex-start" }} onClick={() => void analyse(path)} disabled={pending}>
                Analyse the photo again
              </button>
            )}
            {err && <p style={{ color: "#a32d2d", fontSize: 13 }}>{err}</p>}
            <button className="btn pri" onClick={() => (mode === "receipt" ? (setErr(""), setStep("confirm")) : confirm())} disabled={pending}>
              {mode === "receipt" ? "Review this receipt" : pending ? "Saving…" : "Save to my journal"}
            </button>
          </section>
        </div>
      )}
      {step === "confirm" && draft && (
        <div className="split">
          <section className="side-col">
            {preview ? <img src={preview} alt="Your receipt" style={{ width: "100%", borderRadius: 14 }} /> : <div className="thumb" />}
          </section>
          <section className="card grow" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span className="lbl">Check this before it goes in your budget</span>
            <h2 className="h2">{draft.merchant?.trim() || "Receipt"}</h2>
            <p className="muted">
              {draft.date ?? date}{draft.time ? ` · ${draft.time}` : ""} · {CATEGORY_LABEL[draft.category ?? "groceries"]}
              {draft.payment_method ? ` · ${draft.payment_method}` : ""}
            </p>
            <ul className="receipt-lines">
              {draft.rows.filter((r) => r.name.trim()).map((r, i) => (
                <li key={i}>
                  <span>{r.qty ? `${r.qty}× ` : ""}{r.name}</span>
                  <span>{r.price !== undefined ? r.price.toLocaleString("en-US") : "—"}</span>
                </li>
              ))}
            </ul>
            <dl className="receipt-sums">
              {draft.subtotal !== undefined && <><dt>Subtotal</dt><dd>{draft.subtotal.toLocaleString("en-US")}</dd></>}
              {draft.tax !== undefined && <><dt>Tax / VAT</dt><dd>{draft.tax.toLocaleString("en-US")}</dd></>}
              {draft.discount !== undefined && <><dt>Discount</dt><dd>−{draft.discount.toLocaleString("en-US")}</dd></>}
              <dt className="grand">Total paid</dt>
              <dd className="grand">{(draft.total ?? 0).toLocaleString("en-US")}</dd>
            </dl>
            {draft.rows.some((r) => r.fridge_category) && (
              <p className="muted" style={{ fontSize: 13 }}>
                Items with a shelf will be sent to the fridge for you to confirm.
              </p>
            )}
            {err && <p style={{ color: "#a32d2d", fontSize: 13 }}>{err}</p>}
            <div className="confirm-actions">
              <button className="btn pri" onClick={confirm} disabled={pending}>{pending ? "Saving…" : "Confirm and save"}</button>
              <button className="btn" onClick={() => setStep("review")} disabled={pending}>Edit details</button>
              <button className="btn" onClick={() => { setStep("choose"); setDraft(null); setPreview(null); setPath(undefined); }} disabled={pending}>Retake photo</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

const CATEGORY_LABEL: Record<string, string> = {
  groceries: "Groceries",
  daily_food: "Daily food",
  snacks_drinks: "Snacks & drinks",
  other: "Other"
};

function guessSlot() {
  const h = new Date().getHours();
  return h < 11 ? "breakfast" : h < 16 ? "lunch" : h < 21 ? "dinner" : "snack";
}
