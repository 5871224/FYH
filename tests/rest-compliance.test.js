const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const context = { window: {} };
vm.runInNewContext(
  fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "rest-compliance.js"), "utf8"),
  context
);
const compliance = context.window.restCompliance;

function day(date, options = {}) {
  return {
    date,
    active: true,
    leaveCode: "",
    hasShift: false,
    hasOvertime: false,
    ...options
  };
}

test("週期起訖應依設定的星期起始日計算", () => {
  const sundayWeeks = compliance.buildCalendarWeeks(2026, 5, 0);
  assert.equal(sundayWeeks[0].startDate, "2026-05-31");
  assert.equal(sundayWeeks[0].endDate, "2026-06-06");

  const mondayWeeks = compliance.buildCalendarWeeks(2026, 5, 1);
  assert.equal(mondayWeeks[0].startDate, "2026-06-01");
  assert.equal(mondayWeeks[0].endDate, "2026-06-07");
});

test("例休檢查應回報缺少例假、例假出勤與跨週連續出勤", () => {
  const dates = [
    "2026-05-29", "2026-05-30", "2026-05-31",
    "2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04",
    "2026-06-05", "2026-06-06", "2026-06-07", "2026-06-08"
  ];
  const result = compliance.checkRestCompliance({
    year: 2026,
    month: 5,
    weekStart: 0,
    maxConsecutiveWorkDays: 6,
    reportStartDate: "2026-06-01",
    reportEndDate: "2026-06-30",
    memberCalendars: [
      {
        memberId: "missing",
        memberName: "缺少例假",
        days: [
          day("2026-05-31", { hasShift: true }),
          day("2026-06-01", { hasShift: true }),
          day("2026-06-02", { hasShift: true }),
          day("2026-06-03", { hasShift: true }),
          day("2026-06-04", { hasShift: true }),
          day("2026-06-05", { hasShift: true }),
          day("2026-06-06", { leaveCode: compliance.REST_DAY_CODE })
        ]
      },
      {
        memberId: "holiday-work",
        memberName: "例假出勤",
        days: [
          day("2026-05-31", { leaveCode: compliance.REGULAR_HOLIDAY_CODE, hasOvertime: true }),
          day("2026-06-01", { hasShift: true }),
          day("2026-06-02", { hasShift: true }),
          day("2026-06-03", { hasShift: true }),
          day("2026-06-04", { hasShift: true }),
          day("2026-06-05", { hasShift: true }),
          day("2026-06-06", { leaveCode: compliance.REST_DAY_CODE })
        ]
      },
      {
        memberId: "streak",
        memberName: "跨週連續出勤",
        days: dates.map((dateText) => day(dateText, {
          hasShift: dateText >= "2026-05-29" && dateText <= "2026-06-08",
          leaveCode: dateText === "2026-06-08" ? compliance.REGULAR_HOLIDAY_CODE : ""
        })),
        slidingDays: dates.map((dateText) => day(dateText, { hasShift: true }))
      }
    ]
  });

  assert(result.issues.some((issue) => issue.type === "missing_regular_holiday" && issue.memberId === "missing"));
  assert(result.issues.some((issue) => issue.type === "regular_holiday_work" && issue.memberId === "holiday-work"));
  assert(result.issues.some((issue) => issue.type === "consecutive_work_days_exceeded" && issue.memberId === "streak"));
});

test("到離職週應至少保留兩個未在職日、例假或休息日", () => {
  const result = compliance.checkRestCompliance({
    year: 2026,
    month: 5,
    weekStart: 0,
    memberCalendars: [{
      memberId: "leaving",
      memberName: "離職人員",
      leaveDate: "2026-06-06",
      days: [
        day("2026-05-31", { hasShift: true }),
        day("2026-06-01", { hasShift: true }),
        day("2026-06-02", { hasShift: true }),
        day("2026-06-03", { hasShift: true }),
        day("2026-06-04", { hasShift: true }),
        day("2026-06-05", { hasShift: true }),
        day("2026-06-06", { hasShift: true })
      ]
    }]
  });

  assert(result.issues.some((issue) => issue.type === "insufficient_non_employment_or_rest_days"));
});
