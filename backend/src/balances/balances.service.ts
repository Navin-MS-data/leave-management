import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { ClockService } from '../common/clock.service';
import { yearOf } from '../common/dates';
import { AuthUser } from '../common/types';
import { LeaveRequest, LeaveType, User } from '../entities';

export interface BalanceLine {
  leaveTypeId: number;
  leaveTypeName: string;
  /** null = unlimited */
  allowance: number | null;
  /** Approved days */
  used: number;
  /** Pending days (they already count against the balance) */
  pending: number;
  /** allowance - used - pending; null = unlimited */
  remaining: number | null;
}

export interface UserBalance {
  userId: number;
  userName: string;
  year: number;
  balances: BalanceLine[];
}

@Injectable()
export class BalancesService {
  constructor(
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(LeaveType) private types: Repository<LeaveType>,
    @InjectRepository(LeaveRequest) private requests: Repository<LeaveRequest>,
    private clock: ClockService,
  ) {}

  /**
   * Balances are derived, never stored: allowance minus pending and approved days.
   * That is why cancelling or rejecting a request restores the days automatically.
   */
  async compute(user: Pick<User, 'id' | 'name'>, year: number, manager?: EntityManager): Promise<UserBalance> {
    const em = manager ?? this.requests.manager;
    const types = await em.find(LeaveType, { order: { id: 'ASC' } });
    const rows = await em.find(LeaveRequest, {
      where: { userId: user.id, year, status: In(['pending', 'approved']) },
    });

    const balances = types.map((t): BalanceLine => {
      const mine = rows.filter((r) => r.leaveTypeId === t.id);
      const used = sum(mine.filter((r) => r.status === 'approved'));
      const pending = sum(mine.filter((r) => r.status === 'pending'));
      return {
        leaveTypeId: t.id,
        leaveTypeName: t.name,
        allowance: t.yearlyAllowance,
        used,
        pending,
        remaining: t.yearlyAllowance === null ? null : t.yearlyAllowance - used - pending,
      };
    });
    return { userId: user.id, userName: user.name, year, balances };
  }

  resolveYear(year?: string): number {
    const y = year ? Number(year) : NaN;
    return Number.isInteger(y) && y > 1970 && y < 2200 ? y : yearOf(this.clock.today());
  }

  async forUser(actor: AuthUser, userId: number, year: number): Promise<UserBalance> {
    const target = await this.users.findOneBy({ id: userId });
    if (!target) throw new NotFoundException('User not found');
    const allowed =
      actor.id === target.id ||
      actor.role === 'admin' ||
      (actor.role === 'manager' && target.managerId === actor.id);
    if (!allowed) throw new ForbiddenException('You cannot view this balance');
    return this.compute(target, year);
  }

  /** Balances for every direct report (manager) or every employee and manager (admin). */
  async forTeam(actor: AuthUser, year: number): Promise<UserBalance[]> {
    const members =
      actor.role === 'admin'
        ? await this.users.find({ where: { active: true }, order: { name: 'ASC' } })
        : await this.users.find({ where: { managerId: actor.id, active: true }, order: { name: 'ASC' } });
    const result: UserBalance[] = [];
    for (const m of members) {
      if (m.role === 'admin') continue;
      result.push(await this.compute(m, year));
    }
    return result;
  }
}

function sum(rows: LeaveRequest[]): number {
  return rows.reduce((total, r) => total + r.days, 0);
}
