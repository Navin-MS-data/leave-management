import * as bcrypt from 'bcryptjs';
import { DataSource } from 'typeorm';
import { addDays, isWeekend, toISODate, yearOf } from '../common/dates';
import { RequestStatus } from '../common/types';
import { LeaveRequest, LeaveType, PublicHoliday, Setting, User } from '../entities';
import { evaluateLeaveRules, RuleContext } from '../leave-requests/leave-rules';
import { DEFAULT_SETTINGS } from '../settings/settings.service';

export const SEED_PASSWORD = 'Password123!';
export const SEED_REQUEST_COUNT = 40;

export interface SeedOptions {
  /** Today's date (YYYY-MM-DD). Requests are spread around it. */
  today: string;
  /** Drop and recreate all tables first. */
  reset?: boolean;
  passwordRounds?: number;
}

/** Small deterministic random number generator, so the seed data is the same every run. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HOLIDAYS: Array<[string, string]> = [
  ['01-01', "New Year's Day"],
  ['04-15', 'Spring Holiday'],
  ['05-01', 'Labour Day'],
  ['08-15', 'Summer Holiday'],
  ['10-10', "Founders' Day"],
  ['11-01', 'Remembrance Day'],
  ['12-25', 'Christmas Day'],
  ['12-26', 'Boxing Day'],
];

export async function seed(ds: DataSource, options: SeedOptions) {
  const { today } = options;
  if (options.reset) await ds.synchronize(true);

  const em = ds.manager;
  const year = yearOf(today);
  const rng = mulberry32(20240607);

  // Settings (admin-configurable)
  await em.save(Setting, [
    { key: 'minNoticeDays', value: String(DEFAULT_SETTINGS.minNoticeDays) },
    { key: 'maxTeamOffPerDay', value: String(DEFAULT_SETTINGS.maxTeamOffPerDay) },
  ]);

  // Leave types
  const [annual, sick, unpaid] = await em.save(LeaveType, [
    { name: 'Annual', yearlyAllowance: 20, isPaid: true },
    { name: 'Sick', yearlyAllowance: 10, isPaid: true },
    { name: 'Unpaid', yearlyAllowance: null, isPaid: false },
  ]);

  // Public holidays for last, this and next year
  const holidayRows = [year - 1, year, year + 1].flatMap((y) =>
    HOLIDAYS.map(([md, name]) => ({ date: `${y}-${md}`, name })),
  );
  await em.save(PublicHoliday, holidayRows);
  const holidaySet = new Set(holidayRows.map((h) => h.date));

  // Users: 1 admin, 2 managers, 8 employees (4 per manager)
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, options.passwordRounds ?? 10);
  const mk = (name: string, email: string, role: User['role'], managerId: number | null) =>
    em.create(User, { name, email, role, managerId, passwordHash, active: true });

  const admin = await em.save(mk('Alex Admin', 'admin@example.com', 'admin', null));
  const managers = await em.save([
    mk('Maria Manager', 'manager1@example.com', 'manager', null),
    mk('Marcus Manager', 'manager2@example.com', 'manager', null),
  ]);
  const employeeNames = ['Emma Stone', 'Liam Brown', 'Olivia Davis', 'Noah Wilson', 'Ava Martin', 'Ethan Clark', 'Mia Lopez', 'Lucas Kim'];
  const employees = await em.save(
    employeeNames.map((name, i) =>
      mk(name, `employee${i + 1}@example.com`, 'employee', managers[i < 4 ? 0 : 1].id),
    ),
  );

  // 40 requests in mixed states, each one checked against the real rules engine.
  const requesters = [...managers, ...employees];
  const types = [annual, annual, annual, sick, unpaid];
  const minNotice = DEFAULT_SETTINGS.minNoticeDays;
  const accepted: LeaveRequest[] = [];
  const yearEnd = (d: string) => `${yearOf(d)}-12-31`;

  for (let attempts = 0; accepted.length < SEED_REQUEST_COUNT && attempts < 20_000; attempts++) {
    const user = requesters[Math.floor(rng() * requesters.length)];
    const type = types[Math.floor(rng() * types.length)];

    let start = addDays(today, Math.floor(rng() * 260) - 200);
    while (isWeekend(start) || holidaySet.has(start)) start = addDays(start, 1);
    let end = addDays(start, Math.floor(rng() * 4));
    if (end > yearEnd(start)) end = yearEnd(start);
    if (end < start) continue;

    const status = pickStatus(rng, today, start, end, minNotice);

    const mine = accepted.filter((r) => r.userId === user.id && isActive(r.status));
    const teamKeyOfUser = user.role === 'manager' ? user.id : user.managerId;
    const teamIds = requesters
      .filter((u) => u.id !== user.id && (u.id === teamKeyOfUser || u.managerId === teamKeyOfUser))
      .map((u) => u.id);

    const ctx: RuleContext = {
      today,
      minNoticeDays: minNotice,
      maxTeamOffPerDay: DEFAULT_SETTINGS.maxTeamOffPerDay,
      holidays: holidaySet,
      allowance: type.yearlyAllowance,
      committedDays: mine
        .filter((r) => r.leaveTypeId === type.id && r.year === yearOf(start))
        .reduce((total, r) => total + r.days, 0),
      ownRequests: mine,
      teamRequests: accepted.filter((r) => teamIds.includes(r.userId) && isActive(r.status)),
    };
    const result = evaluateLeaveRules({ startDate: start, endDate: end }, ctx, { skipNotice: true });
    if (result.violations.length > 0) continue;

    const decided = status === 'approved' || status === 'rejected';
    const decider = user.role === 'manager' ? admin.id : user.managerId;
    accepted.push(
      em.create(LeaveRequest, {
        userId: user.id,
        leaveTypeId: type.id,
        startDate: start,
        endDate: end,
        days: result.days,
        year: yearOf(start),
        reason: REASONS[Math.floor(rng() * REASONS.length)],
        status,
        decidedById: decided ? decider : null,
        decidedAt: decided ? new Date(`${addDays(start, -3)}T10:00:00Z`) : null,
        decisionNote: status === 'rejected' ? 'Team is short-staffed during this period' : null,
        cancelledAt: status === 'cancelled' ? new Date(`${addDays(start, -2)}T09:00:00Z`) : null,
      }),
    );
  }

  if (accepted.length < SEED_REQUEST_COUNT) {
    throw new Error(`Seed could only generate ${accepted.length} of ${SEED_REQUEST_COUNT} requests`);
  }
  await em.save(LeaveRequest, accepted);

  return { admin, managers, employees, requests: accepted.length };
}

const REASONS = [
  'Family trip',
  'Medical appointment',
  'Personal errand',
  'Wedding to attend',
  'Moving house',
  'Rest and recovery',
  'Visiting relatives',
  'Public exam',
];

function isActive(status: RequestStatus) {
  return status === 'pending' || status === 'approved';
}

/** Past requests are mostly decided; future ones are mostly pending or approved. */
function pickStatus(rng: () => number, today: string, start: string, end: string, minNotice: number): RequestStatus {
  const roll = rng();
  if (end < today) return roll < 0.6 ? 'approved' : roll < 0.8 ? 'rejected' : 'cancelled';
  if (start >= addDays(today, minNotice)) {
    return roll < 0.5 ? 'pending' : roll < 0.9 ? 'approved' : 'cancelled';
  }
  return 'approved';
}

export { toISODate };
