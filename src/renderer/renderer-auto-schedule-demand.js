function getWorkScheduleSlot(scheduleMap, memberId, dateString) {
  const key = getScheduleKeyForDateString(memberId, dateString);
  return key ? scheduleMap[key] || null : null;
}

function countAssignedShiftMembers(scheduleMap, shiftId, dateString, excludeMemberId = "") {
  if (!shiftId || !dateString) {
    return 0;
  }
  return state.members.filter((member) => {
    if (member.id === excludeMemberId || !isMemberActiveOnDateString(member, dateString)) {
      return false;
    }
    return getWorkScheduleSlot(scheduleMap, member.id, dateString)?.shift === shiftId;
  }).length;
}

function ensureWorkScheduleSlot(scheduleMap, memberId, dateString) {
  const key = getScheduleKeyForDateString(memberId, dateString);
  if (!key) {
    return null;
  }
  if (!scheduleMap[key]) {
    scheduleMap[key] = { shift: null, leave: null, overtime: null };
  }
  return scheduleMap[key];
}

function hasAnyLeaveOnDate(scheduleMap, memberId, dateString) {
  return Boolean(getWorkScheduleSlot(scheduleMap, memberId, dateString)?.leave);
}

function hasAnyShiftOnDate(scheduleMap, memberId, dateString) {
  return Boolean(getWorkScheduleSlot(scheduleMap, memberId, dateString)?.shift);
}

function getVisibleAutoScheduleShifts(dateString = "") {
  return state.shifts.filter((shift) => (
    !shift.hiddenFromToolbar
    && Math.max(0, Number(shift.requiredStaffCount) || 0) > 0
    && (!dateString || isShiftOperatingOnDate(shift, dateString))
  ));
}

function getActiveMembersForDate(dateString) {
  return state.members.filter((member) => isMemberActiveOnDateString(member, dateString));
}

function markAutoLeave(scheduleMap, member, dateString, leave, preview, reason) {
  const slot = ensureWorkScheduleSlot(scheduleMap, member.id, dateString);
  if (!slot || !leave) {
    return false;
  }
  const blockingConditions = getBlockingSameLeaveConditions(scheduleMap, member.id, dateString);
  if (blockingConditions.length) {
    noteScheduleConditionBlocks(preview, dateString, blockingConditions, `${reason || "排假"}：已達同休限額，未自動排假`);
    return false;
  }
  slot.leave = leave.id;
  slot.leaveMeta = {
    leaveCode: leave.code || "",
    displayName: leave.name,
    displayColor: leave.color || "",
    displayTextColor: getItemTextColor(leave, leave.color),
    allDay: true,
    startTime: "",
    endTime: "",
    reasonEnabled: false,
    reason: ""
  };
  return true;
}

function getDailyShiftNeedOptions(scheduleMap, dateString) {
  const shifts = getVisibleAutoScheduleShifts(dateString);
  const activeMembers = getActiveMembersForDate(dateString);
  const availableMembers = [];
  activeMembers.forEach((member) => {
    const slot = getWorkScheduleSlot(scheduleMap, member.id, dateString);
    if (!slot?.shift && !slot?.leave) {
      availableMembers.push(member);
    }
  });
  return shifts
    .map((shift) => {
      const assignedCount = countAssignedShiftMembers(scheduleMap, shift.id, dateString);
      const remaining = Math.max(0, getShiftDemandForDate(shift, dateString) - assignedCount);
      const candidates = remaining > 0
        ? availableMembers.filter((member) => memberCanScheduleShift(member, shift.id))
        : [];
      return { shift, assignedCount, remaining, candidates };
    })
    .filter((item) => item.remaining > 0);
}

function getShiftDepartmentIds(shift) {
  return shift?.applicableDeptId ? [shift.applicableDeptId] : [];
}

function getShiftDemandForDate(shift, dateString) {
  if (!shift || !isShiftOperatingOnDate(shift, dateString)) {
    return 0;
  }
  return Math.max(0, Number(shift.requiredStaffCount) || 0);
}

function getOperatingShiftDepartmentIds(shift, dateString) {
  const shiftDeptIds = getShiftDepartmentIds(shift);
  return shiftDeptIds.filter((deptId) => {
    const department = state.departments.find((item) => item.id === deptId);
    return isDepartmentVisibleInSchedule(department) && isDepartmentOperatingOnDate(department, dateString);
  });
}

function isShiftOperatingOnDate(shift, dateString) {
  const shiftDeptIds = getShiftDepartmentIds(shift);
  return !shiftDeptIds.length || getOperatingShiftDepartmentIds(shift, dateString).length > 0;
}

function shiftHasVisibleDepartment(shift) {
  const shiftDeptIds = getShiftDepartmentIds(shift);
  return !shiftDeptIds.length || shiftDeptIds.some((deptId) => (
    isDepartmentVisibleInScheduleRange(state.departments.find((department) => department.id === deptId))
  ));
}

function getRemainingDailyShiftDemandDetails(scheduleMap, dateString) {
  return getVisibleAutoScheduleShifts(dateString)
    .map((shift) => {
      return {
        shift,
        missing: Math.max(0, getShiftDemandForDate(shift, dateString) - countAssignedShiftMembers(scheduleMap, shift.id, dateString))
      };
    })
    .filter((item) => item.missing > 0);
}
