import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import {
  Between,
  DataSource,
  EntityManager,
  FindOptionsWhere,
  In,
  LessThanOrEqual,
  MoreThanOrEqual,
  Not,
} from "typeorm";
import { ClockService } from "../common/clock.service";
import { yearOf } from "../common/dates";
import { ACTIVE_STATUSES, AuthUser, REQUEST_STATUSES, RequestStatus } from "../common/types";
import { LeaveRequest, LeaveType, PublicHoliday, User } from "../entities";
import { teamKeyOf } from "../entities/user.entity";
import { SettingsService } from "../settings/settings.service";
import {
  evaluateLeaveRules,
  RuleContext,
  RuleResult,
  validateDateRange,
  Violation,
} from "./leave-rules";

export interface RequestInput {
  leaveTypeId: number;
  startDate: string;
  endDate: string;
  reason?: string;
}

export interface PreviewResult {
  valid: boolean;
  days: number;
  workingDays: string[];
  violations: Violation[];
  allowance: number | null;
  /** Remaining balance if this request were accepted; null = unlimited. */
  remainingAfter: number | null;
}

@Injectable()
export class LeaveRequestsService {
  /** Row locks are real Postgres behaviour; tests on in-memory pg-mem turn them off. */
  private readonly useLocks = process.env.DB_ROW_LOCKS !== "false";

  constructor(
    @InjectDataSource() private dataSource: DataSource,
    private settings: SettingsService,
    private clock: ClockService,
  ) {}

  // ---------------------------------------------------------------- queries

  mine(actor: AuthUser) {
    return this.dataSource.manager.find(LeaveRequest, {
      where: { userId: actor.id },
      relations: { leaveType: true },
      order: { startDate: "DESC", id: "DESC" },
    });
  }

  /**
   * Requests a decision-maker is responsible for: a manager sees their reports' requests,
   * an admin sees managers' requests. `status` defaults to pending; "all" disables the filter.
   */
  inbox(actor: AuthUser, status = "pending") {
    if (status !== "all" && !REQUEST_STATUSES.includes(status as RequestStatus)) {
      throw new BadRequestException(`status must be one of: ${REQUEST_STATUSES.join(", ")}, all`);
    }
    const qb = this.dataSource.manager
      .createQueryBuilder(LeaveRequest, "r")
      .leftJoinAndSelect("r.user", "u")
      .leftJoinAndSelect("r.leaveType", "t")
      .orderBy("r.startDate", "ASC")
      .addOrderBy("r.id", "ASC");
    if (actor.role === "manager") qb.where("u.managerId = :id", { id: actor.id });
    else qb.where("u.role = :role", { role: "manager" });
    if (status !== "all") qb.andWhere("r.status = :status", { status });
    return qb.getMany();
  }

  async findOne(actor: AuthUser, id: number) {
    const request = await this.dataSource.manager.findOne(LeaveRequest, {
      where: { id },
      relations: { user: true, leaveType: true, decidedBy: true },
    });
    if (!request) throw new NotFoundException("Leave request not found");
    if (!this.canView(actor, request.user!))
      throw new ForbiddenException("You cannot view this request");
    return request;
  }

  // ---------------------------------------------------------------- commands

  /** Dry run of every rule: used by the form to show the day count and problems before submitting. */
  async preview(actor: AuthUser, input: RequestInput): Promise<PreviewResult> {
    const user = await this.loadUser(this.dataSource.manager, actor.id);
    const dateViolation = validateDateRange(input.startDate, input.endDate);
    if (dateViolation) {
      return {
        valid: false,
        days: 0,
        workingDays: [],
        violations: [dateViolation],
        allowance: null,
        remainingAfter: null,
      };
    }
    const { result, leaveType } = await this.evaluate(this.dataSource.manager, user, input);
    return {
      valid: result.violations.length === 0,
      days: result.days,
      workingDays: result.workingDays,
      violations: result.violations,
      allowance: leaveType.yearlyAllowance,
      remainingAfter: result.remainingAfter,
    };
  }

  async create(actor: AuthUser, input: RequestInput) {
    const saved = await this.dataSource.transaction(async (em) => {
      const user = await this.loadUser(em, actor.id);
      // Serialises concurrent requests of the same team, so two people cannot both
      // pass the coverage or balance check and then both be saved.
      await this.lockTeam(em, user);

      const dateViolation = validateDateRange(input.startDate, input.endDate);
      if (dateViolation) this.throwViolations([dateViolation]);

      const { result } = await this.evaluate(em, user, input);
      if (result.violations.length > 0) this.throwViolations(result.violations);

      return em.save(
        em.create(LeaveRequest, {
          userId: user.id,
          leaveTypeId: input.leaveTypeId,
          startDate: input.startDate,
          endDate: input.endDate,
          days: result.days,
          year: yearOf(input.startDate),
          reason: input.reason ?? "",
          status: "pending",
          decidedById: null,
          decidedAt: null,
          decisionNote: null,
          cancelledAt: null,
        }),
      );
    });
    return this.findOne(actor, saved.id);
  }

  approve(actor: AuthUser, id: number, note?: string) {
    return this.decide(actor, id, "approved", note);
  }

  reject(actor: AuthUser, id: number, note?: string) {
    return this.decide(actor, id, "rejected", note);
  }

  /** Cancelling needs no balance bookkeeping: balances are derived from active requests. */
  async cancel(actor: AuthUser, id: number) {
    await this.dataSource.transaction(async (em) => {
      const request = await em.findOne(LeaveRequest, { where: { id }, relations: { user: true } });
      if (!request) throw new NotFoundException("Leave request not found");
      if (!this.canCancel(actor, request.user!))
        throw new ForbiddenException("You cannot cancel this request");
      await this.lockTeam(em, request.user!);

      const fresh = await em.findOneByOrFail(LeaveRequest, { id });
      if (!ACTIVE_STATUSES.includes(fresh.status)) {
        throw new ConflictException(`A ${fresh.status} request cannot be cancelled`);
      }
      if (fresh.endDate < this.clock.today()) {
        throw new ConflictException("Leave that has already ended cannot be cancelled");
      }
      fresh.status = "cancelled";
      fresh.cancelledAt = new Date();
      await em.save(fresh);
    });
    return this.findOne(actor, id);
  }

  // ---------------------------------------------------------------- internals

  private async decide(
    actor: AuthUser,
    id: number,
    outcome: "approved" | "rejected",
    note?: string,
  ) {
    await this.dataSource.transaction(async (em) => {
      const request = await em.findOne(LeaveRequest, { where: { id }, relations: { user: true } });
      if (!request) throw new NotFoundException("Leave request not found");
      const owner = request.user!;
      if (!this.canDecide(actor, owner)) {
        throw new ForbiddenException("You can only decide on requests from your own reports");
      }
      await this.lockTeam(em, owner);

      // Re-read after taking the lock, so the state check cannot be based on stale data.
      const fresh = await em.findOneByOrFail(LeaveRequest, { id });
      if (fresh.status !== "pending") {
        throw new ConflictException(
          `Only pending requests can be decided; this request is ${fresh.status}`,
        );
      }

      if (outcome === "approved") {
        // Settings or other requests may have changed since the request was made.
        const { result } = await this.evaluate(
          em,
          owner,
          { leaveTypeId: fresh.leaveTypeId, startDate: fresh.startDate, endDate: fresh.endDate },
          { excludeRequestId: fresh.id, skipNotice: true },
        );
        if (result.violations.length > 0) this.throwViolations(result.violations);
      }

      fresh.status = outcome;
      fresh.decidedById = actor.id;
      fresh.decidedAt = new Date();
      fresh.decisionNote = note?.trim() || null;
      await em.save(fresh);
    });
    return this.findOne(actor, id);
  }

  /** Loads everything the rules need and runs them. */
  private async evaluate(
    em: EntityManager,
    user: User,
    input: RequestInput,
    opts: { excludeRequestId?: number; skipNotice?: boolean } = {},
  ): Promise<{ result: RuleResult; leaveType: LeaveType }> {
    const leaveType = await em.findOneBy(LeaveType, { id: input.leaveTypeId });
    if (!leaveType) throw new NotFoundException("Leave type not found");

    const exclude: FindOptionsWhere<LeaveRequest> =
      opts.excludeRequestId !== undefined ? { id: Not(opts.excludeRequestId) } : {};
    const year = yearOf(input.startDate);

    const [settings, holidayRows, committed, own] = await Promise.all([
      this.settings.getAll(em),
      em.find(PublicHoliday, { where: { date: Between(input.startDate, input.endDate) } }),
      em.find(LeaveRequest, {
        where: {
          userId: user.id,
          leaveTypeId: leaveType.id,
          year,
          status: In(ACTIVE_STATUSES),
          ...exclude,
        },
      }),
      em.find(LeaveRequest, {
        where: {
          userId: user.id,
          status: In(ACTIVE_STATUSES),
          startDate: LessThanOrEqual(input.endDate),
          endDate: MoreThanOrEqual(input.startDate),
          ...exclude,
        },
      }),
    ]);

    const teamRequests = await this.loadTeamRequests(em, user, input, exclude);

    const ctx: RuleContext = {
      today: this.clock.today(),
      minNoticeDays: settings.minNoticeDays,
      maxTeamOffPerDay: settings.maxTeamOffPerDay,
      holidays: new Set(holidayRows.map((h) => h.date)),
      allowance: leaveType.yearlyAllowance,
      committedDays: committed.reduce((total, r) => total + r.days, 0),
      ownRequests: own.map((r) => ({ startDate: r.startDate, endDate: r.endDate })),
      teamRequests,
    };
    return { result: evaluateLeaveRules(input, ctx, { skipNotice: opts.skipNotice }), leaveType };
  }

  private async loadTeamRequests(
    em: EntityManager,
    user: User,
    input: RequestInput,
    exclude: FindOptionsWhere<LeaveRequest>,
  ) {
    const key = teamKeyOf(user);
    if (key === null) return [];
    const members = await em.find(User, {
      where: [
        { id: key, active: true },
        { managerId: key, active: true },
      ],
    });
    const ids = members.map((m) => m.id).filter((id) => id !== user.id);
    if (ids.length === 0) return [];
    const rows = await em.find(LeaveRequest, {
      where: {
        userId: In(ids),
        status: In(ACTIVE_STATUSES),
        startDate: LessThanOrEqual(input.endDate),
        endDate: MoreThanOrEqual(input.startDate),
        ...exclude,
      },
    });
    return rows.map((r) => ({ userId: r.userId, startDate: r.startDate, endDate: r.endDate }));
  }

  /** Locks the team's manager row for the rest of the transaction (Postgres row lock). */
  private async lockTeam(em: EntityManager, user: User) {
    const key = teamKeyOf(user);
    if (!this.useLocks || key === null) return;
    await em
      .createQueryBuilder(User, "u")
      .setLock("pessimistic_write")
      .where("u.id = :id", { id: key })
      .getOne();
  }

  private async loadUser(em: EntityManager, id: number): Promise<User> {
    const user = await em.findOneBy(User, { id });
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  private throwViolations(violations: Violation[]): never {
    throw new UnprocessableEntityException({
      statusCode: 422,
      error: "Unprocessable Entity",
      message: violations[0].message,
      violations,
    });
  }

  // ---------------------------------------------------------------- permissions

  /** Owner, their manager, or an admin. */
  private canView(actor: AuthUser, owner: User): boolean {
    return (
      actor.id === owner.id ||
      actor.role === "admin" ||
      (actor.role === "manager" && owner.managerId === actor.id)
    );
  }

  /** A manager decides for their own reports; an admin decides for managers. Nobody decides their own. */
  private canDecide(actor: AuthUser, owner: User): boolean {
    if (actor.id === owner.id) return false;
    if (actor.role === "manager") return owner.managerId === actor.id;
    if (actor.role === "admin") return owner.role === "manager";
    return false;
  }

  private canCancel(actor: AuthUser, owner: User): boolean {
    return actor.id === owner.id || this.canDecide(actor, owner);
  }
}
