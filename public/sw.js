/*
 * DailyBite service worker — reminders only.
 *
 * It does no caching: the app is server-rendered and is better off online than
 * stale. What it is here for is notifications, which a page cannot show once it
 * is closed.
 *
 * Three ways in, in order of how well they survive the tab being shut:
 *   1. `push`        — a real web push from a server. Needs VAPID keys and a
 *                      subscription store; the handler is ready for them.
 *   2. `periodicsync` — Chrome wakes an installed PWA every so often. No server
 *                      needed, but only for installed apps, and the browser
 *                      decides how often.
 *   3. `message`     — an open tab asking for a notification to be shown.
 *
 * All three end in the same place: ask the server what is due, show what it says.
 */

const DUE_URL = "/api/reminders";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

/** Local date and clock as the user reads them, which is what the rules are written in. */
function localNow() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
    time: `${p(d.getHours())}:${p(d.getMinutes())}`
  };
}

async function showDue() {
  const res = await fetch(DUE_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify(localNow())
  });
  if (!res.ok) return;
  const { show = [] } = await res.json();
  for (const n of show) await present(n);
}

function present(n) {
  return self.registration.showNotification(n.title, {
    body: n.body || "",
    tag: n.tag || n.title,
    // The tag already keeps one of each on screen; renotify would buzz for a
    // reminder the person has seen and left there on purpose.
    renotify: false,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { href: n.href || "/" }
  });
}

self.addEventListener("push", (e) => {
  let payload = {};
  try {
    payload = e.data ? e.data.json() : {};
  } catch {
    payload = { title: e.data ? e.data.text() : "DailyBite" };
  }
  e.waitUntil(payload.title ? present(payload) : showDue());
});

self.addEventListener("periodicsync", (e) => {
  if (e.tag === "dailybite-reminders") e.waitUntil(showDue());
});

self.addEventListener("message", (e) => {
  const m = e.data || {};
  if (m.type === "check") e.waitUntil(showDue());
  if (m.type === "show" && m.notification) e.waitUntil(present(m.notification));
});

/** Open the page the reminder is about, reusing a window that is already there. */
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const href = (e.notification.data && e.notification.data.href) || "/";
  e.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of all) {
        if (new URL(c.url).origin === self.location.origin) {
          await c.focus();
          if ("navigate" in c) await c.navigate(href);
          return;
        }
      }
      await self.clients.openWindow(href);
    })()
  );
});
