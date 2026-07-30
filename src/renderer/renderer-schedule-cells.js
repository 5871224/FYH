function getVisibleShiftRows() {
  return state.shifts.filter((shift) => (
    shiftHasVisibleDepartment(shift)
    && (state.tableDeptScopeFilter === "all" || shiftAllowsDepartment(shift, state.tableDeptScopeFilter))
  ));
}

function getShiftViewMembersForDay(shiftId, dateString) {
  return state.members.filter((member) => {
    if (!isMemberActiveOnDateString(member, dateString)) {
      return false;
    }
    const slot = getDisplayedSlot(member.id, dateString);
    return slot?.shift === shiftId;
  });
}

function getShiftViewCellState(shift, dateString) {
  const members = getShiftViewMembersForDay(shift.id, dateString);
  const isOperating = isShiftOperatingOnDate(shift, dateString);
  const requiredStaffCount = getShiftDemandForDate(shift, dateString);
  return {
    members,
    isOperating,
    isShortage: members.length < requiredStaffCount
  };
}

function isRegularHolidayWorkSlot(slot) {
  if (!slot?.shift || !slot.leave) {
    return false;
  }
  if (typeof isRegularRestLeaveId === "function") {
    return isRegularRestLeaveId(slot.leave);
  }
  return getItem("leave", slot.leave)?.code === "0036";
}

function renderShiftViewCell(members, dateString) {
  if (!members.length) {
    return '<div class="shift-view-members"></div>';
  }
  return `
    <div class="shift-view-members">
      ${members.map((member) => {
        const regularHolidayWorkClass = isRegularHolidayWorkSlot(getDisplayedSlot(member.id, dateString))
          ? " regular-holiday-work-member"
          : "";
        return `<div class="shift-view-member${regularHolidayWorkClass}">${escapeHtml(member.name)}</div>`;
      }).join("")}
    </div>
  `;
}

function getScheduleSegmentTextLength(text) {
  return Array.from(String(text || "").trim()).length;
}

function getScheduleSegmentSizeClass(segment, segmentCount) {
  const textLength = getScheduleSegmentTextLength(segment.name);
  if (segmentCount === 1 && textLength > 0 && textLength < 2) {
    return "seg-label-xlarge";
  }
  if (segmentCount < 3 && textLength > 0 && textLength < 3) {
    return "seg-label-large";
  }
  if (segmentCount < 3 && textLength === 3) {
    return "seg-label-medium";
  }
  return "";
}

function renderCellInner(key, memberId = "", day = 0, slotOverride = null, isPreview = false) {
  const cellState = slotOverride || state.schedule[key];
  if (!cellState) {
    return '<div class="cell-inner"></div>';
  }
  const segments = [];
  if (cellState.shift) {
    const shift = getItem("shift", cellState.shift);
    if (shift) {
      segments.push({
        category: "shift",
        name: shift.name,
        color: shift.color,
        textColor: getItemTextColor(shift, shift.color)
      });
    }
  }
  if (cellState.leave) {
    const leave = getItem("leave", cellState.leave);
    if (leave) {
      segments.push({
        category: "leave",
        name: cellState.leaveMeta?.displayName || leave.name,
        color: leave.color,
        textColor: leave.code === "0047" && cellState.shift ? "rgb(112, 112, 112)" : getItemTextColor(leave, leave.color),
        regularHolidayWork: isRegularHolidayWorkSlot(cellState)
      });
    }
  }
  if (cellState.overtime) {
    const overtime = getItem("overtime", cellState.overtime);
    const color = overtime?.color || "#D85A30";
    segments.push({
      category: "overtime",
      name: overtime?.name || cellState.overtimeMeta?.displayName || "加班",
      color,
      textColor: getItemTextColor(overtime, color)
    });
  }
  if (!segments.length) {
    return '<div class="cell-inner"></div>';
  }
  const visibleSegments = segments.slice(0, 3);
  return `<div class="cell-inner">${visibleSegments.map((segment) => (
    `<div class="seg${segment.regularHolidayWork ? " regular-holiday-work-seg" : ""}" style="background-color:${segment.color};color:${segment.textColor || textColor(segment.color)}" ${
      segment.category === "leave" && !isPreview && shouldPromptLeaveDetail(getItem("leave", cellState.leave), cellState.leaveMeta)
        ? `data-hover-schedule-detail="${memberId}:${day}:leave"`
        : segment.category === "overtime" && !isPreview && cellState.overtimeMeta
          ? `data-hover-schedule-detail="${memberId}:${day}:overtime"`
          : ""
    }><span class="seg-label ${getScheduleSegmentSizeClass(segment, visibleSegments.length)}">${escapeHtml(segment.name)}</span></div>`
  )).join("")}</div>`;
}
