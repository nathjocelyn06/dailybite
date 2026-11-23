import Link from "next/link";
import { SERVICES } from "@/lib/nav";
import { NavIcon } from "@/components/NavIcon";
import { webDb } from "@/lib/services/db";
import { getSettings } from "@/lib/services/settings";
import { unreadCount } from "@/lib/services/notifications";
import { SettingsForm } from "./SettingsForm";
import { currentUser } from "@/lib/supabase/server";
import { appUrl } from "@/lib/env";
import { signOutAction } from "@/app/login/actions";
import { CopyField } from "@/components/CopyField";

/**
 * Account / Settings (route kept at /more so old links still work), plus a link to Notifications.
 * Reached from the profile avatar on Home and the sidebar's Account section.
 * It is not a main tab: the app has exactly four (Home, My Kitchen, Journal, Archive).
 */
export default async function AccountPage() {
  const db = await webDb();
  const [s, unread, me] = await Promise.all([getSettings(db), unreadCount(db).catch(() => 0), currentUser()]);
  const account = SERVICES.filter((x) => x.href === "/notifications");
  return (
    <>
      <header className="head"><div className="titles"><span className="lbl">Account</span><h1 className="h1">Settings</h1></div></header>
      <nav className="card" aria-label="Account" style={{ padding: "4px 16px" }}>
        {account.map((n) => (
          <Link key={n.href} href={n.href} className="row" style={{ textDecoration: "none", minHeight: 52 }}>
            <NavIcon name={n.icon} />
            <span style={{ flex: 1 }}>{n.label}<br /><span className="muted" style={{ fontSize: 12 }}>{n.description}</span></span>
            {n.href === "/notifications" && unread > 0 && <span className="badge">{unread}</span>}›
          </Link>
        ))}
      </nav>
      <section className="card"><h2 className="h2" style={{ marginBottom: 10 }}>Settings</h2><SettingsForm s={s} /></section>

      <section className="card" aria-label="Connect Claude" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 className="h2">Connect Claude to this account</h2>
        <p className="muted" style={{ fontSize: 13 }}>
          Paste this in Claude under Settings &rsaquo; Connectors &rsaquo; Add custom connector. It reads and writes
          your DailyBite records and nobody else&rsquo;s. Treat it like a password.
        </p>
        <CopyField label="Your connector URL" value={appUrl(`/api/mcp?key=${s.mcp_key ?? ""}`)} />
      </section>

      <section className="card" aria-label="Account" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 className="h2">Account</h2>
        <p className="muted">Signed in as <strong>{me?.email ?? "this device"}</strong>.</p>
        <form action={signOutAction}>
          <button className="btn">Sign out</button>
        </form>
      </section>
    </>
  );
}
