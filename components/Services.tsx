import Link from "next/link";
import { SERVICES, type Service } from "@/lib/nav";
import { NavIcon } from "./NavIcon";
import { ServiceArt } from "./ServiceArt";

/** A service as a tinted chip + label. Used by My Kitchen. */
export function ServiceTile({ s, sub }: { s: Service; sub?: string }) {
  return (
    <Link href={s.href} className="svc">
      <span className={`svc-icon tone-${s.tone}`}><NavIcon name={s.icon} size={26} /></span>
      <span>{s.short}</span>
      {sub && <span className="svc-sub">{sub}</span>}
    </Link>
  );
}

/**
 * Home's "Other Services": the four shortcuts the Figma shows, as illustrated icons
 * with no tile behind them. There is no "More" sheet — everything else is reached from
 * its own tab, from My Kitchen, or from the sidebar.
 */
export function ServiceGrid({ hrefs }: { hrefs: string[] }) {
  const shortcuts = hrefs.map((h) => SERVICES.find((s) => s.href === h)).filter((s): s is Service => !!s);
  return (
    <>
      <h2 className="h2">Other Services</h2>
      <nav aria-label="Services" className="svc-grid art">
        {shortcuts.map((s) => (
          <Link key={s.href} href={s.href} className="svc">
            <ServiceArt name={s.icon} />
            <span>{s.short}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
