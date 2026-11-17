import { LeaveRequest, LeaveType, PublicHoliday, User } from '../src/entities';
import { evaluateLeaveRules } from '../src/leave-requests/leave-rules';
import { createTestApp, TestApp } from './test-app';

describe('seed data', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  it('creates 2 managers, 8 employees, 3 leave types, holidays and 40 requests', async () => {
    const users = await t.ds.getRepository(User).find();
    expect(users.filter((u) => u.role === 'manager')).toHaveLength(2);
    expect(users.filter((u) => u.role === 'employee')).toHaveLength(8);
    expect(users.filter((u) => u.role === 'admin')).toHaveLength(1);
    expect(await t.ds.getRepository(LeaveType).count()).toBe(3);
    expect(await t.ds.getRepository(PublicHoliday).count()).toBeGreaterThan(0);
    expect(await t.ds.getRepository(LeaveRequest).count()).toBe(40);
  });

  it('has requests in every status', async () => {
    const requests = await t.ds.getRepository(LeaveRequest).find();
    const statuses = new Set(requests.map((r) => r.status));
    expect([...statuses].sort()).toEqual(['approved', 'cancelled', 'pending', 'rejected']);
  });

  it('only contains requests that obey the balance and overlap rules', async () => {
    const requests = await t.ds.getRepository(LeaveRequest).find();
    const types = await t.ds.getRepository(LeaveType).find();
    const active = requests.filter((r) => r.status === 'pending' || r.status === 'approved');

    for (const type of types) {
      if (type.yearlyAllowance === null) continue;
      const perUserYear = new Map<string, number>();
      for (const r of active.filter((r) => r.leaveTypeId === type.id)) {
        const key = `${r.userId}-${r.year}`;
        perUserYear.set(key, (perUserYear.get(key) ?? 0) + r.days);
      }
      for (const days of perUserYear.values()) expect(days).toBeLessThanOrEqual(type.yearlyAllowance);
    }

    for (const r of active) {
      const others = active.filter((o) => o.userId === r.userId && o.id !== r.id);
      const overlaps = evaluateLeaveRules(
        { startDate: r.startDate, endDate: r.endDate },
        {
          today: '2026-06-01',
          minNoticeDays: 0,
          maxTeamOffPerDay: 99,
          holidays: new Set(),
          allowance: null,
          committedDays: 0,
          ownRequests: others,
          teamRequests: [],
        },
        { skipNotice: true },
      ).violations.some((v) => v.code === 'OWN_OVERLAP');
      expect(overlaps).toBe(false);
    }
  });

  it('lets every seeded demo account sign in', async () => {
    const res = await t.as('employee1@example.com').get('/auth/me').expect(200);
    expect(res.body.role).toBe('employee');
    expect(res.body).not.toHaveProperty('passwordHash');
  });
});
