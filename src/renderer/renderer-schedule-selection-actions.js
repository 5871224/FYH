/* 班表工具列選取與套用到儲存格的操作。
 * 由固定建置清單載入。
 */

function clearLeaveFromSlot(slot) {
  if (!slot) {
    return;
  }
  slot.leave = null;
  slot.leaveMeta = null;
}

function clearOvertimeFromSlot(slot) {
  if (!slot) {
    return;
  }
  slot.overtime = null;
  slot.overtimeMeta = null;
}

async function applySelectionToCell(memberId, day) {
  const dateString = normalizeScheduleDateInput(day);
  if (!canEditSchedule()) {
    return;
  }
  const member = state.members.find((item) => item.id === memberId);
  if (!member || !isMemberActiveOnDateString(member, dateString)) {
    return;
  }
  if (!state.selected.type) {
    return;
  }
  const slot = ensureScheduleSlot(memberId, dateString);
  if (!slot) {
    return;
  }
  const previousSchedule = deepClone(state.schedule || {});
  const { type, id } = state.selected;
  if (type === "leave") {
    const leave = getItem("leave", id);
    if (!leave) {
      return;
    }
    try {
      if (slot.leave === id) {
        clearLeaveFromSlot(slot);
        await finishScheduleCellMutationWithUndo(memberId, dateString, previousSchedule);
        return;
      } else if (shouldPromptLeaveDetail(leave, null)) {
        openLeaveAssignmentModal(memberId, dateString, id);
        return;
      } else {
        slot.leave = id;
        slot.leaveMeta = {
          allDay: defaultLeaveIsAllDay(leave),
          startTime: "",
          endTime: "",
          reason: ""
        };
      }
      await finishScheduleCellMutationWithUndo(memberId, dateString, previousSchedule);
    } catch (error) {
      showInfoMessage(`設定請假失敗：${formatSchedulerError(error, "設定失敗")}`);
    }
    return;
  }
  if (type === "shift") {
    const nextShiftId = slot.shift === id ? null : id;
    slot.shift = nextShiftId;
    try {
      await finishScheduleCellMutationWithUndo(memberId, dateString, previousSchedule);
    } catch (error) {
      showInfoMessage(`設定班別失敗：${formatSchedulerError(error, "設定失敗")}`);
    }
    return;
  }
  if (type === "overtime") {
    const nextOvertimeId = slot.overtime === id ? null : id;
    try {
      if (nextOvertimeId) {
        const overtime = getItem("overtime", nextOvertimeId) || state.overtime[0];
        slot.overtime = nextOvertimeId;
        slot.overtimeMeta = {
          startTime: slot.overtimeMeta?.startTime || overtime?.startTime || "",
          endTime: slot.overtimeMeta?.endTime || overtime?.endTime || "",
          useRest1: slot.overtimeMeta?.useRest1 ?? Boolean(overtime?.useRest1),
          rest1StartTime: slot.overtimeMeta?.rest1StartTime || overtime?.rest1StartTime || "",
          rest1EndTime: slot.overtimeMeta?.rest1EndTime || overtime?.rest1EndTime || "",
          useRest2: slot.overtimeMeta?.useRest2 ?? Boolean(overtime?.useRest2),
          rest2StartTime: slot.overtimeMeta?.rest2StartTime || overtime?.rest2StartTime || "",
          rest2EndTime: slot.overtimeMeta?.rest2EndTime || overtime?.rest2EndTime || "",
          reason: slot.overtimeMeta?.reason || ""
        };
      } else {
        clearOvertimeFromSlot(slot);
      }
      await finishScheduleCellMutationWithUndo(memberId, dateString, previousSchedule);
    } catch (error) {
      showInfoMessage(`設定加班失敗：${formatSchedulerError(error, "設定失敗")}`);
    }
    return;
  }
  if (type === "cancel-shift") {
    slot.shift = null;
    try {
      await finishScheduleCellMutationWithUndo(memberId, dateString, previousSchedule);
    } catch (error) {
      showInfoMessage(`清除班別失敗：${formatSchedulerError(error, "清除失敗")}`);
    }
    return;
  }
  if (type === "cancel-leave") {
    try {
      clearLeaveFromSlot(slot);
      await finishScheduleCellMutationWithUndo(memberId, dateString, previousSchedule);
    } catch (error) {
      showInfoMessage(`清除請假失敗：${formatSchedulerError(error, "清除失敗")}`);
    }
    return;
  }
  if (type === "cancel-overtime") {
    try {
      clearOvertimeFromSlot(slot);
      await finishScheduleCellMutationWithUndo(memberId, dateString, previousSchedule);
    } catch (error) {
      showInfoMessage(`清除加班失敗：${formatSchedulerError(error, "清除失敗")}`);
    }
    return;
  }
}

function selectChip(type, id) {
  if (!canEditSchedule()) {
    return;
  }
  clearScheduleRangeSelection();
  if (state.selected.type === type && state.selected.id === id) {
    clearSelectedChip();
    return;
  } else {
    state.selected = { type, id };
  }
  renderToolbar();
  renderTable();
}

function removeAssignmentsByItem(category, id) {
  Object.values(state.schedule).forEach((slot) => {
    if (slot[category] === id) {
      slot[category] = null;
      if (category === "leave") {
        slot.leaveMeta = null;
      }
    }
  });
  pruneEmptySchedule();
}
