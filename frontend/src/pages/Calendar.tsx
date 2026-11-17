import { useMemo, useState } from 'react';
import { errorMessage } from '../api/client';
import { useCalendar } from '../api/hooks';
import type { CalendarEntry } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Icon } from '../components/Icon';
import { TopbarControls } from '../components/Topbar';
import { Loading, Note, PageHeader } from '../components/ui';
import {
  dayOfMonth,
  fmtDate,
  isWeekend,
  monthGrid,
  monthLabel,
  monthOf,
  shiftMonth,
  todayISO,
} from '../lib/dates';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function Calendar() {
  const { user } = useAuth();
  const today = todayISO();
  const [cursor, setCursor] = useState(monthOf(today));
  const weeks = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor]);
  const from = weeks[0][0];
  const to = weeks[weeks.length - 1][6];
  const calendar = useCalendar(from, to);
  const data = calendar.data;
  const isAdmin = user?.role === 'admin';

  const holidays = useMemo(() => new Map((data?.holidays ?? []).map((h) => [h.date, h.name])), [data?.holidays]);
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const entry of data?.entries ?? []) {
      for (const week of weeks) {
        for (const day of week) {
          if (entry.startDate <= day && day <= entry.endDate) {
            map.set(day, [...(map.get(day) ?? []), entry]);
          }
        }
      }
    }
    return map;
  }, [data?.entries, weeks]);

  const inMonth = (iso: string) => monthOf(iso).month === cursor.month;
  const monthEntries = (data?.entries ?? []).filter((e) => e.endDate >= weeks[0][0] && e.startDate <= to);

  return (
    <>
      <TopbarControls>
        <div className="stepper" role="group" aria-label="Month">
          <button type="button" className="btn btn--quiet btn--icon" onClick={() => setCursor(shiftMonth(cursor.year, cursor.month, -1))} aria-label="Previous month">
            <Icon name="left" />
          </button>
          <button type="button" className="btn btn--quiet" onClick={() => setCursor(monthOf(today))}>
            Today
          </button>
          <button type="button" className="btn btn--quiet btn--icon" onClick={() => setCursor(shiftMonth(cursor.year, cursor.month, 1))} aria-label="Next month">
            <Icon name="right" />
          </button>
        </div>
      </TopbarControls>

      <PageHeader
        title="Team calendar"
        running={`${monthLabel(cursor.year, cursor.month)} · ${isAdmin ? `Everyone, ${data?.teamSize ?? '…'} people` : `Team of ${data?.teamSize ?? '…'}`}`}
      />

      {calendar.isError ? <Note tone="error">{errorMessage(calendar.error)}</Note> : null}
      {calendar.isPending ? <Loading label="Loading calendar" /> : null}

      {data ? (
        <>
          <p className="muted small calendar-rule">
            {isAdmin ? (
              <>Showing everyone. The coverage limit applies to each team separately, so days are not flagged here.</>
            ) : (
              <>
                At most <strong className="num">{data.maxTeamOffPerDay}</strong> {data.maxTeamOffPerDay === 1 ? 'person' : 'people'} can be off on the same working day. Pending requests count.
              </>
            )}
          </p>

          <div className="table-wrap">
            <table className="cal">
              <caption className="visually-hidden">Leave in {monthLabel(cursor.year, cursor.month)}</caption>
              <thead>
                <tr>
                  {WEEKDAYS.map((d) => (
                    <th key={d} scope="col" className={d === 'Sat' || d === 'Sun' ? 'is-weekend' : undefined}>
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map((week) => (
                  <tr key={week[0]}>
                    {week.map((day, weekdayIndex) => {
                      const entries = byDay.get(day) ?? [];
                      const holiday = holidays.get(day);
                      const weekend = isWeekend(day);
                      const off = data.coverage[day] ?? 0;
                      const full = !isAdmin && off >= data.maxTeamOffPerDay;
                      const classes = [
                        inMonth(day) ? '' : 'is-outside',
                        weekend ? 'is-weekend' : '',
                        holiday ? 'is-holiday' : '',
                        full ? 'is-full' : '',
                        day === today ? 'is-today' : '',
                      ]
                        .filter(Boolean)
                        .join(' ');
                      return (
                        <td key={day} className={classes} data-wd={WEEKDAYS[weekdayIndex]}>
                          <div className="cal-head">
                            <span className="cal-num num">{dayOfMonth(day)}</span>
                            {off > 0 ? (
                              <span className={`cal-count num${full ? ' is-full' : ''}`}>
                                {isAdmin ? `${off} off` : full ? `Full ${off}/${data.maxTeamOffPerDay}` : `${off}/${data.maxTeamOffPerDay}`}
                              </span>
                            ) : null}
                          </div>
                          {holiday ? <p className="cal-holiday">{holiday}</p> : null}
                          <ul className="cal-list">
                            {entries.slice(0, 3).map((e) => (
                              <li key={e.id} className={`chip chip--${e.status}`} title={`${e.userName} · ${e.leaveTypeName} · ${e.status}`}>
                                <span className="chip-name">{e.userName}</span>
                                {e.status === 'pending' ? <span className="visually-hidden"> (pending)</span> : null}
                              </li>
                            ))}
                            {entries.length > 3 ? <li className="chip-more num">+{entries.length - 3} more</li> : null}
                          </ul>
                          <span className="visually-hidden">
                            {fmtDate(day, true)}.{' '}
                            {holiday ? `${holiday}. ` : ''}
                            {entries.length > 0 ? `Off: ${entries.map((e) => e.userName).join(', ')}.` : weekend ? 'Weekend.' : 'Nobody off.'}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="legend" aria-label="Legend">
            <li><span className="chip chip--approved">Name</span> Approved</li>
            <li><span className="chip chip--pending">Name</span> Pending</li>
            <li><span className="swatch swatch--holiday" /> Public holiday</li>
            <li><span className="swatch swatch--weekend" /> Weekend</li>
            {!isAdmin ? <li><span className="swatch swatch--full" /> At the limit</li> : null}
          </ul>

          {monthEntries.length === 0 ? <p className="muted">Nobody is off in this view.</p> : null}
        </>
      ) : null}
    </>
  );
}
