import Link from "next/link";
import { SERVICES } from "@/lib/nav";
import { NavIcon } from "@/components/NavIcon";
import { webDb } from "@/lib/services/db";
import { getSettings } from "@/lib/services/settings";
import { unreadCount } from "@/lib/services/notifications";
import { SettingsForm } from "./SettingsForm";

/**
 * Account / Settings (route kept at /more so old links still work), plus a link to Notifications.
 * Reached from the profile avatar on Home and the sidebar's Account section.
 * It is not a main tab: the app has exactly four (Home, My Kitchen, Journal, Archive).
 */
export default async function AccountPage() {
  const db = await webDb();
  const [s, unread] = await Promise.all([getSettings(db), unreadCount(db).catch(() => 0)]);
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
    </>
  );
}
