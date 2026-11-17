import { evaluateLeaveRules, listWorkingDays, validateDateRange } from "./leave-rules";

const HOLIDAYS = new Set(["2026-01-01", "2026-04-15", "2026-05-01"]);

const BASE_CTX = {
  today: "2026-01-05",
  minNoticeDays: 2,
  maxTeamOffPerDay: 2,
  holidays: HOLIDAYS,
  allowance: 20,
  committedDays: 0,
  ownRequests: [],
  teamRequests: [],
};

describe("listWorkingDays", () => {
  it("excludes both weekend days", () => {
    // 2026-01-10 is Saturday, 2026-01-11 is Sunday
    const days = listWorkingDays("2026-01-10", "2026-01-11", HOLIDAYS);
    expect(days).toHaveLength(0);
  });

  it("excludes a public holiday that falls on a weekday", () => {
    // 2026-05-01 is a Friday and a holiday
    const days = listWorkingDays("2026-04-30", "2026-05-04", HOLIDAYS);
    expect(days).not.toContain("2026-05-01");
    expect(days).toContain("2026-04-30"); // Thursday
  });

  it("returns a single Monday correctly", () => {
    const days = listWorkingDays("2026-01-05", "2026-01-05", HOLIDAYS);
    expect(days).toEqual(["2026-01-05"]);
  });

  it("spans a month boundary correctly", () => {
    // 2026-01-29 Thu, 2026-01-30 Fri, 2026-01-31 Sat(skip), 2026-02-01 Sun(skip), 2026-02-02 Mon = 3 days
    const days = listWorkingDays("2026-01-29", "2026-02-02", HOLIDAYS);
    expect(days).toEqual(["2026-01-29", "2026-01-30", "2026-02-02"]);
    expect(days).toHaveLength(3);
  });
});

describe("validateDateRange", () => {
  it("returns null for a valid same-year range", () => {
    expect(validateDateRange("2026-03-01", "2026-03-05")).toBeNull();
  });

  it("reports END_BEFORE_START", () => {
    const v = validateDateRange("2026-03-05", "2026-03-01");
    expect(v?.code).toBe("END_BEFORE_START");
  });

  it("reports INVALID_DATE for a non-existent date", () => {
    const v = validateDateRange("2026-02-30", "2026-03-01");
    expect(v?.code).toBe("INVALID_DATE");
  });

  it("reports CROSSES_YEAR for a range spanning two years", () => {
    const v = validateDateRange("2026-12-30", "2027-01-02");
    expect(v?.code).toBe("CROSSES_YEAR");
  });
});

describe("evaluateLeaveRules – balance", () => {
  it("passes when days equal the remaining balance exactly", () => {
    const ctx = { ...BASE_CTX, allowance: 5, committedDays: 3 };
    // Mon-Tue = 2 working days
    const r = evaluateLeaveRules({ startDate: "2026-01-19", endDate: "2026-01-20" }, ctx);
    expect(r.violations).toHaveLength(0);
    expect(r.days).toBe(2);
    expect(r.remainingAfter).toBe(0);
  });

  it("reports INSUFFICIENT_BALANCE when over the limit", () => {
    const ctx = { ...BASE_CTX, allowance: 1, committedDays: 1 };
    // 5 working days
    const r = evaluateLeaveRules({ startDate: "2026-01-19", endDate: "2026-01-23" }, ctx);
    expect(r.violations.some((v) => v.code === "INSUFFICIENT_BALANCE")).toBe(true);
  });

  it("allows unlimited leave (allowance = null)", () => {
    const ctx = { ...BASE_CTX, allowance: null, committedDays: 999 };
    const r = evaluateLeaveRules({ startDate: "2026-01-19", endDate: "2026-01-23" }, ctx);
    expect(r.violations.some((v) => v.code === "INSUFFICIENT_BALANCE")).toBe(false);
    expect(r.remainingAfter).toBeNull();
  });

  it("counts pending days (committedDays) against the balance", () => {
    const ctx = { ...BASE_CTX, allowance: 3, committedDays: 3 };
    const r = evaluateLeaveRules({ startDate: "2026-01-19", endDate: "2026-01-19" }, ctx);
    expect(r.violations.some((v) => v.code === "INSUFFICIENT_BALANCE")).toBe(true);
  });
});

describe("evaluateLeaveRules – notice", () => {
  it("reports MIN_NOTICE when start is too soon", () => {
    // today=2026-01-05, minNotice=2, so 2026-01-06 is too close
    const r = evaluateLeaveRules({ startDate: "2026-01-06", endDate: "2026-01-06" }, BASE_CTX);
    expect(r.violations.some((v) => v.code === "MIN_NOTICE")).toBe(true);
  });

  it("allows the request exactly at the notice boundary", () => {
    // today=2026-01-05 + 2 days = 2026-01-07
    const r = evaluateLeaveRules({ startDate: "2026-01-07", endDate: "2026-01-07" }, BASE_CTX);
    expect(r.violations.some((v) => v.code === "MIN_NOTICE")).toBe(false);
  });

  it("skips notice check when skipNotice=true", () => {
    const r = evaluateLeaveRules({ startDate: "2026-01-06", endDate: "2026-01-06" }, BASE_CTX, {
      skipNotice: true,
    });
    expect(r.violations.some((v) => v.code === "MIN_NOTICE")).toBe(false);
  });
});

describe("evaluateLeaveRules – overlap", () => {
  it("reports OWN_OVERLAP when ranges touch", () => {
    const ctx = {
      ...BASE_CTX,
      ownRequests: [{ startDate: "2026-02-10", endDate: "2026-02-14" }],
    };
    const r = evaluateLeaveRules({ startDate: "2026-02-12", endDate: "2026-02-18" }, ctx);
    expect(r.violations.some((v) => v.code === "OWN_OVERLAP")).toBe(true);
  });

  it("allows adjacent non-overlapping dates", () => {
    const ctx = {
      ...BASE_CTX,
      ownRequests: [{ startDate: "2026-02-09", endDate: "2026-02-10" }],
    };
    const r = evaluateLeaveRules({ startDate: "2026-02-11", endDate: "2026-02-13" }, ctx);
    expect(r.violations.some((v) => v.code === "OWN_OVERLAP")).toBe(false);
  });
});

describe("evaluateLeaveRules – team coverage", () => {
  it("reports TEAM_COVERAGE when the daily limit is hit", () => {
    // maxTeamOffPerDay = 2, two colleagues already off → adding a 3rd should fail
    const ctx = {
      ...BASE_CTX,
      maxTeamOffPerDay: 2,
      teamRequests: [
        { userId: 10, startDate: "2026-03-02", endDate: "2026-03-04" },
        { userId: 11, startDate: "2026-03-02", endDate: "2026-03-02" },
      ],
    };
    const r = evaluateLeaveRules({ startDate: "2026-03-02", endDate: "2026-03-02" }, ctx);
    expect(r.violations.some((v) => v.code === "TEAM_COVERAGE")).toBe(true);
  });

  it("allows the request when the team is under the limit", () => {
    const ctx = {
      ...BASE_CTX,
      maxTeamOffPerDay: 3,
      teamRequests: [
        { userId: 10, startDate: "2026-03-02", endDate: "2026-03-04" },
        { userId: 11, startDate: "2026-03-02", endDate: "2026-03-02" },
      ],
    };
    const r = evaluateLeaveRules({ startDate: "2026-03-02", endDate: "2026-03-02" }, ctx);
    expect(r.violations.some((v) => v.code === "TEAM_COVERAGE")).toBe(false);
  });

  it("reports NO_WORKING_DAYS for a weekend-only range", () => {
    const r = evaluateLeaveRules({ startDate: "2026-01-10", endDate: "2026-01-11" }, BASE_CTX);
    expect(r.violations.some((v) => v.code === "NO_WORKING_DAYS")).toBe(true);
    expect(r.days).toBe(0);
  });
});
