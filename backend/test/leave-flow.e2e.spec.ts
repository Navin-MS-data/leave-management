import {
  ADMIN,
  ANNUAL,
  clearRequests,
  createTestApp,
  employee,
  MANAGER1,
  MANAGER2,
  SICK,
  TestApp,
} from "./test-app";

/**
 * End-to-end tests: real HTTP, real guards and validation, real services.
 * Team A = manager1 + employee1..4. Team B = manager2 + employee5..8.
 * "Today" is Monday 2026-06-01, minimum notice 2 days, max 2 people off per day.
 */
describe("leave management API", () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  beforeEach(async () => {
    await clearRequests(t.ds);
    await t.ds.query("DELETE FROM public_holidays WHERE name = 'Test holiday'");
    await t.ds.query("UPDATE leave_types SET \"yearlyAllowance\" = 20 WHERE name = 'Annual'");
    await t.as(ADMIN).put("/settings", { minNoticeDays: 2, maxTeamOffPerDay: 2 }).expect(200);
  });

  const request = (who: string, start: string, end: string, extra: object = {}) =>
    t
      .as(who)
      .post("/leave-requests", {
        leaveTypeId: ANNUAL,
        startDate: start,
        endDate: end,
        reason: "Trip",
        ...extra,
      });

  const remaining = async (who: string, name = "Annual") => {
    const res = await t.as(who).get("/balances/me").expect(200);
    return res.body.balances.find((b: { leaveTypeName: string }) => b.leaveTypeName === name)
      .remaining as number;
  };

  describe("authentication and roles", () => {
    it("rejects anonymous calls and bad credentials", async () => {
      await t.anonymous().get("/leave-requests/mine").expect(401);
      await t
        .anonymous()
        .post("/auth/login", { email: employee(1), password: "wrong" })
        .expect(401);
    });

    it("lets employees request leave but not change configuration", async () => {
      await request(employee(1), "2026-06-08", "2026-06-08").expect(201);
      await t.as(employee(1)).put("/settings", { maxTeamOffPerDay: 9 }).expect(403);
      await t.as(employee(1)).post("/leave-types", { name: "Study" }).expect(403);
      await t.as(employee(1)).post("/holidays", { date: "2026-12-31", name: "x" }).expect(403);
      await t.as(employee(1)).get("/users").expect(403);
      await t.as(MANAGER1).put("/settings", { maxTeamOffPerDay: 9 }).expect(403);
    });

    it("does not let an employee decide on requests, even their teammates", async () => {
      const created = await request(employee(1), "2026-06-08", "2026-06-08").expect(201);
      await t.as(employee(2)).patch(`/leave-requests/${created.body.id}/approve`).expect(403);
      await t.as(employee(1)).patch(`/leave-requests/${created.body.id}/approve`).expect(403);
    });

    it("does not let a manager decide on another team's requests", async () => {
      const created = await request(employee(1), "2026-06-08", "2026-06-08").expect(201);
      await t.as(MANAGER2).patch(`/leave-requests/${created.body.id}/approve`).expect(403);
      await t.as(MANAGER2).patch(`/leave-requests/${created.body.id}/reject`).expect(403);
      await t.as(MANAGER1).patch(`/leave-requests/${created.body.id}/approve`).expect(200);
    });

    it("limits who can see a balance or a request", async () => {
      const created = await request(employee(1), "2026-06-08", "2026-06-08").expect(201);
      const id = t.ids.employees[0];
      await t.as(employee(2)).get(`/balances/${id}`).expect(403);
      await t.as(MANAGER2).get(`/balances/${id}`).expect(403);
      await t.as(MANAGER1).get(`/balances/${id}`).expect(200);
      await t.as(ADMIN).get(`/balances/${id}`).expect(200);
      await t.as(employee(2)).get(`/leave-requests/${created.body.id}`).expect(403);
      await t.as(employee(1)).get(`/leave-requests/${created.body.id}`).expect(200);
    });

    it("lets an admin decide on a manager request, but never lets a manager approve their own", async () => {
      const created = await request(MANAGER1, "2026-06-08", "2026-06-09").expect(201);
      await t.as(MANAGER1).patch(`/leave-requests/${created.body.id}/approve`).expect(403);
      await t.as(MANAGER2).patch(`/leave-requests/${created.body.id}/approve`).expect(403);
      const res = await t.as(ADMIN).patch(`/leave-requests/${created.body.id}/approve`).expect(200);
      expect(res.body.status).toBe("approved");
    });
  });

  describe("request validation", () => {
    it("rejects an end date before the start date", async () => {
      const res = await request(employee(1), "2026-06-12", "2026-06-08").expect(422);
      expect(res.body.violations[0].code).toBe("END_BEFORE_START");
    });

    it("requires a reason", async () => {
      await request(employee(1), "2026-06-08", "2026-06-08", { reason: "" }).expect(400);
    });

    it("excludes weekends and public holidays from the day count", async () => {
      // Friday 12 June to Tuesday 16 June: Fri, Mon, Tue = 3 working days.
      const res = await request(employee(1), "2026-06-12", "2026-06-16").expect(201);
      expect(res.body.days).toBe(3);

      // A holiday inside the range is not counted either.
      await t.as(ADMIN).post("/holidays", { date: "2026-06-18", name: "Test holiday" }).expect(201);
      const preview = await t
        .as(employee(2))
        .post("/leave-requests/preview", {
          leaveTypeId: ANNUAL,
          startDate: "2026-06-17",
          endDate: "2026-06-19",
        })
        .expect(201);
      expect(preview.body.days).toBe(2);
    });

    it("enforces the minimum notice period", async () => {
      const res = await request(employee(1), "2026-06-02", "2026-06-02").expect(422);
      expect(res.body.violations[0].code).toBe("MIN_NOTICE");
    });
  });

  describe("balance rule", () => {
    it("counts pending requests against the balance", async () => {
      // 15 working days (8-26 June) stay pending, leaving 5.
      await request(employee(1), "2026-06-08", "2026-06-26").expect(201);
      expect(await remaining(employee(1))).toBe(5);

      const res = await request(employee(1), "2026-06-29", "2026-07-07").expect(422); // 7 days
      expect(res.body.violations.map((v: { code: string }) => v.code)).toContain(
        "INSUFFICIENT_BALANCE",
      );
    });

    it("allows a request that uses exactly the remaining balance", async () => {
      await request(employee(1), "2026-06-08", "2026-06-26").expect(201); // 15 days
      await request(employee(1), "2026-06-29", "2026-07-03").expect(201); // 5 days
      expect(await remaining(employee(1))).toBe(0);
    });

    it("restores the balance when a pending request is cancelled", async () => {
      const created = await request(employee(1), "2026-06-08", "2026-06-12").expect(201);
      expect(await remaining(employee(1))).toBe(15);
      const res = await t
        .as(employee(1))
        .patch(`/leave-requests/${created.body.id}/cancel`)
        .expect(200);
      expect(res.body.status).toBe("cancelled");
      expect(await remaining(employee(1))).toBe(20);
    });

    it("restores the balance when an approved request is cancelled", async () => {
      const created = await request(employee(1), "2026-06-08", "2026-06-12").expect(201);
      await t.as(MANAGER1).patch(`/leave-requests/${created.body.id}/approve`).expect(200);
      expect(await remaining(employee(1))).toBe(15);
      await t.as(employee(1)).patch(`/leave-requests/${created.body.id}/cancel`).expect(200);
      expect(await remaining(employee(1))).toBe(20);
      // ...and the freed days can be requested again.
      await request(employee(1), "2026-06-15", "2026-07-10").expect(201); // 20 days
    });

    it("restores the balance when a request is rejected", async () => {
      const created = await request(employee(1), "2026-06-08", "2026-06-12").expect(201);
      await t
        .as(MANAGER1)
        .patch(`/leave-requests/${created.body.id}/reject`)
        .send({ note: "Busy week" })
        .expect(200);
      expect(await remaining(employee(1))).toBe(20);
    });

    it("does not restrict unpaid leave, and tracks each type separately", async () => {
      await request(employee(1), "2026-06-08", "2026-06-12", { leaveTypeId: SICK }).expect(201);
      expect(await remaining(employee(1), "Sick")).toBe(5);
      expect(await remaining(employee(1))).toBe(20);
    });

    it("uses the configured allowance, so changing it changes behavior", async () => {
      await t.as(ADMIN).patch(`/leave-types/${ANNUAL}`, { yearlyAllowance: 2 }).expect(200);
      const res = await request(employee(1), "2026-06-08", "2026-06-10").expect(422);
      expect(res.body.violations[0].code).toBe("INSUFFICIENT_BALANCE");
      await t.as(ADMIN).patch(`/leave-types/${ANNUAL}`, { yearlyAllowance: 3 }).expect(200);
      await request(employee(1), "2026-06-08", "2026-06-10").expect(201);
    });
  });

  describe("overlap rules", () => {
    it("rejects overlapping requests from the same employee", async () => {
      await request(employee(1), "2026-06-08", "2026-06-12").expect(201);
      const res = await request(employee(1), "2026-06-10", "2026-06-15").expect(422);
      expect(res.body.violations.map((v: { code: string }) => v.code)).toContain("OWN_OVERLAP");
      // The next Monday is free.
      await request(employee(1), "2026-06-15", "2026-06-15").expect(201);
    });

    it("allows overlap again once the earlier request was cancelled", async () => {
      const first = await request(employee(1), "2026-06-08", "2026-06-12").expect(201);
      await t.as(employee(1)).patch(`/leave-requests/${first.body.id}/cancel`).expect(200);
      await request(employee(1), "2026-06-08", "2026-06-12").expect(201);
    });

    it("blocks the request that would exceed the team limit (pending counts)", async () => {
      await request(employee(1), "2026-06-08", "2026-06-08").expect(201);
      await request(employee(2), "2026-06-08", "2026-06-08").expect(201);
      const res = await request(employee(3), "2026-06-08", "2026-06-08").expect(422);
      expect(res.body.violations[0].code).toBe("TEAM_COVERAGE");
      expect(res.body.violations[0].dates).toEqual(["2026-06-08"]);

      // Another day, and another team, are not affected.
      await request(employee(3), "2026-06-09", "2026-06-09").expect(201);
      await request(employee(5), "2026-06-08", "2026-06-08").expect(201);
    });

    it("counts the manager as part of the team", async () => {
      await request(employee(1), "2026-06-08", "2026-06-08").expect(201);
      await request(MANAGER1, "2026-06-08", "2026-06-08").expect(201);
      await request(employee(2), "2026-06-08", "2026-06-08").expect(422);
    });

    it("frees the slot when a team member cancels", async () => {
      await request(employee(1), "2026-06-08", "2026-06-08").expect(201);
      const second = await request(employee(2), "2026-06-08", "2026-06-08").expect(201);
      await request(employee(3), "2026-06-08", "2026-06-08").expect(422);
      await t.as(employee(2)).patch(`/leave-requests/${second.body.id}/cancel`).expect(200);
      await request(employee(3), "2026-06-08", "2026-06-08").expect(201);
    });

    it("changing the admin setting changes the outcome without a code change", async () => {
      await request(employee(1), "2026-06-08", "2026-06-08").expect(201);
      await request(employee(2), "2026-06-08", "2026-06-08").expect(201);
      await request(employee(3), "2026-06-08", "2026-06-08").expect(422);

      await t.as(ADMIN).put("/settings", { maxTeamOffPerDay: 3 }).expect(200);
      await request(employee(3), "2026-06-08", "2026-06-08").expect(201);
    });

    it("applies the configured minimum notice days", async () => {
      await t.as(ADMIN).put("/settings", { minNoticeDays: 10 }).expect(200);
      const res = await request(employee(1), "2026-06-08", "2026-06-08").expect(422);
      expect(res.body.violations[0].code).toBe("MIN_NOTICE");
      await t.as(ADMIN).put("/settings", { minNoticeDays: 5 }).expect(200);
      await request(employee(1), "2026-06-08", "2026-06-08").expect(201);
    });

    it("re-checks coverage when approving, in case settings were lowered meanwhile", async () => {
      const a = await request(employee(1), "2026-06-08", "2026-06-08").expect(201);
      await request(employee(2), "2026-06-08", "2026-06-08").expect(201);
      await t.as(ADMIN).put("/settings", { maxTeamOffPerDay: 1 }).expect(200);
      const res = await t.as(MANAGER1).patch(`/leave-requests/${a.body.id}/approve`).expect(422);
      expect(res.body.violations[0].code).toBe("TEAM_COVERAGE");
    });
  });

  describe("approval workflow", () => {
    it("moves pending to approved and records who decided", async () => {
      const created = await request(employee(1), "2026-06-08", "2026-06-08").expect(201);
      expect(created.body.status).toBe("pending");
      const res = await t
        .as(MANAGER1)
        .patch(`/leave-requests/${created.body.id}/approve`)
        .expect(200);
      expect(res.body.status).toBe("approved");
      expect(res.body.decidedById).toBe(t.ids.manager1);
    });

    it("does not allow invalid transitions", async () => {
      const created = await request(employee(1), "2026-06-08", "2026-06-08").expect(201);
      const id = created.body.id;
      await t.as(MANAGER1).patch(`/leave-requests/${id}/reject`).expect(200);
      await t.as(MANAGER1).patch(`/leave-requests/${id}/approve`).expect(409); // rejected -> approved
      await t.as(employee(1)).patch(`/leave-requests/${id}/cancel`).expect(409); // rejected -> cancelled

      const second = await request(employee(1), "2026-06-09", "2026-06-09").expect(201);
      await t.as(employee(1)).patch(`/leave-requests/${second.body.id}/cancel`).expect(200);
      await t.as(MANAGER1).patch(`/leave-requests/${second.body.id}/approve`).expect(409); // cancelled -> approved
      await t.as(employee(1)).patch(`/leave-requests/${second.body.id}/cancel`).expect(409); // cancelled twice
    });

    it("lets only the owner (or the owner's manager) cancel", async () => {
      const created = await request(employee(1), "2026-06-08", "2026-06-08").expect(201);
      await t.as(employee(2)).patch(`/leave-requests/${created.body.id}/cancel`).expect(403);
      await t.as(MANAGER2).patch(`/leave-requests/${created.body.id}/cancel`).expect(403);
      await t.as(MANAGER1).patch(`/leave-requests/${created.body.id}/cancel`).expect(200);
    });

    it("does not allow cancelling leave that has already ended", async () => {
      const created = await request(employee(1), "2026-06-08", "2026-06-08").expect(201);
      t.clock.fixed = "2026-06-20";
      try {
        await t.as(employee(1)).patch(`/leave-requests/${created.body.id}/cancel`).expect(409);
      } finally {
        t.clock.fixed = "2026-06-01";
      }
    });

    it("shows each manager only their own reports' requests in the inbox", async () => {
      await request(employee(1), "2026-06-08", "2026-06-08").expect(201);
      await request(employee(5), "2026-06-08", "2026-06-08").expect(201);
      await request(MANAGER1, "2026-06-15", "2026-06-15").expect(201);

      const inbox1 = await t.as(MANAGER1).get("/leave-requests/inbox").expect(200);
      expect(inbox1.body).toHaveLength(1);
      expect(inbox1.body[0].user.id).toBe(t.ids.employees[0]);

      const adminInbox = await t.as(ADMIN).get("/leave-requests/inbox").expect(200);
      expect(adminInbox.body).toHaveLength(1);
      expect(adminInbox.body[0].user.id).toBe(t.ids.manager1);
      await t.as(employee(1)).get("/leave-requests/inbox").expect(403);
    });
  });

  describe("preview, balances and calendar", () => {
    it("previews the day count and rule violations without creating anything", async () => {
      await request(employee(1), "2026-06-08", "2026-06-08").expect(201);
      const res = await t
        .as(employee(1))
        .post("/leave-requests/preview", {
          leaveTypeId: ANNUAL,
          startDate: "2026-06-08",
          endDate: "2026-06-12",
        })
        .expect(201);
      expect(res.body.days).toBe(5);
      expect(res.body.valid).toBe(false);
      expect(res.body.violations[0].code).toBe("OWN_OVERLAP");
      expect(res.body.remainingAfter).toBe(14); // 20 - 1 already pending - 5 previewed
      const mine = await t.as(employee(1)).get("/leave-requests/mine").expect(200);
      expect(mine.body).toHaveLength(1);
    });

    it("shows a team calendar with coverage, scoped to the user's own team", async () => {
      await request(employee(1), "2026-06-08", "2026-06-09").expect(201);
      await request(employee(2), "2026-06-09", "2026-06-09").expect(201);
      await request(employee(5), "2026-06-09", "2026-06-09").expect(201); // other team

      const res = await t
        .as(employee(3))
        .get("/calendar?from=2026-06-01&to=2026-06-30")
        .expect(200);
      expect(res.body.entries).toHaveLength(2);
      expect(res.body.coverage).toEqual({ "2026-06-08": 1, "2026-06-09": 2 });
      expect(res.body.teamSize).toBe(5);
      expect(res.body.maxTeamOffPerDay).toBe(2);

      const admin = await t.as(ADMIN).get("/calendar?from=2026-06-01&to=2026-06-30").expect(200);
      expect(admin.body.entries).toHaveLength(3);
    });

    it("lists managers and admins their team balances", async () => {
      await request(employee(1), "2026-06-08", "2026-06-08").expect(201);
      const res = await t.as(MANAGER1).get("/balances/team").expect(200);
      expect(res.body).toHaveLength(4);
      await t.as(employee(1)).get("/balances/team").expect(403);
    });
  });
});
