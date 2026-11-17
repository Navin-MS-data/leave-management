import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Between, DataSource, In, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { diffDays, eachDay, isValidISODate, isWeekend } from '../common/dates';
import { ACTIVE_STATUSES, AuthUser } from '../common/types';
import { LeaveRequest, PublicHoliday, User } from '../entities';
import { teamKeyOf } from '../entities/user.entity';
import { SettingsService } from '../settings/settings.service';

const MAX_RANGE_DAYS = 400;

@Injectable()
export class CalendarService {
  constructor(
    @InjectDataSource() private dataSource: DataSource,
    private settings: SettingsService,
  ) {}

  /**
   * Leave of the caller's team (a manager and their reports) between two dates.
   * Admins see everybody. Coverage = number of people off per working day.
   */
  async getCalendar(actor: AuthUser, from: string, to: string) {
    if (!isValidISODate(from) || !isValidISODate(to)) {
      throw new BadRequestException('from and to must be valid dates in YYYY-MM-DD format');
    }
    if (to < from) throw new BadRequestException('to cannot be before from');
    if (diffDays(from, to) > MAX_RANGE_DAYS) {
      throw new BadRequestException(`The range cannot exceed ${MAX_RANGE_DAYS} days`);
    }

    const em = this.dataSource.manager;
    let members: User[];
    if (actor.role === 'admin') {
      members = (await em.find(User, { where: { active: true }, order: { name: 'ASC' } })).filter(
        (u) => u.role !== 'admin',
      );
    } else {
      const key = teamKeyOf(actor);
      members =
        key === null
          ? []
          : await em.find(User, {
              where: [
                { id: key, active: true },
                { managerId: key, active: true },
              ],
              order: { name: 'ASC' },
            });
    }

    const requests = members.length
      ? await em.find(LeaveRequest, {
          where: {
            userId: In(members.map((m) => m.id)),
            status: In(ACTIVE_STATUSES),
            startDate: LessThanOrEqual(to),
            endDate: MoreThanOrEqual(from),
          },
          relations: { leaveType: true },
          order: { startDate: 'ASC' },
        })
      : [];

    const holidays = await em.find(PublicHoliday, { where: { date: Between(from, to) }, order: { date: 'ASC' } });
    const holidaySet = new Set(holidays.map((h) => h.date));
    const names = new Map(members.map((m) => [m.id, m.name]));

    const coverage: Record<string, number> = {};
    for (const day of eachDay(from, to)) {
      if (isWeekend(day) || holidaySet.has(day)) continue;
      const off = new Set(requests.filter((r) => r.startDate <= day && day <= r.endDate).map((r) => r.userId));
      if (off.size > 0) coverage[day] = off.size;
    }

    const { maxTeamOffPerDay } = await this.settings.getAll();
    return {
      from,
      to,
      maxTeamOffPerDay,
      teamSize: members.length,
      members: members.map((m) => ({ id: m.id, name: m.name, role: m.role })),
      entries: requests.map((r) => ({
        id: r.id,
        userId: r.userId,
        userName: names.get(r.userId) ?? '',
        leaveTypeId: r.leaveTypeId,
        leaveTypeName: r.leaveType?.name ?? '',
        startDate: r.startDate,
        endDate: r.endDate,
        days: r.days,
        status: r.status,
      })),
      holidays: holidays.map((h) => ({ date: h.date, name: h.name })),
      coverage,
    };
  }
}
