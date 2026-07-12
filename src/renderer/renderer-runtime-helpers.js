/* 執行狀態、單位、人員、班別與目錄查詢共用工具。
 * 由 renderer.js 最終拆分；維持既有全域 bundle 與功能行為。
 */

function setSaveStatus(message, saving = false) {
  latestSaveStatus = message;
  isSaving = saving;
}

function getDepartmentName(deptId) {
  return state.departments.find((department) => department.id === deptId)?.name || "未指定單位";
}

function getPositionName(positionId) {
  return state.positions.find((position) => position.id === positionId)?.name || "未指定職位";
}

function getSalaryTypeLabel(member) {
  return member?.payByDay ? "日薪" : "月薪";
}

function normalizeRestWeekday(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue >= 0 && numericValue <= 6 ? numericValue : 0;
}

function getRestWeekdayLabel(value) {
  return REST_WEEKDAY_OPTIONS.find((option) => option.value === normalizeRestWeekday(value))?.label || "週日";
}

function getDepartmentSummary(deptId) {
  return getDepartmentName(deptId);
}

function getMemberScheduleShiftIds(member) {
  const validShiftIds = new Set(state.shifts.filter((shift) => !shift.hiddenFromToolbar).map((shift) => shift.id));
  return (Array.isArray(member?.scheduleShiftIds) ? member.scheduleShiftIds : [])
    .map((shiftId) => String(shiftId || ""))
    .filter((shiftId, index, list) => validShiftIds.has(shiftId) && list.indexOf(shiftId) === index);
}

function getMemberHomeDeptId(member) {
  return member?.deptId || "";
}

function getMemberScheduleShiftNames(member) {
  const shiftMap = new Map(state.shifts.map((shift) => [shift.id, shift.name]));
  const names = getMemberScheduleShiftIds(member).map((shiftId) => shiftMap.get(shiftId)).filter(Boolean);
  return names.length ? names.join("、") : "未指定";
}

function renderMemberScheduleShiftPills(member) {
  const shiftMap = new Map(state.shifts.map((shift) => [shift.id, shift.name]));
  const names = getMemberScheduleShiftIds(member).map((shiftId) => shiftMap.get(shiftId)).filter(Boolean);
  if (!names.length) {
    return "-";
  }
  return names.map((name) => `<span class="member-shift-pill">${escapeHtml(name)}</span>`).join("");
}

function getMemberShiftPriority(member, shiftId) {
  const index = getMemberScheduleShiftIds(member).indexOf(shiftId);
  return index === -1 ? Infinity : index;
}

function memberCanScheduleShift(member, shiftId) {
  return Number.isFinite(getMemberShiftPriority(member, shiftId));
}

function getMembersForScheduleShift(shiftId) {
  return state.members
    .filter((member) => isMemberCurrentlyActive(member) && memberCanScheduleShift(member, shiftId))
    .sort((a, b) => getMemberShiftPriority(a, shiftId) - getMemberShiftPriority(b, shiftId) || a.name.localeCompare(b.name));
}

function shiftAllowsDepartment(shift, deptId) {
  return Boolean(shift?.applicableDeptId && shift.applicableDeptId === deptId);
}

function getItemList(category) {
  if (category === "shift") return state.shifts;
  if (category === "leave") return state.leaves;
  return state.overtime;
}

function getItem(category, id) {
  return getItemList(category).find((item) => item.id === id);
}

function getItemTextColor(item, fallback = "#000000") {
  if (!item) {
    return autoLeaveTextColor(fallback);
  }
  if (item.textColor) {
    return item.textColor;
  }
  return autoLeaveTextColor(item.color || fallback);
}

function getLeaveLabel(leave) {
  if (!leave) {
    return "";
  }
  return leave.code ? `${leave.code} ${leave.name}` : leave.name;
}
