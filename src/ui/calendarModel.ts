// Pure date helpers for DateField. Dates are stored as "YYYY-MM-DD" strings
// (local calendar days, no time zone), matching project startDate/endDate.

export type CalendarDay = { iso: string; day: number; inMonth: boolean };

export const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"] as const;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
] as const;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function toIsoDate(year: number, monthIndex: number, day: number): string {
  const date = new Date(year, monthIndex, day);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayIso(now = new Date()): string {
  return toIsoDate(now.getFullYear(), now.getMonth(), now.getDate());
}

// Returns { year, monthIndex, day } for a real calendar date, or undefined.
export function parseIsoDate(value: string | undefined | null): { year: number; monthIndex: number; day: number } | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value?.trim() ?? "");
  if (!match) {
    return undefined;
  }
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  return toIsoDate(year, monthIndex, day) === match[0] ? { year, monthIndex, day } : undefined;
}

export function monthTitle(year: number, monthIndex: number): string {
  return `${MONTH_NAMES[monthIndex]} ${year}`;
}

// "Mar 4, 2024"; falls back to the raw text for anything unparseable.
export function formatDisplayDate(value: string): string {
  const parsed = parseIsoDate(value);
  if (!parsed) {
    return value;
  }
  return `${MONTH_NAMES[parsed.monthIndex].slice(0, 3)} ${parsed.day}, ${parsed.year}`;
}

export function shiftMonth(year: number, monthIndex: number, delta: number): { year: number; monthIndex: number } {
  const date = new Date(year, monthIndex + delta, 1);
  return { year: date.getFullYear(), monthIndex: date.getMonth() };
}

// Six Monday-first weeks covering the month, padded with neighboring days.
export function buildMonthGrid(year: number, monthIndex: number): CalendarDay[][] {
  const first = new Date(year, monthIndex, 1);
  const offset = (first.getDay() + 6) % 7;
  const weeks: CalendarDay[][] = [];
  for (let week = 0; week < 6; week += 1) {
    const days: CalendarDay[] = [];
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const date = new Date(year, monthIndex, 1 - offset + week * 7 + weekday);
      days.push({
        iso: toIsoDate(date.getFullYear(), date.getMonth(), date.getDate()),
        day: date.getDate(),
        inMonth: date.getMonth() === monthIndex
      });
    }
    weeks.push(days);
  }
  return weeks;
}

// ISO strings compare correctly as text.
export function isOutsideRange(iso: string, min?: string, max?: string): boolean {
  return Boolean((min && iso < min) || (max && iso > max));
}
