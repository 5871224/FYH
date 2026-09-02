const AUTO_FILL_PREVIEW_TYPE = "auto-fill-schedule";

function isAutoFillSchedulePreview() {
  return autoSchedulePreview?.previewType === AUTO_FILL_PREVIEW_TYPE;
}

function isBlankScheduleSlot(slot) {
  return !slot?.shift && !slot?.leave && !slot?.overtime;
}

function getFirstConfiguredShiftId(member) {
  const configuredIds = Array.isArray(member?.scheduleShiftIds) ? member.scheduleShiftIds : [];
  return configuredIds
    .map((shiftId) => String(shiftId || ""))
    .find((shiftId) => state.shifts.some((shift) => shift.id === shiftId)) || "";
}

function getAutoFillEligibleDates(member, dates) {
  const department = state.departments.find((item) => item.id === getMemberHomeDeptId(member)) || null;
  if (!department || department.hiddenFromSchedule) {
    return [];
  }
  return dates.filter((dateString) => (
    isMemberActiveOnDateString(member, dateString)
    && (typeof isDepartmentOperatingOnDate !== "function" || isDepartmentOperatingOnDate(department, dateString))
  ));
}

async function ensureAutoFillScheduleRangeLoaded(startDate, endDate) {
  const range = { startDate, endDate };
  if (typeof isScheduleRangeLoaded === "function" && isScheduleRangeLoaded(range)) {
    return;
  }
  const payload = await window.schedulerApi.loadScheduleEntries({
    ...range,
    members: state.members.map((member) => ({ id: member.id }))
  });
  state.schedule = cleanupScheduleEntries({
    ...state.schedule,
    ...(payload.schedule || {})
  }, state);
  if (typeof rememberScheduleLoadedRange === "function") {
    rememberScheduleLoadedRange(range);
  }
}

function buildAutoFillSchedulePreview(dates) {
  const preview = {
    previewType: AUTO_FILL_PREVIEW_TYPE,
    startDate: dates[0] || "",
    endDate: dates[dates.length - 1] || "",
    dates,
    slots: {},
    warnings: []
  };
  const missingShiftMembers = [];
  const workingSchedule = JSON.parse(JSON.stringify(state.schedule || {}));
  let conditionBlockedCount = 0;

  state.members.forEach((member) => {
    if (member.payByDay) {
      return;
    }
    const eligibleDates = getAutoFillEligibleDates(member, dates);
    if (!eligibleDates.length) {
      return;
    }
    const firstShiftId = getFirstConfiguredShiftId(member);
    if (!firstShiftId) {
      missingShiftMembers.push(member.name || member.code || member.id);
      return;
    }
    eligibleDates.forEach((dateString) => {
      const key = getScheduleKeyForDateString(member.id, dateString);
      if (!key || !isBlankScheduleSlot(workingSchedule[key] || null)) {
        return;
      }
      const blockingConditions = getBlockingSameShiftConditions(workingSchedule, member.id, firstShiftId, dateString);
      if (blockingConditions.length) {
        conditionBlockedCount += 1;
        noteScheduleConditionBlocks(preview, dateString, blockingConditions, "已達同班限額，未自動補班");
        return;
      }
      preview.slots[key] = {
        shift: firstShiftId,
        leave: null,
        overtime: null
      };
      workingSchedule[key] = { ...preview.slots[key] };
    });
  });

  if (missingShiftMembers.length) {
    preview.warnings.push(`以下月薪人員未設定排班班別，未自動補班：${missingShiftMembers.join("、")}`);
  }
  if (conditionBlockedCount) {
    preview.warnings.push(`共有 ${conditionBlockedCount} 格因排班條件未自動補班`);
  }
  return preview;
}

function openAutoFillSchedulePeriodModal() {
  if (!requireCurrentGroupUiPermission("schedule_manage", "自動補班")) {
    return;
  }
  closeCoreActionsMenu();
  const { startDate, endDate } = getVisibleDateRange();
  modalContext = { category: "auto-fill-schedule-period" };
  openEntityListModal({
    title: "自動補班期間",
    modalClass: "modal modal-member-form",
    body: `
      <div class="form-grid">
        <div class="form-row">
          <label for="autoFillScheduleStartDate">開始日期</label>
          <input id="autoFillScheduleStartDate" type="date" value="${escapeHtml(startDate)}">
        </div>
        <div class="form-row">
          <label for="autoFillScheduleEndDate">結束日期</label>
          <input id="autoFillScheduleEndDate" type="date" value="${escapeHtml(endDate)}">
        </div>
      </div>
      <p class="modal-description">只補月薪人員完全空白的班表格，班別使用人員設定中的第一個排班班別；日薪人員及已有班別、假別或加班的格子不變。</p>
    `,
    footerButtons: '<button class="btn-primary" type="button" data-generate-auto-fill-schedule="true">產生預覽</button>'
  });
}

async function generateAutoFillSchedulePreviewFromModal(button) {
  const startDate = document.getElementById("autoFillScheduleStartDate")?.value || "";
  const endDate = document.getElementById("autoFillScheduleEndDate")?.value || "";
  if (!startDate || !endDate || (!isValidDateRange(startDate, endDate) && startDate !== endDate)) {
    reportValidationError("請確認自動補班期間");
    return;
  }
  const dates = enumerateDateRange(startDate, endDate);
  if (!dates.length) {
    reportValidationError("請確認自動補班期間");
    return;
  }

  if (button) {
    button.disabled = true;
  }
  try {
    await Promise.all([
      ensureAutoFillScheduleRangeLoaded(startDate, endDate),
      loadScheduleConditions(groupFeatureState.currentGroupId, true)
    ]);
    closeModal();
    autoSchedulePreview = buildAutoFillSchedulePreview(dates);
    renderAll();
    const changeCount = Object.keys(autoSchedulePreview.slots || {}).length;
    const warningCount = autoSchedulePreview.warnings.length;
    showInfoMessage(
      changeCount
        ? `已產生自動補班預覽：${startDate} ～ ${endDate}，共 ${changeCount} 格${warningCount ? `，${warningCount} 則提醒` : ""}`
        : `自動補班預覽沒有可補的空格${warningCount ? `，${warningCount} 則提醒` : ""}`
    );
  } catch (error) {
    reportValidationError(`讀取班表失敗：${error.message || "未知錯誤"}`);
  } finally {
    if (button?.isConnected) {
      button.disabled = false;
    }
  }
}

async function applyAutoFillSchedulePreview() {
  if (!requireCurrentGroupUiPermission("schedule_manage", "套用自動補班")) {
    return;
  }
  if (!await confirmAction("確定要套用目前綠色自動補班預覽嗎？套用後才會正式寫入班表。")) {
    return;
  }
  const changedCount = await applySchedulePreviewSlots(autoSchedulePreview?.slots || {});
  if (!changedCount) {
    showInfoMessage("自動補班預覽沒有需要套用的變更");
    return;
  }
  showInfoMessage(`已套用自動補班預覽，共寫入 ${changedCount} 格`);
}

function cancelAutoFillSchedulePreview() {
  autoSchedulePreview = null;
  renderAll();
  showInfoMessage("已取消自動補班預覽");
}

function bindAutoFillScheduleControls() {
  document.body.addEventListener("click", async (event) => {
    const button = event.target instanceof Element
      ? event.target.closest("[data-generate-auto-fill-schedule]")
      : null;
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }
    event.preventDefault();
    await generateAutoFillSchedulePreviewFromModal(button);
  });
}
