import Link from "next/link";
import { webDb } from "@/lib/services/db";
import { getKitchenOverview } from "@/lib/services/kitchen";
import { ServiceArt } from "@/components/ServiceArt";

/**
 * My Kitchen (tab 2): food at home, nothing else — two doors, from the Figma.
 *   Fridge  → /fridge   (Stock · To buy)
 *   Recipes → /recipes  (Find · Saved · Cook from my fridge)
 * Everything that used to be stacked under them lives on those pages: what can I cook
 * tonight is Cook from my fridge, use-soon and low stock are on the fridge door itself,
 * and the shopping list is the fridge's To buy tab. The live counts stay here so the
 * two cards still say what is waiting behind each door.
 */
export default async function KitchenPage() {
  const db = await webDb();
  const k = await getKitchenOverview(db);

  const doors = [
    {
      title: "Fridge",
      desc: "What you have and what to buy",
      count: `${k.fridge.total} item${k.fridge.total === 1 ? "" : "s"} · ${k.to_buy.open} to buy`,
      href: "/fridge",
      icon: "fridge" as const
    },
    {
      title: "Recipes",
      desc: "Find and cook",
      count: `${k.recipes.saved} saved · ${k.cook_tonight.length} you could cook tonight`,
      href: "/recipes",
      icon: "recipes" as const
    }
  ];

  return (
    <>
      <header className="head">
        <div className="titles" style={{ gap: 2 }}>
          <span className="muted">My Kitchen</span>
          <h1 className="h1">What&apos;s In My Kitchen?</h1>
        </div>
      </header>

      <div className="kitchen-doors">
        {doors.map((d) => (
          <section key={d.title} className="kitchen-door" aria-label={d.title}>
            <ServiceArt name={d.icon} />
            <div className="kitchen-text">
              <h2>{d.title}</h2>
              <p>{d.desc}</p>
              <span className="muted">{d.count}</span>
            </div>
            <Link className="btn kitchen-open" href={d.href}>Open</Link>
          </section>
        ))}
      </div>
    </>
  );
}
