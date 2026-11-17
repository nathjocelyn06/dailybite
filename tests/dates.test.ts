import { describe, expect, it } from "vitest";
import { addDays, addMonths, daysBetween, dayKey, monthRange, weekdayIndex } from "@/lib/dates";

describe("dayKey (user's local date)", () => {
  it("uses the user's time zone, not UTC", () => {
    // 2026-10-29 16:30 UTC is already 2026-10-30 01:30 in Seoul.
    const d = new Date("2026-10-29T16:30:00Z");
    expect(dayKey(d, "Asia/Seoul")).toBe("2026-10-30");
    expect(dayKey(d, "UTC")).toBe("2026-10-29");
    expect(dayKey(d, "America/Los_Angeles")).toBe("2026-10-29");
  });
  it("rolls over exactly at local midnight", () => {
    expect(dayKey(new Date("2026-10-29T14:59:59Z"), "Asia/Seoul")).toBe("2026-10-29");
    expect(dayKey(new Date("2026-10-29T15:00:00Z"), "Asia/Seoul")).toBe("2026-10-30");
  });
});

describe("calendar math", () => {
  it("adds days across months and years", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("counts days between keys", () => {
    expect(daysBetween("2026-10-29", "2026-11-01")).toBe(3);
    expect(daysBetween("2026-10-29", "2026-10-28")).toBe(-1);
  });
  it("month ranges", () => {
    expect(monthRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(monthRange("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
  });
  it("weekday index is Monday-based", () => {
    expect(weekdayIndex("2026-10-26")).toBe(0); // Monday
    expect(weekdayIndex("2026-11-01")).toBe(6); // Sunday
  });
});
