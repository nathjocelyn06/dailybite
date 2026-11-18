"use client";
import { useRef, useState, useTransition } from "react";
import { Photo } from "@/components/Photo";
import { photoUrlAction, updateMealAction, uploadScanPhotoAction } from "@/app/(app)/actions";

/**
 * A polaroid's photo, replaceable while the journal is being edited.
 *
 * The "Change photo" overlay is hidden until `.journal-sheet` carries `is-editing`, so
 * it appears with Edit Journal without the meals (rendered on the server) having to know
 * about the editor's state.
 *
 * The file goes to a server action, which writes it to the private bucket — the browser
 * has had no Supabase client since v3.1 — and the meal row is then pointed at the new path.
 */
export function MealPhoto({ mealId, src, alt }: { mealId: string; src: string | null; alt: string }) {
  const [url, setUrl] = useState(src);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function onFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setErr("Pick an image file.");
    if (file.size > 8 * 1024 * 1024) return setErr("That image is over 8 MB.");
    setErr("");
    start(async () => {
      try {
        const fd = new FormData();
        fd.append("file", file);
        const { path } = await uploadScanPhotoAction(fd);
        await updateMealAction({ id: mealId, photo_path: path });
        setUrl(await photoUrlAction(path));
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Could not change the photo.");
      }
    });
  }

  return (
    <div className="meal-photo">
      <Photo src={url} alt={alt} style={{ borderRadius: 1 }} />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr"
        onChange={(e) => onFile(e.target.files?.[0])}
        aria-label={`Change the photo for ${alt}`}
      />
      <button type="button" className="meal-photo-edit" onClick={() => fileRef.current?.click()} disabled={pending}>
        {pending ? "Uploading…" : "Change photo"}
      </button>
      {err && <p className="meal-photo-err">{err}</p>}
    </div>
  );
}
