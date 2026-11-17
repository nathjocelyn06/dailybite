import "server-only";
import type { Db } from "./db";

const BUCKET = "photos";

/** Signed URLs for private photos (default 1 hour). Missing paths map to null. */
export async function signedUrls(db: Db, paths: (string | null | undefined)[], seconds = 3600): Promise<Record<string, string>> {
  const list = [...new Set(paths.filter((p): p is string => !!p))];
  if (!list.length) return {};
  // Owner-scope guard for the service-role client: paths always start with "<user_id>/".
  const own = list.filter((p) => p.startsWith(`${db.userId}/`));
  const { data, error } = await db.sb.storage.from(BUCKET).createSignedUrls(own, seconds);
  if (error || !data) return {};
  const out: Record<string, string> = {};
  for (const d of data) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  return out;
}

/** Upload bytes (server side) under <user_id>/<folder>/<timestamp>.<ext>. */
export async function uploadPhoto(db: Db, folder: string, bytes: ArrayBuffer, contentType: string): Promise<string> {
  const ext = contentType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
  const path = `${db.userId}/${folder}/${Date.now()}.${ext}`;
  const { error } = await db.sb.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: false });
  if (error) throw new Error(`upload failed: ${error.message}`);
  return path;
}

export async function downloadPhoto(db: Db, path: string): Promise<{ base64: string; mediaType: string }> {
  if (!path.startsWith(`${db.userId}/`)) throw new Error("Not your photo");
  const { data, error } = await db.sb.storage.from(BUCKET).download(path);
  if (error || !data) throw new Error(`download failed: ${error?.message}`);
  const buf = Buffer.from(await data.arrayBuffer());
  return { base64: buf.toString("base64"), mediaType: data.type || "image/jpeg" };
}
