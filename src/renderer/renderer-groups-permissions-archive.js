/* 群組、角色權限與班表封存。
 * 權限狀態由 canonical schedulerApi 載入；本模組只負責領域狀態與介面。
 */

const COMMON_PERMISSION_LABELS = {
  settings: "設定",
  export: "匯出",
  leave_settings: "假別設定"
};

const GROUP_PERMISSION_LABELS = {
  schedule_view: "班表查看",
  schedule_manage: "班表管理",
  department_settings: "單位設定",
  attendance_review: "簽到審核",
  meal_admin: "訂餐管理"
};

const groupFeatureState = {
  bundle: { actor: {}, groups: [], roles: [] },
  archiveRanges: [],
  currentGroupId: "",
  catalog: { departments: [], members: [], shifts: [], schedule: {} },
  initialized: false,
  dragGroupId: "",
  dragRoleId: "",
  dragRoleStartOrder: []
};

async function loadGroupAccessData(payload = {}) {
  groupFeatureState.bundle = payload.accessBundle && typeof payload.accessBundle === "object"
    ? payload.accessBundle
    : await window.schedulerApi.getGroupAccessBundle();
  groupFeatureState.archiveRanges = Array.isArray(payload.archiveRanges)
    ? payload.archiveRanges
    : await window.schedulerApi.getScheduleArchiveRanges();
  return { bundle: groupFeatureState.bundle, archiveRanges: groupFeatureState.archiveRanges };
}


function getAccessActor() { return groupFeatureState.bundle?.actor || {}; }
function getCommonPermissions() { return Array.isArray(getAccessActor().commonPermissions) ? getAccessActor().commonPermissions : []; }
function hasCommonPermission(permission) { return getCommonPermissions().includes(permission); }
function getActorGroupPermissions(groupId) {
  const map = getAccessActor().groupPermissions;
  return map && typeof map === "object" && Array.isArray(map[groupId]) ? map[groupId] : [];
}
function hasGroupPermission(groupId, permission) { return Boolean(groupId && getActorGroupPermissions(groupId).includes(permission)); }
function hasAnyGroupPermission(permission) {
  const map = getAccessActor().groupPermissions;
  return Boolean(map && typeof map === "object" && Object.values(map).some((permissions) => Array.isArray(permissions) && permissions.includes(permission)));
}
function getAllGroups() { return Array.isArray(groupFeatureState.bundle?.groups) ? groupFeatureState.bundle.groups : []; }
function getSelectableGroups() { return getAllGroups().filter((group) => group.status === "active" && hasGroupPermission(group.id, "schedule_view")); }
function getCurrentGroup() { return getAllGroups().find((group) => group.id === groupFeatureState.currentGroupId) || null; }
function getActorGroup() { return getAllGroups().find((group) => group.id === getAccessActor().groupId) || null; }
function getAllRoles() { return Array.isArray(groupFeatureState.bundle?.roles) ? groupFeatureState.bundle.roles : []; }
function getRoleById(roleId) { return getAllRoles().find((role) => role.id === roleId) || null; }
function getRoleGroupPermissions(role, groupId) {
  const rows = Array.isArray(role?.groupPermissions) ? role.groupPermissions : [];
  return rows.find((row) => row.groupId === groupId)?.permissions || [];
}
function getDefaultAccessRoleId() {
  const currentGroupId = groupFeatureState.currentGroupId;
  return getAllRoles().find((role) => {
    const common = Array.isArray(role.commonPermissions) ? role.commonPermissions : [];
    const groupPermissions = getRoleGroupPermissions(role, currentGroupId);
    return common.length === 0 && groupPermissions.length === 1 && groupPermissions[0] === "schedule_view";
  })?.id || getAllRoles()[0]?.id || "";
}

function chooseCurrentGroupId() {
  const selectable = getSelectableGroups();
  if (!selectable.length) return "";
  const stored = localStorage.getItem("fyh.schedule.groupId") || "";
  if (selectable.some((group) => group.id === stored)) return stored;
  const actorGroupId = getAccessActor().groupId || "";
  if (selectable.some((group) => group.id === actorGroupId)) return actorGroupId;
  return selectable[0].id;
}

function appendDeletedLabel(value, deleted) {
  const text = String(value || "");
  if (!deleted || text.endsWith("（已刪除）")) return text;
  return `${text}（已刪除）`;
}

function enrichNormalizedState(normalized) {
  normalized.departments = (normalized.departments || []).map((department) => ({
    ...department,
    name: appendDeletedLabel(department.name, department.deleted)
  }));
  normalized.members = (normalized.members || []).map((member) => ({
    ...member,
    name: appendDeletedLabel(member.name, member.deleted)
  }));
  normalized.shifts = (normalized.shifts || []).map((shift) => ({
    ...shift,
    name: appendDeletedLabel(shift.name, shift.deleted),
    hiddenFromToolbar: Boolean(shift.deleted || shift.hiddenFromToolbar)
  }));
  normalized.leaves = (normalized.leaves || []).map((leave) => ({
    ...leave,
    name: appendDeletedLabel(leave.name, leave.deleted),
    hiddenFromToolbar: Boolean(leave.deleted || leave.hiddenFromToolbar)
  }));
  normalized.overtime = (normalized.overtime || []).map((overtime) => ({
    ...overtime,
    name: appendDeletedLabel(overtime.name, overtime.deleted),
    hiddenFromToolbar: Boolean(overtime.deleted || overtime.hiddenFromToolbar)
  }));
  normalized.groups = getAllGroups();
  normalized.accessRoles = getAllRoles();
  normalized.access = getAccessActor();
  return normalized;
}

function scheduleKeyMemberId(key) {
  if (typeof parseScheduleKeyParts === "function") return parseScheduleKeyParts(key)?.memberId || "";
  const parts = String(key || "").split("_");
  if (parts.length < 4) return "";
  parts.splice(-3);
  return parts.join("_");
}

function snapshotCanonicalState(normalized) {
  groupFeatureState.catalog.departments = deepClone(normalized.departments || []);
  groupFeatureState.catalog.members = deepClone(normalized.members || []);
  groupFeatureState.catalog.shifts = deepClone(normalized.shifts || []);
  groupFeatureState.catalog.schedule = deepClone(normalized.schedule || {});
}

function currentGroupMemberIds() {
  return new Set(groupFeatureState.catalog.members.filter((member) => member.groupId === groupFeatureState.currentGroupId).map((member) => member.id));
}

function syncCurrentScopeIntoCatalog() {
  const groupId = groupFeatureState.currentGroupId;
  if (!groupId || !state || typeof state !== "object") return;
  groupFeatureState.catalog.departments = [
    ...groupFeatureState.catalog.departments.filter((item) => item.groupId !== groupId),
    ...(state.departments || []).map((item) => ({ ...deepClone(item), groupId }))
  ];
  groupFeatureState.catalog.members = [
    ...groupFeatureState.catalog.members.filter((item) => item.groupId !== groupId),
    ...(state.members || []).map((item) => ({ ...deepClone(item), groupId: item.groupId || groupId }))
  ];
  groupFeatureState.catalog.shifts = [
    ...groupFeatureState.catalog.shifts.filter((item) => item.groupId !== groupId),
    ...(state.shifts || []).map((item) => ({ ...deepClone(item), groupId: item.groupId || groupId }))
  ];
  const memberIds = currentGroupMemberIds();
  const nextSchedule = {};
  Object.entries(groupFeatureState.catalog.schedule || {}).forEach(([key, slot]) => {
    if (!memberIds.has(scheduleKeyMemberId(key))) nextSchedule[key] = slot;
  });
  Object.entries(state.schedule || {}).forEach(([key, slot]) => { nextSchedule[key] = deepClone(slot); });
  groupFeatureState.catalog.schedule = nextSchedule;
}

function applyCurrentGroupScope(targetState = state) {
  const groupId = groupFeatureState.currentGroupId;
  const departments = groupFeatureState.catalog.departments.filter((item) => item.groupId === groupId);
  const members = groupFeatureState.catalog.members.filter((item) => item.groupId === groupId);
  const shifts = groupFeatureState.catalog.shifts.filter((item) => item.groupId === groupId);
  const memberIds = new Set(members.map((member) => member.id));
  const schedule = {};
  Object.entries(groupFeatureState.catalog.schedule || {}).forEach(([key, slot]) => {
    if (memberIds.has(scheduleKeyMemberId(key))) schedule[key] = deepClone(slot);
  });
  targetState.departments = deepClone(departments);
  targetState.members = deepClone(members);
  targetState.shifts = deepClone(shifts);
  targetState.schedule = schedule;
  targetState.groups = getAllGroups();
  targetState.accessRoles = getAllRoles();
  targetState.access = getAccessActor();
  targetState.currentGroupId = groupId;
  if (!targetState.departments.some((department) => department.id === targetState.deptFilter)) targetState.deptFilter = "all";
  if (!targetState.departments.some((department) => department.id === targetState.tableDeptScopeFilter)) targetState.tableDeptScopeFilter = "all";
  return targetState;
}

function resetGroupInteractionState() {
  state.selected = { type: null, id: null };
  state.deptFilter = "all";
  state.tableDeptScopeFilter = "all";
  scheduleUndoStack = [];
  scheduleRedoStack = [];
  scheduleClipboard = null;
  autoSchedulePreview = null;
  clearScheduleRangeSelection?.();
  syncScheduleHistoryButtons?.();
}

async function switchScheduleGroup(groupId) {
  if (!hasGroupPermission(groupId, "schedule_view")) return;
  const group = getAllGroups().find((item) => item.id === groupId && item.status === "active");
  if (!group) return;
  syncCurrentScopeIntoCatalog();
  groupFeatureState.currentGroupId = groupId;
  localStorage.setItem("fyh.schedule.groupId", groupId);
  applyCurrentGroupScope(state);
  resetGroupInteractionState();
  currentMember = resolveCurrentMember();
  renderAll();
}

async function reloadGroupApplicationState() {
  const previousGroupId = groupFeatureState.currentGroupId;
  const payload = await window.schedulerApi.loadState();
  await loadGroupAccessData(payload);
  state = initializeGroupPermissionState(payload);
  if (previousGroupId && getSelectableGroups().some((group) => group.id === previousGroupId)) {
    groupFeatureState.currentGroupId = previousGroupId;
    applyCurrentGroupScope(state);
  }
  currentMember = resolveCurrentMember();
  scheduleApplicationLoaded = true;
  managerDirectoryLoaded = false;
  managerDirectoryLoading = null;
  renderAll();
}

function isArchivedDate(dateString, groupId = groupFeatureState.currentGroupId) {
  return (groupFeatureState.archiveRanges || []).some((range) => range.groupId === groupId && dateString >= range.startDate && dateString <= range.endDate);
}

function isDeletedScheduleMember(memberId) {
  return Boolean((state.members || []).find((member) => member.id === memberId)?.deleted);
}

function markArchivedScheduleCells() {
  document.querySelectorAll("#mainTable .cell[data-date]").forEach((cell) => {
    const archived = isArchivedDate(cell.dataset.date || "");
    cell.classList.toggle("archived-schedule-cell", archived);
    if (archived) {
      cell.dataset.readonly = "true";
      cell.title = "此期間班表已封存";
    }
  });
  const dates = typeof getVisibleDates === "function" ? getVisibleDates() : [];
  const archivedVisible = dates.some((date) => isArchivedDate(date));
  const card = document.getElementById("scheduleCard");
  let banner = document.getElementById("scheduleArchiveBanner");
  if (!archivedVisible) { banner?.remove(); return; }
  if (!banner && card) {
    banner = document.createElement("div");
    banner.id = "scheduleArchiveBanner";
    banner.className = "schedule-archive-banner";
    const nav = card.querySelector(".calendar-nav");
    nav?.insertAdjacentElement("afterend", banner);
  }
  if (banner) banner.textContent = "顯示範圍包含已封存班表；封存日期不可變動。";
}

function ensureGroupSelector() {
  const tableViewSelect = document.getElementById("tableViewSelect");
  if (!tableViewSelect) return;
  let selector = document.getElementById("scheduleGroupSelect");
  if (!selector) {
    selector = document.createElement("select");
    selector.id = "scheduleGroupSelect";
    selector.setAttribute("aria-label", "群組");
    tableViewSelect.insertAdjacentElement("beforebegin", selector);
  }
  const options = getSelectableGroups();
  selector.innerHTML = options.map((group) => `<option value="${escapeHtml(group.id)}" ${group.id === groupFeatureState.currentGroupId ? "selected" : ""}>${escapeHtml(group.name)}</option>`).join("");
  selector.hidden = options.length === 0;
  selector.disabled = options.length <= 1;
}

function getFunctionMenuSections() {
  const groupId = groupFeatureState.currentGroupId;
  const sections = [];
  if (hasCommonPermission("settings")) {
    sections.push({
      id: "settings",
      label: "設定",
      items: [
        { id: "permissionSettingsMenuButton", label: "權限設定", groupAction: "permission-settings" },
        { id: "groupSettingsMenuButton", label: "群組設定", groupAction: "group-settings" },
        { id: "weekStartSettingsButton", label: "週期設定", action: "week-start-settings" },
        { id: "scheduleArchiveMenuButton", label: "班表封存", groupAction: "schedule-archive" }
      ]
    });
  }
  if (hasGroupPermission(groupId, "schedule_manage")) {
    sections.push({
      id: "schedule",
      label: "排班",
      items: [
        { id: "scheduleConditionsMenuButton", label: "排班條件", groupAction: "schedule-conditions" },
        { id: "autoSchedulePreviewButton", label: "自動排班預覽", action: "auto-schedule-preview" },
        { id: "autoFillSchedulePreviewButton", label: "自動補班預覽", action: "auto-fill-schedule-preview" },
        { id: "autoScheduleApplyButton", label: "套用預覽", action: "auto-schedule-apply" },
        { id: "autoScheduleCancelButton", label: "取消預覽", action: "auto-schedule-cancel" }
      ]
    });
  }
  if (hasCommonPermission("export")) {
    sections.push({
      id: "export",
      label: "匯出",
      items: [
        { id: "exportScheduleButton", label: "匯出上班日", action: "export-workday" },
        { id: "exportSapButton", label: "匯出休例假", action: "export-sap" },
        { id: "exportLeaveButton", label: "匯出請假", action: "export-leave" },
        { id: "exportOvertimeButton", label: "匯出加班", action: "export-overtime" }
      ]
    });
  }
  return sections;
}

function hasFunctionMenuAccess() {
  return getFunctionMenuSections().length > 0;
}

function renderFunctionMenu() {
  const menu = document.getElementById("coreActionsMenu");
  if (!menu) return;
  menu.innerHTML = getFunctionMenuSections().map((section) => `
    <div class="core-actions-menu-category" role="none" data-function-menu-section="${section.id}">
      <div class="core-actions-menu-trigger" tabindex="0" role="menuitem" aria-haspopup="menu" aria-expanded="false">
        <span>${section.label}</span><span class="core-actions-menu-arrow" aria-hidden="true">‹</span>
      </div>
      <div class="core-actions-submenu" role="menu" aria-label="${section.label}">
        ${section.items.map((item) => `<button class="ghost-btn ops-btn${item.groupAction ? " group-feature-action" : ""}" id="${item.id}" type="button"${item.groupAction ? ` data-group-feature-action="${item.groupAction}"` : ` data-function-menu-action="${item.action}"`}>${item.label}</button>`).join("")}
      </div>
    </div>
  `).join("");
}

function renderToolbarPermissionControls() {
  const groupId = groupFeatureState.currentGroupId;
  const visibility = {
    shiftSettingsButton: hasGroupPermission(groupId, "schedule_manage"),
    restComplianceButton: hasGroupPermission(groupId, "schedule_manage"),
    deptSettingsButton: hasGroupPermission(groupId, "department_settings"),
    leaveSettingsButton: hasCommonPermission("leave_settings"),
    overtimeSettingsButton: false
  };
  Object.entries(visibility).forEach(([id, visible]) => {
    const element = document.getElementById(id);
    if (!element) return;
    element.hidden = !visible;
    element.disabled = !visible;
  });
}

function syncPermissionUi() {
  ensureGroupSelector();
  markArchivedScheduleCells();
  renderFunctionMenu();
  renderToolbarPermissionControls();
}

function groupUnitNames(group) { return Array.isArray(group?.unitNames) && group.unitNames.length ? group.unitNames.join("、") : "-"; }
function renderGroupUnitTags(group) {
  const unitNames = Array.isArray(group?.unitNames) ? group.unitNames.filter(Boolean) : [];
  if (!unitNames.length) return '<span class="group-unit-empty">-</span>';
  return `<div class="group-unit-tags">${unitNames.map((name) => `<span class="group-unit-tag">${escapeHtml(name)}</span>`).join("")}</div>`;
}
function actionIcon(name) {
  const paths = name === "edit"
    ? '<path d="M4 20h4l10-10a2 2 0 0 0-4-4L4 16v4z"></path><path d="M13.5 6.5l4 4"></path>'
    : '<path d="M4 7h16"></path><path d="M9 7V4h6v3"></path><path d="M7 7l1 13h8l1-13"></path>';
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
}

function renderGroupSettingsRows() {
  return getAllGroups().map((group) => `
    <tr class="group-settings-row" draggable="true" data-group-row="${escapeHtml(group.id)}">
      <td class="group-drag-col"><span class="group-drag-handle" title="拖曳排序">≡</span></td>
      <td class="group-code-col">${escapeHtml(group.code || "")}</td><td class="group-name-col">${escapeHtml(group.name || "")}</td>
      <td class="group-units-cell" title="${escapeHtml(groupUnitNames(group))}">${renderGroupUnitTags(group)}</td>
      <td class="group-meal-col"><input type="checkbox" ${group.mealEnabled ? "checked" : ""} disabled aria-label="可否訂餐"></td>
      <td class="group-status-col"><span class="group-status ${group.status === "active" ? "is-active" : "is-inactive"}">${group.status === "active" ? "啟用" : "停用"}</span></td>
      <td class="group-actions-cell group-actions-col"><button class="settings-icon-btn" type="button" data-edit-schedule-group="${escapeHtml(group.id)}" aria-label="編輯" title="編輯">${actionIcon("edit")}</button><button class="ghost-btn compact-btn" type="button" data-toggle-schedule-group="${escapeHtml(group.id)}">${group.status === "active" ? "停用" : "啟用"}</button><button class="settings-icon-btn settings-icon-btn-danger" type="button" data-delete-schedule-group="${escapeHtml(group.id)}" aria-label="刪除" title="刪除">${actionIcon("delete")}</button></td>
    </tr>`).join("");
}

function openGroupSettings() {
  if (!hasCommonPermission("settings")) return;
  modalContext = { category: "group-settings" };
  openEntityListModal({
    title: "群組設定",
    modalClass: "modal modal-wide group-settings-modal settings-list-modal",
    body: `<div class="records-table-wrap"><table class="records-table group-settings-table"><thead><tr><th class="group-drag-col"></th><th class="group-code-col">群組代碼</th><th class="group-name-col">群組名稱</th><th class="group-units-col">單位</th><th class="group-meal-col">可否訂餐</th><th class="group-status-col">狀態</th><th class="group-actions-col">操作</th></tr></thead><tbody id="groupSettingsRows">${renderGroupSettingsRows()}</tbody></table></div>`,
    headerButtons: '<button class="btn-primary" type="button" data-add-schedule-group="true">新增</button>',
    hideFooterClose: true
  });
}

function openGroupForm(groupId = "") {
  const group = getAllGroups().find((item) => item.id === groupId) || { id: "", code: "", name: "", nameVi: "", mealEnabled: false, status: "active", sortOrder: getAllGroups().length };
  modalContext = { category: "group-form", targetId: group.id || "" };
  openEntityListModal({
    title: group.id ? "修改群組" : "新增群組",
    modalClass: "modal modal-form-compact",
    body: `<div class="form-grid two-col"><div class="form-row"><label for="groupCode">群組代碼</label><input id="groupCode" type="text" maxlength="30" value="${escapeHtml(group.code)}"></div><div class="form-row"><label for="groupName">群組名稱</label><input id="groupName" type="text" maxlength="30" value="${escapeHtml(group.name)}"></div><div class="form-row"><label for="groupNameVi">越文名稱</label><input id="groupNameVi" type="text" maxlength="60" value="${escapeHtml(group.nameVi || "")}" placeholder="可留空；越文模式會顯示中文"></div><div class="form-row"><label class="checkbox-row"><input id="groupMealEnabled" type="checkbox" ${group.mealEnabled ? "checked" : ""}>可否訂餐</label></div><div class="form-row"><label for="groupStatus">狀態</label><select id="groupStatus"><option value="active" ${group.status === "active" ? "selected" : ""}>啟用</option><option value="inactive" ${group.status === "inactive" ? "selected" : ""}>停用</option></select></div></div>`,
    headerButtons: `<button class="btn-primary" type="button" data-save-schedule-group="true">${group.id ? "儲存修改" : "新增"}</button>`,
    hideFooterClose: true
  });
}

async function saveScheduleGroupFromForm() {
  const code = document.getElementById("groupCode")?.value.trim() || "";
  const name = document.getElementById("groupName")?.value.trim() || "";
  const nameVi = document.getElementById("groupNameVi")?.value.trim() || "";
  if (!code || !name) { reportValidationError("請填寫群組代碼與群組名稱"); return; }
  const existing = getAllGroups().find((item) => item.id === modalContext.targetId) || null;
  await window.schedulerApi.saveScheduleGroup({ id: existing?.id || "", code, name, nameVi, mealEnabled: Boolean(document.getElementById("groupMealEnabled")?.checked), status: document.getElementById("groupStatus")?.value || "active", sortOrder: existing?.sortOrder ?? getAllGroups().length });
  await reloadGroupApplicationState();
  openGroupSettings();
}

async function toggleScheduleGroup(groupId) {
  const group = getAllGroups().find((item) => item.id === groupId);
  if (!group) return;
  await window.schedulerApi.saveScheduleGroup({ id: group.id, code: group.code, name: group.name, mealEnabled: group.mealEnabled, status: group.status === "active" ? "inactive" : "active", sortOrder: group.sortOrder });
  await reloadGroupApplicationState();
  openGroupSettings();
}

async function deleteScheduleGroup(groupId) {
  const group = getAllGroups().find((item) => item.id === groupId);
  if (!group) return;
  const typed = window.prompt(`刪除「${group.name}」後，未封存班表、群組內單位、班別及目前歸屬設定將一併刪除。已封存班表保留。\n\n請輸入「${group.name}」確認刪除：`) || "";
  if (typed !== group.name) return;
  await window.schedulerApi.deleteScheduleGroup(group.id, typed);
  localStorage.removeItem("fyh.schedule.groupId");
  await reloadGroupApplicationState();
  openGroupSettings();
}

async function saveGroupOrder() {
  const ids = Array.from(document.querySelectorAll("#groupSettingsRows [data-group-row]")).map((row) => row.dataset.groupRow || "").filter(Boolean);
  await window.schedulerApi.reorderScheduleGroups(ids);
  await loadGroupAccessData();
}

function getPermissionRoleOrderFromDom() {
  return Array.from(document.querySelectorAll("#permissionSettingsRows [data-permission-role-id]"))
    .map((row) => row.dataset.permissionRoleId || "")
    .filter(Boolean);
}

function previewPermissionRoleOrder(targetRow, clientY) {
  const dragging = document.querySelector(`[data-permission-role-id="${groupFeatureState.dragRoleId}"]`);
  if (!dragging || dragging === targetRow) return;
  const rect = targetRow.getBoundingClientRect();
  targetRow.parentElement?.insertBefore(dragging, clientY < rect.top + rect.height / 2 ? targetRow : targetRow.nextSibling);
}

async function savePermissionRoleOrder() {
  const orderedIds = getPermissionRoleOrderFromDom();
  if (!orderedIds.length || orderedIds.join("|") === groupFeatureState.dragRoleStartOrder.join("|")) return;
  const roleMap = new Map(getAllRoles().map((role) => [role.id, role]));
  groupFeatureState.bundle.roles = orderedIds.map((id, index) => ({ ...roleMap.get(id), sortOrder: index })).filter((role) => role.id);
  if (state && typeof state === "object") state.accessRoles = getAllRoles();
  setSaveStatus("角色排序儲存中...", true);
  try {
    await window.schedulerApi.reorderAccessRoles(orderedIds);
    await loadGroupAccessData();
    if (state && typeof state === "object") state.accessRoles = getAllRoles();
    setSaveStatus("角色排序已儲存");
  } catch (error) {
    setSaveStatus(`角色排序儲存失敗：${error.message || error}`);
    await reloadGroupApplicationState();
    openPermissionSettings();
  }
}

function permissionTagList(labels) {
  if (!labels.length) return '<span class="group-unit-empty">-</span>';
  return `<div class="permission-summary-tags">${labels.map((label) => `<span class="group-unit-tag permission-summary-tag">${escapeHtml(label)}</span>`).join("")}</div>`;
}
function renderCommonPermissionSummary(role) {
  return permissionTagList((role.commonPermissions || []).map((permission) => COMMON_PERMISSION_LABELS[permission]).filter(Boolean));
}
function renderGroupPermissionSummary(role) {
  const rows = getAllGroups().map((group) => {
    const labels = getRoleGroupPermissions(role, group.id).map((permission) => GROUP_PERMISSION_LABELS[permission]).filter(Boolean);
    if (!labels.length) return "";
    return `<div class="permission-group-summary-row"><strong>${escapeHtml(getLocalizedName(group))}</strong>${permissionTagList(labels)}</div>`;
  }).filter(Boolean);
  return rows.join("") || '<span class="group-unit-empty">-</span>';
}

function openPermissionSettings() {
  if (!hasCommonPermission("settings")) return;
  modalContext = { category: "permission-settings" };
  openEntityListModal({
    title: "權限設定",
    modalClass: "modal modal-wide permission-settings-modal settings-list-modal",
    body: `<div class="records-table-wrap"><table class="records-table permission-settings-table"><thead><tr><th class="permission-role-drag-col"></th><th class="permission-role-col">角色名稱</th><th>共用權限</th><th class="permission-items-col">群組權限</th><th class="permission-actions-col">操作</th></tr></thead><tbody id="permissionSettingsRows">${getAllRoles().map((role) => `<tr data-permission-role-id="${escapeHtml(role.id)}"><td class="permission-role-drag-col"><span class="settings-order-drag-handle" draggable="true" data-permission-role-drag-handle="${escapeHtml(role.id)}" title="拖曳排序" aria-label="拖曳排序">≡</span></td><td class="permission-role-col">${escapeHtml(getLocalizedName(role))}</td><td>${renderCommonPermissionSummary(role)}</td><td class="permission-summary-cell permission-items-col">${renderGroupPermissionSummary(role)}</td><td class="permission-actions-col"><button class="settings-icon-btn" type="button" data-edit-access-role="${escapeHtml(role.id)}" aria-label="編輯" title="編輯">${actionIcon("edit")}</button><button class="settings-icon-btn settings-icon-btn-danger" type="button" data-delete-access-role="${escapeHtml(role.id)}" aria-label="刪除" title="刪除">${actionIcon("delete")}</button></td></tr>`).join("")}</tbody></table></div>`,
    headerButtons: '<button class="btn-primary" type="button" data-add-access-role="true">新增</button>',
    hideFooterClose: true
  });
}

function accessPermissionCheckbox(attributeText, permission, label, checked) {
  return `<label class="permission-check"><input type="checkbox" ${attributeText}="${permission}" ${checked ? "checked" : ""}>${escapeHtml(label)}</label>`;
}

function openAccessRoleForm(roleId = "") {
  const role = getAllRoles().find((item) => item.id === roleId) || { id: "", code: "", name: "", nameVi: "", commonPermissions: [], groupPermissions: [] };
  const common = new Set(role.commonPermissions || []);
  modalContext = { category: "access-role-form", targetId: role.id || "" };
  openEntityListModal({
    title: role.id ? "修改角色" : "新增角色",
    modalClass: "modal modal-wide access-role-form-modal",
    body: `<div class="form-row"><label for="accessRoleName">角色名稱</label><input id="accessRoleName" type="text" maxlength="30" value="${escapeHtml(role.name)}"></div><div class="form-row"><label for="accessRoleNameVi">越文名稱</label><input id="accessRoleNameVi" type="text" maxlength="60" value="${escapeHtml(role.nameVi || "")}" placeholder="可留空"></div><fieldset class="role-permission-fieldset"><legend>共用權限</legend><div class="role-permission-grid">${Object.entries(COMMON_PERMISSION_LABELS).map(([permission,label]) => accessPermissionCheckbox("data-role-common-permission", permission, label, common.has(permission))).join("")}</div></fieldset><fieldset class="role-group-fieldset"><legend>群組權限</legend><div class="records-table-wrap"><table class="records-table role-group-permission-table"><thead><tr><th>群組</th>${Object.values(GROUP_PERMISSION_LABELS).map((label) => `<th>${escapeHtml(label)}</th>`).join("")}</tr></thead><tbody>${getAllGroups().map((group) => { const selected = new Set(getRoleGroupPermissions(role, group.id)); return `<tr data-role-group-row="${escapeHtml(group.id)}"><td>${escapeHtml(getLocalizedName(group))}</td>${Object.entries(GROUP_PERMISSION_LABELS).map(([permission,label]) => `<td>${accessPermissionCheckbox(`data-role-group-permission="${group.id}" data-role-group-permission-name`, permission, label, selected.has(permission))}</td>`).join("")}</tr>`; }).join("")}</tbody></table></div></fieldset>`,
    headerButtons: `<button class="btn-primary" type="button" data-save-access-role="true">${role.id ? "儲存修改" : "新增"}</button>`,
    hideFooterClose: true
  });
}

async function saveAccessRoleFromForm() {
  const name = document.getElementById("accessRoleName")?.value.trim() || "";
  const nameVi = document.getElementById("accessRoleNameVi")?.value.trim() || "";
  if (!name) { reportValidationError("請填寫角色名稱"); return; }
  const existing = getAllRoles().find((role) => role.id === modalContext.targetId) || null;
  const commonPermissions = Array.from(document.querySelectorAll("[data-role-common-permission]:checked")).map((input) => input.dataset.roleCommonPermission || "").filter(Boolean);
  const groupPermissions = getAllGroups().map((group) => ({
    groupId: group.id,
    permissions: Array.from(document.querySelectorAll(`[data-role-group-permission="${group.id}"]:checked`)).map((input) => input.dataset.roleGroupPermissionName || "").filter(Boolean)
  })).filter((row) => row.permissions.length);
  await window.schedulerApi.saveAccessRole({ id: existing?.id || "", code: existing?.code || "", name, nameVi, commonPermissions, groupPermissions, sortOrder: existing?.sortOrder ?? getAllRoles().length });
  await reloadGroupApplicationState();
  openPermissionSettings();
}

async function deleteAccessRole(roleId) {
  const role = getAllRoles().find((item) => item.id === roleId);
  if (!role) return;
  if (!await confirmAction(`確定要刪除角色「${role.name}」嗎？`)) return;
  await window.schedulerApi.deleteAccessRole(roleId);
  await reloadGroupApplicationState();
  openPermissionSettings();
}

async function loadArchiveList(groupId = null) { return await window.schedulerApi.getScheduleArchives(groupId); }

async function openScheduleArchive() {
  if (!hasCommonPermission("settings") || !hasGroupPermission(groupFeatureState.currentGroupId, "schedule_view")) return;
  const archives = await loadArchiveList(null);
  const currentGroup = getCurrentGroup();
  const visibleDates = typeof getVisibleDates === "function" ? getVisibleDates() : [];
  const startDate = visibleDates[0] || getTodayDateString();
  const endDate = visibleDates[visibleDates.length - 1] || getTodayDateString();
  modalContext = { category: "schedule-archive" };
  openEntityListModal({
    title: "班表封存",
    modalClass: "modal modal-wide schedule-archive-modal settings-list-modal",
    body: `${hasGroupPermission(groupFeatureState.currentGroupId, "schedule_manage") && currentGroup ? `<div class="archive-create-row"><div class="form-row"><label>群組</label><div class="readonly-pill">${escapeHtml(currentGroup.name)}</div></div><div class="form-row"><label for="archiveStartDate">開始日期</label><input id="archiveStartDate" type="date" value="${escapeHtml(startDate)}"></div><div class="form-row"><label for="archiveEndDate">結束日期</label><input id="archiveEndDate" type="date" value="${escapeHtml(endDate)}"></div><button class="btn-primary" type="button" data-create-schedule-archive="true">封存</button></div>` : ""}<div class="records-table-wrap"><table class="records-table archive-list-table"><thead><tr><th>群組</th><th>日期範圍</th><th>封存時間</th><th>封存人員</th><th>人員數</th><th>資料筆數</th><th>操作</th></tr></thead><tbody>${(archives || []).map((archive) => `<tr><td>${escapeHtml(archive.group_name || "")}</td><td>${escapeHtml(archive.start_date)}～${escapeHtml(archive.end_date)}</td><td>${escapeHtml(String(archive.archived_at || "").replace("T", " ").slice(0,16))}</td><td>${escapeHtml(archive.archived_by_name || "")}</td><td>${Number(archive.member_count || 0)}</td><td>${Number(archive.entry_count || 0)}</td><td><button class="ghost-btn compact-btn" type="button" data-view-schedule-archive="${escapeHtml(archive.id)}">查看</button>${hasGroupPermission(groupFeatureState.currentGroupId, "schedule_manage") && hasGroupPermission(archive.group_id, "schedule_manage") ? `<button class="ghost-btn compact-btn" type="button" data-unarchive-schedule="${escapeHtml(archive.id)}">解除封存</button>` : ""}</td></tr>`).join("") || '<tr><td colspan="7">尚無封存班表</td></tr>'}</tbody></table></div>`,
    hideFooterClose: true
  });
}

async function createScheduleArchive() {
  const group = getCurrentGroup();
  const startDate = document.getElementById("archiveStartDate")?.value || "";
  const endDate = document.getElementById("archiveEndDate")?.value || "";
  if (!group || !startDate || !endDate || startDate > endDate) { reportValidationError("封存日期範圍不正確"); return; }
  if (!await confirmAction(`確定封存「${group.name}」${startDate}～${endDate} 的班表嗎？封存後不可修改。`)) return;
  await window.schedulerApi.archiveSchedule(group.id, startDate, endDate);
  groupFeatureState.archiveRanges = await window.schedulerApi.getScheduleArchiveRanges();
  scheduleUndoStack = [];
  scheduleRedoStack = [];
  renderAll();
  await openScheduleArchive();
}

async function unarchiveSchedule(archiveId) {
  const archive = (await loadArchiveList(null) || []).find((item) => item.id === archiveId);
  if (!archive) return;
  if (!await confirmAction(`確定解除「${archive.group_name || ""}」${archive.start_date || ""}～${archive.end_date || ""} 的班表封存嗎？解除後可重新修改班表。`)) return;
  await window.schedulerApi.unarchiveSchedule(archiveId);
  groupFeatureState.archiveRanges = await window.schedulerApi.getScheduleArchiveRanges();
  scheduleUndoStack = [];
  scheduleRedoStack = [];
  await reloadGroupApplicationState();
  await openScheduleArchive();
}

async function viewScheduleArchive(archiveId) {
  const result = await window.schedulerApi.getScheduleArchiveDetail(archiveId);
  const archive = result?.archive || {};
  const entries = Array.isArray(result?.entries) ? result.entries : [];
  modalContext = { category: "schedule-archive-detail", targetId: archiveId };
  openEntityListModal({
    title: `${archive.group_name_snapshot || ""}封存班表`,
    modalClass: "modal modal-wide archive-detail-modal",
    body: `<p class="modal-description">${escapeHtml(archive.start_date || "")}～${escapeHtml(archive.end_date || "")}，封存後不可修改。</p><div class="records-table-wrap"><table class="records-table archive-detail-table"><thead><tr><th>日期</th><th>群組－單位</th><th>人員</th><th>班別</th><th>假別</th><th>加班</th><th>備註</th></tr></thead><tbody>${entries.map((entry) => `<tr><td>${escapeHtml(entry.work_date || "")}</td><td>${escapeHtml(`${archive.group_name_snapshot || ""}-${entry.department_name_snapshot || ""}`)}</td><td>${escapeHtml(entry.employee_name_snapshot || entry.employee_code_snapshot || "")}</td><td>${escapeHtml(entry.shift_name_snapshot || "-")}${entry.shift_start_time_snapshot ? `<br><span>${escapeHtml(String(entry.shift_start_time_snapshot).slice(0,5))}-${escapeHtml(String(entry.shift_end_time_snapshot || "").slice(0,5))}</span>` : ""}</td><td>${escapeHtml(entry.leave_name_snapshot || "-")}</td><td>${escapeHtml(entry.overtime_name_snapshot || "-")}</td><td>${escapeHtml(entry.note || entry.leave_reason || entry.overtime_reason || "")}</td></tr>`).join("") || '<tr><td colspan="7">沒有班表資料</td></tr>'}</tbody></table></div>`,
    hideFooterClose: true
  });
}

function getDepartmentsForGroup(groupId) { return groupFeatureState.catalog.departments.filter((department) => department.groupId === groupId && !department.deleted); }
function getShiftsForGroup(groupId) { return groupFeatureState.catalog.shifts.filter((shift) => shift.groupId === groupId && !shift.deleted); }
function renderMemberGroupOptions(selectedGroupId) { return getSelectableGroups().map((group) => `<option value="${escapeHtml(group.id)}" ${group.id === selectedGroupId ? "selected" : ""}>${escapeHtml(group.name)}</option>`).join(""); }
function renderMemberUnitOptions(groupId, selectedDeptId = "") { return getDepartmentsForGroup(groupId).map((department) => `<option value="${escapeHtml(department.id)}" ${department.id === selectedDeptId ? "selected" : ""}>${escapeHtml(department.name)}</option>`).join(""); }
function getOrderedMemberGroupShifts(groupId, selectedIds = []) {
  const shifts = getShiftsForGroup(groupId).filter((shift) => !shift.hiddenFromToolbar);
  const shiftById = new Map(shifts.map((shift) => [shift.id, shift]));
  const orderedSelectedIds = (Array.isArray(selectedIds) ? selectedIds : [])
    .filter((shiftId, index, list) => shiftById.has(shiftId) && list.indexOf(shiftId) === index);
  const selectedIdSet = new Set(orderedSelectedIds);
  return {
    orderedSelectedIds,
    shifts: [
      ...orderedSelectedIds.map((shiftId) => shiftById.get(shiftId)).filter(Boolean),
      ...shifts.filter((shift) => !selectedIdSet.has(shift.id))
    ]
  };
}

function renderMemberGroupShiftSelector(groupId, selectedIds = []) {
  const ordered = getOrderedMemberGroupShifts(groupId, selectedIds);
  const selectedRankById = new Map(ordered.orderedSelectedIds.map((shiftId, index) => [shiftId, index + 1]));
  return `<div class="schedule-dept-list" id="memberScheduleShiftList" hidden>${ordered.shifts.map((shift) => { const rank = selectedRankById.get(shift.id) || 0; const checked = rank > 0; return `<label class="schedule-dept-option" draggable="true" data-schedule-shift-option="${escapeHtml(shift.id)}"><input type="checkbox" value="${escapeHtml(shift.id)}" ${checked ? "checked" : ""}><span class="schedule-dept-rank">${checked ? rank : "-"}</span><span>${escapeHtml(shift.name)}</span></label>`; }).join("")}</div>`;
}
function memberShiftNamesForGroup(groupId, selectedIds) {
  const map = new Map(getShiftsForGroup(groupId).map((shift) => [shift.id, shift.name]));
  const names = (selectedIds || []).map((id) => map.get(id)).filter(Boolean);
  return names.length ? names.join("、") : "未指定";
}

function renderMemberCustomRoleOptions(member) {
  const selectedRoleId = member?.roleId || "";
  const roles = getAllRoles();
  if (!roles.length) {
    return '<option value="">未設定</option>';
  }
  return roles.map((role) => `<option value="${escapeHtml(role.id)}" ${role.id === selectedRoleId ? "selected" : ""}>${escapeHtml(role.name)}</option>`).join("");
}

function openMemberForm(mode, memberId = "") {
  const returnTo = modalContext?.category === "department-settings"
    ? captureSettingsReturnContext({ category: "department-settings", view: modalContext.view || departmentSettingsView })
    : modalContext?.category === "member-settings" ? captureSettingsReturnContext({ category: "member-settings" }) : null;
  const defaultAccessRoleId = getDefaultAccessRoleId();
  const member = mode === "edit" ? state.members.find((item) => item.id === memberId) : {
    id: "", code: "", name: "", nameVi: "", groupId: groupFeatureState.currentGroupId,
    deptId: getDepartmentsForGroup(groupFeatureState.currentGroupId)[0]?.id || "",
    hireDate: "", leaveDate: "", payByDay: false, fixedRestWeekday: 0,
    scheduleShiftIds: [], roleId: defaultAccessRoleId
  };
  if (!member) return;
  if (!canEditMemberAccount(member)) { showInfoMessage("沒有權限修改此帳號"); return; }
  const groupId = member.groupId || groupFeatureState.currentGroupId;
  const selectedShifts = Array.isArray(member.scheduleShiftIds) ? member.scheduleShiftIds : [];
  modalContext = { mode, category: "member", targetId: memberId, returnTo };
  openEntityListModal({
    title: `${mode === "edit" ? "修改" : "新增"}人員`,
    modalClass: "modal modal-member-form",
    body: `<div class="form-grid two-col"><div class="form-row"><label for="memberCode">工號</label><input id="memberCode" type="text" maxlength="12" value="${escapeHtml(member.code)}"></div><div class="form-row"><label for="memberName">姓名</label><input id="memberName" type="text" maxlength="12" value="${escapeHtml(member.name)}"></div><div class="form-row"><label for="memberRole">權限</label><select id="memberRole" ${hasCommonPermission("settings") ? "" : "disabled"}>${renderMemberCustomRoleOptions(member)}</select></div><div class="form-row"><label for="memberNameVi">越文名稱</label><input id="memberNameVi" type="text" maxlength="60" value="${escapeHtml(member.nameVi || "")}" placeholder="可留空"></div><div class="form-row"><label for="memberHireDate">到職日</label><input id="memberHireDate" type="date" value="${escapeHtml(member.hireDate)}"></div><div class="form-row"><label for="memberLeaveDate">離職日</label><input id="memberLeaveDate" type="date" value="${escapeHtml(member.leaveDate)}"></div><div class="form-row"><label for="memberSalaryType">計薪方式</label><select id="memberSalaryType"><option value="monthly" ${member.payByDay ? "" : "selected"}>月薪</option><option value="daily" ${member.payByDay ? "selected" : ""}>日薪</option></select></div><div class="form-row"><label for="memberFixedRestWeekday">例假星期</label><select id="memberFixedRestWeekday">${REST_WEEKDAY_OPTIONS.map((option) => `<option value="${option.value}" ${normalizeRestWeekday(member.fixedRestWeekday) === option.value ? "selected" : ""}>${option.label}</option>`).join("")}</select></div><div class="form-row"><label for="memberGroup">所屬群組</label><select id="memberGroup">${renderMemberGroupOptions(groupId)}</select></div><div class="form-row"><label for="memberDept">所屬單位</label><select id="memberDept">${renderMemberUnitOptions(groupId, member.deptId || "")}</select></div>${mode === "edit" ? `<div class="form-row"><button class="ghost-btn" type="button" data-reset-member-password="${escapeHtml(member.code)}">重設密碼為 0000</button></div>` : ""}<div class="form-row form-row-wide"><label>排班班別</label><div class="schedule-dept-summary-row"><div class="readonly-pill schedule-shift-summary">${escapeHtml(memberShiftNamesForGroup(groupId, selectedShifts))}</div><button class="ghost-btn compact-btn" type="button" data-toggle-schedule-shifts="true">設定</button></div>${renderMemberGroupShiftSelector(groupId, selectedShifts)}</div></div>`,
    headerButtons: `<button class="btn-primary" type="button" data-save-member="${mode}">${mode === "edit" ? "儲存修改" : "新增"}</button>`,
    hideFooterClose: true
  });
}

async function saveMember(mode) {
  const returnTo = modalContext.returnTo || null;
  const hireDate = document.getElementById("memberHireDate")?.value || "";
  const leaveDate = document.getElementById("memberLeaveDate")?.value || "";
  if (hireDate && leaveDate && !isValidDateRange(hireDate, leaveDate)) { reportValidationError("到職日必須早於離職日"); return; }
  const previousMember = mode === "edit" ? state.members.find((member) => member.id === modalContext.targetId) || null : null;
  const groupId = document.getElementById("memberGroup")?.value || "";
  const deptId = document.getElementById("memberDept")?.value || "";
  const roleId = document.getElementById("memberRole")?.value || previousMember?.roleId || "";
  const scheduleShiftIds = readMemberScheduleShiftIds();
  const payload = {
    id: mode === "edit" ? modalContext.targetId : uid("m"), code: document.getElementById("memberCode")?.value.trim(), name: document.getElementById("memberName")?.value.trim(), nameVi: document.getElementById("memberNameVi")?.value.trim() || "",
    groupId, deptId, scheduleShiftIds, positionId: previousMember?.positionId || "", proxyMemberId: "", hireDate, leaveDate,
    payByDay: document.getElementById("memberSalaryType")?.value === "daily", fixedRestWeekday: normalizeRestWeekday(document.getElementById("memberFixedRestWeekday")?.value),
    monthlyRestDays: Math.max(0, Number(previousMember?.monthlyRestDays) || 0), roleId
  };
  if (!payload.code || !payload.name) return reportValidationError("請填寫人員編號與姓名");
  if (!payload.groupId) return reportValidationError("請選擇所屬群組");
  if (!payload.deptId) return reportValidationError("請選擇所屬單位");
  try {
    if (previousMember && previousMember.groupId !== payload.groupId) await window.schedulerApi.validateMemberGroupChange(previousMember.code, payload.groupId);
    await window.schedulerApi.syncMemberProfile(payload, previousMember?.code || "");
    await reloadGroupApplicationState();
    await window.fyhI18n?.refreshLabels?.();
    window.fyhI18n?.refresh?.();
    closeModal();
    await reopenSettingsModalPreservingScroll(returnTo || { category: "member-settings", scrollTop: 0 });
  } catch (error) { reportValidationError(`同步人員資料失敗：${error.message}`); }
}

function syncMemberGroupFields(groupId) {
  const deptSelect = document.getElementById("memberDept");
  if (deptSelect) deptSelect.innerHTML = renderMemberUnitOptions(groupId, "");
  const shiftList = document.getElementById("memberScheduleShiftList");
  if (shiftList) shiftList.outerHTML = renderMemberGroupShiftSelector(groupId, []);
  const summary = document.querySelector(".schedule-shift-summary");
  if (summary) summary.textContent = "未指定";
}

function renderAttendanceGroupOptions(selectedValue) { const reviewGroups = getAllGroups().filter((group) => group.status === "active" && hasGroupPermission(group.id, "attendance_review")); return `<option value="">全部群組</option>${reviewGroups.map((group) => `<option value="${escapeHtml(group.id)}" ${group.id === selectedValue ? "selected" : ""}>${escapeHtml(group.name)}</option>`).join("")}`; }

function renderAttendanceReviewSectionWithGroups() {
  const review = ensureAttendanceReviewState();
  const filters = review.filters;
  const rows = review.rows || [];
  return `<section class="records-section"><div class="records-admin-toolbar overtime-review-toolbar attendance-review-toolbar"><div class="records-admin-filters overtime-review-filters attendance-review-filters"><label class="records-admin-field"><span>開始日期</span><input type="date" value="${escapeHtml(filters.fromDate || "")}" data-attendance-review-filter="fromDate"></label><label class="records-admin-field"><span>結束日期</span><input type="date" value="${escapeHtml(filters.toDate || "")}" data-attendance-review-filter="toDate"></label><label class="records-admin-field"><span>群組</span><select data-attendance-review-filter="groupId">${renderAttendanceGroupOptions(filters.groupId || "")}</select></label><label class="records-admin-field"><span>人員</span><select data-attendance-review-filter="memberId">${memberOptions(filters.memberId, review.members)}</select></label><label class="records-admin-field"><span>異常</span><select data-attendance-review-filter="issueType"><option value="" ${!filters.issueType ? "selected" : ""}>全部顯示</option>${(review.issueTypes || []).map((type) => `<option value="${escapeHtml(type)}" ${filters.issueType === type ? "selected" : ""}>${escapeHtml(type)}</option>`).join("")}</select></label><label class="records-admin-field"><span>狀態</span><select data-attendance-review-filter="status"><option value="unreviewed" ${filters.status === "unreviewed" ? "selected" : ""}>未審</option><option value="reviewed" ${filters.status === "reviewed" ? "selected" : ""}>已審</option><option value="all" ${filters.status === "all" ? "selected" : ""}>全部</option></select></label></div><div class="records-admin-actions overtime-review-actions attendance-review-actions"><button class="ghost-btn compact-btn" type="button" data-export-attendance-review="true">匯出加班</button><button class="primary-btn compact-btn" type="button" data-attendance-review-batch="reviewed">批次審核</button><button class="ghost-btn compact-btn" type="button" data-attendance-review-batch="returned">批次退回</button></div></div>${review.error ? `<div class="auth-error">${escapeHtml(review.error)}</div>` : ""}<div class="records-table-wrap"><table class="records-table attendance-review-table"><thead><tr><th class="attendance-review-check-col"><input type="checkbox" data-attendance-review-check-all></th><th class="attendance-review-date-col">日期</th><th class="attendance-review-employee-col">員工</th><th class="attendance-schedule-icon-col">圖示</th><th>群組－單位</th><th>打卡時間</th><th>上班時數</th><th>加班時數</th><th>備註</th><th>異常</th><th>狀態</th><th>操作</th></tr></thead><tbody>${rows.map((row) => {
    const token = `${row.user_id}:${row.work_date}`;
    const groupUnit = [row.groupName || row.group_name || "", row.departmentName || row.department_name || ""].filter(Boolean).join("-") || "-";
    return `<tr><td><input type="checkbox" data-attendance-review-check="${escapeHtml(token)}"></td><td>${escapeHtml(row.work_date || "")}</td><td>${escapeHtml(row.employee_name || "")}</td><td class="attendance-schedule-icon-col">${renderScheduleIcon(row)}</td><td>${escapeHtml(groupUnit)}</td><td>${renderPunchLine("上班", row.clock_in_at, row.clock_in_location) || "-"}${renderPunchLine("下班", row.clock_out_at, row.clock_out_location)}</td><td>${row.regularHours ?? ""}</td><td>${row.overtimeHours ?? ""}</td><td>${escapeHtml(row.note || "")}</td><td>${escapeHtml((row.issues || []).join("、") || "正常")}</td><td>${renderReviewStatus(row.reviewed)}</td><td><div class="attendance-review-row-actions"><button class="settings-icon-btn attendance-review-action-btn" type="button" data-edit-attendance-review="${escapeHtml(token)}" aria-label="編輯" title="編輯">${actionIcon("edit")}</button><button class="settings-icon-btn attendance-review-action-btn attendance-review-toggle ${row.reviewed ? "is-reviewed" : "is-unreviewed"}" type="button" data-toggle-attendance-review="${escapeHtml(token)}" data-reviewed="${row.reviewed ? "true" : "false"}" aria-label="${row.reviewed ? "取消審核" : "審核"}" title="${row.reviewed ? "取消審核" : "審核"}"><svg viewBox="0 0 24 24"><path d="M9 4h6l1 2h3v15H5V6h3l1-2z"></path><path d="m9 13 2 2 4-5"></path></svg></button>${row.id ? `<button class="settings-icon-btn attendance-review-action-btn" type="button" data-view-attendance-history="${escapeHtml(row.id)}" aria-label="歷程" title="歷程"><svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7"></path><path d="M3 4v5h5"></path><path d="M12 7v5l3 2"></path></svg></button>` : ""}</div></td></tr>`;
  }).join("") || '<tr><td colspan="12">沒有資料</td></tr>'}</tbody></table></div>${renderAttendanceReviewPagination(review)}</section>`;
}

function bindGroupFeatureEvents() {
  document.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
    if (target.id === "scheduleGroupSelect") { void switchScheduleGroup(target.value); return; }
    if (target.id === "memberGroup") { syncMemberGroupFields(target.value); return; }
    if (target.dataset.roleGroupPermissionName === "schedule_manage" && target.checked) {
      const groupId = target.dataset.roleGroupPermission || "";
      const view = document.querySelector(`[data-role-group-permission="${groupId}"][data-role-group-permission-name="schedule_view"]`);
      if (view) view.checked = true;
      return;
    }
    if (target.dataset.roleGroupPermissionName === "schedule_view" && !target.checked) {
      const groupId = target.dataset.roleGroupPermission || "";
      const manage = document.querySelector(`[data-role-group-permission="${groupId}"][data-role-group-permission-name="schedule_manage"]`);
      if (manage) manage.checked = false;
    }
  });
  document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    const action = button.dataset.groupFeatureAction;
    if (action === "group-settings") { event.preventDefault(); closeCoreActionsMenu(); openGroupSettings(); return; }
    if (action === "permission-settings") { event.preventDefault(); closeCoreActionsMenu(); openPermissionSettings(); return; }
    if (action === "schedule-conditions") { event.preventDefault(); closeCoreActionsMenu(); void openScheduleConditions(); return; }
    if (action === "schedule-archive") { event.preventDefault(); closeCoreActionsMenu(); void openScheduleArchive(); return; }
    if (button.dataset.addScheduleCondition !== undefined) { event.preventDefault(); openScheduleConditionForm(); return; }
    if (button.dataset.editScheduleCondition) { event.preventDefault(); openScheduleConditionForm(button.dataset.editScheduleCondition); return; }
    if (button.dataset.saveScheduleCondition !== undefined) { event.preventDefault(); void saveScheduleConditionFromModal(); return; }
    if (button.dataset.deleteScheduleCondition) { event.preventDefault(); void deleteScheduleCondition(button.dataset.deleteScheduleCondition); return; }
    if (button.dataset.addScheduleGroup !== undefined) { openGroupForm(); return; }
    if (button.dataset.editScheduleGroup) { openGroupForm(button.dataset.editScheduleGroup); return; }
    if (button.dataset.saveScheduleGroup !== undefined) { void saveScheduleGroupFromForm().catch((error) => reportValidationError(error.message)); return; }
    if (button.dataset.toggleScheduleGroup) { void toggleScheduleGroup(button.dataset.toggleScheduleGroup).catch((error) => showInfoMessage(error.message)); return; }
    if (button.dataset.deleteScheduleGroup) { void deleteScheduleGroup(button.dataset.deleteScheduleGroup).catch((error) => showInfoMessage(error.message)); return; }
    if (button.dataset.addAccessRole !== undefined) { openAccessRoleForm(); return; }
    if (button.dataset.editAccessRole) { openAccessRoleForm(button.dataset.editAccessRole); return; }
    if (button.dataset.saveAccessRole !== undefined) {
    if (button.disabled) return;
    button.disabled = true;
    void saveAccessRoleFromForm()
      .catch((error) => reportValidationError(error.message))
      .finally(() => { if (button.isConnected) button.disabled = false; });
    return;
  }
    if (button.dataset.deleteAccessRole) { void deleteAccessRole(button.dataset.deleteAccessRole).catch((error) => showInfoMessage(error.message)); return; }
    if (button.dataset.createScheduleArchive !== undefined) { void createScheduleArchive().catch((error) => reportValidationError(error.message)); return; }
    if (button.dataset.viewScheduleArchive) { void viewScheduleArchive(button.dataset.viewScheduleArchive).catch((error) => showInfoMessage(error.message)); return; }
    if (button.dataset.unarchiveSchedule) { void unarchiveSchedule(button.dataset.unarchiveSchedule).catch((error) => showInfoMessage(error.message)); }
  });
  document.addEventListener("dragstart", (event) => {
    const roleHandle = event.target.closest?.("[data-permission-role-drag-handle]");
    if (roleHandle) {
      const roleRow = roleHandle.closest("[data-permission-role-id]");
      groupFeatureState.dragRoleId = roleRow?.dataset.permissionRoleId || "";
      groupFeatureState.dragRoleStartOrder = getPermissionRoleOrderFromDom();
      roleRow?.classList.add("permission-role-dragging");
      if (event.dataTransfer && groupFeatureState.dragRoleId) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", groupFeatureState.dragRoleId);
      }
      return;
    }
    const row = event.target.closest?.("[data-group-row]");
    if (!row) return;
    groupFeatureState.dragGroupId = row.dataset.groupRow || "";
    row.classList.add("is-dragging");
  });
  document.addEventListener("dragover", (event) => {
    const roleRow = event.target.closest?.("[data-permission-role-id]");
    if (roleRow && groupFeatureState.dragRoleId) {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      previewPermissionRoleOrder(roleRow, event.clientY);
      return;
    }
    const row = event.target.closest?.("[data-group-row]");
    if (!row || !groupFeatureState.dragGroupId) return;
    event.preventDefault();
    const dragging = document.querySelector(`[data-group-row="${groupFeatureState.dragGroupId}"]`);
    if (!dragging || dragging === row) return;
    const rect = row.getBoundingClientRect();
    row.parentElement?.insertBefore(dragging, event.clientY < rect.top + rect.height / 2 ? row : row.nextSibling);
  });
  document.addEventListener("dragend", (event) => {
    const roleRow = event.target.closest?.("[data-permission-role-id]");
    if (groupFeatureState.dragRoleId) {
      roleRow?.classList.remove("permission-role-dragging");
      const shouldSave = getPermissionRoleOrderFromDom().join("|") !== groupFeatureState.dragRoleStartOrder.join("|");
      groupFeatureState.dragRoleId = "";
      if (shouldSave) void savePermissionRoleOrder();
      return;
    }
    const row = event.target.closest?.("[data-group-row]");
    row?.classList.remove("is-dragging");
    if (!groupFeatureState.dragGroupId) return;
    groupFeatureState.dragGroupId = "";
    void saveGroupOrder().catch((error) => showInfoMessage(error.message));
  });
}


function initializeGroupPermissionState(payload) {
  const normalized = enrichNormalizedState(normalizeState(payload));
  if (!groupFeatureState.currentGroupId || !getSelectableGroups().some((group) => group.id === groupFeatureState.currentGroupId)) {
    groupFeatureState.currentGroupId = chooseCurrentGroupId();
  }
  snapshotCanonicalState(normalized);
  groupFeatureState.initialized = true;
  return applyCurrentGroupScope(normalized);
}

