"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { dayKey } from "@/lib/dates";

/** How often an open, visible page re-reads the server. */
const POLL_MS = 10_000;

/**
 * Keeps every open device in sync.
 *
 * v3.1 (no sign-in): the browser never talks to Supabase any more — all reads and
 * writes go through server components and server actions — so there is no
 * authenticated client to subscribe to Realtime with. Instead this:
 *  1. re-renders the page every 10 s while the tab is visible, so a change made by
 *     Claude (MCP) or on another device shows up within a few seconds;
 *  2. re-renders the moment the local date rolls over, so "today" starts fresh;
 *  3. re-renders when you come back to the tab.
 */
export function LiveSync({ tz }: { tz: string }) {
  const router = useRouter();
  const day = useRef(dayKey(new Date(), tz));

  useEffect(() => {
    const tick = setInterval(() => {
      const now = dayKey(new Date(), tz);
      if (now !== day.current) {
        day.current = now;
        router.refresh();
        return;
      }
      if (document.visibilityState === "visible") router.refresh();
    }, POLL_MS);

    const onVisible = () => document.visibilityState === "visible" && router.refresh();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, tz]);

  return null;
}
