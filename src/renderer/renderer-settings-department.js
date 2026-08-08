let departmentAttendanceSettingsUserId = "";

async function ensureDepartmentAttendanceSettingsLoaded() {
  if (!canManagePermissions()) return;
  const userId = currentProfile?.id || "";
  if (userId && departmentAttendanceSettingsUserId === userId) return;
  const settings = await window.schedulerApi.getDepartmentAttendanceSettings();
  const byDepartment = new Map((settings || []).map((row) => [row.departmentId, row]));
  state.departments = state.departments.map((department) => {
    const attendance = byDepartment.get(department.id);
    return attendance ? {
      ...department,
      address: attendance.address || "",
      latitude: attendance.latitude ?? "",
      longitude: attendance.longitude ?? "",
      publicIp: attendance.publicIp || "",
      attendanceEnabled: Boolean(attendance.attendanceEnabled)
    } : department;
  });
  departmentAttendanceSettingsUserId = userId;
}

async function openDepartmentSettings() {
  try {
    await ensureManagerDirectoryLoaded();
    await ensureDepartmentAttendanceSettingsLoaded();
  } catch (error) {
    showInfoMessage(`讀取管理資料失敗：${error.message || error}`);
    return;
  }
  departmentSettingsView = "department";
  modalContext = { category: "department-settings", view: "department" };
  const activeMembers = state.members.filter((member) => !member.deleted && isMemberCurrentlyActive(member));
  const activeDepartments = state.departments.filter((department) => !department.deleted);
  const departmentRows = activeDepartments.map((department) => {
    const homeMembers = activeMembers.filter((member) => getMemberHomeDeptId(member) === department.id);
    const startDate = department.startDate || "-";
    const endDate = department.endDate || "-";
    return `
      <div class="department-settings-row sortable-settings-item" data-sort-category="department" data-sort-item="${escapeHtml(department.id)}" data-drop-department="${escapeHtml(department.id)}">
         ${renderSettingsOrderDragColumn()}
         <div class="department-settings-title">${escapeHtml(department.name)}</div>
        <div class="member-inline-list">
          ${homeMembers.length
            ? homeMembers.map((member) => `
              <div class="member-item draggable-member" draggable="true" data-member-card="${escapeHtml(member.id)}" data-drop-member="${escapeHtml(member.id)}" data-drop-department="${escapeHtml(department.id)}">
                <span>${escapeHtml(member.name)}</span>
              </div>
            `).join("")
            : '<div class="dept-empty-pill">拖曳人員到這裡</div>'
          }
        </div>
        <div class="department-settings-date-stack"><span>${escapeHtml(startDate)}</span><span>${escapeHtml(endDate)}</span></div>
        <div class="department-settings-flag">${department.hiddenFromSchedule ? "是" : "否"}</div>
        <div class="department-settings-flag">${department.attendanceEnabled ? "是" : "否"}</div>
        <div class="member-table-actions">
          ${renderActionIconButton("edit", `data-edit-department="${escapeHtml(department.id)}"`)}
          ${renderActionIconButton("delete", `data-delete-department="${escapeHtml(department.id)}"`)}
        </div>
      </div>
    `;
  }).join("");
  const body = activeDepartments.length
    ? `
      <div class="department-settings-table-wrap">
        <div class="department-settings-table department-settings-table-department">
          <div class="department-settings-row department-settings-head">
             ${renderSettingsOrderDragColumn(true)}
             <div>單位</div>
            <div>所屬人員</div>
            <div>開始日期<br>結束日期</div>
            <div>不顯示</div>
            <div>可否打卡</div>
            <div>操作</div>
          </div>
          ${departmentRows}
        </div>
      </div>
    `
    : '<div class="empty-state">目前還沒有單位</div>';
  openEntityListModal({
    title: "單位設定",
    modalClass: "modal modal-wide department-settings-modal settings-list-modal",
    body,
    headerButtons: `
      <button class="ghost-btn" type="button" data-export-departments="true">匯出</button>
      <button class="ghost-btn" type="button" data-import-departments="true">匯入</button>
      <button class="btn-primary" type="button" data-open-add-department="true">新增</button>
    `,
    hideFooterClose: true
  });
}

function renderDepartmentAttendanceFields(department, disabledAttr) {
  return `
      <div class="settings-form-divider"></div>
      <div class="form-row">
        <label for="departmentAddress">地址</label>
        <input id="departmentAddress" type="text" value="${escapeHtml(department.address || "")}" placeholder="打卡地點地址" ${disabledAttr}>
      </div>
      <div class="form-grid">
        <div class="form-row">
          <label for="departmentLatitude">緯度</label>
          <input id="departmentLatitude" type="number" step="0.000001" min="-90" max="90" value="${escapeHtml(String(department.latitude ?? ""))}" placeholder="例如 25.033964" ${disabledAttr}>
        </div>
        <div class="form-row">
          <label for="departmentLongitude">經度</label>
          <input id="departmentLongitude" type="number" step="0.000001" min="-180" max="180" value="${escapeHtml(String(department.longitude ?? ""))}" placeholder="例如 121.564468" ${disabledAttr}>
        </div>
      </div>
      <div class="form-row">
        <label for="departmentPublicIp">固定對外 IP</label>
        <input id="departmentPublicIp" type="text" value="${escapeHtml(department.publicIp || "")}" placeholder="可用逗號或空白分隔多組 IP" ${disabledAttr}>
      </div>
      <div class="form-row checkbox-row checkbox-row-left">
        <label>
          <input id="departmentAttendanceEnabled" type="checkbox" ${department.attendanceEnabled ? "checked" : ""} ${disabledAttr}>
          是否啟用打卡
        </label>
      </div>
      ${canManagePermissions() ? "" : '<p class="modal-description">打卡地址、座標、固定 IP 與是否啟用打卡只有管理員可以修改。</p>'}
  `;
}

function renderDepartmentFormBody(department, attendanceFieldsDisabled) {
  return `
      <div class="form-row">
        <label for="departmentName">單位名稱</label>
        <input id="departmentName" type="text" maxlength="12" value="${escapeHtml(department.name)}" placeholder="請輸入單位名稱">
      </div>
      <div class="form-grid">
        <div class="form-row">
          <label for="departmentStartDate">開始日期</label>
          <input id="departmentStartDate" type="date" value="${escapeHtml(department.startDate || "")}">
        </div>
        <div class="form-row">
          <label for="departmentEndDate">結束日期</label>
          <input id="departmentEndDate" type="date" value="${escapeHtml(department.endDate || "")}">
        </div>
      </div>
      <div class="form-row checkbox-row checkbox-row-left">
        <label>
          <input id="departmentHiddenFromSchedule" type="checkbox" ${department.hiddenFromSchedule ? "checked" : ""}>
          不顯示於班表
        </label>
      </div>
      ${renderDepartmentAttendanceFields(department, attendanceFieldsDisabled)}
  `;
}

function openDepartmentForm(mode, departmentId = "") {
  const returnTo = modalContext?.category === "department-settings"
    ? captureSettingsReturnContext({ category: "department-settings", view: departmentSettingsView })
    : null;
  const department = mode === "edit"
    ? state.departments.find((item) => item.id === departmentId)
    : { id: "", name: "", startDate: "", endDate: "", hiddenFromSchedule: false, address: "", latitude: "", longitude: "", publicIp: "", attendanceEnabled: false };
  if (!department) {
    return;
  }
  const attendanceFieldsDisabled = canManagePermissions() ? "" : "disabled";
  modalContext = { mode, category: "department", targetId: departmentId, returnTo };
  openEntityListModal({
    title: `${mode === "edit" ? "修改" : "新增"}單位`,
    modalClass: "modal modal-form-compact settings-edit-form",
    body: `
      <div class="form-row">
        <label for="departmentName">單位名稱</label>
        <input id="departmentName" type="text" maxlength="12" value="${escapeHtml(department.name)}" placeholder="請輸入單位名稱">
      </div>
      <div class="form-grid">
        <div class="form-row">
          <label for="departmentStartDate">開始日期</label>
          <input id="departmentStartDate" type="date" value="${escapeHtml(department.startDate || "")}">
        </div>
        <div class="form-row">
          <label for="departmentEndDate">結束日期</label>
          <input id="departmentEndDate" type="date" value="${escapeHtml(department.endDate || "")}">
        </div>
      </div>
      <div class="form-row checkbox-row checkbox-row-left">
        <label>
          <input id="departmentHiddenFromSchedule" type="checkbox" ${department.hiddenFromSchedule ? "checked" : ""}>
          不顯示
        </label>
      </div>
    `,
    headerButtons: `<button class="btn-primary" type="button" data-save-department="${mode}">${mode === "edit" ? "儲存修改" : "新增"}</button>`,
    body: renderDepartmentFormBody(department, attendanceFieldsDisabled),
    hideFooterClose: true
  });
}

async function saveDepartment(mode) {
  const returnTo = modalContext.returnTo || null;
  const name = document.getElementById("departmentName")?.value.trim();
  const startDate = document.getElementById("departmentStartDate")?.value || "";
  const endDate = document.getElementById("departmentEndDate")?.value || "";
  const hiddenFromSchedule = Boolean(document.getElementById("departmentHiddenFromSchedule")?.checked);
  const previousDepartment = mode === "edit"
    ? state.departments.find((department) => department.id === modalContext.targetId) || null
    : null;
  const latitudeInput = document.getElementById("departmentLatitude")?.value.trim() || "";
  const longitudeInput = document.getElementById("departmentLongitude")?.value.trim() || "";
  const latitude = latitudeInput === "" ? "" : Number(latitudeInput);
  const longitude = longitudeInput === "" ? "" : Number(longitudeInput);
  if (!name) {
    document.getElementById("departmentName")?.focus();
    return;
  }
  if (startDate && endDate && !isValidDateRange(startDate, endDate)) {
    reportValidationError("開始日期必須早於結束日期");
    return;
  }
  if (canManagePermissions() && latitude !== "" && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) {
    reportValidationError("緯度必須介於 -90 到 90");
    return;
  }
  if (canManagePermissions() && longitude !== "" && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) {
    reportValidationError("經度必須介於 -180 到 180");
    return;
  }
  const attendancePayload = canManagePermissions()
    ? {
      address: document.getElementById("departmentAddress")?.value.trim() || "",
      latitude,
      longitude,
      publicIp: document.getElementById("departmentPublicIp")?.value.trim() || "",
      attendanceEnabled: Boolean(document.getElementById("departmentAttendanceEnabled")?.checked)
    }
    : {
      address: previousDepartment?.address || "",
      latitude: previousDepartment?.latitude ?? "",
      longitude: previousDepartment?.longitude ?? "",
      publicIp: previousDepartment?.publicIp || "",
      attendanceEnabled: Boolean(previousDepartment?.attendanceEnabled)
    };
  const payload = { id: mode === "edit" ? modalContext.targetId : uid("d"), name, startDate, endDate, hiddenFromSchedule, ...attendancePayload };
  const sortOrder = mode === "edit"
    ? state.departments.findIndex((department) => department.id === payload.id)
    : state.departments.length;
  try {
    await window.schedulerApi.saveDepartmentItem(payload, Math.max(0, sortOrder));
  } catch (error) {
    const message = formatSchedulerError(error, "單位儲存失敗");
    setSaveStatus(`單位儲存失敗：${message}`);
    showInfoMessage(`單位儲存失敗：${message}`);
    return;
  }
  if (mode === "edit") {
    state.departments = state.departments.map((department) => department.id === modalContext.targetId ? payload : department);
  } else {
    state.departments.push(payload);
  }
  closeModal();
  renderAll();
  await reopenSettingsModalPreservingScroll(returnTo || { category: "department-settings", view: departmentSettingsView, scrollTop: 0 });
}

function removeScheduleByMember(memberId) {
  Object.keys(state.schedule).forEach((key) => {
    if (key.startsWith(`${memberId}_`)) {
      delete state.schedule[key];
    }
  });
}

async function deleteDepartment(departmentId) {
  const memberIds = state.members.filter((member) => !member.deleted && getMemberHomeDeptId(member) === departmentId).map((member) => member.id);
  if (memberIds.length) {
    showInfoMessage("這個單位還有人員，請先將人員移轉到其他單位後再刪除。");
    return;
  }
  const usedShifts = state.shifts.filter((shift) => !shift.deleted && shift.applicableDeptId === departmentId);
  if (usedShifts.length) {
    showInfoMessage(`這個單位仍有班別使用，請先修改有使用的班別：${usedShifts.map((shift) => shift.name).join("、")}`);
    return;
  }
  const returnTo = captureSettingsReturnContext({ category: "department-settings", view: departmentSettingsView });
  const confirmed = await confirmAction("確定要刪除這個單位嗎？");
  if (!confirmed) {
    return;
  }
  try {
    await window.schedulerApi.deleteDepartmentItem(departmentId);
  } catch (error) {
    showInfoMessage(formatSchedulerError(error, "單位刪除失敗"));
    return;
  }
  state.departments = state.departments.map((department) => department.id === departmentId
    ? { ...department, deleted: true }
    : department);
  if (state.deptFilter === departmentId) {
    state.deptFilter = "all";
  }
  if (state.tableDeptScopeFilter === departmentId) {
    state.tableDeptScopeFilter = "all";
  }
  renderAll();
  await reopenSettingsModalPreservingScroll(returnTo);
}

async function moveMemberToDepartment(memberId, departmentId, targetMemberId = "") {
  const member = state.members.find((item) => item.id === memberId);
  if (!member || targetMemberId === memberId) {
    return;
  }
  const returnTo = captureSettingsReturnContext({ category: "department-settings", view: departmentSettingsView });
  const remaining = state.members.filter((item) => item.id !== memberId);
  const targetDeptId = targetMemberId
    ? (getMemberHomeDeptId(remaining.find((item) => item.id === targetMemberId)) || departmentId)
    : departmentId;
  const grouped = new Map(state.departments.map((department) => [department.id, []]));
  remaining.forEach((item) => {
    const homeDeptId = getMemberHomeDeptId(item);
    if (grouped.has(homeDeptId)) {
      grouped.get(homeDeptId).push(item);
    }
  });
  if (!grouped.has(targetDeptId)) {
    return;
  }
  const movedMember = { ...member, deptId: targetDeptId };
  const targetList = grouped.get(targetDeptId);
  const targetIndex = targetMemberId ? targetList.findIndex((item) => item.id === targetMemberId) : -1;
  if (targetIndex >= 0) {
    targetList.splice(targetIndex, 0, movedMember);
  } else {
    targetList.push(movedMember);
  }
  state.members = state.departments.flatMap((department) => grouped.get(department.id) || []);
  renderAll();
  await reopenSettingsModalPreservingScroll(returnTo);
  queueSave();
}

function moveDragPreviewElement(draggedElement, targetElement, clientY) {
  if (!(draggedElement instanceof HTMLElement) || !(targetElement instanceof HTMLElement) || draggedElement === targetElement) {
    return false;
  }
  const parent = targetElement.parentElement;
  if (!parent || draggedElement.parentElement !== parent) {
    return false;
  }
  const targetRect = targetElement.getBoundingClientRect();
  const insertAfter = clientY > targetRect.top + targetRect.height / 2;
  const referenceNode = insertAfter ? targetElement.nextElementSibling : targetElement;
  if (referenceNode === draggedElement || draggedElement.nextElementSibling === referenceNode) {
    return true;
  }
  parent.insertBefore(draggedElement, referenceNode);
  dragPreviewElement = draggedElement;
  return true;
}

function cssEscapeValue(value) {
  return window.CSS?.escape ? CSS.escape(String(value)) : String(value).replace(/["\\]/g, "\\$&");
}

function clearDragPreviewState() {
  if (dragPreviewElement instanceof HTMLElement) {
    dragPreviewElement.classList.remove("drag-preview-active");
    dragPreviewElement.classList.remove("schedule-order-insert-before");
    dragPreviewElement.classList.remove("schedule-order-insert-after");
  }
  document.querySelectorAll(".drag-preview-active, .schedule-order-insert-before, .schedule-order-insert-after").forEach((element) => {
    element.classList.remove("drag-preview-active");
    element.classList.remove("schedule-order-insert-before");
    element.classList.remove("schedule-order-insert-after");
  });
  dragPreviewElement = null;
}

function markDragPreviewTarget(element, insertAfter = null) {
  if (!(element instanceof HTMLElement)) {
    return;
  }
  if (dragPreviewElement !== element) {
    clearDragPreviewState();
    dragPreviewElement = element;
  }
  element.classList.add("drag-preview-active");
  if (insertAfter !== null) {
    element.classList.toggle("schedule-order-insert-before", !insertAfter);
    element.classList.toggle("schedule-order-insert-after", insertAfter);
  }
}

function markScheduleTableOrderTarget(element, clientY) {
  if (!(element instanceof HTMLElement)) {
    return false;
  }
  const rect = element.getBoundingClientRect();
  const insertAfter = clientY > rect.top + rect.height / 2;
  markDragPreviewTarget(element, insertAfter);
  return insertAfter;
}

function getScheduleTableOrderInsertAfter(element, clientY) {
  if (!(element instanceof HTMLElement)) {
    return false;
  }
  if (element.classList.contains("schedule-order-insert-after")) {
    return true;
  }
  if (element.classList.contains("schedule-order-insert-before")) {
    return false;
  }
  return markScheduleTableOrderTarget(element, clientY);
}

function previewSortableSettingsItem(targetElement, clientY) {
  const draggedElement = document.querySelector(`[data-sort-item="${cssEscapeValue(dragSortItemId)}"][data-sort-category="${cssEscapeValue(dragSortCategory)}"]`);
  if (!(draggedElement instanceof HTMLElement)) {
    return false;
  }
  draggedElement.classList.add("drag-preview-active");
  return moveDragPreviewElement(draggedElement, targetElement, clientY);
}

function previewScheduleShiftOption(targetElement, clientY) {
  const draggedElement = document.querySelector(`[data-schedule-shift-option="${cssEscapeValue(dragScheduleShiftId)}"]`);
  if (!(draggedElement instanceof HTMLElement)) {
    return false;
  }
  draggedElement.classList.add("drag-preview-active");
  if (!moveDragPreviewElement(draggedElement, targetElement, clientY)) {
    return false;
  }
  syncScheduleShiftSelectorRanks();
  syncScheduleShiftSummary();
  return true;
}

function previewDepartmentMember(targetElement, clientY) {
  const draggedElement = document.querySelector(`[data-member-card="${cssEscapeValue(dragMemberId)}"]`);
  if (!(draggedElement instanceof HTMLElement)) {
    return false;
  }
  draggedElement.classList.add("drag-preview-active");
  return moveDragPreviewElement(draggedElement, targetElement, clientY);
}
