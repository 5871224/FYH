/* 通用實體視窗、請假與加班指派表單。
 * 由 renderer.js 最終拆分；維持既有全域 bundle 與功能行為。
 */

function openEntityListModal(config) {
  const headerButtons = config.headerButtons || "";
  const headerActionBlock = headerButtons
    ? `<div class="modal-header-actions">${headerButtons}</div>`
    : '<div class="modal-header-actions"></div>';
  const closeButton = `
    <div class="modal-header-close">
      <button class="settings-icon-btn modal-close-btn" type="button" data-close-button="true" aria-label="關閉" title="關閉">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12"></path>
          <path d="M18 6l-12 12"></path>
        </svg>
      </button>
    </div>
  `;
  const showFooter = !config.hideFooterClose || config.footerButtons;
  setModal(`
    <div class="modal-overlay" data-close-modal="true">
      <div class="${config.modalClass || "modal modal-wide"}">
        <div class="modal-header">
          <h3>${escapeHtml(config.title)}</h3>
          <div class="modal-header-tools">
            ${headerActionBlock}
            ${closeButton}
          </div>
        </div>
        <div class="modal-body">
          ${config.description ? `<p class="modal-description">${escapeHtml(config.description)}</p>` : ""}
          ${config.body}
        </div>
        ${showFooter ? `
          <div class="modal-footer">
            ${config.hideFooterClose ? "" : '<button class="btn-cancel" type="button" data-close-button="true">關閉</button>'}
            ${config.footerButtons || ""}
          </div>
        ` : ""}
      </div>
    </div>
  `);
}

function syncLeaveAssignmentModalUi() {
  const allDay = document.getElementById("leaveAssignmentAllDay")?.checked;
  const reasonEnabled = document.getElementById("leaveAssignmentReasonEnabled")?.checked;
  const timeSection = document.getElementById("leaveAssignmentTimeSection");
  const reasonSection = document.getElementById("leaveAssignmentReasonSection");
  const reasonInput = document.getElementById("leaveAssignmentReason");

  if (timeSection) {
    timeSection.style.display = allDay ? "none" : "";
  }
  setTimeInputDisabled("leaveAssignmentStartTime", Boolean(allDay));
  setTimeInputDisabled("leaveAssignmentEndTime", Boolean(allDay));
  if (reasonSection) {
    reasonSection.style.display = reasonEnabled ? "" : "none";
  }
  if (reasonInput) {
    if (reasonEnabled) {
      reasonInput.disabled = false;
      reasonInput.removeAttribute("disabled");
      reasonInput.readOnly = false;
      reasonInput.style.pointerEvents = "auto";
    } else {
      reasonInput.disabled = true;
      reasonInput.setAttribute("disabled", "disabled");
      reasonInput.style.pointerEvents = "none";
    }
  }
}

function syncOvertimeFormUi() {
  const useRest1 = Boolean(document.getElementById("overtimeUseRest1")?.checked);
  const useRest2 = Boolean(document.getElementById("overtimeUseRest2")?.checked);
  const rest1Fields = document.getElementById("overtimeRest1Fields");
  const rest2Fields = document.getElementById("overtimeRest2Fields");
  const rest2Toggle = document.getElementById("overtimeUseRest2");
  const rest1Inputs = ["overtimeRest1StartTime", "overtimeRest1EndTime"];
  const rest2Inputs = ["overtimeRest2StartTime", "overtimeRest2EndTime"];

  if (rest1Fields) {
    rest1Fields.style.display = useRest1 ? "" : "none";
  }
  rest1Inputs.forEach((id) => setTimeInputDisabled(id, !useRest1));

  if (!useRest1) {
    if (rest2Toggle) {
      rest2Toggle.checked = false;
      rest2Toggle.disabled = true;
    }
    if (rest2Fields) {
      rest2Fields.style.display = "none";
    }
    rest2Inputs.forEach((id) => setTimeInputDisabled(id, true));
    return;
  }

  if (rest2Toggle) {
    rest2Toggle.disabled = false;
  }
  if (rest2Fields) {
    rest2Fields.style.display = useRest2 ? "" : "none";
  }
  rest2Inputs.forEach((id) => setTimeInputDisabled(id, !useRest2));
}

function openLeaveAssignmentModal(memberId, day, leaveId) {
  const dateString = normalizeScheduleDateInput(day);
  const member = state.members.find((item) => item.id === memberId);
  const leave = getItem("leave", leaveId);
  if (!member || !leave) {
    return;
  }

  const slot = getSlot(memberId, dateString);
  const existingMeta = slot?.leave === leaveId ? slot.leaveMeta || null : null;
  const defaultAllDay = existingMeta?.allDay ?? defaultLeaveIsAllDay(leave);
  const reasonEnabled = existingMeta?.reasonEnabled ?? leave.requiresReason;
  const startTime = existingMeta?.startTime || "";
  const endTime = existingMeta?.endTime || "";
  const reason = existingMeta?.reason || "";

  modalContext = {
    category: "leave-assignment",
    memberId,
    day: dateString,
    leaveId
  };
  openEntityListModal({
    title: "休假明細",
    modalClass: "modal modal-form-compact",
    headerButtons: `<button class="btn-primary" type="button" data-save-leave-assignment="true">儲存</button>`,
    hideFooterClose: true,
    body: `
      <div class="form-row">
        <label>假別</label>
        <div class="readonly-pill">${escapeHtml(member.name)} · ${escapeHtml(formatDateTextFromIso(dateString))} · ${escapeHtml(getLeaveLabel(leave))}</div>
      </div>
      <div class="form-row checkbox-row checkbox-row-left">
        <label>
          <input id="leaveAssignmentAllDay" type="checkbox" ${defaultAllDay ? "checked" : ""}>
          整天
        </label>
      </div>
      <div class="form-grid" id="leaveAssignmentTimeSection" style="${defaultAllDay ? "display:none;" : ""}">
        <div class="form-row">
          <label for="leaveAssignmentStartTime">開始時間</label>
          ${timeInputMarkup("leaveAssignmentStartTime", startTime, defaultAllDay)}
        </div>
        <div class="form-row">
          <label for="leaveAssignmentEndTime">結束時間</label>
          ${timeInputMarkup("leaveAssignmentEndTime", endTime, defaultAllDay)}
        </div>
      </div>
      <div class="form-row checkbox-row checkbox-row-left">
        <label>
          <input id="leaveAssignmentReasonEnabled" type="checkbox" ${reasonEnabled ? "checked" : ""}>
          原因
        </label>
      </div>
      <div class="form-row" id="leaveAssignmentReasonSection" style="${reasonEnabled ? "" : "display:none;"}">
        <label for="leaveAssignmentReason">原因內容</label>
        <input id="leaveAssignmentReason" type="text" maxlength="60" value="${escapeHtml(reason)}" ${reasonEnabled ? "" : "disabled"} placeholder="請輸入原因">
      </div>
    `
  });
  syncLeaveAssignmentModalUi();
}

async function saveLeaveAssignmentFromModal() {
  const { memberId, day, leaveId } = modalContext;
  const allDay = document.getElementById("leaveAssignmentAllDay")?.checked !== false;
  const reasonEnabled = Boolean(document.getElementById("leaveAssignmentReasonEnabled")?.checked);
  const startTime = readTimeInputValue("leaveAssignmentStartTime");
  const endTime = readTimeInputValue("leaveAssignmentEndTime");
  if (!allDay && !isValidTimeRange(startTime, endTime)) {
    reportValidationError("開始時間必須早於結束時間");
    return;
  }

  try {
    const dateString = normalizeScheduleDateInput(day);
    const slot = ensureScheduleSlot(memberId, dateString);
    const leave = getItem("leave", leaveId);
    if (!slot || !leave) {
      throw new Error("找不到班表格子或假別");
    }
    const previousSchedule = deepClone(state.schedule || {});
    slot.leave = leaveId;
    slot.leaveMeta = {
      leaveCode: leave.code || "",
      displayName: leave.name,
      displayColor: leave.color || "",
      displayTextColor: getItemTextColor(leave, leave.color),
      allDay,
      startTime: allDay ? "" : startTime,
      endTime: allDay ? "" : endTime,
      reasonEnabled,
      reason: reasonEnabled ? (document.getElementById("leaveAssignmentReason")?.value.trim() || "") : ""
    };
    closeModal();
    await finishScheduleCellMutationWithUndo(memberId, dateString, previousSchedule);
  } catch (error) {
    reportValidationError(`儲存休假失敗：${formatSchedulerError(error, "儲存失敗")}`);
  }
}

function openOvertimeAssignmentModal(memberId, day) {
  const dateString = normalizeScheduleDateInput(day);
  const member = state.members.find((item) => item.id === memberId);
  const slot = getSlot(memberId, dateString);
  const overtimeMeta = slot?.overtimeMeta || null;
  if (!member || !slot?.overtime) {
    return;
  }
  modalContext = {
    category: "overtime-assignment",
    memberId,
    day: dateString
  };
  openEntityListModal({
    title: "修改加班",
    modalClass: "modal modal-form-compact",
    body: `
      <div class="form-row">
        <label>人員</label>
        <div class="readonly-pill">${escapeHtml(member.name)} · ${escapeHtml(formatDateTextFromIso(dateString))}</div>
      </div>
      <div class="form-grid">
        <div class="form-row">
          <label for="scheduleOvertimeStartTime">加班開始</label>
          ${timeInputMarkup("scheduleOvertimeStartTime", overtimeMeta?.startTime || "")}
        </div>
        <div class="form-row">
          <label for="scheduleOvertimeEndTime">加班結束</label>
          ${timeInputMarkup("scheduleOvertimeEndTime", overtimeMeta?.endTime || "")}
        </div>
      </div>
      <div class="form-section">
        <div class="form-row checkbox-row">
          <label class="overtime-use-label">
            <input id="scheduleOvertimeUseRest1" type="checkbox" ${overtimeMeta?.useRest1 ? "checked" : ""}>
            使用休息1
          </label>
        </div>
        <div class="form-grid" id="scheduleOvertimeRest1Fields" style="${overtimeMeta?.useRest1 ? "" : "display:none;"}">
          <div class="form-row">
            <label for="scheduleOvertimeRest1StartTime">休息1開始</label>
            ${timeInputMarkup("scheduleOvertimeRest1StartTime", overtimeMeta?.rest1StartTime || "", !overtimeMeta?.useRest1)}
          </div>
          <div class="form-row">
            <label for="scheduleOvertimeRest1EndTime">休息1結束</label>
            ${timeInputMarkup("scheduleOvertimeRest1EndTime", overtimeMeta?.rest1EndTime || "", !overtimeMeta?.useRest1)}
          </div>
        </div>
      </div>
      <div class="form-section">
        <div class="form-row checkbox-row">
          <label class="overtime-use-label">
            <input id="scheduleOvertimeUseRest2" type="checkbox" ${overtimeMeta?.useRest1 && overtimeMeta?.useRest2 ? "checked" : ""} ${overtimeMeta?.useRest1 ? "" : "disabled"}>
            使用休息2
          </label>
        </div>
        <div class="form-grid" id="scheduleOvertimeRest2Fields" style="${overtimeMeta?.useRest1 && overtimeMeta?.useRest2 ? "" : "display:none;"}">
          <div class="form-row">
            <label for="scheduleOvertimeRest2StartTime">休息2開始</label>
            ${timeInputMarkup("scheduleOvertimeRest2StartTime", overtimeMeta?.rest2StartTime || "", !(overtimeMeta?.useRest1 && overtimeMeta?.useRest2))}
          </div>
          <div class="form-row">
            <label for="scheduleOvertimeRest2EndTime">休息2結束</label>
            ${timeInputMarkup("scheduleOvertimeRest2EndTime", overtimeMeta?.rest2EndTime || "", !(overtimeMeta?.useRest1 && overtimeMeta?.useRest2))}
          </div>
        </div>
      </div>
    `,
    footerButtons: '<button class="btn-primary" type="button" data-save-overtime-assignment="true">儲存</button>'
  });
  syncScheduleOvertimeFormUi();
}

async function saveOvertimeAssignmentFromModal() {
  const { memberId, day } = modalContext;
  const startTime = readTimeInputValue("scheduleOvertimeStartTime");
  const endTime = readTimeInputValue("scheduleOvertimeEndTime");
  const useRest1 = Boolean(document.getElementById("scheduleOvertimeUseRest1")?.checked);
  const useRest2 = Boolean(document.getElementById("scheduleOvertimeUseRest2")?.checked) && useRest1;
  const rest1StartTime = readTimeInputValue("scheduleOvertimeRest1StartTime");
  const rest1EndTime = readTimeInputValue("scheduleOvertimeRest1EndTime");
  const rest2StartTime = readTimeInputValue("scheduleOvertimeRest2StartTime");
  const rest2EndTime = readTimeInputValue("scheduleOvertimeRest2EndTime");
  if (!memberId || !day) {
    reportValidationError("請確認加班資料");
    return;
  }
  if (!isValidTimeRange(startTime, endTime)) {
    reportValidationError("加班開始時間必須早於加班結束時間");
    return;
  }
  if (useRest1 && !isValidTimeRange(rest1StartTime, rest1EndTime)) {
    reportValidationError("休息1開始時間必須早於結束時間");
    return;
  }
  if (useRest2 && !isValidTimeRange(rest2StartTime, rest2EndTime)) {
    reportValidationError("休息2開始時間必須早於結束時間");
    return;
  }
  try {
    const dateString = normalizeScheduleDateInput(day);
    const slot = getSlot(memberId, dateString);
    const overtime = getItem("overtime", slot?.overtime) || state.overtime[0];
    if (!slot || !overtime) {
      throw new Error("找不到班表格子或加班類型");
    }
    const previousSchedule = deepClone(state.schedule || {});
    slot.overtime = overtime.id;
    slot.overtimeMeta = {
      displayName: overtime.name || "加班",
      displayColor: overtime.color || "#D85A30",
      displayTextColor: getItemTextColor(overtime, overtime.color || "#D85A30"),
      startTime,
      endTime,
      useRest1,
      rest1StartTime: useRest1 ? rest1StartTime : "",
      rest1EndTime: useRest1 ? rest1EndTime : "",
      useRest2,
      rest2StartTime: useRest2 ? rest2StartTime : "",
      rest2EndTime: useRest2 ? rest2EndTime : "",
      reason: slot.overtimeMeta?.reason || ""
    };
    closeModal();
    await finishScheduleCellMutationWithUndo(memberId, dateString, previousSchedule);
  } catch (error) {
    reportValidationError(`儲存加班失敗：${formatSchedulerError(error, "儲存失敗")}`);
  }
}

function syncScheduleOvertimeFormUi() {
  const useRest1 = Boolean(document.getElementById("scheduleOvertimeUseRest1")?.checked);
  const useRest2 = Boolean(document.getElementById("scheduleOvertimeUseRest2")?.checked) && useRest1;
  const rest1Fields = document.getElementById("scheduleOvertimeRest1Fields");
  const rest2Fields = document.getElementById("scheduleOvertimeRest2Fields");
  const rest2Toggle = document.getElementById("scheduleOvertimeUseRest2");

  if (rest1Fields) {
    rest1Fields.style.display = useRest1 ? "" : "none";
  }
  setTimeInputDisabled("scheduleOvertimeRest1StartTime", !useRest1);
  setTimeInputDisabled("scheduleOvertimeRest1EndTime", !useRest1);

  if (rest2Toggle) {
    rest2Toggle.disabled = !useRest1;
    if (!useRest1) {
      rest2Toggle.checked = false;
    }
  }
  if (rest2Fields) {
    rest2Fields.style.display = useRest2 ? "" : "none";
  }
  setTimeInputDisabled("scheduleOvertimeRest2StartTime", !useRest2);
  setTimeInputDisabled("scheduleOvertimeRest2EndTime", !useRest2);
}
