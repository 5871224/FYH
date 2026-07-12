function getMemberEightWeekStats(member) {
  return getVisibleDates().reduce((stats, dateString) => {
    if (!isMemberActiveOnDateString(member, dateString)) {
      return stats;
    }
    const slot = getDisplayedSlot(member.id, dateString);
    const leave = getItem("leave", slot?.leave);
    const hasShift = Boolean(slot?.shift);
    if (leave?.code === "0036") {
      stats.regular += 1;
    }
    if (leave?.code === "0047") {
      if (hasShift) {
        stats.restWork += 1;
      } else {
        stats.rest += 1;
      }
    }
    if (!slot?.shift && !slot?.leave) {
      stats.unassigned += 1;
    }
    return stats;
  }, { regular: 0, rest: 0, restWork: 0, unassigned: 0 });
}

function renderMemberStats(member) {
  const stats = getMemberEightWeekStats(member);
  return `
    <div class="member-stats">
      <span>休:${stats.rest}</span>
      <span>灰休:${stats.restWork}</span>
      <span>例:${stats.regular}</span>
      <span>未排:${stats.unassigned}</span>
    </div>
  `;
}

function memberHasScheduledShiftInDepartment(member, departmentId) {
  if (getMemberHomeDeptId(member) === departmentId) {
    return true;
  }
  for (const dateString of getVisibleDates()) {
    if (!isMemberActiveOnDateString(member, dateString)) {
      continue;
    }
    const slot = getDisplayedSlot(member.id, dateString);
    const shift = getItem("shift", slot?.shift);
    if (shift && shiftAllowsDepartment(shift, departmentId)) {
      return true;
    }
  }
  return false;
}

function getVisibleTableGroups() {
  return state.departments
    .filter((department) => isDepartmentVisibleInScheduleRange(department))
    .map((department) => ({
      department,
      members: state.members.filter((member) => {
        if (getMemberHomeDeptId(member) !== department.id) {
          return false;
        }
        if (!isMemberActiveInVisibleRange(member)) {
          return false;
        }
        if (state.tableDeptScopeFilter === "all") {
          return true;
        }
        return memberHasScheduledShiftInDepartment(member, state.tableDeptScopeFilter);
      })
    }))
    .filter(({ members }) => members.length);
}
