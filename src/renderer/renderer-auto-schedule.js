function buildAutoSchedulePreview(dates = getVisibleDates()) {
  const startDate = dates[0] || getTodayDateString();
  const regularLeave = getLeaveByCode("0036");
  const restLeave = getLeaveByCode("0047");
  const preview = {
    startDate,
    dates,
    slots: {},
    warnings: [],
    cancelLeaveRequestIds: new Set(),
    memberTargets: {}
  };
  const scheduleMap = deepClone(state.schedule || {});
  if (!regularLeave || !restLeave) {
    preview.warnings.push("找不到例假 0036 或休息日 0047，無法完整自動排班");
    return preview;
  }

  state.members.forEach((member) => {
    const activeDays = countMemberActiveDays(member, dates);
    if (!activeDays) {
      return;
    }
    dates.forEach((dateString) => {
      if (!isMemberActiveOnDateString(member, dateString)) {
        return;
      }
      if (toDateObject(dateString)?.getDay() === normalizeRestWeekday(member.fixedRestWeekday)) {
        const hadShift = hasAnyShiftOnDate(scheduleMap, member.id, dateString);
        markAutoLeave(scheduleMap, member, dateString, regularLeave, preview, hadShift ? "例假加班" : "固定例假");
        if (hadShift) {
          preview.warnings.push(`${member.name} ${dateString} 已有班別，預排為例假加班`);
        }
      }
    });
  });

  state.members.forEach((member) => {
    const target = getMemberAutoRestTarget(member, scheduleMap, dates);
    if (!target.activeDays) {
      return;
    }
    preview.memberTargets[member.id] = target;
  });

  dates.forEach((dateString) => {
    findBestDailyShiftAssignments(scheduleMap, dateString, preview);
    placeDailySurplusRestDays(scheduleMap, dateString, dates, startDate, restLeave, preview);
  });

  state.members.forEach((member) => {
    const target = preview.memberTargets[member.id]?.restTarget ?? 0;
    let restCount = countMemberLeaveByPredicate(scheduleMap, member.id, dates, isRestLeaveId);
    while (restCount < target) {
      const weekCount = Math.max(1, Math.ceil(dates.length / 7));
      const weekIndexes = Array.from({ length: weekCount }, (_, index) => index);
      const targetWeek = weekIndexes.find((weekIndex) => !memberHasRestInWeek(scheduleMap, member.id, dates, weekIndex, startDate));
      const candidateDate = dates.find((dateString) => (
        getWeekBucketIndex(dateString, startDate) === targetWeek
        && isMemberActiveOnDateString(member, dateString)
        && !hasAnyLeaveOnDate(scheduleMap, member.id, dateString)
      ));
      if (!candidateDate) {
        preview.warnings.push(`${member.name} 休息日不足 ${target - restCount} 天`);
        break;
      }
      markAutoLeave(scheduleMap, member, candidateDate, restLeave, preview, hasAnyShiftOnDate(scheduleMap, member.id, candidateDate) ? "休息日加班" : "補足休息日");
      if (hasAnyShiftOnDate(scheduleMap, member.id, candidateDate)) {
        preview.warnings.push(`${member.name} ${candidateDate} 預排為休息日加班`);
      }
      restCount += 1;
    }
  });

  Object.entries(scheduleMap).forEach(([key, slot]) => {
    const original = state.schedule[key] || null;
    if (JSON.stringify(original || null) !== JSON.stringify(slot || null)) {
      preview.slots[key] = slot;
    }
  });
  preview.cancelLeaveRequestIds = Array.from(preview.cancelLeaveRequestIds);
  return preview;
}

function getMissingAutoScheduleLeaveLabels() {
  return [
    { code: "0036", name: "例假" },
    { code: "0047", name: "休息日" }
  ]
    .filter((leave) => !getLeaveByCode(leave.code))
    .map((leave) => `${leave.name} ${leave.code}`);
}

async function previewAutoSchedule() {
  if (!promptManagerAccess("自動排班需先登入主管帳號")) {
    return;
  }
  const { startDate, endDate } = getVisibleDateRange();
  modalContext = { category: "auto-schedule-period" };
  openEntityListModal({
    title: "自動排班期間",
    modalClass: "modal modal-member-form",
    body: `
      <div class="form-grid">
        <div class="form-row">
          <label for="autoScheduleStartDate">開始日期</label>
          <input id="autoScheduleStartDate" type="date" value="${escapeHtml(startDate)}">
        </div>
        <div class="form-row">
          <label for="autoScheduleEndDate">結束日期</label>
          <input id="autoScheduleEndDate" type="date" value="${escapeHtml(endDate)}">
        </div>
      </div>
    `,
    footerButtons: '<button class="btn-primary" type="button" data-generate-auto-schedule="true">產生預覽</button>'
  });
}

async function generateAutoSchedulePreviewFromModal() {
  const startDate = document.getElementById("autoScheduleStartDate")?.value || "";
  const endDate = document.getElementById("autoScheduleEndDate")?.value || "";
  if (!startDate || !endDate || (!isValidDateRange(startDate, endDate) && startDate !== endDate)) {
    reportValidationError("請確認自動排班期間");
    return;
  }
  const dates = enumerateDateRange(startDate, endDate);
  if (!dates.length) {
    reportValidationError("請確認自動排班期間");
    return;
  }
  const missingLeaveLabels = getMissingAutoScheduleLeaveLabels();
  if (missingLeaveLabels.length) {
    reportValidationError(`自動排班需要先在假別設定新增：${missingLeaveLabels.join("、")}`);
    return;
  }
  closeModal();
  autoSchedulePreview = buildAutoSchedulePreview(dates);
  renderAll();
  const changeCount = Object.keys(autoSchedulePreview.slots || {}).length;
  const warningCount = autoSchedulePreview.warnings.length;
  showInfoMessage(`已產生自動排班預覽：${startDate} ～ ${endDate}，${changeCount} 格預排${warningCount ? `，${warningCount} 則提醒` : ""}`);
}

async function applyAutoSchedulePreview() {
  if (!promptManagerAccess("套用自動排班需先登入主管帳號")) {
    return;
  }
  if (!autoSchedulePreview) {
    showInfoMessage("目前沒有自動排班預覽");
    return;
  }
  if (!await confirmAction("確定要套用目前綠色預排結果嗎？套用後會寫入班表。")) {
    return;
  }
  const previewSlots = autoSchedulePreview.slots || {};
  const changedCells = Object.keys(previewSlots).map(parseScheduleKeyParts).filter(Boolean);
  if (!changedCells.length) {
    autoSchedulePreview = null;
    renderAll();
    showInfoMessage("自動排班預覽沒有需要套用的變更");
    return;
  }
  rememberScheduleUndoSnapshot();
  Object.entries(previewSlots).forEach(([key, slot]) => {
    state.schedule[key] = deepClone(slot);
  });
  autoSchedulePreview = null;
  pruneEmptySchedule();
  renderAll();
  await persistScheduleCells(changedCells);
  showInfoMessage("已套用自動排班預覽");
}

function cancelAutoSchedulePreview() {
  if (!autoSchedulePreview) {
    return;
  }
  autoSchedulePreview = null;
  renderAll();
  showInfoMessage("已取消自動排班預覽");
}
