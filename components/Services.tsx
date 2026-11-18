import Link from "next/link";
import { SERVICES, type Service } from "@/lib/nav";
import { ServiceArt } from "./ServiceArt";

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
