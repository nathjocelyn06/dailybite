import { describe, expect, it } from "vitest";
import { TABS, SERVICES, HOME_GRID, KITCHEN_SERVICES, sectionOf, breadcrumbFor, isActive } from "../lib/nav";

describe("4-tab navigation (v3)", () => {
  it("has exactly Home, My Kitchen, Journal, Archive", () => {
    expect(TABS.map((t) => t.label)).toEqual(["Home", "My Kitchen", "Journal", "Archive"]);
  });

  it("maps every route to its parent tab", () => {
    for (const p of ["/", "/progress", "/budget", "/notifications", "/messages", "/insights"]) expect(sectionOf(p)).toBe("home");
    for (const p of ["/kitchen", "/recipes", "/recipes/themealdb/123", "/fridge"]) expect(sectionOf(p)).toBe("kitchen");
    expect(sectionOf("/journal")).toBe("journal");
    expect(sectionOf("/archive")).toBe("archive");
    expect(sectionOf("/calendar")).toBe("archive");
    expect(sectionOf("/more")).toBeNull();
  });

  it("highlights the parent tab on secondary pages", () => {
    const archive = TABS.find((t) => t.key === "archive")!;
    expect(isActive(archive, "/calendar")).toBe(true);
    expect(isActive(TABS[1], "/calendar")).toBe(false);
  });

  it("builds breadcrumbs for secondary pages only", () => {
    expect(breadcrumbFor("/calendar")).toEqual({ parent: TABS[3], label: "Calendar" });
    expect(breadcrumbFor("/budget")?.parent.label).toBe("Home");
    expect(breadcrumbFor("/progress")?.label).toBe("My progress");
    expect(breadcrumbFor("/recipes")).toEqual({ parent: TABS[1], label: "Recipes" });
    expect(breadcrumbFor("/kitchen")).toBeNull();
    expect(breadcrumbFor("/")).toBeNull();
  });

  it("My Kitchen holds only Fridge and Recipes (no budget, no calendar)", () => {
    expect(KITCHEN_SERVICES.map((s) => s.group)).toEqual(["fridge", "fridge", "fridge", "recipes", "recipes", "recipes"]);
    expect(KITCHEN_SERVICES.some((s) => s.href.startsWith("/budget") || s.href.startsWith("/calendar"))).toBe(false);
  });

  it("keeps every feature reachable and drops cut features", () => {
    const hrefs = SERVICES.map((s) => s.href.split("?")[0]);
    for (const p of ["/recipes", "/fridge", "/budget", "/calendar", "/progress", "/notifications", "/journal", "/archive", "/more"]) expect(hrefs).toContain(p);
    expect(hrefs).not.toContain("/insights");
    for (const h of HOME_GRID) expect(SERVICES.some((s) => s.href === h)).toBe(true);
  });
});
