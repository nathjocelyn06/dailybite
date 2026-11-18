"use client";
import { useRef, useState } from "react";
import { uploadScanPhotoAction, photoUrlAction } from "../actions";

/** Square crop size we upload. Big enough to stay sharp on the page, small enough to send fast. */
const OUT = 900;

/**
 * Photo for the scrapbook: pick from camera or gallery, frame it, upload it.
 *
 * The crop is a square the photo is panned and zoomed inside — enough to get the food
 * centred without building a full crop tool. Only the cropped square is uploaded, so
 * the page never carries a 12 MP original around.
 */
export function PhotoDrop({ onPlaced, onCancel }: { onPlaced: (path: string, url: string | null) => void; onCancel: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const drag = useRef<{ x: number; y: number } | null>(null);

  function pick(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setErr("Choose an image file.");
    setErr("");
    setZoom(1);
    setPos({ x: 0, y: 0 });
    setSrc(URL.createObjectURL(file));
  }

  async function use() {
    const img = imgRef.current;
    if (!img) return;
    setBusy(true);
    setErr("");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = OUT;
      canvas.height = OUT;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not prepare the image");

      // The preview is a square box; mirror exactly what it shows into the canvas.
      const box = img.parentElement!.getBoundingClientRect();
      const scale = OUT / box.width;
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const base = Math.max(box.width / w, box.height / h) * zoom;
      const drawW = w * base * scale;
      const drawH = h * base * scale;
      const cx = (OUT - drawW) / 2 + pos.x * scale;
      const cy = (OUT - drawH) / 2 + pos.y * scale;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, OUT, OUT);
      ctx.drawImage(img, cx, cy, drawW, drawH);

      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.88));
      if (!blob) throw new Error("Could not read the image");

      const fd = new FormData();
      fd.append("file", new File([blob], `journal-${Date.now()}.jpg`, { type: "image/jpeg" }));
      const { path } = await uploadScanPhotoAction(fd);
      const url = await photoUrlAction(path);
      onPlaced(path, url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not add the photo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-label="Add a photo" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <span className="lbl">Add a photo</span>

      {!src ? (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr"
            onChange={(e) => pick(e.target.files?.[0])}
            aria-label="Choose a photo"
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn pri" onClick={() => fileRef.current?.click()}>Choose a photo</button>
            <button className="btn" onClick={onCancel}>Cancel</button>
          </div>
          <p className="muted" style={{ fontSize: 12 }}>On a phone this offers the camera as well as the gallery.</p>
        </>
      ) : (
        <>
          <div
            className="crop-box"
            onPointerDown={(e) => { drag.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); }}
            onPointerMove={(e) => { if (drag.current) setPos({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y }); }}
            onPointerUp={() => { drag.current = null; }}
            onPointerCancel={() => { drag.current = null; }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={src}
              alt="Photo to place"
              style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${zoom})` }}
              draggable={false}
            />
          </div>
          <label className="field">Zoom
            <input type="range" min="1" max="3" step="0.05" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
          </label>
          {err && <p style={{ color: "#a32d2d", fontSize: 13 }} role="alert">{err}</p>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn pri" disabled={busy} onClick={() => void use()}>{busy ? "Adding…" : "Place on the page"}</button>
            <button className="btn" disabled={busy} onClick={() => setSrc(null)}>Pick another</button>
            <button className="btn" disabled={busy} onClick={onCancel}>Cancel</button>
          </div>
          <p className="muted" style={{ fontSize: 12 }}>Drag the photo to frame it. Only the square you see is uploaded.</p>
        </>
      )}
    </section>
  );
}
