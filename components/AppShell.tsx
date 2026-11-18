/* eslint-disable @next/next/no-img-element */
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TABS, isActive, breadcrumbFor } from "@/lib/nav";
import { NavIcon } from "./NavIcon";
import { LiveSync } from "./LiveSync";

/**
 * Four destinations only: Home, My Kitchen, Journal, Archive.
 * Desktop: compact sidebar (icons + labels at tablet width). Phone (≤ 860px): fixed bottom bar
 * with the same four tabs. Notifications (bell) and Settings (avatar) sit in the Account section
 * on desktop and in the Home / My Kitchen headers on phone.
 */
export function AppShell({ children, unread, tz }: { children: React.ReactNode; unread: number; tz: string }) {
  const pathname = usePathname() || "/";
  const crumb = breadcrumbFor(pathname);
  const cameraHref = pathname.startsWith("/fridge")
    ? "/snap?mode=ingredient"
    : pathname.startsWith("/budget") || pathname.startsWith("/kitchen")
      ? "/snap?mode=receipt"
      : pathname.startsWith("/recipes")
        ? "/snap?mode=recipe_finder"
        : pathname.startsWith("/journal")
          ? "/snap?mode=journal"
          : "/snap";

  return (
    <div className="shell">
      <aside className="side">
        <Link href="/" className="brand" aria-label="DailyBite home">
          <img className="brand-logo" src="/logo-dailybite-wordmark.png" alt="DailyBite" />
        </Link>
        <nav className="nav" aria-label="Main">
          {TABS.map((t) => (
            <Link key={t.key} href={t.href} aria-current={isActive(t, pathname) ? "page" : undefined}>
              <NavIcon name={t.icon} />
              <span className="nav-label">{t.label}</span>
            </Link>
          ))}
        </nav>
        <div className="nav account" aria-label="Account">
          <span className="lbl nav-label" style={{ padding: "0 12px 6px" }}>Account</span>
          <Link href="/notifications" aria-current={pathname.startsWith("/notifications") || pathname.startsWith("/messages") ? "page" : undefined}>
            <NavIcon name="notifications" size={18} />
            <span className="nav-label">Notifications</span>
            {unread > 0 && <span className="badge">{unread}</span>}
          </Link>
          <Link href="/more" aria-current={pathname.startsWith("/more") ? "page" : undefined}>
            <NavIcon name="settings" size={18} />
            <span className="nav-label">Settings</span>
          </Link>
        </div>
      </aside>

      <main className="main">
        {crumb && (
          <nav aria-label="Breadcrumb" className="crumb">
            <Link href={crumb.parent.href}>{crumb.parent.label}</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{crumb.label}</span>
          </nav>
        )}
        {children}
      </main>

      <Link href={cameraHref} className="fab" aria-label="Open AI camera">
        <span className="fab-dot"><NavIcon name="camera" size={22} /></span>
        <span className="fab-label">AI camera</span>
      </Link>

      <nav className="tabbar" aria-label="Main tabs">
        {TABS.map((t) => (
          <Link key={t.key} href={t.href} aria-current={isActive(t, pathname) ? "page" : undefined}>
            <span className="tab-icon"><NavIcon name={t.icon} size={22} /></span>
            {t.label}
          </Link>
        ))}
      </nav>

      <LiveSync tz={tz} />
    </div>
  );
}
