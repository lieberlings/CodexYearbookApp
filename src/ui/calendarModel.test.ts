import {
  buildMonthGrid,
  formatDisplayDate,
  isOutsideRange,
  parseIsoDate,
  shiftMonth,
  todayIso
} from "./calendarModel";

describe("calendarModel", () => {
  it("parses only real calendar dates", () => {
    expect(parseIsoDate("2024-02-29")).toEqual({ year: 2024, monthIndex: 1, day: 29 });
    expect(parseIsoDate("2023-02-29")).toBeUndefined();
    expect(parseIsoDate("2024-13-01")).toBeUndefined();
    expect(parseIsoDate("2024-1-1")).toBeUndefined();
    expect(parseIsoDate("")).toBeUndefined();
    expect(parseIsoDate(undefined)).toBeUndefined();
  });

  it("formats dates for display and keeps unparseable text", () => {
    expect(formatDisplayDate("2024-03-04")).toBe("Mar 4, 2024");
    expect(formatDisplayDate("summer")).toBe("summer");
  });

  it("builds a Monday-first six-week grid", () => {
    // October 2026 starts on a Thursday.
    const grid = buildMonthGrid(2026, 9);
    expect(grid).toHaveLength(6);
    expect(grid[0][0]).toEqual({ iso: "2026-09-28", day: 28, inMonth: false });
    expect(grid[0][3]).toEqual({ iso: "2026-10-01", day: 1, inMonth: true });
    expect(grid.flat().filter((day) => day.inMonth)).toHaveLength(31);
  });

  it("shifts months across year boundaries", () => {
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, monthIndex: 11 });
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, monthIndex: 0 });
  });

  it("checks min and max bounds", () => {
    expect(isOutsideRange("2026-01-05", "2026-01-06")).toBe(true);
    expect(isOutsideRange("2026-01-06", "2026-01-06", "2026-01-06")).toBe(false);
    expect(isOutsideRange("2026-01-07", undefined, "2026-01-06")).toBe(true);
  });

  it("formats today as a local date", () => {
    expect(todayIso(new Date(2026, 9, 12, 23, 30))).toBe("2026-10-12");
  });
});
