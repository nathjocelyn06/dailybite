import { DEFAULT_TZ } from "./env";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

/** YYYY-MM-DD for the given instant in the user's time zone. "Today" always comes from here. */
export function dayKey(d: Date = new Date(), tz: string = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(d);
}

/** HH:MM in the user's time zone. */
export function timeKey(d: Date = new Date(), tz: string = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

export function isDayKey(s: unknown): s is string {
  return typeof s === "string" && DAY_RE.test(s);
}

export function isMonthKey(s: unknown): s is string {
  return typeof s === "string" && MONTH_RE.test(s);
}

/** Pure calendar math on YYYY-MM-DD keys (no time zone involved). */
export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function monthOf(key: string): string {
  return key.slice(0, 7);
}

export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

/** 0 = Monday ... 6 = Sunday */
export function weekdayIndex(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function prettyDay(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d))
  );
}

export function greeting(d: Date = new Date(), tz: string = DEFAULT_TZ): string {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hour12: false }).format(d));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}
