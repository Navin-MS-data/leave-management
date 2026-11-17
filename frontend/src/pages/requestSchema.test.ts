import { requestSchema } from './requestSchema';

const valid = { leaveTypeId: '1', startDate: '2026-06-08', endDate: '2026-06-12', reason: 'Family trip' };

describe('request form schema', () => {
  it('accepts a complete request', () => {
    expect(requestSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an end date before the start date, on the end date field', () => {
    const result = requestSchema.safeParse({ ...valid, startDate: '2026-06-12', endDate: '2026-06-08' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'endDate');
      expect(issue?.message).toBe('End date cannot be before the start date');
    }
  });

  it('allows a one-day request', () => {
    expect(requestSchema.safeParse({ ...valid, endDate: valid.startDate }).success).toBe(true);
  });

  it('requires a leave type, both dates and a reason', () => {
    const result = requestSchema.safeParse({ leaveTypeId: '', startDate: '', endDate: '', reason: '   ' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0]);
      expect(fields).toEqual(expect.arrayContaining(['leaveTypeId', 'startDate', 'endDate', 'reason']));
    }
  });

  it('limits the reason to 500 characters', () => {
    expect(requestSchema.safeParse({ ...valid, reason: 'x'.repeat(501) }).success).toBe(false);
    expect(requestSchema.safeParse({ ...valid, reason: 'x'.repeat(500) }).success).toBe(true);
  });
});
