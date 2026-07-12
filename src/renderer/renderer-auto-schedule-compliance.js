function getLeaveByCode(code) {
  return state.leaves.find((leave) => leave.code === code) || null;
}

function isRestLeaveId(leaveId) {
  return getItem("leave", leaveId)?.code === "0047";
}

function isRegularRestLeaveId(leaveId) {
  return getItem("leave", leaveId)?.code === "0036";
}

function getWeekBucketIndex(dateString, rangeStartDate) {
  return Math.floor(diffDays(rangeStartDate, dateString) / 7);
}

function getMemberAutoRestTarget(member, scheduleMap, dates) {
  const activeDays = countMemberActiveDays(member, dates);
  if (!activeDays) {
    return { activeDays: 0, fixedRegularCount: 0, totalHolidayTarget: 0, restTarget: 0 };
  }
  const fixedRegularCount = countMemberLeaveByPredicate(scheduleMap, member.id, dates, isRegularRestLeaveId);
  const totalHolidayTarget = Math.round((activeDays / 56) * 16);
  return {
    activeDays,
    fixedRegularCount,
    totalHolidayTarget,
    restTarget: Math.max(0, totalHolidayTarget - fixedRegularCount)
  };
}

function countMemberActiveDays(member, dates) {
  return dates.filter((dateString) => isMemberActiveOnDateString(member, dateString)).length;
}

function countMemberLeaveByPredicate(scheduleMap, memberId, dates, predicate) {
  return dates.filter((dateString) => predicate(getWorkScheduleSlot(scheduleMap, memberId, dateString)?.leave)).length;
}

function memberHasRestInWeek(scheduleMap, memberId, dates, weekIndex, rangeStartDate) {
  return dates.some((dateString) => (
    getWeekBucketIndex(dateString, rangeStartDate) === weekIndex
    && isRestLeaveId(getWorkScheduleSlot(scheduleMap, memberId, dateString)?.leave)
  ));
}

function countMemberRestInWeek(scheduleMap, memberId, dates, weekIndex, rangeStartDate) {
  return dates.filter((dateString) => (
    getWeekBucketIndex(dateString, rangeStartDate) === weekIndex
    && isRestLeaveId(getWorkScheduleSlot(scheduleMap, memberId, dateString)?.leave)
  )).length;
}

function canAutoPlaceDailyRest(scheduleMap, member, dateString, dates, rangeStartDate) {
  if (!isMemberActiveOnDateString(member, dateString)) {
    return false;
  }
  const slot = getWorkScheduleSlot(scheduleMap, member.id, dateString);
  if (slot?.shift || slot?.leave) {
    return false;
  }
  const target = getMemberAutoRestTarget(member, scheduleMap, dates).restTarget;
  if (countMemberLeaveByPredicate(scheduleMap, member.id, dates, isRestLeaveId) >= target) {
    return false;
  }
  const weekIndex = getWeekBucketIndex(dateString, rangeStartDate);
  return countMemberRestInWeek(scheduleMap, member.id, dates, weekIndex, rangeStartDate) === 0;
}

function placeDailySurplusRestDays(scheduleMap, dateString, dates, rangeStartDate, restLeave, preview) {
  const candidates = getActiveMembersForDate(dateString)
    .filter((member) => canAutoPlaceDailyRest(scheduleMap, member, dateString, dates, rangeStartDate))
    .sort((a, b) => {
      if (a.payByDay !== b.payByDay) {
        return a.payByDay ? -1 : 1;
      }
      const restDiff = countMemberLeaveByPredicate(scheduleMap, a.id, dates, isRestLeaveId)
        - countMemberLeaveByPredicate(scheduleMap, b.id, dates, isRestLeaveId);
      return restDiff || a.name.localeCompare(b.name);
    });
  candidates.forEach((member) => {
    markAutoLeave(scheduleMap, member, dateString, restLeave, preview, "多餘人力預排休息日");
  });
}
