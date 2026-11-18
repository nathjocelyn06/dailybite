/**
 * DailyBite navigation (v3): exactly four destinations, one job each.
 *   Home        → today. Also holds My progress (AI overview), Budget and Notifications (bell).
 *   My Kitchen  → food at home: Fridge (Stock · To buy) and Recipes (Find · Saved · Cook from my fridge).
 *   Journal     → what I ate today and how it felt.
 *   Archive     → the past: list (search + filters) and Calendar.
 * Settings sits behind the profile avatar / sidebar Account section.
 * Cut for now (routes redirect or are hidden): health articles + workouts, water, body photo journal.
 *
 * Every route is kept. A secondary route belongs to its parent tab through `section`,
 * so the parent stays highlighted (e.g. /calendar highlights Archive).
 * `icon` is a key drawn by components/NavIcon.tsx; `tone` picks the tile colour (app/globals.css).
 */
export type IconKey =
  | "home" | "kitchen" | "journal" | "archive"
  | "calendar" | "recipes" | "fridge" | "grocery" | "budget" | "saved" | "cook" | "search"
  | "progress" | "notifications" | "settings" | "more" | "camera" | "receipt";

export type TabKey = "home" | "kitchen" | "journal" | "archive";

/** Tile colours from the Chroma palette (see --tone-* in app/globals.css). */
export type Tone = "emerald" | "amber" | "vermilion" | "blush" | "sun" | "periwinkle" | "lilac" | "cobalt" | "ocean" | "coral" | "neutral";

export type NavItem = { href: string; label: string; icon: IconKey; key: TabKey };

/** Main navigation: desktop sidebar and phone bottom bar use the same four items. */
export const TABS: NavItem[] = [
  { key: "home", href: "/", label: "Home", icon: "home" },
  { key: "kitchen", href: "/kitchen", label: "My Kitchen", icon: "kitchen" },
  { key: "journal", href: "/journal", label: "Journal", icon: "journal" },
  { key: "archive", href: "/archive", label: "Archive", icon: "archive" }
];

export type Service = {
  href: string; label: string; short: string; icon: IconKey; tone: Tone; description: string;
  section: TabKey | "account"; group?: "fridge" | "recipes";
};

/** Every feature, grouped under its parent. Used by the Home grid, the More sheet, My Kitchen and get_app_map. */
export const SERVICES: Service[] = [
  { section: "home", href: "/progress", label: "My progress", short: "My progress", icon: "progress", tone: "lilac", description: "AI overview of your week or month, trends and goals" },
  { section: "home", href: "/budget", label: "Budget", short: "Budget", icon: "budget", tone: "periwinkle", description: "Food spending this month" },
  { section: "home", href: "/notifications", label: "Notifications", short: "Notifications", icon: "notifications", tone: "coral", description: "Expiry, low stock, meal plan and budget alerts" },
  { section: "kitchen", group: "fridge", href: "/fridge", label: "Fridge", short: "Fridge", icon: "fridge", tone: "emerald", description: "What you have and what expires soon" },
  { section: "kitchen", group: "fridge", href: "/fridge?tab=list", label: "To buy", short: "To buy", icon: "grocery", tone: "amber", description: "Your grocery list, inside Fridge" },
  { section: "kitchen", group: "fridge", href: "/snap?mode=receipt", label: "Scan groceries", short: "Scan groceries", icon: "receipt", tone: "ocean", description: "Receipt or items → fridge (you confirm first)" },
  { section: "kitchen", group: "recipes", href: "/recipes", label: "Recipes", short: "Recipes", icon: "recipes", tone: "vermilion", description: "Find recipes with videos" },
  { section: "kitchen", group: "recipes", href: "/recipes?tab=collection", label: "Saved recipes", short: "Saved", icon: "saved", tone: "blush", description: "Your recipe collection" },
  { section: "kitchen", group: "recipes", href: "/recipes?tab=scanner", label: "Cook from my fridge", short: "Cook from fridge", icon: "cook", tone: "sun", description: "Recipes ranked by what you already have" },
  { section: "journal", href: "/journal", label: "Food journal", short: "Journal", icon: "journal", tone: "blush", description: "Today's page: photos, meals, notes" },
  { section: "archive", href: "/archive", label: "Search past days", short: "Archive", icon: "archive", tone: "ocean", description: "Meals, journal pages, receipts" },
  { section: "archive", href: "/calendar", label: "Calendar", short: "Calendar", icon: "calendar", tone: "cobalt", description: "Past days and planned meals: month, week, day" },
  { section: "account", href: "/more", label: "Settings", short: "Settings", icon: "settings", tone: "neutral", description: "Goals, budget, time zone, privacy" }
];

/**
 * Home service grid: the four shortcuts the Figma shows, plus "More" — which is still
 * how Journal, Budget, Calendar and Notifications are reached from Home on a phone,
 * where there is no sidebar.
 */
export const HOME_GRID = ["/fridge", "/fridge?tab=list", "/recipes", "/progress"];

export const KITCHEN_SERVICES = SERVICES.filter((s) => s.section === "kitchen");

export const SECTION_LABEL: Record<Service["section"], string> = {
  home: "Your day · Home",
  kitchen: "Food at home · My Kitchen",
  journal: "Records · Journal",
  archive: "Records · Archive",
  account: "Account"
};

/** Which main tab a path belongs to. Settings and the camera highlight none. */
const SECTION_OF: [prefix: string, tab: TabKey | null][] = [
  ["/kitchen", "kitchen"], ["/recipes", "kitchen"], ["/fridge", "kitchen"],
  ["/journal", "journal"],
  ["/archive", "archive"], ["/calendar", "archive"],
  ["/progress", "home"], ["/budget", "home"], ["/notifications", "home"], ["/messages", "home"], ["/insights", "home"],
  ["/more", null], ["/snap", null]
];

export function sectionOf(pathname: string): TabKey | null {
  if (pathname === "/") return "home";
  for (const [p, tab] of SECTION_OF) if (pathname === p || pathname.startsWith(p + "/")) return tab;
  return null;
}

/** Parent tab + label for the breadcrumb on secondary pages ("Archive / Calendar"). */
export function breadcrumbFor(pathname: string): { parent: NavItem; label: string } | null {
  const tab = sectionOf(pathname);
  if (!tab || TABS.some((t) => t.href === pathname)) return null;
  const parent = TABS.find((t) => t.key === tab)!;
  const path = pathname === "/messages" ? "/notifications" : pathname;
  const svc = SERVICES.find((s) => s.section === tab && !s.href.includes("?") && path.startsWith(s.href));
  return svc ? { parent, label: svc.href === "/recipes" ? "Recipes" : svc.label } : null;
}

export function isActive(item: NavItem, pathname: string) {
  return sectionOf(pathname) === item.key;
}
