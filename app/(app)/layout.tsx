import Image from "next/image";
import { AppShell } from "@/components/AppShell";
import { webDb } from "@/lib/services/db";
import { unreadCount } from "@/lib/services/notifications";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const db = await webDb();
  const unread = await unreadCount(db).catch(() => 0);
  return (
    <>
      {/* Logo opening. Pure CSS: it fades itself out, never takes pointer events,
          and plays once per page load (soft navigation between tabs keeps it mounted
          and finished). There is no sign-in screen; the app opens on Home. */}
      <div className="splash" aria-hidden="true">
        <Image className="splash-logo" src="/logo-dailybite-splash.png" alt="" width={1207} height={471} quality={100} priority />
      </div>
      <AppShell unread={unread} tz={db.tz}>
        {children}
      </AppShell>
    </>
  );
}
