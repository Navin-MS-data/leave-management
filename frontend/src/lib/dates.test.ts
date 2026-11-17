import { addDays, diffDays, eachDay, fmtDate, fmtRange, isWeekend, monthBounds, monthGrid, shiftMonth, weekdayIndex } from './dates';

describe('date helpers', () => {
  it('formats a date-only string without shifting the day', () => {
    // 2026-06-08 is a Monday, whatever the machine time zone is.
    expect(fmtDate('2026-06-08')).toBe('Mon 8 Jun');
    expect(fmtDate('2026-06-08', true)).toBe('Mon 8 Jun 2026');
  });

  it('formats ranges within and across months', () => {
    expect(fmtRange('2026-06-08', '2026-06-12')).toBe('Mon 8 – Fri 12 Jun');
    expect(fmtRange('2026-06-08', '2026-06-08')).toBe('Mon 8 Jun');
    expect(fmtRange('2026-06-29', '2026-07-03')).toBe('Mon 29 Jun – Fri 3 Jul');
  });

  it('does date arithmetic across month and year ends', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(diffDays('2026-06-01', '2026-06-08')).toBe(7);
    expect(eachDay('2026-06-29', '2026-07-02')).toEqual(['2026-06-29', '2026-06-30', '2026-07-01', '2026-07-02']);
  });

  it('knows weekends with Monday as the first day', () => {
    expect(weekdayIndex('2026-06-08')).toBe(0);
    expect(weekdayIndex('2026-06-14')).toBe(6);
    expect(isWeekend('2026-06-13')).toBe(true);
    expect(isWeekend('2026-06-12')).toBe(false);
  });

  it('builds month grids that start on a Monday and end on a Sunday', () => {
    const weeks = monthGrid(2026, 6);
    expect(weeks[0][0]).toBe('2026-06-01'); // 1 June 2026 is a Monday
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    const last = weeks[weeks.length - 1];
    expect(weekdayIndex(last[6])).toBe(6);
    expect(monthGrid(2026, 2)[0][0]).toBe('2026-01-26'); // February starts on a Sunday, so the grid begins in January
  });

  it('moves between months and finds month bounds', () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(monthBounds(2028, 2)).toEqual({ first: '2028-02-01', last: '2028-02-29' });
  });
});
