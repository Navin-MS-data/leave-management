import { diffDays, eachDay, isValidISODate, isWeekend, yearOf } from '../common/dates';

/**
 * Pure business rules for leave requests. No database access here: the service loads the
 * data into a RuleContext and this module decides. That keeps every rule easy to test.
 */

export type ViolationCode =
  | 'INVALID_DATE'
  | 'END_BEFORE_START'
  | 'CROSSES_YEAR'
  | 'NO_WORKING_DAYS'
  | 'MIN_NOTICE'
  | 'INSUFFICIENT_BALANCE'
  | 'OWN_OVERLAP'
  | 'TEAM_COVERAGE';

export interface Violation {
  code: ViolationCode;
  message: string;
  /** Dates involved, where relevant (for example days where team coverage is exceeded). */
  dates?: string[];
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface TeamRange extends DateRange {
  userId: number;
}

export interface RuleContext {
  /** Today as YYYY-MM-DD. */
  today: string;
  /** Admin setting: a request must start at least this many days from today. */
  minNoticeDays: number;
  /** Admin setting: max team members who may be off on the same working day. */
  maxTeamOffPerDay: number;
  holidays: ReadonlySet<string>;
  /** Yearly allowance of the leave type. null = unlimited. */
  allowance: number | null;
  /** Days already committed (pending + approved) for this user, leave type and year. */
  committedDays: number;
  /** The user's other pending/approved requests that touch the requested dates. */
  ownRequests: DateRange[];
  /** Other team members' pending/approved requests that touch the requested dates. */
  teamRequests: TeamRange[];
}

export interface RuleOptions {
  /** Used when re-checking an already-created request at approval time. */
  skipNotice?: boolean;
}

export interface RuleResult {
  workingDays: string[];
  days: number;
  violations: Violation[];
  /** Remaining balance after this request, null if the leave type is unlimited. */
  remainingAfter: number | null;
}

/** Working days = calendar days minus weekends and public holidays. */
export function listWorkingDays(start: string, end: string, holidays: ReadonlySet<string>): string[] {
  return eachDay(start, end).filter((d) => !isWeekend(d) && !holidays.has(d));
}

export function countWorkingDays(start: string, end: string, holidays: ReadonlySet<string>): number {
  return listWorkingDays(start, end, holidays).length;
}

/** Checks that only depend on the two dates themselves. */
export function validateDateRange(start: string, end: string): Violation | null {
  if (!isValidISODate(start) || !isValidISODate(end)) {
    return { code: 'INVALID_DATE', message: 'Dates must be valid and use the YYYY-MM-DD format' };
  }
  if (end < start) {
    return { code: 'END_BEFORE_START', message: 'End date cannot be before the start date' };
  }
  if (yearOf(start) !== yearOf(end)) {
    return {
      code: 'CROSSES_YEAR',
      message: 'A request cannot span two calendar years. Please submit one request per year',
    };
  }
  return null;
}

export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.startDate <= b.endDate && b.startDate <= a.endDate;
}

export function evaluateLeaveRules(
  input: DateRange,
  ctx: RuleContext,
  options: RuleOptions = {},
): RuleResult {
  const dateViolation = validateDateRange(input.startDate, input.endDate);
  if (dateViolation) {
    return { workingDays: [], days: 0, violations: [dateViolation], remainingAfter: null };
  }

  const violations: Violation[] = [];
  const workingDays = listWorkingDays(input.startDate, input.endDate, ctx.holidays);
  const days = workingDays.length;

  // Weekends and public holidays do not count as leave days.
  if (days === 0) {
    violations.push({
      code: 'NO_WORKING_DAYS',
      message: 'The selected dates contain no working days (only weekends and public holidays)',
    });
  }

  // Minimum notice.
  if (!options.skipNotice && diffDays(ctx.today, input.startDate) < ctx.minNoticeDays) {
    violations.push({
      code: 'MIN_NOTICE',
      message: `Leave must be requested at least ${ctx.minNoticeDays} day(s) in advance`,
    });
  }

  // Balance: pending requests are already inside committedDays.
  let remainingAfter: number | null = null;
  if (ctx.allowance !== null) {
    remainingAfter = ctx.allowance - ctx.committedDays - days;
    if (remainingAfter < 0) {
      const remaining = Math.max(ctx.allowance - ctx.committedDays, 0);
      violations.push({
        code: 'INSUFFICIENT_BALANCE',
        message: `Requested ${days} day(s) but only ${remaining} remaining (pending requests are counted)`,
      });
    }
  }

  // An employee cannot have overlapping requests.
  const overlapping = ctx.ownRequests.filter((r) => rangesOverlap(r, input));
  if (overlapping.length > 0) {
    violations.push({
      code: 'OWN_OVERLAP',
      message: 'You already have a pending or approved request that overlaps these dates',
    });
  }

  // Team coverage: on each working day at most maxTeamOffPerDay people may be off,
  // counting this request.
  if (days > 0) {
    const blocked: string[] = [];
    for (const day of workingDays) {
      const off = new Set(
        ctx.teamRequests.filter((r) => r.startDate <= day && day <= r.endDate).map((r) => r.userId),
      );
      if (off.size + 1 > ctx.maxTeamOffPerDay) blocked.push(day);
    }
    if (blocked.length > 0) {
      violations.push({
        code: 'TEAM_COVERAGE',
        message: `Too many team members would be off (maximum ${ctx.maxTeamOffPerDay} per day) on: ${blocked.join(', ')}`,
        dates: blocked,
      });
    }
  }

  return { workingDays, days, violations, remainingAfter };
}
