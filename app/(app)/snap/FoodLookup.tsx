"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ScanRow } from "@/lib/scan-types";

type Hit = {
  code: string;
  name: string;
  brand?: string;
  image?: string;
  per100: { kcal?: number; protein_g?: number; carbs_g?: number; fat_g?: number };
  serving?: { label: string; grams?: number };
};

/** BarcodeDetector is not in the TS DOM lib yet. */
type DetectedBarcode = { rawValue: string };
type BarcodeDetectorLike = { detect(source: CanvasImageSource): Promise<DetectedBarcode[]> };
declare global {
  interface Window {
    BarcodeDetector?: new (opts?: { formats?: string[] }) => BarcodeDetectorLike;
  }
}

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"];
const r1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Packaged-food logging, the way MyFitnessPal does it: scan a barcode or search by
 * name, pick a serving, add it to the meal. Everything comes from Open Food Facts,
 * which needs no API key — so this works whether or not a vision model is configured.
 */
export function FoodLookup({ onAdd }: { onAdd: (row: ScanRow) => void }) {
  const [tab, setTab] = useState<"scan" | "search">("scan");
  const [hits, setHits] = useState<Hit[]>([]);
  const [chosen, setChosen] = useState<Hit | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [manual, setManual] = useState("");

  const lookup = useCallback(async (params: string, label: string) => {
    setBusy(true);
    setNote("");
    setChosen(null);
    try {
      const res = await fetch(`/api/food?${params}`);
      const data = (await res.json()) as { hits: Hit[]; note?: string };
      setHits(data.hits ?? []);
      if (data.note) setNote(data.note);
      if (data.hits?.length === 1) setChosen(data.hits[0]);
      if (!data.hits?.length && !data.note) setNote(`Nothing found for ${label}.`);
    } catch {
      setNote("Could not reach the food database. Check your connection.");
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <section className="card side-col" style={{ gap: 10 }}>
      <nav className="seg-links" aria-label="Lookup method">
        <button className={tab === "scan" ? "on" : ""} onClick={() => setTab("scan")} aria-current={tab === "scan" ? "page" : undefined}>Scan barcode</button>
        <button className={tab === "search" ? "on" : ""} onClick={() => setTab("search")} aria-current={tab === "search" ? "page" : undefined}>Search</button>
      </nav>

      {tab === "scan" ? (
        <BarcodeScanner onCode={(code) => void lookup(`barcode=${encodeURIComponent(code)}`, code)} manual={manual} setManual={setManual} busy={busy} />
      ) : (
        <form
          style={{ display: "flex", gap: 8 }}
          onSubmit={(e) => { e.preventDefault(); void lookup(`q=${encodeURIComponent(query)}`, `“${query}”`); }}
        >
          <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Greek yogurt, oat milk…" aria-label="Search foods" />
          <button className="btn pri" disabled={busy || query.trim().length < 2}>{busy ? "…" : "Search"}</button>
        </form>
      )}

      {note && <p className="muted" style={{ fontSize: 13 }}>{note}</p>}

      {!chosen && hits.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
          {hits.map((h) => (
            <button key={h.code} className="food-hit" onClick={() => setChosen(h)}>
              <span style={{ flex: 1, textAlign: "left" }}>
                <strong>{h.name}</strong>
                {h.brand && <span className="muted"> · {h.brand}</span>}
                <br />
                <span className="muted" style={{ fontSize: 12 }}>{h.per100.kcal} kcal / 100 g</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {chosen && <ServingPicker hit={chosen} onBack={() => setChosen(null)} onAdd={onAdd} />}
    </section>
  );
}

function BarcodeScanner({
  onCode,
  manual,
  setManual,
  busy
}: {
  onCode: (code: string) => void;
  manual: string;
  setManual: (v: string) => void;
  busy: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<"idle" | "scanning" | "unsupported" | "error">("idle");
  const [err, setErr] = useState("");

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  async function start() {
    setErr("");
    if (typeof window === "undefined" || !window.BarcodeDetector) {
      // Safari has no BarcodeDetector; typing the digits still works everywhere.
      setState("unsupported");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        await v.play().catch(() => undefined);
      }
      setState("scanning");

      const detector = new window.BarcodeDetector({ formats: FORMATS });
      const tick = async () => {
        if (!streamRef.current || !videoRef.current?.videoWidth) return;
        try {
          const found = await detector.detect(videoRef.current);
          const code = found[0]?.rawValue;
          if (code) {
            stop();
            setState("idle");
            onCode(code);
            return;
          }
        } catch {
          /* a frame that won't decode is normal; keep going */
        }
        requestAnimationFrame(() => void tick());
      };
      void tick();
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      setErr(name === "NotAllowedError" ? "Camera permission was blocked." : "Could not open the camera.");
      setState("error");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {state === "scanning" && (
        <div className="camera-stage" style={{ aspectRatio: "4/3" }}>
          <video ref={videoRef} playsInline muted autoPlay className="camera-video" />
          <p className="camera-hint">Point at the barcode</p>
        </div>
      )}
      {state !== "scanning" && (
        <button className="btn pri" onClick={() => void start()} disabled={busy}>Scan a barcode</button>
      )}
      {state === "unsupported" && (
        <p className="muted" style={{ fontSize: 13 }}>This browser can&apos;t scan barcodes (Safari doesn&apos;t support it yet). Type the number under the barcode instead.</p>
      )}
      {err && <p style={{ color: "#a32d2d", fontSize: 13 }}>{err}</p>}
      <form
        style={{ display: "flex", gap: 8 }}
        onSubmit={(e) => { e.preventDefault(); onCode(manual); }}
      >
        <input className="input" inputMode="numeric" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="or type the barcode digits" aria-label="Barcode number" />
        <button className="btn" disabled={busy || manual.replace(/\D/g, "").length < 6}>Look up</button>
      </form>
    </div>
  );
}

function ServingPicker({ hit, onBack, onAdd }: { hit: Hit; onBack: () => void; onAdd: (row: ScanRow) => void }) {
  const packGrams = hit.serving?.grams;
  const [mode, setMode] = useState<"pack" | "100" | "custom">(packGrams ? "pack" : "100");
  const [qty, setQty] = useState("1");
  const [custom, setCustom] = useState(String(packGrams ?? 100));

  const unit = mode === "pack" && packGrams ? packGrams : mode === "100" ? 100 : Number(custom) || 0;
  const count = Number(qty) || 0;
  const grams = r1(unit * count);
  const f = grams / 100;
  const at = (v: number | undefined) => (v === undefined ? undefined : r1(v * f));

  const row: ScanRow = {
    name: hit.brand ? `${hit.name} (${hit.brand})` : hit.name,
    portion:
      mode === "pack" && hit.serving ? `${qty} × ${hit.serving.label}` : mode === "100" ? `${grams} g` : `${grams} g`,
    grams,
    kcal: at(hit.per100.kcal),
    protein_g: at(hit.per100.protein_g),
    carbs_g: at(hit.per100.carbs_g),
    fat_g: at(hit.per100.fat_g),
    source: "db"
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <strong>{hit.name}</strong>
        {hit.brand && <span className="muted"> · {hit.brand}</span>}
      </div>

      <div className="seg-links" role="group" aria-label="Serving">
        {packGrams && <button className={mode === "pack" ? "on" : ""} onClick={() => setMode("pack")}>{hit.serving?.label}</button>}
        <button className={mode === "100" ? "on" : ""} onClick={() => setMode("100")}>100 g</button>
        <button className={mode === "custom" ? "on" : ""} onClick={() => setMode("custom")}>Grams</button>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        {mode === "custom" ? (
          <label className="field" style={{ flex: 1 }}>Grams
            <input className="input" inputMode="decimal" value={custom} onChange={(e) => setCustom(e.target.value)} />
          </label>
        ) : (
          <label className="field" style={{ flex: 1 }}>How many
            <input className="input" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
          </label>
        )}
      </div>

      <div className="totals">
        <strong>{row.kcal ?? "?"} kcal</strong>
        <span>protein {row.protein_g ?? "?"} g</span>
        <span>carbs {row.carbs_g ?? "?"} g</span>
        <span>fat {row.fat_g ?? "?"} g</span>
        <span className="muted">{grams} g</span>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn pri" onClick={() => onAdd(row)} disabled={!grams}>Add to meal</button>
        <button className="btn" onClick={onBack}>Back to results</button>
      </div>
    </div>
  );
}
