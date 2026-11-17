import { addDays, diffDays, isValidISODate, isWeekend } from '../src/common/dates';
import {
  countWorkingDays,
  evaluateLeaveRules,
  RuleContext,
  validateDateRange,
} from '../src/leave-requests/leave-rules';

// 2026-03-02 is a Monday.
const MON = '2026-03-02';
const FRI = '2026-03-06';

function ctx(overrides: Partial<RuleContext> = {}): RuleContext {
  return {
    today: '2026-02-01',
    minNoticeDays: 2,
    maxTeamOffPerDay: 2,
    holidays: new Set<string>(),
    allowance: 20,
    committedDays: 0,
    ownRequests: [],
    teamRequests: [],
    ...overrides,
  };
}

const codes = (r: ReturnType<typeof evaluateLeaveRules>) => r.violations.map((v) => v.code);

describe('date helpers', () => {
  it('knows weekdays, weekends and invalid dates', () => {
    expect(isWeekend('2026-03-07')).toBe(true); // Saturday
    expect(isWeekend(MON)).toBe(false);
    expect(isValidISODate('2026-02-30')).toBe(false);
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(diffDays('2026-03-01', '2026-03-10')).toBe(9);
  });
});

describe('working days', () => {
  it('counts a full Monday to Friday week as 5 days', () => {
    expect(countWorkingDays(MON, FRI, new Set())).toBe(5);
  });

  it('does not count weekends', () => {
    expect(countWorkingDays('2026-03-07', '2026-03-08', new Set())).toBe(0);
    expect(countWorkingDays(MON, '2026-03-09', new Set())).toBe(6); // Mon-Fri + next Mon
  });

  it('does not count public holidays', () => {
    expect(countWorkingDays(MON, FRI, new Set(['2026-03-04']))).toBe(4);
  });

  it('rejects a request made only of weekend days and holidays', () => {
    const r = evaluateLeaveRules({ startDate: '2026-03-07', endDate: '2026-03-08' }, ctx());
    expect(codes(r)).toContain('NO_WORKING_DAYS');
    const holiday = evaluateLeaveRules(
      { startDate: '2026-03-04', endDate: '2026-03-04' },
      ctx({ holidays: new Set(['2026-03-04']) }),
    );
    expect(codes(holiday)).toContain('NO_WORKING_DAYS');
  });
});

describe('date validation', () => {
  it('rejects an end date before the start date', () => {
    expect(validateDateRange(FRI, MON)?.code).toBe('END_BEFORE_START');
    expect(codes(evaluateLeaveRules({ startDate: FRI, endDate: MON }, ctx()))).toEqual(['END_BEFORE_START']);
  });

  it('accepts a single-day request', () => {
    const r = evaluateLeaveRules({ startDate: MON, endDate: MON }, ctx());
    expect(r.violations).toEqual([]);
    expect(r.days).toBe(1);
  });

  it('rejects impossible dates and requests spanning two years', () => {
    expect(validateDateRange('2026-02-31', '2026-03-01')?.code).toBe('INVALID_DATE');
    expect(validateDateRange('2026-12-30', '2027-01-02')?.code).toBe('CROSSES_YEAR');
  });
});

describe('minimum notice', () => {
  it('rejects a request starting sooner than the notice period', () => {
    const r = evaluateLeaveRules({ startDate: MON, endDate: MON }, ctx({ today: '2026-03-01', minNoticeDays: 3 }));
    expect(codes(r)).toContain('MIN_NOTICE');
  });

  it('accepts a request that starts exactly on the notice boundary', () => {
    const r = evaluateLeaveRules({ startDate: MON, endDate: MON }, ctx({ today: '2026-02-28', minNoticeDays: 2 }));
    expect(codes(r)).not.toContain('MIN_NOTICE');
  });

  it('changing the configured value changes the outcome with no code change', () => {
    const input = { startDate: MON, endDate: MON };
    const base = { today: '2026-02-27' }; // 3 days before
    expect(codes(evaluateLeaveRules(input, ctx({ ...base, minNoticeDays: 3 })))).toEqual([]);
    expect(codes(evaluateLeaveRules(input, ctx({ ...base, minNoticeDays: 7 })))).toEqual(['MIN_NOTICE']);
  });
});

describe('balance rule', () => {
  it('rejects a request larger than the remaining balance', () => {
    const r = evaluateLeaveRules({ startDate: MON, endDate: FRI }, ctx({ allowance: 4 }));
    expect(codes(r)).toContain('INSUFFICIENT_BALANCE');
  });

  it('allows a request that uses exactly the remaining balance', () => {
    const r = evaluateLeaveRules({ startDate: MON, endDate: FRI }, ctx({ allowance: 8, committedDays: 3 }));
    expect(r.violations).toEqual([]);
    expect(r.remainingAfter).toBe(0);
  });

  it('counts pending days against the balance (they are part of committedDays)', () => {
    // 18 of 20 days already committed (e.g. pending), 5 more requested.
    const r = evaluateLeaveRules({ startDate: MON, endDate: FRI }, ctx({ allowance: 20, committedDays: 18 }));
    expect(codes(r)).toContain('INSUFFICIENT_BALANCE');
  });

  it('does not limit leave types without an allowance', () => {
    const r = evaluateLeaveRules({ startDate: MON, endDate: FRI }, ctx({ allowance: null, committedDays: 500 }));
    expect(r.violations).toEqual([]);
    expect(r.remainingAfter).toBeNull();
  });
});

describe('overlap rules', () => {
  it('rejects overlap with your own active request', () => {
    const r = evaluateLeaveRules(
      { startDate: '2026-03-04', endDate: '2026-03-10' },
      ctx({ ownRequests: [{ startDate: MON, endDate: FRI }] }),
    );
    expect(codes(r)).toContain('OWN_OVERLAP');
  });

  it('allows a request that starts the day after your other request ends', () => {
    const r = evaluateLeaveRules(
      { startDate: '2026-03-09', endDate: '2026-03-09' },
      ctx({ ownRequests: [{ startDate: MON, endDate: FRI }] }),
    );
    expect(codes(r)).not.toContain('OWN_OVERLAP');
  });

  it('rejects when the team limit would be exceeded on a day', () => {
    const r = evaluateLeaveRules(
      { startDate: MON, endDate: MON },
      ctx({
        maxTeamOffPerDay: 2,
        teamRequests: [
          { userId: 2, startDate: MON, endDate: FRI },
          { userId: 3, startDate: MON, endDate: MON },
        ],
      }),
    );
    expect(codes(r)).toEqual(['TEAM_COVERAGE']);
    expect(r.violations[0].dates).toEqual([MON]);
  });

  it('allows the request on days where the team is under the limit', () => {
    const r = evaluateLeaveRules(
      { startDate: '2026-03-03', endDate: '2026-03-03' },
      ctx({
        maxTeamOffPerDay: 2,
        teamRequests: [
          { userId: 2, startDate: MON, endDate: FRI },
          { userId: 3, startDate: MON, endDate: MON }, // off Monday only
        ],
      }),
    );
    expect(r.violations).toEqual([]);
  });

  it('counts each teammate once even with several requests', () => {
    const r = evaluateLeaveRules(
      { startDate: MON, endDate: MON },
      ctx({
        maxTeamOffPerDay: 2,
        teamRequests: [
          { userId: 2, startDate: MON, endDate: MON },
          { userId: 2, startDate: MON, endDate: MON },
        ],
      }),
    );
    expect(r.violations).toEqual([]);
  });

  it('does not count weekends or holidays towards team coverage', () => {
    const r = evaluateLeaveRules(
      { startDate: '2026-03-06', endDate: '2026-03-09' }, // Fri, Sat, Sun, Mon
      ctx({
        maxTeamOffPerDay: 1,
        teamRequests: [{ userId: 2, startDate: '2026-03-07', endDate: '2026-03-08' }],
      }),
    );
    expect(r.violations).toEqual([]);
  });

  it('changing the configured team limit changes the outcome with no code change', () => {
    const input = { startDate: MON, endDate: MON };
    const team = [{ userId: 2, startDate: MON, endDate: MON }];
    expect(codes(evaluateLeaveRules(input, ctx({ maxTeamOffPerDay: 1, teamRequests: team })))).toEqual([
      'TEAM_COVERAGE',
    ]);
    expect(codes(evaluateLeaveRules(input, ctx({ maxTeamOffPerDay: 2, teamRequests: team })))).toEqual([]);
  });
});

describe('approval re-check', () => {
  it('can skip the notice rule for a request that already exists', () => {
    const input = { startDate: MON, endDate: MON };
    const late = ctx({ today: MON, minNoticeDays: 5 });
    expect(codes(evaluateLeaveRules(input, late))).toContain('MIN_NOTICE');
    expect(codes(evaluateLeaveRules(input, late, { skipNotice: true }))).not.toContain('MIN_NOTICE');
  });
});
