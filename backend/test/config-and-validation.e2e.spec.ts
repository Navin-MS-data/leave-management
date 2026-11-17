import { SEED_PASSWORD } from "../src/seed/seed";
import {
  ADMIN,
  ANNUAL,
  clearRequests,
  createTestApp,
  employee,
  MANAGER1,
  TestApp,
  UNPAID,
} from "./test-app";

/** Admin configuration, user management, input validation and edge cases. */
describe("configuration, users and validation", () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  beforeEach(async () => {
    await clearRequests(t.ds);
    await t.as(ADMIN).put("/settings", { minNoticeDays: 2, maxTeamOffPerDay: 2 }).expect(200);
  });

  const leave = (who: string, body: object) => t.as(who).post("/leave-requests", body);
  const valid = {
    leaveTypeId: ANNUAL,
    startDate: "2026-06-08",
    endDate: "2026-06-08",
    reason: "Trip",
  };

  describe("settings", () => {
    it("returns the configured values to any signed-in user", async () => {
      const res = await t.as(employee(1)).get("/settings").expect(200);
      expect(res.body).toEqual({ minNoticeDays: 2, maxTeamOffPerDay: 2 });
    });

    it("rejects invalid values", async () => {
      await t.as(ADMIN).put("/settings", { maxTeamOffPerDay: 0 }).expect(400);
      await t.as(ADMIN).put("/settings", { minNoticeDays: -1 }).expect(400);
      await t.as(ADMIN).put("/settings", { minNoticeDays: 1.5 }).expect(400);
      await t.as(ADMIN).put("/settings", { maxTeamOffPerDay: "many" }).expect(400);
    });

    it("updates one value without touching the other", async () => {
      const res = await t.as(ADMIN).put("/settings", { maxTeamOffPerDay: 4 }).expect(200);
      expect(res.body).toEqual({ minNoticeDays: 2, maxTeamOffPerDay: 4 });
    });

    it("requires authentication", async () => {
      await t.anonymous().get("/settings").expect(401);
    });
  });

  describe("leave types", () => {
    it("lets an admin create, update and delete a type", async () => {
      const created = await t
        .as(ADMIN)
        .post("/leave-types", { name: "Study", yearlyAllowance: 5 })
        .expect(201);
      expect(created.body).toMatchObject({ name: "Study", yearlyAllowance: 5, isPaid: true });

      const updated = await t
        .as(ADMIN)
        .patch(`/leave-types/${created.body.id}`, { yearlyAllowance: null })
        .expect(200);
      expect(updated.body.yearlyAllowance).toBeNull();

      await t.as(ADMIN).delete(`/leave-types/${created.body.id}`).expect(200);
      await t.as(ADMIN).delete(`/leave-types/${created.body.id}`).expect(404);
    });

    it("rejects duplicate names and invalid allowances", async () => {
      await t.as(ADMIN).post("/leave-types", { name: "Annual" }).expect(409);
      await t.as(ADMIN).post("/leave-types", { name: "Odd", yearlyAllowance: -3 }).expect(400);
      await t.as(ADMIN).post("/leave-types", { yearlyAllowance: 3 }).expect(400);
      await t.as(ADMIN).patch(`/leave-types/${ANNUAL}`, { name: "Sick" }).expect(409);
      await t.as(ADMIN).patch("/leave-types/9999", { name: "x" }).expect(404);
    });

    it("does not delete a type that existing requests use", async () => {
      await leave(employee(1), valid).expect(201);
      await t.as(ADMIN).delete(`/leave-types/${ANNUAL}`).expect(409);
    });

    it("lets everybody read the list", async () => {
      const res = await t.as(employee(1)).get("/leave-types").expect(200);
      expect(res.body.map((x: { name: string }) => x.name)).toEqual(["Annual", "Sick", "Unpaid"]);
    });
  });

  describe("public holidays", () => {
    it("lets an admin add and remove a holiday, and lists by year", async () => {
      const created = await t
        .as(ADMIN)
        .post("/holidays", { date: "2031-03-03", name: "Test Day" })
        .expect(201);
      const inYear = await t.as(employee(1)).get("/holidays?year=2031").expect(200);
      expect(inYear.body).toHaveLength(1);
      const otherYear = await t.as(employee(1)).get("/holidays?year=2032").expect(200);
      expect(otherYear.body).toHaveLength(0);
      await t.as(ADMIN).delete(`/holidays/${created.body.id}`).expect(200);
      await t.as(ADMIN).delete(`/holidays/${created.body.id}`).expect(404);
    });

    it("rejects duplicates and impossible dates", async () => {
      await t.as(ADMIN).post("/holidays", { date: "2031-04-04", name: "A" }).expect(201);
      await t.as(ADMIN).post("/holidays", { date: "2031-04-04", name: "B" }).expect(409);
      await t.as(ADMIN).post("/holidays", { date: "2031-02-30", name: "C" }).expect(400);
      await t.as(ADMIN).post("/holidays", { date: "tomorrow", name: "D" }).expect(400);
    });

    it("a newly added holiday immediately stops counting as a leave day", async () => {
      const body = { leaveTypeId: ANNUAL, startDate: "2026-06-22", endDate: "2026-06-24" };
      const before = await t.as(employee(1)).post("/leave-requests/preview", body).expect(201);
      expect(before.body.days).toBe(3);
      const holiday = await t
        .as(ADMIN)
        .post("/holidays", { date: "2026-06-23", name: "Temp" })
        .expect(201);
      const after = await t.as(employee(1)).post("/leave-requests/preview", body).expect(201);
      expect(after.body.days).toBe(2);
      await t.as(ADMIN).delete(`/holidays/${holiday.body.id}`).expect(200);
    });
  });

  describe("users", () => {
    const login = (email: string, password = SEED_PASSWORD) =>
      t.anonymous().post("/auth/login", { email, password });

    it("lets an admin create a user who can then sign in, without exposing the password hash", async () => {
      const created = await t
        .as(ADMIN)
        .post("/users", {
          name: "Nina Patel",
          email: "Nina@Example.com",
          password: "Password123!",
          role: "employee",
          managerId: t.ids.manager1,
        })
        .expect(201);
      expect(created.body.email).toBe("nina@example.com");
      expect(created.body).not.toHaveProperty("passwordHash");

      const res = await login("nina@example.com", "Password123!").expect(200);
      expect(res.body.user.managerId).toBe(t.ids.manager1);
      // The new employee is part of manager1's team.
      const reports = await t.as(MANAGER1).get("/users/reports").expect(200);
      expect(reports.body.map((u: { email: string }) => u.email)).toContain("nina@example.com");
    });

    it("validates new users", async () => {
      const base = {
        name: "X",
        email: "x@example.com",
        password: "Password123!",
        role: "employee",
      };
      await t
        .as(ADMIN)
        .post("/users", { ...base, managerId: null })
        .expect(400); // employee needs a manager
      await t
        .as(ADMIN)
        .post("/users", { ...base, managerId: t.ids.employees[0] })
        .expect(400); // manager must be a manager
      await t
        .as(ADMIN)
        .post("/users", { ...base, managerId: t.ids.manager1, password: "short" })
        .expect(400);
      await t
        .as(ADMIN)
        .post("/users", { ...base, managerId: t.ids.manager1, role: "boss" })
        .expect(400);
      await t
        .as(ADMIN)
        .post("/users", { ...base, managerId: t.ids.manager1, email: "not-an-email" })
        .expect(400);
      await t
        .as(ADMIN)
        .post("/users", { ...base, managerId: t.ids.manager1, email: employee(1) })
        .expect(409);
    });

    it("stops a deactivated user immediately, even with a token that is still valid", async () => {
      const created = await t
        .as(ADMIN)
        .post("/users", {
          name: "Temp",
          email: "temp@example.com",
          password: "Password123!",
          role: "employee",
          managerId: t.ids.manager1,
        })
        .expect(201);
      const session = await login("temp@example.com", "Password123!").expect(200);
      const client = t.withToken(session.body.accessToken);
      await client.get("/auth/me").expect(200);

      await t.as(ADMIN).patch(`/users/${created.body.id}`, { active: false }).expect(200);
      await client.get("/auth/me").expect(401);
      await login("temp@example.com", "Password123!").expect(401);
    });

    it("applies a role change straight away, without logging in again", async () => {
      const created = await t
        .as(ADMIN)
        .post("/users", {
          name: "Promo",
          email: "promo@example.com",
          password: "Password123!",
          role: "employee",
          managerId: t.ids.manager1,
        })
        .expect(201);
      const client = t.withToken(
        (await login("promo@example.com", "Password123!")).body.accessToken,
      );
      await client.get("/leave-requests/inbox").expect(403);

      const updated = await t
        .as(ADMIN)
        .patch(`/users/${created.body.id}`, { role: "manager" })
        .expect(200);
      expect(updated.body.managerId).toBeNull();
      await client.get("/leave-requests/inbox").expect(200);
    });

    it("does not let an admin lock themselves out", async () => {
      await t.as(ADMIN).patch(`/users/${t.ids.admin}`, { active: false }).expect(400);
      await t.as(ADMIN).patch(`/users/${t.ids.admin}`, { role: "employee" }).expect(400);
    });

    it("rejects wrong or unknown credentials with the same message", async () => {
      const wrong = await login(employee(1), "nope").expect(401);
      const unknown = await login("ghost@example.com").expect(401);
      expect(wrong.body.message).toBe(unknown.body.message);
    });

    it("rejects a malformed token", async () => {
      await t.withToken("not.a.token").get("/auth/me").expect(401);
    });
  });

  describe("request validation and edge cases", () => {
    it("rejects missing or malformed fields", async () => {
      await leave(employee(1), { ...valid, startDate: "08/06/2026" }).expect(400);
      await leave(employee(1), { ...valid, leaveTypeId: "annual" }).expect(400);
      await leave(employee(1), { leaveTypeId: ANNUAL }).expect(400);
    });

    it("rejects an impossible calendar date", async () => {
      const res = await leave(employee(1), {
        ...valid,
        startDate: "2026-02-30",
        endDate: "2026-03-02",
      }).expect(422);
      expect(res.body.violations[0].code).toBe("INVALID_DATE");
    });

    it("rejects an unknown leave type", async () => {
      await leave(employee(1), { ...valid, leaveTypeId: 999 }).expect(404);
    });

    it("rejects a request that contains only a weekend", async () => {
      const res = await leave(employee(1), {
        ...valid,
        startDate: "2026-06-13",
        endDate: "2026-06-14",
      }).expect(422);
      expect(res.body.violations[0].code).toBe("NO_WORKING_DAYS");
    });

    it("rejects a request that spans two calendar years", async () => {
      const res = await leave(employee(1), {
        ...valid,
        startDate: "2026-12-29",
        endDate: "2027-01-04",
      }).expect(422);
      expect(res.body.violations[0].code).toBe("CROSSES_YEAR");
    });

    it("keeps balances per year", async () => {
      await leave(employee(1), { ...valid, startDate: "2026-12-28", endDate: "2026-12-31" }).expect(
        201,
      ); // 4 days, 2026
      await leave(employee(1), { ...valid, startDate: "2027-01-04", endDate: "2027-01-08" }).expect(
        201,
      ); // 5 days, 2027
      const y2026 = await t.as(employee(1)).get("/balances/me?year=2026").expect(200);
      const y2027 = await t.as(employee(1)).get("/balances/me?year=2027").expect(200);
      const annual = (b: { balances: Array<{ leaveTypeName: string; remaining: number }> }) =>
        b.balances.find((x) => x.leaveTypeName === "Annual")!.remaining;
      expect(annual(y2026.body)).toBe(16); // 20 - 4
      expect(annual(y2027.body)).toBe(15); // 20 - 5
    });

    it("reports null remaining for unlimited leave types and does not cap them", async () => {
      const res = await leave(employee(1), {
        leaveTypeId: UNPAID,
        startDate: "2026-06-08",
        endDate: "2026-11-30",
        reason: "Sabbatical",
      }).expect(201);
      expect(res.body.days).toBeGreaterThan(100);
      const balance = await t.as(employee(1)).get("/balances/me").expect(200);
      const unpaid = balance.body.balances.find(
        (b: { leaveTypeName: string }) => b.leaveTypeName === "Unpaid",
      );
      expect(unpaid.allowance).toBeNull();
      expect(unpaid.remaining).toBeNull();
    });

    it("does not let an admin request leave", async () => {
      await leave(ADMIN, valid).expect(403);
    });

    it("returns 404 for requests that do not exist and 400 for bad ids", async () => {
      await t.as(MANAGER1).patch("/leave-requests/99999/approve").expect(404);
      await t.as(employee(1)).patch("/leave-requests/99999/cancel").expect(404);
      await t.as(employee(1)).get("/leave-requests/99999").expect(404);
      await t.as(employee(1)).get("/leave-requests/abc").expect(400);
    });

    it("returns 404 for the balance of an unknown user", async () => {
      await t.as(ADMIN).get("/balances/99999").expect(404);
    });

    it("records the manager decision note", async () => {
      const created = await leave(employee(1), valid).expect(201);
      const res = await t
        .as(MANAGER1)
        .patch(`/leave-requests/${created.body.id}/reject`, { note: "Release week" })
        .expect(200);
      expect(res.body).toMatchObject({
        status: "rejected",
        decisionNote: "Release week",
        decidedById: t.ids.manager1,
      });
      expect(res.body.decidedAt).toBeTruthy();
    });

    it("validates the inbox status filter", async () => {
      await t.as(MANAGER1).get("/leave-requests/inbox?status=banana").expect(400);
      await t.as(MANAGER1).get("/leave-requests/inbox?status=all").expect(200);
    });
  });

  describe("calendar validation", () => {
    it("rejects invalid ranges", async () => {
      await t.as(employee(1)).get("/calendar").expect(400);
      await t.as(employee(1)).get("/calendar?from=2026-06-10&to=2026-06-01").expect(400);
      await t.as(employee(1)).get("/calendar?from=2026-01-01&to=2028-01-01").expect(400);
    });

    it("marks holidays in the calendar and leaves them out of coverage", async () => {
      const holiday = await t
        .as(ADMIN)
        .post("/holidays", { date: "2026-06-09", name: "Cal Holiday" })
        .expect(201);
      await leave(employee(1), { ...valid, startDate: "2026-06-08", endDate: "2026-06-10" }).expect(
        201,
      );
      const res = await t
        .as(employee(1))
        .get("/calendar?from=2026-06-08&to=2026-06-12")
        .expect(200);
      expect(res.body.holidays).toEqual([{ date: "2026-06-09", name: "Cal Holiday" }]);
      expect(res.body.coverage).toEqual({ "2026-06-08": 1, "2026-06-10": 1 });
      await t.as(ADMIN).delete(`/holidays/${holiday.body.id}`).expect(200);
    });
  });
});
