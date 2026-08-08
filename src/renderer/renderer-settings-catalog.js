function getLeaveCatalogDisplayName(item) {
  if (!item) {
    return "";
  }
  return LEAVE_CATALOG.find((entry) => entry.code === item.code)?.name || item.name || "";
}

function openListSettings(category) {
  modalContext = { category: "list-settings", listCategory: category };
  const titleMap = {
    shift: "班別設定",
    leave: "假別設定",
    overtime: "加班設定"
  };
  const list = getItemList(category).filter((item) => !item.deleted);
  const renderShiftMemberNames = (shift) => {
    const members = getMembersForScheduleShift(shift.id).filter((member) => !member.deleted);
    if (!members.length) {
      return "-";
    }
    return members.map((member) => (
      `<span class="settings-member-chip" data-shift-schedule-member="${escapeHtml(member.id)}" title="雙擊修改人員">${escapeHtml(member.name)}</span>`
    )).join("");
  };
  const body = list.length
      ? `
        <div class="settings-table-wrap">
          <div class="settings-table-scroll">
            <div class="settings-table">
              <div class="settings-table-row settings-table-head settings-table-row-${category}">
                 ${renderSettingsOrderDragColumn(true)}
                 <div>預覽</div>
                ${category === "leave" ? "<div>假別代碼</div>" : ""}
                ${category === "shift" ? "" : `<div>${category === "leave" ? "假別" : "加班"}</div>`}
                <div>${category === "shift" ? "適用單位" : category === "leave" ? "需填時間" : "時段"}</div>
                ${category === "shift" ? "<div>需求人數</div>" : ""}
                ${category === "shift" ? "<div>排班人員</div>" : ""}
                ${category === "overtime" ? "<div>休息1</div><div>休息2</div>" : ""}
                ${category === "shift" ? "<div>時段</div>" : ""}
                ${category === "leave" ? "<div>需填原因</div>" : ""}
                <div>不顯示</div>
                <div class="settings-table-actions-head">操作</div>
              </div>
              ${list.map((item) => `
                <div class="settings-table-row settings-table-row-${category} sortable-settings-item" data-sort-category="${category}" data-sort-item="${item.id}">
                   ${renderSettingsOrderDragColumn()}
                   <div class="settings-table-color">
                    <div class="settings-table-preview" style="background:${escapeHtml(item.color)};color:${escapeHtml(getItemTextColor(item, item.color))}">${escapeHtml(item.name || item.code || "名稱")}</div>
                  </div>
                  ${category === "leave" ? `<div class="settings-table-code">${escapeHtml(item.code || "")}</div>` : ""}
                  ${category === "shift" ? "" : `<div class="settings-table-name">${escapeHtml(category === "leave" ? getLeaveCatalogDisplayName(item) : item.name)}</div>`}
                  <div class="settings-table-meta">${category === "shift"
                    ? escapeHtml(getDepartmentSummary(item.applicableDeptId))
                    : category === "leave"
                      ? (item.requiresTime ? "是" : "否")
                      : escapeHtml(`${item.startTime || "--:--"} - ${item.endTime || "--:--"}`)
                  }</div>
                  ${category === "shift"
                    ? `<div class="settings-table-meta">${escapeHtml(String(item.requiredStaffCount ?? 0))}</div>`
                    : ""}
                  ${category === "shift"
                    ? `<div class="settings-table-meta settings-member-list">${renderShiftMemberNames(item)}</div>`
                    : ""}
                  ${category === "overtime"
                    ? `<div class="settings-table-meta">${item.useRest1 ? escapeHtml(`${item.rest1StartTime || "--:--"} - ${item.rest1EndTime || "--:--"}`) : "-"}</div>
                       <div class="settings-table-meta">${item.useRest2 ? escapeHtml(`${item.rest2StartTime || "--:--"} - ${item.rest2EndTime || "--:--"}`) : "-"}</div>`
                    : ""}
                  ${category === "shift"
                    ? `<div class="settings-table-meta">${escapeHtml(`${item.startTime || "--:--"} - ${item.endTime || "--:--"}`)}</div>`
                    : ""}
                  ${category === "leave"
                    ? `<div class="settings-table-meta">${item.requiresReason ? "是" : "否"}</div>`
                    : ""}
                  <div class="settings-table-meta">${item.hiddenFromToolbar ? "是" : "否"}</div>
                  <div class="settings-table-actions">
                    ${renderActionIconButton("edit", `data-edit-item="${category}" data-edit-id="${item.id}"`)}
                    ${renderActionIconButton("delete", `data-delete-category="${category}" data-delete-id="${item.id}"`)}
                  </div>
                </div>
              `).join("")}
            </div>
          </div>
        </div>
      `
      : '<div class="empty-state">目前還沒有資料</div>';

  openEntityListModal({
    title: titleMap[category],
    modalClass: category === "shift" || category === "leave" || category === "overtime"
      ? "modal modal-wide catalog-settings-modal settings-list-modal"
      : undefined,
    body,
    headerButtons: `
      <button class="ghost-btn" type="button" data-export-settings="${category}">匯出</button>
      <button class="ghost-btn" type="button" data-import-settings="${category}">匯入</button>
      <button class="btn-primary" type="button" data-open-add="${category}">新增</button>
    `,
    hideFooterClose: true
  });
}

function readApplicableDepartmentInput() {
  return document.getElementById("shiftApplicableDept")?.value || "";
}

function renderColorPreviewFields(category, previewText) {
  return `
    <div class="form-row form-row-compact leave-preview-row">
      <label>預覽</label>
      <div class="leave-preview-wrap">
        <div class="leave-preview" data-color-preview="${category}" style="background:${escapeHtml(modalColor)};color:${escapeHtml(modalTextColor)}">
          <span data-color-preview-text="${category}">${escapeHtml(previewText)}</span>
        </div>
        <div class="leave-color-actions">
          <button class="ghost-btn leave-color-btn" type="button" data-open-item-color="bg">底色</button>
          <input class="hidden-color-input leave-color-input" type="color" value="${escapeHtml(modalColor)}" data-item-color-input="bg">
          <button class="ghost-btn leave-color-btn" type="button" data-open-item-color="text">字色</button>
          <input class="hidden-color-input leave-color-input" type="color" value="${escapeHtml(modalTextColor)}" data-item-color-input="text">
          <button class="ghost-btn leave-color-btn" type="button" data-set-auto-item-text="true">自動字色</button>
        </div>
      </div>
    </div>
  `;
}

function renderActionIconButton(kind, attrs, extraClass = "") {
  const title = kind === "delete" ? "刪除" : "修改";
  const dangerClass = kind === "delete" ? " settings-icon-btn-danger" : "";
  const icon = kind === "delete"
    ? `
      <path d="M4 7h16"></path>
      <path d="M9 7V4h6v3"></path>
      <path d="M7 7l1 13h8l1-13"></path>
      <path d="M10 11v6"></path>
      <path d="M14 11v6"></path>
    `
    : `
      <path d="M4 20h4l10-10a2 2 0 0 0-4-4L4 16v4z"></path>
      <path d="M13.5 6.5l4 4"></path>
    `;
  return `
    <button class="settings-icon-btn${dangerClass}${extraClass ? ` ${extraClass}` : ""}" type="button" ${attrs} aria-label="${title}" title="${title}">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        ${icon}
      </svg>
    </button>
  `;
}

function syncNamedColorUi() {
  const preview = document.querySelector("[data-color-preview]");
  const previewText = document.querySelector("[data-color-preview-text]");
  const bgInput = document.querySelector('[data-item-color-input="bg"]');
  const textInput = document.querySelector('[data-item-color-input="text"]');
  if (modalTextColorAuto) {
    modalTextColor = autoLeaveTextColor(modalColor);
  }
  const fallbackName = modalContext.category === "shift"
    ? "班別"
    : modalContext.category === "overtime"
      ? "加班"
      : "名稱";
  const displayName = modalContext.category === "leave"
    ? (document.getElementById("leaveCatalogName")?.value.trim() || "名稱")
    : modalContext.category === "shift"
      ? (document.getElementById("shiftName")?.value.trim() || fallbackName)
      : (document.getElementById("namedItemName")?.value.trim() || fallbackName);
  if (preview) {
    preview.style.background = modalColor;
    preview.style.color = modalTextColor;
  }
  if (previewText) {
    previewText.textContent = displayName;
  }
  if (bgInput) {
    bgInput.value = modalColor;
  }
  if (textInput) {
    textInput.value = modalTextColor;
  }
}

function openShiftFormModal(mode, shiftId = "") {
  const returnTo = modalContext?.category === "list-settings"
    ? captureSettingsReturnContext({ category: "list-settings", listCategory: "shift" })
    : null;
  const shift = mode === "edit"
    ? state.shifts.find((item) => item.id === shiftId)
    : {
      id: "",
      name: "",
      color: COLORS[0].hex,
      startTime: "",
      endTime: "",
      hiddenFromToolbar: false,
      requiredStaffCount: 1,
      applicableDeptId: state.deptFilter !== "all" ? state.deptFilter : (state.departments[0]?.id || ""),
      positionRequirements: []
    };
  if (!shift) {
    return;
  }
  modalColor = shift.color;
  modalTextColorAuto = shift.autoTextColor ?? !shift.textColor;
  modalTextColor = shift.textColor || autoLeaveTextColor(shift.color);
  modalContext = { mode, category: "shift", targetId: shiftId, returnTo };

  openEntityListModal({
    title: mode === "edit" ? "修改班別" : "新增班別",
    modalClass: "modal modal-wide modal-form-compact settings-edit-form",
    body: `
      ${renderColorPreviewFields("shift", shift.name || "班別")}
      <div class="form-row">
        <label for="shiftApplicableDept">適用單位</label>
        <select id="shiftApplicableDept">${buildSelectOptions(state.departments.filter((item) => !item.deleted), "id", (item) => item.name, shift.applicableDeptId || "")}</select>
      </div>
      <div class="form-grid">
        <div class="form-row">
          <label for="shiftName">名稱</label>
          <textarea id="shiftName" class="single-line-textarea" rows="1" maxlength="12" lang="zh-Hant" spellcheck="false" placeholder="請輸入班別">${escapeHtml(shift.name)}</textarea>
        </div>
        <div class="form-row">
          <label for="shiftRequiredStaffCount">需求人數</label>
          <input id="shiftRequiredStaffCount" type="number" min="0" max="99" step="1" value="${escapeHtml(String(shift.requiredStaffCount ?? 1))}">
        </div>
      </div>
      <div class="form-section">
      <div class="form-grid">
        <div class="form-row">
          <label for="shiftStartTime">上班時間</label>
          ${timeInputMarkup("shiftStartTime", shift.startTime || "")}
        </div>
        <div class="form-row">
          <label for="shiftEndTime">下班時間</label>
          ${timeInputMarkup("shiftEndTime", shift.endTime || "")}
        </div>
      </div>
      </div>
      <div class="form-row checkbox-row checkbox-row-left">
        <label>
          <input id="shiftHiddenFromToolbar" type="checkbox" ${shift.hiddenFromToolbar ? "checked" : ""}>
          不顯示
        </label>
      </div>
    `,
    headerButtons: `<button class="btn-primary" type="button" data-save-shift="${mode}">${mode === "edit" ? "儲存修改" : "新增"}</button>`,
    hideFooterClose: true
  });
  syncNamedColorUi();
}

async function saveShiftFromModal(mode) {
  const returnTo = modalContext.returnTo || null;
  const name = document.getElementById("shiftName")?.value.trim();
  if (!name) {
    document.getElementById("shiftName")?.focus();
    return;
  }
  const startTime = readTimeInputValue("shiftStartTime");
  const endTime = readTimeInputValue("shiftEndTime");
  if (!isValidTimeRange(startTime, endTime)) {
    reportValidationError("上班時間必須早於下班時間");
    return;
  }
  const applicableDeptId = readApplicableDepartmentInput();
  if (!state.departments.some((department) => department.id === applicableDeptId && !department.deleted)) {
    reportValidationError("請選擇適用單位");
    return;
  }
  const payload = {
    id: mode === "edit" ? modalContext.targetId : uid("s"),
    name,
    color: modalColor,
    textColor: modalTextColor,
    autoTextColor: modalTextColorAuto,
    startTime,
    endTime,
    hiddenFromToolbar: Boolean(document.getElementById("shiftHiddenFromToolbar")?.checked),
    requiredStaffCount: Math.max(0, Number(document.getElementById("shiftRequiredStaffCount")?.value || 0)),
    applicableDeptId,
    positionRequirements: []
  };

  const sortOrder = mode === "edit"
    ? state.shifts.findIndex((shift) => shift.id === payload.id)
    : state.shifts.length;
  try {
    await window.schedulerApi.saveShiftItem(payload, Math.max(0, sortOrder));
  } catch (error) {
    setSaveStatus(`班別儲存失敗：${error.message}`);
    return;
  }
  if (mode === "edit") {
    state.shifts = state.shifts.map((shift) => shift.id === payload.id ? payload : shift);
  } else {
    state.shifts.push(payload);
  }
  closeModal();
  renderAll();
  await reopenSettingsModalPreservingScroll(returnTo || { category: "list-settings", listCategory: "shift", scrollTop: 0 });
}

function openNamedColorFormModal(category, mode, targetId = "") {
  const returnTo = modalContext?.category === "list-settings"
    ? captureSettingsReturnContext({ category: "list-settings", listCategory: category })
    : null;
  const list = getItemList(category);
  const item = mode === "edit"
    ? list.find((entry) => entry.id === targetId)
    : {
      id: "",
      code: category === "leave" ? LEAVE_CATALOG[0].code : "",
      name: category === "overtime" ? "加班" : LEAVE_CATALOG[0].name,
      color: COLORS[0].hex,
      requiresTime: false,
      requiresReason: false,
      hiddenFromToolbar: false,
      startTime: "",
      endTime: "",
      useRest1: false,
      rest1StartTime: "",
      rest1EndTime: "",
      useRest2: false,
      rest2StartTime: "",
      rest2EndTime: ""
    };
  if (!item) {
    return;
  }
  modalColor = item.color;
  modalTextColorAuto = item.autoTextColor ?? !item.textColor;
  modalTextColor = item.textColor || autoLeaveTextColor(item.color);
  modalContext = { category, mode, targetId, returnTo };
  const titleMap = {
    shift: "班別",
    leave: "假別",
    overtime: "加班"
  };
  openEntityListModal({
      title: `${mode === "edit" ? "修改" : "新增"}${titleMap[category]}`,
    modalClass: category === "leave" || category === "overtime"
        ? "modal modal-wide modal-form-compact settings-edit-form"
        : "modal modal-wide",
      body: `
      ${renderColorPreviewFields(category, item.name || (category === "overtime" ? "加班" : "名稱"))}
      <div class="form-row">
        <label for="${category === "leave" ? "leaveCatalogCode" : "namedItemName"}">${category === "leave" ? "假別" : "名稱"}</label>
        ${category === "leave"
          ? `<select id="leaveCatalogCode">${buildSelectOptions(LEAVE_CATALOG, "code", (entry) => `${entry.code} ${entry.name}`, item.code || "")}</select>`
          : `<textarea id="namedItemName" class="single-line-textarea" rows="1" maxlength="12" lang="zh-Hant" spellcheck="false" placeholder="請輸入名稱">${escapeHtml(item.name)}</textarea>`
        }
      </div>
      ${category === "leave" ? `
        <div class="form-row">
          <label for="leaveCatalogName">名稱</label>
          <input id="leaveCatalogName" type="text" maxlength="20" placeholder="請輸入名稱" value="${escapeHtml(item.name || LEAVE_CATALOG.find((entry) => entry.code === item.code)?.name || "")}">
        </div>
        <div class="form-section">
          <div class="form-row checkbox-row checkbox-row-left">
            <label>
              <input id="leaveRequiresTime" type="checkbox" ${item.requiresTime ? "checked" : ""}>
              需填時間
            </label>
          </div>
          <div class="form-row checkbox-row checkbox-row-left">
            <label>
              <input id="leaveRequiresReason" type="checkbox" ${item.requiresReason ? "checked" : ""}>
              需填原因
            </label>
          </div>
        </div>
      ` : ""}
      ${category === "overtime" ? `
        <div class="form-section">
          <div class="form-grid">
            <div class="form-row">
              <label for="overtimeStartTime">上班時間</label>
              ${timeInputMarkup("overtimeStartTime", item.startTime || "")}
            </div>
            <div class="form-row">
              <label for="overtimeEndTime">下班時間</label>
              ${timeInputMarkup("overtimeEndTime", item.endTime || "")}
            </div>
          </div>
        </div>
        <div class="form-section">
          <div class="form-row checkbox-row">
            <label class="overtime-use-label">
              <input id="overtimeUseRest1" type="checkbox" ${item.useRest1 ? "checked" : ""}>
              使用休息1
            </label>
          </div>
          <div class="form-grid" id="overtimeRest1Fields" style="${item.useRest1 ? "" : "display:none;"}">
            <div class="form-row">
              <label for="overtimeRest1StartTime">休息1開始</label>
              ${timeInputMarkup("overtimeRest1StartTime", item.rest1StartTime || "", !item.useRest1)}
            </div>
            <div class="form-row">
              <label for="overtimeRest1EndTime">休息1結束</label>
              ${timeInputMarkup("overtimeRest1EndTime", item.rest1EndTime || "", !item.useRest1)}
            </div>
          </div>
        </div>
        <div class="form-section">
          <div class="form-row checkbox-row">
            <label class="overtime-use-label">
              <input id="overtimeUseRest2" type="checkbox" ${item.useRest1 && item.useRest2 ? "checked" : ""} ${item.useRest1 ? "" : "disabled"}>
              使用休息2
            </label>
          </div>
          <div class="form-grid" id="overtimeRest2Fields" style="${item.useRest1 && item.useRest2 ? "" : "display:none;"}">
            <div class="form-row">
              <label for="overtimeRest2StartTime">休息2開始</label>
              ${timeInputMarkup("overtimeRest2StartTime", item.rest2StartTime || "", !(item.useRest1 && item.useRest2))}
            </div>
            <div class="form-row">
              <label for="overtimeRest2EndTime">休息2結束</label>
              ${timeInputMarkup("overtimeRest2EndTime", item.rest2EndTime || "", !(item.useRest1 && item.useRest2))}
            </div>
          </div>
        </div>
      ` : ""}
      <div class="form-row checkbox-row checkbox-row-left">
        <label>
          <input id="${category}HiddenFromToolbar" type="checkbox" ${item.hiddenFromToolbar ? "checked" : ""}>
          不顯示
        </label>
      </div>
    `,
    headerButtons: `<button class="btn-primary" type="button" data-save-named-item="${category}:${mode}">${mode === "edit" ? "儲存修改" : "新增"}</button>`,
    hideFooterClose: true
  });
  if (category === "overtime") {
    syncOvertimeFormUi();
  }
  syncNamedColorUi();
}

function readNamedColorPayloadBase(category, mode) {
  return {
    id: mode === "edit" ? modalContext.targetId : uid(category[0]),
    color: modalColor,
    textColor: modalTextColor,
    autoTextColor: modalTextColorAuto,
    hiddenFromToolbar: Boolean(document.getElementById(`${category}HiddenFromToolbar`)?.checked)
  };
}

async function persistNamedCatalogItem(category, mode, payload, returnTo) {
  const currentList = getItemList(category);
  const nextList = mode === "edit"
    ? currentList.map((item) => item.id === payload.id ? payload : item)
    : [...currentList, payload];
  const sortOrder = mode === "edit" ? currentList.findIndex((item) => item.id === payload.id) : currentList.length;
  try {
    await window.schedulerApi.saveCatalogItem(category, payload, Math.max(0, sortOrder));
  } catch (error) {
    setSaveStatus(`${category === "leave" ? "假別" : "加班"}儲存失敗：${error.message}`);
    return false;
  }
  if (category === "leave") state.leaves = nextList;
  if (category === "overtime") state.overtime = nextList;
  closeModal();
  renderAll();
  await reopenSettingsModalPreservingScroll(returnTo || { category: "list-settings", listCategory: category, scrollTop: 0 });
  return true;
}

async function saveLeaveItem(mode) {
  const returnTo = modalContext.returnTo || null;
  const selectedLeave = LEAVE_CATALOG.find((entry) => entry.code === (document.getElementById("leaveCatalogCode")?.value || ""));
  const name = document.getElementById("leaveCatalogName")?.value.trim() || "";
  if (!name) {
    document.getElementById("leaveCatalogName")?.focus();
    return;
  }
  const payload = {
    ...readNamedColorPayloadBase("leave", mode),
    code: selectedLeave?.code,
    name,
    requiresTime: Boolean(document.getElementById("leaveRequiresTime")?.checked),
    requiresReason: Boolean(document.getElementById("leaveRequiresReason")?.checked)
  };
  await persistNamedCatalogItem("leave", mode, payload, returnTo);
}

async function saveOvertimeItem(mode) {
  const returnTo = modalContext.returnTo || null;
  const name = document.getElementById("namedItemName")?.value.trim() || "";
  if (!name) {
    document.getElementById("namedItemName")?.focus();
    return;
  }
  const startTime = readTimeInputValue("overtimeStartTime");
  const endTime = readTimeInputValue("overtimeEndTime");
  if (!isValidTimeRange(startTime, endTime)) return reportValidationError("上班時間必須早於下班時間");

  const useRest1 = Boolean(document.getElementById("overtimeUseRest1")?.checked);
  const useRest2 = Boolean(document.getElementById("overtimeUseRest2")?.checked) && useRest1;
  const rest1StartTime = useRest1 ? readTimeInputValue("overtimeRest1StartTime") : "";
  const rest1EndTime = useRest1 ? readTimeInputValue("overtimeRest1EndTime") : "";
  const rest2StartTime = useRest2 ? readTimeInputValue("overtimeRest2StartTime") : "";
  const rest2EndTime = useRest2 ? readTimeInputValue("overtimeRest2EndTime") : "";
  if (useRest1 && !isValidTimeRange(rest1StartTime, rest1EndTime)) return reportValidationError("休息1開始時間必須早於結束時間");
  if (useRest2 && !isValidTimeRange(rest2StartTime, rest2EndTime)) return reportValidationError("休息2開始時間必須早於結束時間");

  const payload = {
    ...readNamedColorPayloadBase("overtime", mode),
    name,
    startTime,
    endTime,
    useRest1,
    rest1StartTime,
    rest1EndTime,
    useRest2,
    rest2StartTime,
    rest2EndTime
  };
  await persistNamedCatalogItem("overtime", mode, payload, returnTo);
}

async function saveNamedColorItem(category, mode) {
  if (category === "shift") return saveShiftFromModal(mode);
  if (category === "leave") return saveLeaveItem(mode);
  if (category === "overtime") return saveOvertimeItem(mode);
  throw new Error(`unsupported catalog category: ${category}`);
}

async function deleteListItem(category, id) {
  const labelMap = {
    shift: "班別",
    leave: "假別",
    overtime: "加班"
  };
  const returnTo = captureSettingsReturnContext({
    category: "list-settings",
    listCategory: category
  });
  const confirmed = await confirmAction(`確定要刪除這個${labelMap[category] || "項目"}嗎？`);
  if (!confirmed) {
    return;
  }

  try {
    await window.schedulerApi.deleteCatalogItem(category, id);
  } catch (error) {
    setSaveStatus(`${labelMap[category] || "項目"}刪除失敗：${error.message || error}`);
    return;
  }

  if (category === "shift") {
    state.shifts = state.shifts.map((item) => item.id === id ? { ...item, deleted: true, hiddenFromToolbar: true } : item);
    state.members = state.members.map((member) => member.deleted ? member : ({
      ...member,
      scheduleShiftIds: getMemberScheduleShiftIds(member).filter((shiftId) => shiftId !== id)
    }));
  }
  if (category === "leave") state.leaves = state.leaves.map((item) => item.id === id ? { ...item, deleted: true, hiddenFromToolbar: true } : item);
  if (category === "overtime") state.overtime = state.overtime.map((item) => item.id === id ? { ...item, deleted: true, hiddenFromToolbar: true } : item);
  renderAll();
  await reopenSettingsModalPreservingScroll(returnTo);
}
