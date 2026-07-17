/* 排班狀態清理、目錄正規化與顏色工具
 * 由 renderer.js 第二階段拆分；維持既有全域 bundle 執行方式。
 */

function textColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#2b241c" : "#ffffff";
}

function autoLeaveTextColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#000000" : "#ffffff";
}

function leaveRequiresTime(leave) {
  return Boolean(leave?.requiresTime);
}

function defaultLeaveIsAllDay(leave) {
  return !leaveRequiresTime(leave);
}

function sanitizeDepartment(department, fallbackIndex) {
  return {
    id: department?.id || uid(`d${fallbackIndex}`),
    name: department?.name || `單位 ${fallbackIndex + 1}`,
    startDate: department?.startDate || "",
    endDate: department?.endDate || "",
    hiddenFromSchedule: Boolean(department?.hiddenFromSchedule),
    address: department?.address || "",
    latitude: department?.latitude ?? "",
    longitude: department?.longitude ?? "",
    publicIp: department?.publicIp || "",
    attendanceEnabled: Boolean(department?.attendanceEnabled)
  };
}

function sanitizePosition(position, fallbackIndex) {
  return {
    id: position?.id || uid(`p${fallbackIndex}`),
    code: position?.code || `P${String(fallbackIndex + 1).padStart(2, "0")}`,
    name: position?.name || `職位 ${fallbackIndex + 1}`
  };
}

function normalizeScheduleShiftIds(member, shifts) {
  const validShiftIds = new Set((shifts || []).map((shift) => shift.id));
  const ids = Array.isArray(member?.scheduleShiftIds) ? member.scheduleShiftIds : [];
  return ids
    .map((shiftId) => String(shiftId || ""))
    .filter((shiftId, index, list) => validShiftIds.has(shiftId) && list.indexOf(shiftId) === index);
}

function sanitizeMember(member, fallbackIndex, merged) {
  const validDeptIds = new Set(merged.departments.map((department) => department.id));
  const deptId = member?.deptId && validDeptIds.has(member.deptId)
    ? member.deptId
    : merged.departments[0]?.id || "";
  return {
    id: member?.id || uid(`m${fallbackIndex}`),
    code: member?.code || "",
    name: member?.name || `人員 ${fallbackIndex + 1}`,
    deptId,
    scheduleShiftIds: normalizeScheduleShiftIds(member, merged.shifts),
    positionId: member?.positionId && merged.positions.some((position) => position.id === member.positionId)
      ? member.positionId
      : merged.positions[0]?.id || "",
    proxyMemberId: member?.proxyMemberId || "",
    hireDate: member?.hireDate || "",
    leaveDate: member?.leaveDate || "",
    payByDay: Boolean(member?.payByDay),
    fixedRestWeekday: normalizeRestWeekday(member?.fixedRestWeekday),
    monthlyRestDays: Math.max(0, Number(member?.monthlyRestDays) || 0),
    role: normalizeRole(member?.role)
  };
}

function sanitizeShift(shift, fallbackIndex, merged) {
  const applicableDeptId = shift?.applicableDeptId && merged.departments.some((department) => department.id === shift.applicableDeptId)
    ? shift.applicableDeptId
    : merged.departments[0]?.id || "";
  const color = shift?.color || COLORS[fallbackIndex % COLORS.length].hex;
  const autoText = shift?.autoTextColor ?? !shift?.textColor;
    return {
      id: shift?.id || uid(`s${fallbackIndex}`),
      name: shift?.name || `班別 ${fallbackIndex + 1}`,
      color,
      textColor: shift?.textColor || autoLeaveTextColor(color),
      autoTextColor: Boolean(autoText),
      startTime: shift?.startTime || "",
      endTime: shift?.endTime || "",
      hiddenFromToolbar: Boolean(shift?.hiddenFromToolbar),
      requiredStaffCount: Math.max(0, Number(shift?.requiredStaffCount) || 0),
      applicableDeptId,
      positionRequirements: Array.isArray(shift?.positionRequirements)
        ? shift.positionRequirements
        .filter((item) => item && item.positionId)
        .map((item) => ({ positionId: item.positionId, count: Math.max(0, Number(item.count) || 0) }))
      : []
  };
}

function sanitizeNamedColorItem(item, fallbackIndex, prefix, label) {
  return {
    id: item?.id || uid(`${prefix}${fallbackIndex}`),
    name: item?.name || `${label} ${fallbackIndex + 1}`,
    color: item?.color || COLORS[fallbackIndex % COLORS.length].hex
  };
}

function resolveLeaveCatalogEntry(item, fallbackIndex) {
  const requestedCode = item?.code || LEGACY_LEAVE_NAME_MAP[item?.name] || "";
  const byCode = LEAVE_CATALOG.find((entry) => entry.code === requestedCode);
  if (byCode) {
    return byCode;
  }
  const byName = LEAVE_CATALOG.find((entry) => entry.name === item?.name);
  if (byName) {
    return byName;
  }
  return LEAVE_CATALOG[fallbackIndex % LEAVE_CATALOG.length];
}

function sanitizeLeaveItem(item, fallbackIndex) {
  const catalogEntry = resolveLeaveCatalogEntry(item, fallbackIndex);
  const color = item?.color || COLORS[fallbackIndex % COLORS.length].hex;
  const autoText = item?.autoTextColor ?? !item?.textColor;
  return {
    id: item?.id || uid(`l${fallbackIndex}`),
    code: catalogEntry.code,
    name: item?.name || catalogEntry.name,
    color,
    textColor: item?.textColor || autoLeaveTextColor(color),
    autoTextColor: Boolean(autoText),
    hiddenFromToolbar: Boolean(item?.hiddenFromToolbar),
    requiresTime: Boolean(item?.requiresTime),
    requiresReason: Boolean(item?.requiresReason)
  };
}

function sanitizeOvertimeItem(item, fallbackIndex) {
    const color = item?.color || COLORS[fallbackIndex % COLORS.length].hex;
    const autoText = item?.autoTextColor ?? !item?.textColor;
    return {
      id: item?.id || uid(`o${fallbackIndex}`),
      name: item?.name || "加班",
      color,
      textColor: item?.textColor || autoLeaveTextColor(color),
      autoTextColor: Boolean(autoText),
      hiddenFromToolbar: Boolean(item?.hiddenFromToolbar),
      startTime: item?.startTime || "",
      endTime: item?.endTime || "",
      useRest1: Boolean(item?.useRest1),
      rest1StartTime: item?.rest1StartTime || "",
      rest1EndTime: item?.rest1EndTime || "",
      useRest2: Boolean(item?.useRest2),
      rest2StartTime: item?.rest2StartTime || "",
      rest2EndTime: item?.rest2EndTime || ""
    };
  }

function sanitizeHoliday(holiday, fallbackIndex) {
  return {
    id: holiday?.id || uid(`h${fallbackIndex}`),
    date: holiday?.date || "",
    name: holiday?.name || `國定假日 ${fallbackIndex + 1}`
  };
}

function cleanupScheduleEntries(schedule, merged) {
  const validShiftIds = new Set(merged.shifts.map((shift) => shift.id));
  const validLeaveIds = new Set(merged.leaves.map((leave) => leave.id));
  const validOvertimeIds = new Set(merged.overtime.map((item) => item.id));
  const fallbackOvertimeId = merged.overtime[0]?.id || null;
  const nextSchedule = {};

  Object.entries(schedule || {}).forEach(([key, slot]) => {
    const hasOvertimeMeta = slot?.overtimeMeta && typeof slot.overtimeMeta === "object";
    const overtimeId = validOvertimeIds.has(slot?.overtime)
      ? slot.overtime
      : hasOvertimeMeta
        ? fallbackOvertimeId
        : null;
    const nextSlot = {
      shift: validShiftIds.has(slot?.shift) ? slot.shift : null,
      leave: validLeaveIds.has(slot?.leave) ? slot.leave : null,
      overtime: overtimeId,
      leaveMeta: validLeaveIds.has(slot?.leave) && slot?.leaveMeta && typeof slot.leaveMeta === "object"
        ? {
          leaveCode: slot.leaveMeta.leaveCode || "",
          displayName: slot.leaveMeta.displayName || "",
          displayColor: slot.leaveMeta.displayColor || "",
          displayTextColor: slot.leaveMeta.displayTextColor || "",
          allDay: slot.leaveMeta.allDay !== false,
          startTime: slot.leaveMeta.allDay === false ? (slot.leaveMeta.startTime || "") : "",
          endTime: slot.leaveMeta.allDay === false ? (slot.leaveMeta.endTime || "") : "",
          reasonEnabled: Boolean(slot.leaveMeta.reasonEnabled),
          reason: slot.leaveMeta.reasonEnabled ? (slot.leaveMeta.reason || "") : ""
        }
        : null,
      overtimeMeta: overtimeId && hasOvertimeMeta
        ? {
          displayName: slot.overtimeMeta.displayName || "",
          displayColor: slot.overtimeMeta.displayColor || "",
          displayTextColor: slot.overtimeMeta.displayTextColor || "",
          startTime: slot.overtimeMeta.startTime || "",
          endTime: slot.overtimeMeta.endTime || "",
          useRest1: Boolean(slot.overtimeMeta.useRest1),
          rest1StartTime: slot.overtimeMeta.useRest1 ? (slot.overtimeMeta.rest1StartTime || "") : "",
          rest1EndTime: slot.overtimeMeta.useRest1 ? (slot.overtimeMeta.rest1EndTime || "") : "",
          useRest2: Boolean(slot.overtimeMeta.useRest2),
          rest2StartTime: slot.overtimeMeta.useRest2 ? (slot.overtimeMeta.rest2StartTime || "") : "",
          rest2EndTime: slot.overtimeMeta.useRest2 ? (slot.overtimeMeta.rest2EndTime || "") : "",
          reason: slot.overtimeMeta.reason || ""
        }
        : null
    };
    if (nextSlot.shift || nextSlot.leave || nextSlot.overtime) {
      nextSchedule[key] = nextSlot;
    }
  });

  return nextSchedule;
}

function normalizeState(payload) {
  if (!payload || typeof payload !== "object") {
    return createEmptyState();
  }

  const merged = createEmptyState();
  merged.role = "manager";
  merged.year = Number.isInteger(payload.year) ? payload.year : merged.year;
  merged.month = Number.isInteger(payload.month) ? payload.month : merged.month;
  merged.departments = Array.isArray(payload.departments)
    ? payload.departments.map((department, index) => sanitizeDepartment(department, index))
    : merged.departments;
  merged.positions = Array.isArray(payload.positions) && payload.positions.length
    ? payload.positions.map((position, index) => sanitizePosition(position, index))
    : merged.positions;
  merged.shifts = Array.isArray(payload.shifts)
    ? payload.shifts.map((shift, index) => sanitizeShift(shift, index, merged))
    : merged.shifts;
  merged.shifts = merged.shifts.filter((shift) => shift.name !== "休息");
  merged.members = Array.isArray(payload.members)
    ? payload.members.map((member, index) => sanitizeMember(member, index, merged))
    : merged.members;
  merged.leaves = Array.isArray(payload.leaves)
    ? payload.leaves.map((item, index) => sanitizeLeaveItem(item, index))
    : merged.leaves;
  merged.overtime = Array.isArray(payload.overtime)
    ? payload.overtime.map((item, index) => sanitizeOvertimeItem(item, index))
    : merged.overtime;
  merged.holidays = Array.isArray(payload.holidays)
    ? payload.holidays.map((holiday, index) => sanitizeHoliday(holiday, index)).filter((holiday) => holiday.date)
    : merged.holidays;
  merged.rules = {
    maxConsecutiveWorkDays: Math.max(1, Number(payload.rules?.maxConsecutiveWorkDays) || merged.rules.maxConsecutiveWorkDays),
    weekStart: Number.isInteger(Number(payload.rules?.weekStart)) ? Math.min(6, Math.max(0, Number(payload.rules?.weekStart))) : merged.rules.weekStart,
    monthStartDay: Number.isInteger(Number(payload.rules?.monthStartDay)) ? Math.min(31, Math.max(1, Number(payload.rules?.monthStartDay))) : merged.rules.monthStartDay,
    eightWeekStartDate: toDateObject(payload.rules?.eightWeekStartDate) ? payload.rules.eightWeekStartDate : merged.rules.eightWeekStartDate
  };
  merged.deptFilter = typeof payload.deptFilter === "string" ? payload.deptFilter : merged.deptFilter;
  merged.tableView = payload.tableView === "shift" ? "shift" : "member";
  merged.tableDeptScopeFilter = typeof payload.tableDeptScopeFilter === "string" ? payload.tableDeptScopeFilter : merged.tableDeptScopeFilter;
  merged.tableStatsVisible = payload.tableStatsVisible !== false;
  merged.scheduleStartDate = toDateObject(payload.scheduleStartDate) ? payload.scheduleStartDate : merged.scheduleStartDate;
  merged.schedule = cleanupScheduleEntries(payload.schedule && typeof payload.schedule === "object" ? payload.schedule : merged.schedule, merged);
  merged.scheduleLoadedRanges = normalizeScheduleLoadedRanges(payload.scheduleLoadedRanges);

  if (!merged.departments.some((department) => department.id === merged.deptFilter)) {
    merged.deptFilter = "all";
  }
  if (!merged.departments.some((department) => department.id === merged.tableDeptScopeFilter)) {
    merged.tableDeptScopeFilter = "all";
  }

  return merged;
}
