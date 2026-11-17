import type { LeaveRequest, LeaveType } from '../api/types';

export const ACTIVE = ['pending', 'approved'] as const;

export function isActive(status: LeaveRequest['status']): boolean {
  return status === 'pending' || status === 'approved';
}

/**
 * The cancel button only appears for requests that still hold days and have not ended.
 * (Rejected and cancelled requests are final, finished leave cannot be cancelled.)
 */
export function canCancel(request: Pick<LeaveRequest, 'status' | 'endDate'>, today: string): boolean {
  return isActive(request.status) && request.endDate >= today;
}

export interface Entry {
  request: LeaveRequest;
  /**
   * "entry" is the request itself. "reversal" is the line a cancelled request adds under it,
   * handing the days back (the original is struck, never erased).
   */
  kind: 'entry' | 'reversal';
  /** Remaining days after this line, in date order. null for unlimited types and for lines that hold no days. */
  balanceAfter: number | null;
}

/**
 * Builds the passbook: entries in date order with a running balance per leave type.
 * Pending and approved requests hold days. A rejected request is shown struck and leaves the balance
 * untouched. A cancelled request is shown struck and followed by a reversal line that returns its days.
 */
export function buildEntries(requests: LeaveRequest[], leaveTypes: LeaveType[], year: number): Entry[] {
  const allowance = new Map(leaveTypes.map((t) => [t.id, t.yearlyAllowance]));
  const spent = new Map<number, number>();
  const ordered = requests
    .filter((r) => r.year === year)
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id - b.id);

  return ordered.flatMap((request): Entry[] => {
    const limit = allowance.get(request.leaveTypeId) ?? null;
    if (request.status === 'cancelled') {
      // Running balance at this point in the book: what is left once the returned days are back.
      const kept = spent.get(request.leaveTypeId) ?? 0;
      return [
        { request, kind: 'entry', balanceAfter: null },
        { request, kind: 'reversal', balanceAfter: limit === null ? null : limit - kept },
      ];
    }
    if (!isActive(request.status)) return [{ request, kind: 'entry', balanceAfter: null }];
    const total = (spent.get(request.leaveTypeId) ?? 0) + request.days;
    spent.set(request.leaveTypeId, total);
    return [{ request, kind: 'entry', balanceAfter: limit === null ? null : limit - total }];
  });
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
