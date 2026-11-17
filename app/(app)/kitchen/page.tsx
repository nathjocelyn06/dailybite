/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { webDb } from "@/lib/services/db";
import { getKitchenOverview } from "@/lib/services/kitchen";
import { KITCHEN_SERVICES } from "@/lib/nav";
import { ServiceTile } from "@/components/Services";
import { NavIcon } from "@/components/NavIcon";
import { ActionButton } from "@/components/ActionButton";
import { boughtAction } from "../actions";

/**
 * My Kitchen (tab 2): food at home, nothing else.
 *   Fridge card   → Stock · To buy · Scan groceries
 *   Recipes card  → Find · Saved · Cook from my fridge
 *   then: What can I cook tonight? · Use soon · To buy preview.
 * Loop: use soon → cook tonight → recipe → "I cooked this" (uses stock, logs to Journal);
 * missing items → To buy → scan receipt → back into the fridge (pending until confirmed).
 */
export default async function KitchenPage() {
  const db = await webDb();
  const k = await getKitchenOverview(db);
  const fridge = KITCHEN_SERVICES.filter((s) => s.group === "fridge");
  const recipes = KITCHEN_SERVICES.filter((s) => s.group === "recipes");
  const sub: Record<string, string> = {
    "/fridge": `${k.fridge.total} items`,
    "/fridge?tab=list": `${k.to_buy.open} to buy`,
    "/snap?mode=receipt": "receipt or items",
    "/recipes": "search · videos",
    "/recipes?tab=collection": `${k.recipes.saved} saved`,
    "/recipes?tab=scanner": "uses what you have"
  };
  const days = (n: number | null) => (n === null || n < 0 ? "expired" : n === 0 ? "today" : `${n} day${n === 1 ? "" : "s"}`);

  return (
    <>
      <header className="head">
        <div className="titles"><span className="lbl">My Kitchen</span><h1 className="h1">What&apos;s in my kitchen?</h1></div>
        <form action="/recipes" role="search" className="hero-search" style={{ border: "1px solid var(--grid)" }}>
          <NavIcon name="search" size={18} />
          <label className="sr" htmlFor="kitchen-search">Search an ingredient or recipe</label>
          <input id="kitchen-search" type="search" name="query" placeholder="Search an ingredient or recipe" />
        </form>
      </header>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        {([["Fridge", "What you have and what to buy", "/fridge", "fridge", "emerald", fridge],
           ["Recipes", "Find, save and cook", "/recipes", "recipes", "vermilion", recipes]] as const).map(([title, desc, href, icon, tone, items]) => (
          <section key={title} className="card" aria-label={title} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="head">
              <span className={`svc-icon tone-${tone}`} style={{ width: 52, height: 52 }}><NavIcon name={icon} size={26} /></span>
              <div className="titles" style={{ gap: 2 }}><h2 className="h2" style={{ fontSize: 18 }}>{title}</h2><span className="muted">{desc}</span></div>
              <Link className="btn" href={href}>Open</Link>
            </div>
            <nav aria-label={`${title} shortcuts`} className="svc-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
              {items.map((s) => <ServiceTile key={s.href} s={s} sub={sub[s.href]} />)}
            </nav>
          </section>
        ))}
      </div>

      <section className="card" aria-label="What can I cook tonight">
        <div className="head" style={{ marginBottom: 14 }}>
          <div className="titles" style={{ gap: 2 }}><h2 className="h2" style={{ fontSize: 18 }}>What can I cook tonight?</h2><span className="muted">Ranked by what&apos;s already in your fridge, expiring first</span></div>
          <Link href="/recipes?tab=scanner" className="muted">See all</Link>
        </div>
        {k.cook_tonight.length ? (
          <div className="hscroll">
            {k.cook_tonight.map((r) => (
              <Link key={r.external_id} href={`/recipes/themealdb/${r.external_id}`} style={{ display: "flex", flexDirection: "column", gap: 6, textDecoration: "none" }}>
                {r.thumb_url ? <img className="thumb" src={r.thumb_url} alt="" loading="lazy" /> : <div className="thumb" aria-hidden="true" />}
                <span className="chip fresh" style={{ alignSelf: "flex-start" }}>uses {r.matches.slice(0, 2).join(", ")}</span>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{r.title}</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="muted">Add a few things to your fridge and recipe ideas will show up here. <Link href="/recipes">Find a recipe</Link></p>
        )}
      </section>

      <div className="split">
        <section className="card grow" aria-label="Use soon" style={{ flexBasis: 320 }}>
          <div className="head"><h2 className="h2" style={{ flex: 1 }}>Use soon</h2><Link href="/fridge" className="muted">Fridge</Link></div>
          {k.fridge.use_soon.length || k.fridge.low_stock.length ? (
            <>
              {k.fridge.use_soon.map((f) => (
                <div className="row" key={f.id}><span style={{ flex: 1 }}>{f.name}</span><span className="chip warn">{days(f.days_left)}</span></div>
              ))}
              {k.fridge.low_stock.map((f) => (
                <div className="row" key={`low-${f.id}`}><span style={{ flex: 1 }}>{f.name}</span><span className="chip">running low</span></div>
              ))}
            </>
          ) : <p className="muted" style={{ paddingTop: 8 }}>Nothing expiring or running low.</p>}
        </section>

        <section className="card side-col" aria-label="To buy" style={{ gap: 0 }}>
          <div className="head"><h2 className="h2" style={{ flex: 1 }}>To buy</h2><Link href="/fridge?tab=list" className="muted">Open list</Link></div>
          {k.to_buy.items.length ? k.to_buy.items.map((g) => (
            <div className="row" key={g.id}>
              <ActionButton action={boughtAction} args={[g.id, true]} className="btn sm" label={`Mark ${g.name} bought`}>○</ActionButton>
              <span style={{ flex: 1 }}>{g.name}</span>
              <span className="muted">{g.qty} {g.unit}</span>
            </div>
          )) : <p className="muted" style={{ paddingTop: 8 }}>Nothing to buy.</p>}
          <p className="muted" style={{ paddingTop: 8, fontSize: 12 }}>Bought items go into the fridge after you confirm them.</p>
        </section>
      </div>
    </>
  );
}
