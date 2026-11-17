import { SnapClient } from "./SnapClient";
import { webDb } from "@/lib/services/db";
import { dayKey } from "@/lib/dates";

export default async function SnapPage({ searchParams }: { searchParams: Promise<{ mode?: string; slot?: string; date?: string }> }) {
  const sp = await searchParams;
  const db = await webDb();
  return <SnapClient initialMode={sp.mode} initialSlot={sp.slot} date={sp.date ?? dayKey(new Date(), db.tz)} />;
}
