export function env(name: string, fallback?: string): string {
  const v = process.env[name];
  if (v !== undefined && v !== "") return v;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing environment variable ${name}. See .env.example.`);
}

export function optionalEnv(name: string): string | undefined {
  const v = process.env[name];
  return v === undefined || v === "" ? undefined : v;
}

export const DEFAULT_TZ = process.env.DEFAULT_TIMEZONE || "Asia/Seoul";

export function appUrl(path = "/"): string {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return base + (path.startsWith("/") ? path : `/${path}`);
}
