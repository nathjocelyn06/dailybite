"use client";
import { useEffect, useState } from "react";
import { DEFAULT_PREFS, parsePrefs, serialisePrefs, REMINDER_COOKIE, type ReminderPrefs } from "@/lib/reminders";

function readCookie(): string | undefined {
  return document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${REMINDER_COOKIE}=`))
    ?.slice(REMINDER_COOKIE.length + 1);
}

/** A year, so the settings outlive the session the way a setting should. */
function writeCookie(p: ReminderPrefs) {
  document.cookie = `${REMINDER_COOKIE}=${serialisePrefs(p)}; path=/; max-age=${365 * 24 * 60 * 60}; samesite=lax`;
}

/**
 * Alert settings. They live in a cookie, not a table: the alerts are shown by this
 * browser's service worker, and the server route that decides what is due reads the
 * same cookie on the worker's own request.
 */
export function ReminderSettings() {
  const [prefs, setPrefs] = useState<ReminderPrefs>(DEFAULT_PREFS);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [status, setStatus] = useState("");

  useEffect(() => {
    setPrefs(parsePrefs(readCookie()));
    setPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  }, []);

  function save(next: ReminderPrefs) {
    setPrefs(next);
    writeCookie(next);
    setStatus("Saved");
  }

  async function enable() {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setPermission(p);
    if (p === "granted") {
      await navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
      setStatus("Notifications are on for this browser.");
    } else {
      setStatus("");
    }
  }

  /** Proof it works end to end: the worker shows it, and clicking it opens the journal. */
  async function test() {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return setStatus("Turn notifications on first.");
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification("DailyBite test alert", {
      body: "If you can see this, alerts will reach you. Tap to open your journal.",
      tag: "dailybite-test",
      icon: "/icons/icon-192.png",
      data: { href: "/journal" }
    });
    setStatus("Sent — check your notifications.");
  }

  /** Ask the server what is due right now and show whatever has not been shown yet. */
  async function checkNow() {
    const reg = await navigator.serviceWorker.ready.catch(() => null);
    if (!reg?.active) return setStatus("The alert worker is not running yet — reload the page.");
    reg.active.postMessage({ type: "check" });
    setStatus("Checked. Anything over the line will appear now and in the list below.");
  }

  const denied = permission === "denied";

  return (
    <section className="card" aria-label="Alert settings" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="head">
        <h2 className="h2" style={{ flex: 1 }}>Alerts</h2>
        {permission === "granted"
          ? <span className="chip">on for this browser</span>
          : <button className="btn pri sm" onClick={() => void enable()} disabled={permission === "unsupported" || denied}>Turn on notifications</button>}
      </div>

      {permission === "unsupported" && <p className="muted">This browser cannot show notifications.</p>}
      {denied && (
        <p className="banner warn">
          Notifications are blocked for this site. Allow them in the padlock menu of the address bar, then reload.
        </p>
      )}

      <label className="switch">
        <input type="checkbox" checked={prefs.calories} onChange={(e) => save({ ...prefs, calories: e.target.checked })} />
        <span><strong>Calorie alert</strong><br /><span className="muted">When the day&apos;s logged calories go past your goal.</span></span>
      </label>

      <label className="switch">
        <input type="checkbox" checked={prefs.budget} onChange={(e) => save({ ...prefs, budget: e.target.checked })} />
        <span><strong>Budget alert</strong><br /><span className="muted">When this month&apos;s food spend passes your threshold.</span></span>
      </label>
      {prefs.budget && (
        <div style={{ paddingLeft: 30, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <input
            type="range"
            min={50}
            max={120}
            step={5}
            value={prefs.budget_threshold}
            onChange={(e) => save({ ...prefs, budget_threshold: Number(e.target.value) })}
            aria-label="Warn me at this percentage of the budget"
            style={{ flex: "1 1 200px" }}
          />
          <strong>{prefs.budget_threshold}% of the monthly budget</strong>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button className="btn sm" onClick={() => void test()}>Send a test alert</button>
        <button className="btn sm" onClick={() => void checkNow()}>Check now</button>
        <span className="muted" role="status" style={{ fontSize: 13 }}>{status}</span>
      </div>
      <p className="muted" style={{ fontSize: 12 }}>
        Alerts are checked while DailyBite is open, and in the background when it is installed to
        the home screen. Each one is sent once — once a day for calories, once a month for the budget.
      </p>
    </section>
  );
}
