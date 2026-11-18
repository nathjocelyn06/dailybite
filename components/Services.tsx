"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SERVICES, SECTION_LABEL, type Service } from "@/lib/nav";
import { NavIcon } from "./NavIcon";
import { ServiceArt } from "./ServiceArt";

export function ServiceTile({ s, sub }: { s: Service; sub?: string }) {
  return (
    <Link href={s.href} className="svc">
      <span className={`svc-icon tone-${s.tone}`}><NavIcon name={s.icon} size={26} /></span>
      <span>{s.short}</span>
      {sub && <span className="svc-sub">{sub}</span>}
    </Link>
  );
}

/** Home service grid: the given shortcuts + a "More" tile that opens every service grouped by parent tab. */
export function ServiceGrid({ hrefs }: { hrefs: string[] }) {
  const [open, setOpen] = useState(false);
  const shortcuts = hrefs.map((h) => SERVICES.find((s) => s.href === h)).filter((s): s is Service => !!s);
  return (
    <>
      <div className="head">
        <h2 className="h2" style={{ flex: 1 }}>Other Services</h2>
        {/* the Figma shows four icons, so everything else lives behind this */}
        <button type="button" className="link-btn muted" onClick={() => setOpen(true)} aria-haspopup="dialog">See all</button>
      </div>
      <nav aria-label="Services" className="svc-grid art">
        {shortcuts.map((s) => (
          <Link key={s.href} href={s.href} className="svc">
            <ServiceArt name={s.icon} />
            <span>{s.short}</span>
          </Link>
        ))}
      </nav>
      {open && <AllServicesSheet onClose={() => setOpen(false)} />}
    </>
  );
}

function AllServicesSheet({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const top = SERVICES.filter((s) => s.section !== "account" && s.href !== "/snap?mode=receipt").slice(0, 12);
  const groups = (Object.keys(SECTION_LABEL) as Service["section"][])
    .map((k) => ({ k, label: SECTION_LABEL[k], items: SERVICES.filter((s) => s.section === k) }))
    .filter((g) => g.items.length);
  return (
    <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label="All services" className="sheet">
        <span className="sheet-handle" aria-hidden="true" />
        <div className="head">
          <h2 className="h2" style={{ flex: 1, fontSize: 18 }}>Top services</h2>
          <button ref={closeRef} type="button" className="btn" onClick={onClose} aria-label="Close all services" style={{ width: 44, padding: 0 }}>×</button>
        </div>
        <div className="svc-grid">{top.map((s) => <ServiceTile key={s.href} s={s} />)}</div>
        <h2 className="h2" style={{ fontSize: 18, paddingTop: 4 }}>Other services</h2>
        {groups.map((g) => (
          <div key={g.k}>
            <span className="lbl" style={{ display: "block", padding: "8px 0 4px" }}>{g.label}</span>
            {g.items.map((s) => (
              <Link key={s.href} href={s.href} className="svc-row" onClick={onClose}>
                <span className={`svc-icon sm tone-${s.tone}`}><NavIcon name={s.icon} size={20} /></span>
                <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <strong style={{ fontSize: 14 }}>{s.label}</strong>
                  <span className="muted" style={{ fontSize: 12 }}>{s.description}</span>
                </span>
              </Link>
            ))}
          </div>
        ))}
      </section>
    </div>
  );
}
