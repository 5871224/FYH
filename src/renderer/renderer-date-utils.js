/* 班表日期、週期、時間與區間工具
 * 由 renderer.js 第一階段拆分；維持既有全域 bundle 執行方式。
 */

function scheduleKey(memberId, year, month, day) {
  return `${memberId}_${year}_${month}_${day}`;
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function weekdayOf(day) {
  return new Date(state.year, state.month, day).getDay();
}

function getConfiguredWeekStart() {
  const value = Number(state.rules?.weekStart);
  return Number.isInteger(value) && value >= 0 && value <= 6 ? value : 0;
}

function getWeekIndexForDay(day) {
  const offset = (weekdayOf(1) - getConfiguredWeekStart() + 7) % 7;
  return Math.floor((day + offset - 1) / 7);
}

function getWeekStripeClass(day) {
  return getWeekIndexForDay(day) % 2 === 1 ? "week-alt" : "";
}

function getWeekIndexForDate(dateString) {
  const dates = getVisibleDates();
  const index = dates.indexOf(dateString);
  return index >= 0 ? Math.floor(index / 7) : 0;
}

function getWeekStripeClassForDate(dateString) {
  return getWeekIndexForDate(dateString) % 2 === 1 ? "week-alt" : "";
}

function getWeekBoundaryClass(day, daysInCurrentMonth) {
  const classes = [];
  const weekday = weekdayOf(day);
  const weekStart = getConfiguredWeekStart();
  const weekEnd = (weekStart + 6) % 7;
  if (weekday === weekStart && day !== 1) {
    classes.push("week-boundary-start");
  }
  if (weekday === weekEnd && day !== daysInCurrentMonth) {
    classes.push("week-boundary-end");
  }
  return classes.join(" ");
}

function getWeekBoundaryClassForDate(dateString, index, totalDays) {
  const classes = [];
  const date = toDateObject(dateString);
  if (!date) {
    return "";
  }
  const weekday = date.getDay();
  const weekStart = getConfiguredWeekStart();
  const weekEnd = (weekStart + 6) % 7;
  if (weekday === weekStart && index !== 0) {
    classes.push("week-boundary-start");
  }
  if (weekday === weekEnd && index !== totalDays - 1) {
    classes.push("week-boundary-end");
  }
  return classes.join(" ");
}

function toDateString(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function toDateStringFromDate(date) {
  return toDateString(date.getFullYear(), date.getMonth(), date.getDate());
}

function getTodayDateString() {
  return toDateStringFromDate(new Date());
}

function addDaysToDateString(dateString, count) {
  const date = toDateObject(dateString);
  if (!date) {
    return "";
  }
  date.setDate(date.getDate() + count);
  return toDateStringFromDate(date);
}

function diffDays(startDateString, endDateString) {
  const start = toDateObject(startDateString);
  const end = toDateObject(endDateString);
  if (!start || !end) {
    return 0;
  }
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.floor((end - start) / dayMs);
}

function getConfiguredEightWeekAnchorDate() {
  return toDateObject(state.rules?.eightWeekStartDate) ? state.rules.eightWeekStartDate : getTodayDateString();
}

function getEightWeekCycleStartForDate(dateString) {
  const anchorDate = getConfiguredEightWeekAnchorDate();
  const offset = diffDays(anchorDate, dateString);
  const periodLength = 56;
  const periods = Math.floor(offset / periodLength);
  return addDaysToDateString(anchorDate, periods * periodLength) || dateString;
}

function syncVisibleDatePartsFromStart() {
  const start = toDateObject(state.scheduleStartDate);
  if (!start) {
    return;
  }
  state.year = start.getFullYear();
  state.month = start.getMonth();
}

function resetScheduleWindowToToday() {
  const today = getTodayDateString();
  if (!toDateObject(state.rules?.eightWeekStartDate)) {
    state.rules.eightWeekStartDate = today;
  }
  state.scheduleStartDate = getEightWeekCycleStartForDate(today);
  state.tableView = "member";
  state.tableDeptScopeFilter = "all";
  syncVisibleDatePartsFromStart();
}

function getVisibleDates() {
  const startDate = toDateObject(state.scheduleStartDate) ? state.scheduleStartDate : getEightWeekCycleStartForDate(getTodayDateString());
  return enumerateDateRange(startDate, addDaysToDateString(startDate, 55));
}

function getVisibleDateRange() {
  const dates = getVisibleDates();
  return {
    startDate: dates[0] || getTodayDateString(),
    endDate: dates[dates.length - 1] || getTodayDateString()
  };
}

function getBufferedVisibleDateRange() {
  const range = getVisibleDateRange();
  // ponytail: 7-day buffer matches the current 6-day consecutive-work ceiling; widen if compliance rules look farther.
  return {
    startDate: addDaysToDateString(range.startDate, -7),
    endDate: addDaysToDateString(range.endDate, 7)
  };
}

function normalizeScheduleLoadedRanges(ranges) {
  return (Array.isArray(ranges) ? ranges : [])
    .map((range) => ({
      startDate: toDateObject(range?.startDate) ? range.startDate : "",
      endDate: toDateObject(range?.endDate) ? range.endDate : ""
    }))
    .filter((range) => range.startDate && range.endDate && range.startDate <= range.endDate);
}

function isScheduleRangeLoaded(range) {
  return normalizeScheduleLoadedRanges(state.scheduleLoadedRanges)
    .some((loaded) => loaded.startDate <= range.startDate && loaded.endDate >= range.endDate);
}

function rememberScheduleLoadedRange(range) {
  state.scheduleLoadedRanges = [
    ...normalizeScheduleLoadedRanges(state.scheduleLoadedRanges),
    range
  ];
}

async function ensureVisibleScheduleLoaded() {
  const range = getBufferedVisibleDateRange();
  if (isScheduleRangeLoaded(range)) {
    return;
  }
  const payload = await window.schedulerApi.loadScheduleEntries({
    ...range,
    members: state.members.map((member) => ({ id: member.id }))
  });
  state.schedule = cleanupScheduleEntries({
    ...state.schedule,
    ...(payload.schedule || {})
  }, state);
  rememberScheduleLoadedRange(range);
}

function getScheduleKeyForDateString(memberId, dateString) {
  const date = toDateObject(dateString);
  if (!date) {
    return "";
  }
  return scheduleKey(memberId, date.getFullYear(), date.getMonth(), date.getDate());
}

function normalizeScheduleDateInput(value) {
  if (typeof value === "string" && toDateObject(value)) {
    return value;
  }
  return toDateString(state.year, state.month, Number(value) || 1);
}

function isMemberCurrentlyActive(member) {
  const today = new Date();
  const todayString = toDateString(today.getFullYear(), today.getMonth(), today.getDate());
  if (member.hireDate && member.hireDate > todayString) {
    return false;
  }
  return !member.leaveDate || member.leaveDate >= todayString;
}

function toDateObject(dateString) {
  const [year, month, day] = String(dateString || "").split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }
  return new Date(year, month - 1, day);
}

function enumerateDateRange(startDate, endDate) {
  const start = toDateObject(startDate);
  const end = toDateObject(endDate);
  if (!start || !end || start > end) {
    return [];
  }
  const dates = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(toDateString(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function isMemberActiveOnDateString(member, dateString) {
  if (!dateString) {
    return false;
  }
  if (member.hireDate && dateString < member.hireDate) {
    return false;
  }
  if (member.leaveDate && dateString > member.leaveDate) {
    return false;
  }
  return true;
}

function normalizeTimeText(value) {
  const match = String(value ?? "").trim().match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) {
    return "";
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    return "";
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function toMinutes(value) {
  const normalized = normalizeTimeText(value);
  if (!normalized) {
    return null;
  }
  const [hours, minutes] = normalized.split(":").map(Number);
  return hours * 60 + minutes;
}

function isValidTimeRange(start, end) {
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);
  return startMinutes !== null && endMinutes !== null && startMinutes < endMinutes;
}

function isValidDateRange(start, end) {
  return Boolean(start && end && start < end);
}

function isValidDateTimeRange(startDate, startTime, endDate, endTime) {
  const normalizedStartTime = normalizeTimeText(startTime);
  const normalizedEndTime = normalizeTimeText(endTime);
  if (!startDate || !endDate || !normalizedStartTime || !normalizedEndTime) {
    return false;
  }
  return `${startDate}T${normalizedStartTime}` < `${endDate}T${normalizedEndTime}`;
}
