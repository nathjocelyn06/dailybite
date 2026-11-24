import Link from "next/link";
import { webDb } from "@/lib/services/db";
import { searchArchive, type ArchiveHit } from "@/lib/services/archive";
import { isDayKey } from "@/lib/dates";

const TYPES: { k: ArchiveHit["type"] | "all"; label: string }[] = [
  { k: "all", label: "All" }, { k: "journal", label: "Journal" }, { k: "meal", label: "Meals" }, { k: "expense", label: "Expenses" },
  { k: "fridge", label: "Fridge & grocery" }, { k: "recipe", label: "Recipes" }, { k: "photo", label: "Photos" }, { k: "receipt", label: "Receipts" }
];

/** Archive (tab 4) = List (this page: search over existing records) + Calendar (/calendar). Every result opens the original record (no copies). */
export default async function ArchivePage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; from?: string; to?: string }> }) {
  const sp = await searchParams;
  const type = (TYPES.find((t) => t.k === sp.type)?.k ?? "all") as ArchiveHit["type"] | "all";
  const db = await webDb();
  const hits = await searchArchive(db, {
    query: sp.q || undefined,
    type,
    from: isDayKey(sp.from) ? sp.from : undefined,
    to: isDayKey(sp.to) ? sp.to : undefined,
    limit: 60
  });

  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(type !== "all" ? { type } : {}), ...(sp.from ? { from: sp.from } : {}), ...(sp.to ? { to: sp.to } : {}), ...patch });
    for (const [k, v] of [...p.entries()]) if (!v || v === "all") p.delete(k);
    return `/archive?${p.toString()}`;
  };

  return (
    <>
      <header className="head"><div className="titles"><span className="lbl">Archive</span><h1 className="h1">Everything I&apos;ve recorded</h1></div></header>
      <nav className="seg-links" aria-label="Archive views">
        <Link href="/archive" aria-current="page">List</Link>
        <Link href="/calendar">Calendar</Link>
      </nav>
      <form className="card" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }} action="/archive">
        <label className="field" style={{ flex: "2 1 260px" }}>Search<input className="input" type="search" name="q" defaultValue={sp.q ?? ""} placeholder="ramen, Sinchon, birthday…" /></label>
        <label className="field">From<input className="input" type="date" name="from" defaultValue={sp.from ?? ""} /></label>
        <label className="field">To<input className="input" type="date" name="to" defaultValue={sp.to ?? ""} /></label>
        {type !== "all" && <input type="hidden" name="type" value={type} />}
        <button className="btn pri">Search</button>
      </form>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {TYPES.map((t) => <Link key={t.k} href={qs({ type: t.k })} className={`chip ${type === t.k ? "on" : ""}`} style={{ minHeight: 36, textDecoration: "none" }}>{t.label}</Link>)}
      </div>

      <section className="card" aria-label="Results">
        <p className="muted" style={{ marginBottom: 6 }}>
          {hits.length} records
          {(sp.from || sp.to) && <> · <Link href={qs({ from: "", to: "" })}>clear the dates</Link></>}
        </p>
        {hits.length === 0 && <p className="muted">Nothing matches. Try another search or filter.</p>}
        {hits.map((h) => (
          <div className="row" key={`${h.type}-${h.id}`}>
            <span className="chip">{h.type}</span>
            <span className="muted" style={{ width: 92 }}>{h.date}</span>
            <span style={{ flex: 1 }}><strong>{h.title}</strong>{h.subtitle && <><br /><span className="muted">{h.subtitle}</span></>}</span>
            <Link className="btn sm" href={h.href}>Open original</Link>
          </div>
        ))}
      </section>

    </>
  );
}
