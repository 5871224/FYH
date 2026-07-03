const assert = require("assert");
const path = require("path");

const compliance = require(path.join(__dirname, "..", "src", "renderer", "rest-compliance.js"));

const sundayWeeks = compliance.buildCalendarWeeks(2026, 5, 0);
assert.strictEqual(sundayWeeks[0].startDate, "2026-05-31", "Sunday-based weeks should start from the prior Sunday");
assert.strictEqual(sundayWeeks[0].endDate, "2026-06-06", "Sunday-based weeks should end on Saturday");

const mondayWeeks = compliance.buildCalendarWeeks(2026, 5, 1);
assert.strictEqual(mondayWeeks[0].startDate, "2026-06-01", "Monday-based weeks should start on Monday for June 2026");
assert.strictEqual(mondayWeeks[0].endDate, "2026-06-07", "Monday-based weeks should end on Sunday");

const result = compliance.checkRestCompliance({
  year: 2026,
  month: 5,
  weekStart: 0,
  maxConsecutiveWorkDays: 6,
  reportStartDate: "2026-06-01",
  reportEndDate: "2026-06-30",
  memberCalendars: [
    {
      memberId: "m1",
      memberName: "Compliant",
      memberCode: "SELF_CHECK_1",
      hireDate: "",
      leaveDate: "",
      days: [
        { date: "2026-05-31", active: true, leaveCode: "0036", hasShift: false, hasOvertime: false },
        { date: "2026-06-01", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-02", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-03", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-04", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-05", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-06", active: true, leaveCode: "0047", hasShift: false, hasOvertime: false }
      ]
    },
    {
      memberId: "m2",
      memberName: "Missing Regular Holiday",
      memberCode: "SELF_CHECK_2",
      hireDate: "",
      leaveDate: "",
      days: [
        { date: "2026-05-31", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-01", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-02", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-03", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-04", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-05", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-06", active: true, leaveCode: "0047", hasShift: false, hasOvertime: false }
      ]
    },
    {
      memberId: "m3",
      memberName: "Regular Holiday Work",
      memberCode: "SELF_CHECK_3",
      hireDate: "",
      leaveDate: "",
      days: [
        { date: "2026-05-31", active: true, leaveCode: "0036", hasShift: false, hasOvertime: true },
        { date: "2026-06-01", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-02", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-03", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-04", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-05", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-06", active: true, leaveCode: "0047", hasShift: false, hasOvertime: false }
      ]
    },
    {
      memberId: "m4",
      memberName: "Leave Week Needs Protection",
      memberCode: "A004",
      hireDate: "",
      leaveDate: "2026-06-06",
      days: [
        { date: "2026-05-31", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-01", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-02", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-03", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-04", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-05", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-06", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-07", active: false, leaveCode: "", hasShift: false, hasOvertime: false }
      ]
    },
    {
      memberId: "m5",
      memberName: "Consecutive Work",
      memberCode: "A005",
      hireDate: "",
      leaveDate: "",
      slidingDays: [
        { date: "2026-05-31", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-01", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-02", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-03", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-04", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-05", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-06", active: true, leaveCode: "", hasShift: true, hasOvertime: false }
      ],
      days: [
        { date: "2026-05-31", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-01", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-02", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-03", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-04", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-05", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-06", active: true, leaveCode: "", hasShift: true, hasOvertime: false }
      ]
    }
  ]
});

assert(result.checkedWeeks >= 4, "sample calendars should produce checked weeks");
assert(result.skippedWeeks >= 1, "hire or leave weeks should be skipped");
assert(result.issues.some((issue) => issue.type === "missing_regular_holiday" && issue.memberId === "m2"), "missing regular holiday should be flagged");
assert(!result.issues.some((issue) => issue.type === "missing_rest_day"), "missing rest days should not be flagged");
assert(result.issues.some((issue) => issue.type === "regular_holiday_work" && issue.memberId === "m3"), "work on a regular holiday should be flagged");
assert(result.issues.some((issue) => issue.type === "consecutive_work_days_exceeded" && issue.memberId === "m5"), "more than 6 consecutive work days should be flagged");
assert(!result.issues.some((issue) => issue.memberId === "m1"), "a compliant week should not generate issues");
assert(result.issues.some((issue) => issue.type === "insufficient_non_employment_or_rest_days" && issue.memberId === "m4"), "hire week should enforce the 2-day protection rule");

const slidingResult = compliance.checkRestCompliance({
  year: 2026,
  month: 5,
  weekStart: 1,
  maxConsecutiveWorkDays: 6,
  reportStartDate: "2026-06-01",
  reportEndDate: "2026-06-30",
  memberCalendars: [
    {
      memberId: "m6",
      memberName: "Cross Week Streak",
      memberCode: "A006",
      hireDate: "",
      leaveDate: "",
      slidingDays: [
        { date: "2026-05-29", active: false, leaveCode: "", hasShift: false, hasOvertime: false },
        { date: "2026-05-30", active: false, leaveCode: "", hasShift: false, hasOvertime: false },
        { date: "2026-05-31", active: false, leaveCode: "", hasShift: false, hasOvertime: false },
        { date: "2026-06-01", active: true, leaveCode: "0036", hasShift: false, hasOvertime: false },
        { date: "2026-06-02", active: true, leaveCode: "0047", hasShift: false, hasOvertime: false },
        { date: "2026-06-03", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-04", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-05", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-06", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-07", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-08", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-09", active: true, leaveCode: "", hasShift: true, hasOvertime: false }
      ],
      days: [
        { date: "2026-06-01", active: true, leaveCode: "0036", hasShift: false, hasOvertime: false },
        { date: "2026-06-02", active: true, leaveCode: "0047", hasShift: false, hasOvertime: false },
        { date: "2026-06-03", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-04", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-05", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-06", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-07", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-08", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-09", active: true, leaveCode: "", hasShift: true, hasOvertime: false }
      ]
    }
  ]
});

assert(slidingResult.issues.some((issue) => issue.type === "consecutive_work_days_exceeded" && issue.memberId === "m6"), "cross-week sliding streaks should be flagged");

const carryOverResult = compliance.checkRestCompliance({
  year: 2026,
  month: 5,
  weekStart: 0,
  maxConsecutiveWorkDays: 6,
  reportStartDate: "2026-06-01",
  reportEndDate: "2026-06-30",
  memberCalendars: [
    {
      memberId: "m7",
      memberName: "Carry Over Streak",
      memberCode: "A007",
      hireDate: "",
      leaveDate: "",
      slidingDays: [
        { date: "2026-05-26", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-05-27", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-05-28", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-05-29", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-05-30", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-05-31", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-01", active: true, leaveCode: "", hasShift: true, hasOvertime: false }
      ],
      days: [
        { date: "2026-06-01", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-02", active: true, leaveCode: "0036", hasShift: false, hasOvertime: false },
        { date: "2026-06-03", active: true, leaveCode: "0047", hasShift: false, hasOvertime: false }
      ]
    }
  ]
});

assert(carryOverResult.issues.some((issue) => issue.type === "consecutive_work_days_exceeded" && issue.memberId === "m7" && issue.date === "2026-06-01"), "carry-over streaks from the previous month should be flagged on the first in-month date");

const hireLeaveProtectedResult = compliance.checkRestCompliance({
  year: 2026,
  month: 5,
  weekStart: 0,
  maxConsecutiveWorkDays: 6,
  reportStartDate: "2026-06-01",
  reportEndDate: "2026-06-30",
  memberCalendars: [
    {
      memberId: "m8",
      memberName: "Hire Week Protected",
      memberCode: "A008",
      hireDate: "2026-06-04",
      leaveDate: "",
      slidingDays: [
        { date: "2026-05-31", active: false, leaveCode: "", hasShift: false, hasOvertime: false },
        { date: "2026-06-01", active: false, leaveCode: "", hasShift: false, hasOvertime: false },
        { date: "2026-06-02", active: false, leaveCode: "", hasShift: false, hasOvertime: false },
        { date: "2026-06-03", active: false, leaveCode: "", hasShift: false, hasOvertime: false },
        { date: "2026-06-04", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-05", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-06", active: true, leaveCode: "0047", hasShift: false, hasOvertime: false }
      ],
      days: [
        { date: "2026-05-31", active: false, leaveCode: "", hasShift: false, hasOvertime: false },
        { date: "2026-06-01", active: false, leaveCode: "", hasShift: false, hasOvertime: false },
        { date: "2026-06-02", active: false, leaveCode: "", hasShift: false, hasOvertime: false },
        { date: "2026-06-03", active: false, leaveCode: "", hasShift: false, hasOvertime: false },
        { date: "2026-06-04", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-05", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-06", active: true, leaveCode: "0047", hasShift: false, hasOvertime: false }
      ]
    }
  ]
});

assert(!hireLeaveProtectedResult.issues.some((issue) => issue.memberId === "m8"), "hire week with at least 2 protected days should not be flagged");

const hireWeekConsecutiveResult = compliance.checkRestCompliance({
  year: 2026,
  month: 5,
  weekStart: 0,
  maxConsecutiveWorkDays: 6,
  reportStartDate: "2026-06-01",
  reportEndDate: "2026-06-30",
  memberCalendars: [
    {
      memberId: "m9",
      memberName: "Hire Week Consecutive",
      memberCode: "A009",
      hireDate: "2026-06-03",
      leaveDate: "",
      slidingDays: [
        { date: "2026-05-31", active: false, leaveCode: "", hasShift: false, hasOvertime: false },
        { date: "2026-06-01", active: false, leaveCode: "", hasShift: false, hasOvertime: false },
        { date: "2026-06-02", active: false, leaveCode: "", hasShift: false, hasOvertime: false },
        { date: "2026-06-03", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-04", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-05", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-06", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-07", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-08", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-09", active: true, leaveCode: "", hasShift: true, hasOvertime: false }
      ],
      days: [
        { date: "2026-05-31", active: false, leaveCode: "", hasShift: false, hasOvertime: false },
        { date: "2026-06-01", active: false, leaveCode: "", hasShift: false, hasOvertime: false },
        { date: "2026-06-02", active: false, leaveCode: "", hasShift: false, hasOvertime: false },
        { date: "2026-06-03", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-04", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-05", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-06", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-07", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-08", active: true, leaveCode: "", hasShift: true, hasOvertime: false },
        { date: "2026-06-09", active: true, leaveCode: "", hasShift: true, hasOvertime: false }
      ]
    }
  ]
});

assert(hireWeekConsecutiveResult.issues.some((issue) => issue.type === "consecutive_work_days_exceeded" && issue.memberId === "m9"), "hire week should still count toward consecutive work day violations");

console.log("rest compliance checks passed");
