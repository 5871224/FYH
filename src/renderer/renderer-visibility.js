/* 人員與單位任職、營運及班表顯示區間判定
 * 由固定建置清單載入。
 */

function isMemberActiveOnDate(member, year, month, day) {
  const date = toDateString(year, month, day);
  if (member.hireDate && date < member.hireDate) {
    return false;
  }
  if (member.leaveDate && date > member.leaveDate) {
    return false;
  }
  return true;
}

function doesDateRangeOverlapRange(startDate, endDate, rangeStart, rangeEnd) {
  if (startDate && startDate > rangeEnd) {
    return false;
  }
  if (endDate && endDate < rangeStart) {
    return false;
  }
  return true;
}

function isDepartmentActiveInVisibleRange(department) {
  const { startDate, endDate } = getVisibleDateRange();
  return doesDateRangeOverlapRange(department?.startDate || "", department?.endDate || "", startDate, endDate);
}

function isDepartmentVisibleInSchedule(department) {
  return Boolean(department) && !department.hiddenFromSchedule;
}

function isDepartmentVisibleInScheduleRange(department) {
  return isDepartmentVisibleInSchedule(department) && isDepartmentActiveInVisibleRange(department);
}

function isDepartmentOperatingOnDate(department, dateString) {
  if (!department || !dateString) {
    return false;
  }
  if (department.startDate && dateString < department.startDate) {
    return false;
  }
  if (department.endDate && dateString > department.endDate) {
    return false;
  }
  return true;
}

function isMemberActiveInVisibleRange(member) {
  const { startDate, endDate } = getVisibleDateRange();
  return doesDateRangeOverlapRange(member?.hireDate || "", member?.leaveDate || "", startDate, endDate);
}
