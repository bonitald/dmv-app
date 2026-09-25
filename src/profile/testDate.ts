// ph-9-us-5: the tentative test date is a calendar date stored as a plain 'YYYY-MM-DD' string
// (users/{uid}.testDate, ph-9-us-2), never a timestamp, so it can't shift a day across time
// zones. Everything here works in the device's local calendar and is pure, so it's unit-tested.

export type DateString = string;

export interface CalendarDate {
  year: number;
  month: number; // 1-12
  day: number;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Days ahead the picker opens on when no date is set yet (about four weeks). */
export const DEFAULT_PICKER_OFFSET_DAYS = 28;
/** Furthest ahead a test date can be picked. */
export const MAX_MONTHS_AHEAD = 12;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Parses a stored date, rejecting bad formats and impossible dates like 2026-02-31. */
export function parseDateString(value: unknown): CalendarDate | null {
  if (typeof value !== 'string') return null;
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function formatDateString({ year, month, day }: CalendarDate): DateString {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** The local calendar date of `date` as 'YYYY-MM-DD'. */
export function toDateString(date: Date): DateString {
  return formatDateString({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  });
}

/** Adds whole days to a calendar date; Date handles month and year rollover. */
export function addDays(value: DateString, days: number): DateString {
  const d = parseDateString(value);
  if (!d) throw new Error(`Invalid date string: ${value}`);
  return toDateString(new Date(d.year, d.month - 1, d.day + days));
}

/** Adds calendar months, clamping the day to the target month's length (Jan 31 + 1 → Feb 28). */
export function addMonths(value: DateString, months: number): DateString {
  const d = parseDateString(value);
  if (!d) throw new Error(`Invalid date string: ${value}`);
  const first = new Date(d.year, d.month - 1 + months, 1);
  const year = first.getFullYear();
  const month = first.getMonth() + 1;
  return formatDateString({ year, month, day: Math.min(d.day, daysInMonth(year, month)) });
}

/** Whole calendar days from `today` to `value` (negative once passed), or null if malformed. */
export function daysUntil(value: unknown, today: Date): number | null {
  const target = parseDateString(value);
  if (!target) return null;
  // Date.UTC on both sides counts calendar days without DST hours getting in the way.
  const targetDay = Date.UTC(target.year, target.month - 1, target.day);
  const todayDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((targetDay - todayDay) / 86_400_000);
}

export type Countdown =
  | { kind: 'days'; days: number; label: string }
  | { kind: 'tomorrow'; label: string }
  | { kind: 'today'; label: string }
  | { kind: 'passed'; label: string };

/** The countdown card's copy for a test `days` away (ph-9-us-5). */
export function countdownFor(days: number): Countdown {
  if (days < 0) return { kind: 'passed', label: 'Your test date has passed' };
  if (days === 0) return { kind: 'today', label: 'Test day — good luck!' };
  if (days === 1) return { kind: 'tomorrow', label: 'Your test is tomorrow' };
  return { kind: 'days', days, label: 'days until your test' };
}

/** The range of dates the picker allows: today through 12 months ahead. */
export function selectableRange(today: Date): { min: DateString; max: DateString } {
  const min = toDateString(today);
  return { min, max: addMonths(min, MAX_MONTHS_AHEAD) };
}

export function isSelectable(value: DateString, today: Date): boolean {
  const { min, max } = selectableRange(today);
  // 'YYYY-MM-DD' strings sort in date order.
  return parseDateString(value) !== null && value >= min && value <= max;
}

/** Where the picker opens: the saved date if it's still selectable, else about 4 weeks out. */
export function initialPickerDate(saved: unknown, today: Date): DateString {
  if (typeof saved === 'string' && isSelectable(saved, today)) return saved;
  return addDays(toDateString(today), DEFAULT_PICKER_OFFSET_DAYS);
}

/**
 * One month as calendar rows, Sunday first. Each row has 7 cells: a date string, or null for
 * the blanks before the 1st and after the last day.
 */
export function monthGrid(year: number, month: number): (DateString | null)[][] {
  const leading = new Date(year, month - 1, 1).getDay();
  const cells: (DateString | null)[] = Array(leading).fill(null);
  for (let day = 1; day <= daysInMonth(year, month); day++) {
    cells.push(formatDateString({ year, month, day }));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (DateString | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const WEEKDAYS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

export function monthLabel(year: number, month: number): string {
  return `${MONTHS[month - 1]} ${year}`;
}

/** 'Thursday, October 22, 2026'-style label, used for display and accessibility. */
export function longDateLabel(value: DateString): string {
  const d = parseDateString(value);
  if (!d) return value;
  // A fixed name table rather than toLocaleDateString, so the label doesn't depend on the
  // engine's Intl support.
  const weekday = WEEKDAYS[new Date(d.year, d.month - 1, d.day).getDay()];
  return `${weekday}, ${MONTHS[d.month - 1]} ${d.day}, ${d.year}`;
}
