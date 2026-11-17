/**
 * Date helpers. All dates in the app are plain "YYYY-MM-DD" strings (no time zone),
 * and all arithmetic is done in UTC so results never depend on the server time zone.
 */
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseISODate(s: string): Date {
  return new Date(`${s}T00:00:00Z`);
}

export function isValidISODate(s: unknown): s is string {
  if (typeof s !== 'string' || !ISO_RE.test(s)) return false;
  const d = parseISODate(s);
  return !Number.isNaN(d.getTime()) && toISODate(d) === s;
}

export function addDays(s: string, n: number): string {
  const d = parseISODate(s);
  d.setUTCDate(d.getUTCDate() + n);
  return toISODate(d);
}

/** Number of days from a to b (b - a). */
export function diffDays(a: string, b: string): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000);
}

/** Every calendar day from start to end, inclusive. */
export function eachDay(start: string, end: string): string[] {
  const days: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  return days;
}

export function isWeekend(s: string): boolean {
  const dow = parseISODate(s).getUTCDay();
  return dow === 0 || dow === 6;
}

export function yearOf(s: string): number {
  return Number(s.slice(0, 4));
}

/** Today's date in the server's local time zone. */
export function todayISO(): string {
  const n = new Date();
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
}
