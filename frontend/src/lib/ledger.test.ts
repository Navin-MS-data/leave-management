import type { LeaveRequest, LeaveType } from '../api/types';
import { buildEntries, canCancel } from './ledger';

const types: LeaveType[] = [
  { id: 1, name: 'Annual', yearlyAllowance: 20, isPaid: true },
  { id: 3, name: 'Unpaid', yearlyAllowance: null, isPaid: false },
];

function req(overrides: Partial<LeaveRequest>): LeaveRequest {
  return {
    id: 1,
    userId: 4,
    leaveTypeId: 1,
    startDate: '2026-06-08',
    endDate: '2026-06-12',
    days: 5,
    year: 2026,
    reason: 'Trip',
    status: 'approved',
    decidedById: null,
    decidedAt: null,
    decisionNote: null,
    cancelledAt: null,
    createdAt: '2026-05-01T10:00:00Z',
    ...overrides,
  };
}

describe('passbook entries', () => {
  it('keeps a running balance in date order, pending included', () => {
    const entries = buildEntries(
      [
        req({ id: 2, startDate: '2026-07-06', endDate: '2026-07-08', days: 3, status: 'pending' }),
        req({ id: 1, startDate: '2026-06-08', endDate: '2026-06-12', days: 5, status: 'approved' }),
      ],
      types,
      2026,
    );
    expect(entries.map((e) => e.request.id)).toEqual([1, 2]);
    expect(entries.map((e) => e.balanceAfter)).toEqual([15, 12]);
  });

  it('leaves the balance untouched for rejected and cancelled entries', () => {
    const entries = buildEntries(
      [
        req({ id: 1, days: 5, status: 'cancelled' }),
        req({ id: 2, startDate: '2026-07-06', endDate: '2026-07-07', days: 2, status: 'rejected' }),
        req({ id: 3, startDate: '2026-08-03', endDate: '2026-08-04', days: 2, status: 'approved' }),
      ],
      types,
      2026,
    );
    // cancelled: struck entry + reversal line; rejected: struck entry; approved: holds 2 of 20
    expect(entries.map((e) => `${e.request.id}:${e.kind}`)).toEqual(['1:entry', '1:reversal', '2:entry', '3:entry']);
    expect(entries.map((e) => e.balanceAfter)).toEqual([null, 20, null, 18]);
  });

  it('adds a reversal line under a cancelled entry that hands the days back to the running balance', () => {
    const entries = buildEntries(
      [
        req({ id: 1, startDate: '2026-03-02', endDate: '2026-03-04', days: 3, status: 'approved' }),
        req({ id: 2, startDate: '2026-06-08', endDate: '2026-06-12', days: 5, status: 'cancelled' }),
        req({ id: 3, leaveTypeId: 3, startDate: '2026-07-06', endDate: '2026-07-07', days: 2, status: 'cancelled' }),
      ],
      types,
      2026,
    );
    const reversals = entries.filter((e) => e.kind === 'reversal');
    expect(reversals.map((e) => e.request.id)).toEqual([2, 3]);
    expect(reversals[0].balanceAfter).toBe(17); // 20 - 3, the cancelled 5 are back
    expect(reversals[1].balanceAfter).toBeNull(); // unlimited type
  });

  it('tracks each leave type separately and shows no balance for unlimited types', () => {
    const entries = buildEntries(
      [req({ id: 1, days: 5 }), req({ id: 2, leaveTypeId: 3, startDate: '2026-09-07', endDate: '2026-09-08', days: 2 })],
      types,
      2026,
    );
    expect(entries[0].balanceAfter).toBe(15);
    expect(entries[1].balanceAfter).toBeNull();
  });

  it('only includes the selected year', () => {
    const entries = buildEntries([req({ id: 1, year: 2025 }), req({ id: 2, year: 2026 })], types, 2026);
    expect(entries).toHaveLength(1);
  });
});

describe('cancel rule', () => {
  it('only offers cancel for pending or approved requests that have not ended', () => {
    expect(canCancel({ status: 'pending', endDate: '2026-06-12' }, '2026-06-01')).toBe(true);
    expect(canCancel({ status: 'approved', endDate: '2026-06-12' }, '2026-06-12')).toBe(true);
    expect(canCancel({ status: 'approved', endDate: '2026-06-12' }, '2026-06-13')).toBe(false);
    expect(canCancel({ status: 'rejected', endDate: '2026-06-12' }, '2026-06-01')).toBe(false);
    expect(canCancel({ status: 'cancelled', endDate: '2026-06-12' }, '2026-06-01')).toBe(false);
  });
});
