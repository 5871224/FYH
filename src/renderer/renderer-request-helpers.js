/* 請假、加班申請與目前人員的共用判定工具。
 * 由 renderer.js 拆分；維持既有全域 bundle 執行方式。
 */

function resolveCurrentMember() {
  if (currentProfile?.id) {
    const byId = state.members.find((member) => member.id === currentProfile.id);
    if (byId) return byId;
  }
  if (!currentProfile?.employee_code) return null;
  return state.members.find((member) => member.code === currentProfile.employee_code) || null;
}

function requestMatchesMember(record, memberId = "", memberCode = "") {
  if (!record) {
    return false;
  }
  return Boolean(
    (memberId && record.memberId === memberId)
    || (memberCode && record.memberCode === memberCode)
  );
}

function hasDateRangeOverlap(startDate, endDate, otherStartDate, otherEndDate) {
  if (!startDate || !endDate || !otherStartDate || !otherEndDate) {
    return false;
  }
  return otherStartDate <= endDate && otherEndDate >= startDate;
}

function findDirectLeaveScheduleConflict(scheduleMemberId, startDate, endDate) {
  if (!scheduleMemberId || !startDate || !endDate) {
    return "";
  }
  return enumerateDateRange(startDate, endDate).find((dateString) => {
    const slot = getScheduleSlotByDateString(scheduleMemberId, dateString);
    return Boolean(slot?.leave);
  }) || "";
}

function hasDirectOvertimeScheduleConflict(scheduleMemberId, workDate) {
  if (!scheduleMemberId || !workDate) {
    return false;
  }
  const slot = getScheduleSlotByDateString(scheduleMemberId, workDate);
  return Boolean(slot?.overtime);
}

function formatRequestDateText(startDate, endDate) {
  if (!startDate) {
    return "";
  }
  return startDate === endDate || !endDate ? startDate : `${startDate} ~ ${endDate}`;
}

function formatOvertimeTimeText(record) {
  return `${record.startTime || "--:--"} - ${record.endTime || "--:--"}`;
}

function formatOvertimeRestLines(record) {
  const lines = [];
  if (record.useRest1) {
    lines.push(`休息1：${record.rest1StartTime || "--:--"} - ${record.rest1EndTime || "--:--"}`);
  }
  if (record.useRest2) {
    lines.push(`休息2：${record.rest2StartTime || "--:--"} - ${record.rest2EndTime || "--:--"}`);
  }
  return lines;
}

function leaveRequiresTime(leave) {
  return Boolean(leave?.requiresTime);
}

function defaultLeaveIsAllDay(leave) {
  return !leaveRequiresTime(leave);
}

function getLeaveStyleForRecord(record) {
  const leaveItemId = String(record?.leaveItemId || "").trim();
  return leaveItemId ? state.leaves.find((item) => item.id === leaveItemId) || null : null;
}

function getLeaveStyleForSlot(slot) {
  return getItem("leave", slot?.leave);
}

function getLeaveCatalogDisplayName(item) {
  if (!item) {
    return "";
  }
  return LEAVE_CATALOG.find((entry) => entry.code === item.code)?.name || item.name || "";
}
