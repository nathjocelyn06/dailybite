import "server-only";
import { type Db, must } from "./db";

export type ArchiveHit = {
  type: "journal" | "meal" | "expense" | "fridge" | "recipe" | "photo" | "receipt";
  id: string;
  date: string;
  title: string;
  subtitle: string;
  href: string; // opens the ORIGINAL record. The archive never copies data.
};

type Q = { query?: string; type?: ArchiveHit["type"] | "all"; from?: string; to?: string; limit?: number };

export async function searchArchive(db: Db, q: Q): Promise<ArchiveHit[]> {
  const want = (t: ArchiveHit["type"]) => !q.type || q.type === "all" || q.type === t;
  const like = q.query ? `%${q.query.replace(/[%_]/g, "")}%` : null;
  const limit = q.limit ?? 40;
  const jobs: Promise<ArchiveHit[]>[] = [];


  if (want("meal") || want("photo")) {
    jobs.push(
      (async () => {
        let b = db.sb.from("meals").select("id,date,slot,name,kcal,status,photo_path,place").eq("user_id", db.userId);
        if (like) b = b.or(`name.ilike.${like},place.ilike.${like},notes.ilike.${like}`);
        if (q.type === "photo") b = b.not("photo_path", "is", null);
        if (q.from) b = b.gte("date", q.from);
        if (q.to) b = b.lte("date", q.to);
        const rows = must(await b.order("date", { ascending: false }).limit(limit), "archive meals") as {
          id: string; date: string; slot: string; name: string; kcal: number | null; status: string; photo_path: string | null; place: string | null;
        }[];
        return rows.map((r) => ({
          type: (q.type === "photo" ? "photo" : "meal") as ArchiveHit["type"],
          id: r.id,
          date: r.date,
          title: `${r.slot}: ${r.name}`,
          subtitle: [r.kcal ? `${r.kcal} kcal` : null, r.status, r.place].filter(Boolean).join(" · "),
          href: `/journal?date=${r.date}&meal=${r.id}`
        }));
      })()
    );
  }
  if (want("expense") || want("receipt")) {
    jobs.push(
      (async () => {
        let b = db.sb.from("expenses").select("id,date,merchant,category,amount,receipt_path").eq("user_id", db.userId);
        if (like) b = b.or(`merchant.ilike.${like},note.ilike.${like}`);
        if (q.type === "receipt") b = b.not("receipt_path", "is", null);
        if (q.from) b = b.gte("date", q.from);
        if (q.to) b = b.lte("date", q.to);
        const rows = must(await b.order("date", { ascending: false }).limit(limit), "archive expenses") as {
          id: string; date: string; merchant: string; category: string; amount: number; receipt_path: string | null;
        }[];
        return rows.map((r) => ({
          type: (q.type === "receipt" ? "receipt" : "expense") as ArchiveHit["type"],
          id: r.id,
          date: r.date,
          title: r.merchant,
          subtitle: `${r.category.replace("_", " ")} · ${Number(r.amount).toLocaleString()}`,
          href: `/budget?expense=${r.id}`
        }));
      })()
    );
  }
  if (want("journal")) {
    jobs.push(
      (async () => {
        let b = db.sb.from("journal_pages").select("id,date,title,review,mood").eq("user_id", db.userId);
        if (like) b = b.or(`review.ilike.${like},title.ilike.${like}`);
        if (q.from) b = b.gte("date", q.from);
        if (q.to) b = b.lte("date", q.to);
        const rows = must(await b.order("date", { ascending: false }).limit(limit), "archive journal") as {
          id: string; date: string; title: string | null; review: string | null; mood: string | null;
        }[];
        return rows.map((r) => ({
          type: "journal" as const,
          id: r.id,
          date: r.date,
          title: r.title || "Journal page",
          subtitle: (r.review ?? "").slice(0, 90),
          href: `/journal?date=${r.date}`
        }));
      })()
    );
  }
  if (want("fridge")) {
    jobs.push(
      (async () => {
        let b = db.sb.from("fridge_events").select("id,item_name,kind,delta,created_at").eq("user_id", db.userId);
        if (like) b = b.ilike("item_name", like);
        if (q.from) b = b.gte("created_at", `${q.from}T00:00:00`);
        if (q.to) b = b.lte("created_at", `${q.to}T23:59:59`);
        const rows = must(await b.order("created_at", { ascending: false }).limit(limit), "archive fridge") as {
          id: string; item_name: string; kind: string; delta: number | null; created_at: string;
        }[];
        return rows.map((r) => ({
          type: "fridge" as const,
          id: r.id,
          date: r.created_at.slice(0, 10),
          title: `${r.item_name}: ${r.kind}`,
          subtitle: r.delta ? `${r.delta > 0 ? "+" : ""}${r.delta}` : "",
          href: `/fridge`
        }));
      })()
    );
  }
  if (want("recipe")) {
    jobs.push(
      (async () => {
        let b = db.sb.from("recipes").select("id,title,folder,updated_at,source,external_id").eq("user_id", db.userId);
        if (like) b = b.ilike("title", like);
        const rows = must(await b.order("updated_at", { ascending: false }).limit(limit), "archive recipes") as {
          id: string; title: string; folder: string | null; updated_at: string; source: string; external_id: string | null;
        }[];
        return rows.map((r) => ({
          type: "recipe" as const,
          id: r.id,
          date: r.updated_at.slice(0, 10),
          title: r.title,
          subtitle: r.folder ?? "",
          href: r.source === "themealdb" && r.external_id ? `/recipes/themealdb/${r.external_id}` : `/recipes/mine/${r.id}`
        }));
      })()
    );
  }
  const all = (await Promise.all(jobs)).flat();
  return all.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, limit);
}

export type ArchiveMonth = { month: string; year: string; count: number };

/**
 * Archive › month/year browser. Counts the records that actually exist per month
 * (meals, expenses, journal pages) so empty months never show up as dead links.
 */
export async function archiveMonths(db: Db): Promise<ArchiveMonth[]> {
  const [meals, expenses, pages] = await Promise.all([
    db.sb.from("meals").select("date").eq("user_id", db.userId),
    db.sb.from("expenses").select("date").eq("user_id", db.userId),
    db.sb.from("journal_pages").select("date").eq("user_id", db.userId)
  ]);
  const counts = new Map<string, number>();
  for (const [res, what] of [[meals, "archive months: meals"], [expenses, "archive months: expenses"], [pages, "archive months: journal"]] as const) {
    for (const row of must(res, what) as { date: string }[]) {
      const m = row.date.slice(0, 7);
      counts.set(m, (counts.get(m) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([month, count]) => ({ month, year: month.slice(0, 4), count }))
    .sort((a, b) => (a.month < b.month ? 1 : -1));
}

