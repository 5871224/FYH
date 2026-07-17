(function initRestCompliance(globalScope) {
  const REGULAR_HOLIDAY_CODE = "0036";
  const REST_DAY_CODE = "0047";
  const DEFAULT_WEEK_START = 0;

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function toDateString(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function createDate(year, month, day) {
    return new Date(year, month, day);
  }

  function addDays(date, count) {
    const next = new Date(date);
    next.setDate(next.getDate() + count);
    return next;
  }

  function startOfWeek(date, weekStart = DEFAULT_WEEK_START) {
    const offset = (date.getDay() - weekStart + 7) % 7;
    return addDays(date, -offset);
  }

  function endOfWeek(date, weekStart = DEFAULT_WEEK_START) {
    return addDays(startOfWeek(date, weekStart), 6);
  }

  function buildCalendarWeeks(year, month, weekStart = DEFAULT_WEEK_START) {
    const monthStart = createDate(year, month, 1);
    const monthEnd = createDate(year, month + 1, 0);
    const rangeStart = startOfWeek(monthStart, weekStart);
    const rangeEnd = endOfWeek(monthEnd, weekStart);
    const weeks = [];
    let cursor = new Date(rangeStart);

    while (cursor <= rangeEnd) {
      const dates = [];
      for (let index = 0; index < 7; index += 1) {
        dates.push(toDateString(addDays(cursor, index)));
      }
      weeks.push({
        startDate: dates[0],
        endDate: dates[6],
        dates
      });
      cursor = addDays(cursor, 7);
    }

    return weeks;
  }

  function buildDayMap(days) {
    return new Map((Array.isArray(days) ? days : []).map((day) => [day.date, day]));
  }

  function isHireOrLeaveWeek(member, week) {
    return Boolean(
      (member.hireDate && week.dates.includes(member.hireDate)) ||
      (member.leaveDate && week.dates.includes(member.leaveDate))
    );
  }

  function isWorkDay(day) {
    return Boolean(day.active && (day.hasShift || day.hasOvertime));
  }

  function pushIssue(issues, issue) {
    issues.push(issue);
  }

  function findWeekForDate(weeks, dateString) {
    return weeks.find((week) => week.dates.includes(dateString)) || null;
  }

  function buildWeekDays(week, dayMap) {
    return week.dates.map((date) => ({ date, ...(dayMap.get(date) || {}) }));
  }

  function checkHireOrLeaveWeek(member, week, dayMap, issues) {
    const weekDays = buildWeekDays(week, dayMap);
    const protectionDays = weekDays.filter((day) => (
      !day.active ||
      day.leaveCode === REGULAR_HOLIDAY_CODE ||
      day.leaveCode === REST_DAY_CODE
    ));

    if (protectionDays.length >= 2) {
      return;
    }

    pushIssue(issues, {
      severity: "error",
      type: "insufficient_non_employment_or_rest_days",
      memberId: member.memberId,
      memberName: member.memberName,
      memberCode: member.memberCode || "",
      weekStart: week.startDate,
      weekEnd: week.endDate,
      message: "到職/離職週未在職日＋例假＋休息日少於 2 天"
    });
  }

  function checkSlidingConsecutiveWorkDays(member, weeks, slidingDayMap, issues, maxConsecutiveWorkDays, reportStartDate, reportEndDate) {
    const dates = [...slidingDayMap.keys()].sort();
    let streak = 0;
    let streakStartDate = "";
    let reportedCurrentStreak = false;

    dates.forEach((dateString) => {
      const week = findWeekForDate(weeks, dateString);
      const day = { date: dateString, ...(slidingDayMap.get(dateString) || {}) };
      if (isWorkDay(day)) {
        if (streak === 0) {
          streakStartDate = dateString;
          reportedCurrentStreak = false;
        }
        streak += 1;
        if (
          streak > maxConsecutiveWorkDays &&
          dateString >= reportStartDate &&
          dateString <= reportEndDate &&
          !reportedCurrentStreak
        ) {
          pushIssue(issues, {
            severity: "error",
            type: "consecutive_work_days_exceeded",
            memberId: member.memberId,
            memberName: member.memberName,
            memberCode: member.memberCode || "",
            weekStart: week?.startDate || dateString,
            weekEnd: week?.endDate || dateString,
            date: dateString,
            streakStartDate,
            streakLength: streak,
            message: `連續出勤超過 ${maxConsecutiveWorkDays} 天`
          });
          reportedCurrentStreak = true;
        }
        return;
      }

      streak = 0;
      streakStartDate = "";
      reportedCurrentStreak = false;
    });
  }

  function checkRestCompliance(config) {
    const weeks = Array.isArray(config.weeks) && config.weeks.length
      ? config.weeks
      : buildCalendarWeeks(config.year, config.month, config.weekStart);
    const issues = [];
    const maxConsecutiveWorkDays = Math.max(1, Number(config.maxConsecutiveWorkDays) || 6);
    const reportStartDate = config.reportStartDate || weeks[0]?.startDate || "";
    const reportEndDate = config.reportEndDate || weeks[weeks.length - 1]?.endDate || "";
    let checkedWeeks = 0;
    let skippedWeeks = 0;

    (config.memberCalendars || []).forEach((member) => {
      const dayMap = buildDayMap(member.days);
      const slidingDayMap = buildDayMap(member.slidingDays || member.days);

      weeks.forEach((week) => {
        if (isHireOrLeaveWeek(member, week)) {
          skippedWeeks += 1;
          checkHireOrLeaveWeek(member, week, dayMap, issues);
          return;
        }

        const activeDays = buildWeekDays(week, dayMap).filter((day) => day.active);
        if (!activeDays.length) {
          return;
        }

        checkedWeeks += 1;
        const regularHolidays = activeDays.filter((day) => day.leaveCode === REGULAR_HOLIDAY_CODE);
        if (!regularHolidays.length) {
          pushIssue(issues, {
            severity: "error",
            type: "missing_regular_holiday",
            memberId: member.memberId,
            memberName: member.memberName,
            memberCode: member.memberCode || "",
            weekStart: week.startDate,
            weekEnd: week.endDate,
            message: "本週未標記例假"
          });
        }

        regularHolidays.forEach((day) => {
          if (!day.hasShift && !day.hasOvertime) {
            return;
          }
          pushIssue(issues, {
            severity: "warning",
            type: "regular_holiday_work",
            memberId: member.memberId,
            memberName: member.memberName,
            memberCode: member.memberCode || "",
            weekStart: week.startDate,
            weekEnd: week.endDate,
            date: day.date,
            message: "例假日有排班或加班，請確認是否符合第40條例外事由"
          });
        });
      });

      checkSlidingConsecutiveWorkDays(
        member,
        weeks,
        slidingDayMap,
        issues,
        maxConsecutiveWorkDays,
        reportStartDate,
        reportEndDate
      );
    });

    return {
      weeks,
      checkedWeeks,
      skippedWeeks,
      checkedMembers: (config.memberCalendars || []).length,
      issues
    };
  }

  const api = {
    REGULAR_HOLIDAY_CODE,
    REST_DAY_CODE,
    DEFAULT_WEEK_START,
    buildCalendarWeeks,
    checkRestCompliance
  };

  globalScope.restCompliance = api;
})(typeof window !== "undefined" ? window : globalThis);
