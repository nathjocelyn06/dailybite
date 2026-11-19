"use client";
import { useEffect } from "react";

/**
 * Keeps the reminder service worker registered and nudges it while a tab is open.
 *
 * The worker is what actually shows a notification, and it is the worker — not a
 * timer in here — that keeps working once the tab is closed, through periodic
 * background sync (installed PWAs) or a web push. This component only:
 *   · registers it,
 *   · asks for periodic sync once permission is granted,
 *   · and, while someone is looking at the app, asks it to check on the hour's
 *     edges, so a reminder that comes due during a session is not held back.
 *
 * Everything it asks for is a no-op without notification permission.
 */
export function Reminders() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    let stop = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let cleanup: (() => void) | undefined;

    async function go() {
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => null);
      if (!reg || stop) return;
      await navigator.serviceWorker.ready.catch(() => undefined);

      if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

      // The real background path: the browser wakes the worker on its own schedule.
      // Chrome only grants it to installed apps, and silently refuses otherwise.
      const sync = (reg as ServiceWorkerRegistration & { periodicSync?: { register(tag: string, o: { minInterval: number }): Promise<void> } }).periodicSync;
      await sync?.register("dailybite-reminders", { minInterval: 60 * 60 * 1000 }).catch(() => undefined);

      const check = () => {
        if (document.visibilityState === "visible") reg.active?.postMessage({ type: "check" });
      };
      check();
      timer = setInterval(check, 5 * 60 * 1000);
      document.addEventListener("visibilitychange", check);
      if (!stop) cleanup = () => document.removeEventListener("visibilitychange", check);
    }

    void go();
    return () => {
      stop = true;
      if (timer) clearInterval(timer);
      cleanup?.();
    };
  }, []);

  return null;
}
