/**
 * Date-only helpers. Dates are "YYYY-MM-DD" strings with no time zone. Everything goes
 * through Date.UTC so a date never shifts by a day depending on the viewer's time zone.
 */
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export interface DateParts {
  y: number;
  m: number; // 1-12
  d: number;
}

export function parts(iso: string): DateParts {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

function utc(iso: string): Date {
  const { y, m, d } = parts(iso);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayISO(): string {
  const n = new Date();
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
}

export function addDays(iso: string, n: number): string {
  const date = utc(iso);
  date.setUTCDate(date.getUTCDate() + n);
  return toISO(date);
}

export function diffDays(a: string, b: string): number {
  return Math.round((utc(b).getTime() - utc(a).getTime()) / 86_400_000);
}

export function eachDay(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

/** 0 = Monday ... 6 = Sunday */
export function weekdayIndex(iso: string): number {
  return (utc(iso).getUTCDay() + 6) % 7;
}

export function isWeekend(iso: string): boolean {
  return weekdayIndex(iso) >= 5;
}

export function weekdayShort(iso: string): string {
  return WEEKDAYS[utc(iso).getUTCDay()];
}

/** "Mon 8 Jun" */
export function fmtDate(iso: string, withYear = false): string {
  const { y, m, d } = parts(iso);
  const base = `${weekdayShort(iso)} ${d} ${MONTHS[m - 1]}`;
  return withYear ? `${base} ${y}` : base;
}

/** "Mon 8 – Fri 12 Jun" or "Mon 8 Jun" for one day. */
export function fmtRange(start: string, end: string): string {
  if (start === end) return fmtDate(start);
  const a = parts(start);
  const b = parts(end);
  if (a.y === b.y && a.m === b.m) {
    return `${weekdayShort(start)} ${a.d} – ${weekdayShort(end)} ${b.d} ${MONTHS[b.m - 1]}`;
  }
  return `${fmtDate(start)} – ${fmtDate(end)}`;
}

export function monthLabel(year: number, month: number): string {
  return `${MONTHS_LONG[month - 1]} ${year}`;
}

export function monthOf(iso: string): { year: number; month: number } {
  const { y, m } = parts(iso);
  return { year: y, month: m };
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function monthBounds(year: number, month: number): { first: string; last: string } {
  const pad = (v: number) => String(v).padStart(2, '0');
  const first = `${year}-${pad(month)}-01`;
  const last = toISO(new Date(Date.UTC(year, month, 0)));
  return { first, last };
}

/** Weeks (Monday first) covering the month, each a list of 7 ISO dates. */
export function monthGrid(year: number, month: number): string[][] {
  const { first, last } = monthBounds(year, month);
  const start = addDays(first, -weekdayIndex(first));
  const end = addDays(last, 6 - weekdayIndex(last));
  const days = eachDay(start, end);
  const weeks: string[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

export function dayOfMonth(iso: string): number {
  return parts(iso).d;
}

export function yearOf(iso: string): number {
  return parts(iso).y;
}
