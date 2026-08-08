/* 群組、角色權限與班表封存。
 * 權限狀態由 canonical schedulerApi 載入；本模組只負責領域狀態與介面。
 */

const GROUP_PERMISSION_LABELS = {
  schedule_view: "班表查看",
  schedule_manage: "班表管理",
  group_settings: "群組設定",
  department_settings: "單位設定",
  member_settings: "人員設定",
  leave_settings: "假別設定",
  permission_settings: "權限設定",
  attendance_review: "簽到審核",
  meal_admin: "訂餐管理"
};

const groupFeatureState = {
  bundle: { actor: {}, groups: [], roles: [] },
  entityMap: { departments: [], members: [], shifts: [], leaves: [], overtime: [], archiveRanges: [] },
  currentGroupId: "",
  allDepartments: [],
  allMembers: [],
  allShifts: [],
  allSchedule: {},
  initialized: false,
  dragGroupId: ""
};

async function loadGroupAccessData(payload = {}) {
  groupFeatureState.bundle = payload.accessBundle && typeof payload.accessBundle === "object"
    ? payload.accessBundle
    : await window.schedulerApi.getGroupAccessBundle();
  groupFeatureState.entityMap = payload.entityMap && typeof payload.entityMap === "object"
    ? payload.entityMap
    : await window.schedulerApi.getGroupEntityMap();
  return { bundle: groupFeatureState.bundle, entityMap: groupFeatureState.entityMap };
}


function getAccessActor() { return groupFeatureState.bundle?.actor || {}; }
function getAccessPermissions() { return Array.isArray(getAccessActor().permissions) ? getAccessActor().permissions : []; }
function hasPermission(permission) { return getAccessPermissions().includes(permission); }
function getApplicableGroupIds() { return Array.isArray(getAccessActor().applicableGroupIds) ? getAccessActor().applicableGroupIds.filter(Boolean) : []; }
function roleAppliesToGroup(groupId) { return Boolean(groupId && getApplicableGroupIds().includes(groupId)); }
function getAllGroups() { return Array.isArray(groupFeatureState.bundle?.groups) ? groupFeatureState.bundle.groups : []; }
function getSelectableGroups() {
  const allowed = new Set(getApplicableGroupIds());
  return getAllGroups().filter((group) => allowed.has(group.id) && group.status === "active");
}
function getCurrentGroup() { return getAllGroups().find((group) => group.id === groupFeatureState.currentGroupId) || null; }
function getActorGroup() { return getAllGroups().find((group) => group.id === getAccessActor().groupId) || null; }
function getAllRoles() { return Array.isArray(groupFeatureState.bundle?.roles) ? groupFeatureState.bundle.roles : []; }
function getRoleById(roleId) { return getAllRoles().find((role) => role.id === roleId) || null; }
function normalizeLegacyRoleValue(role) { return role === "admin" || role === "manager" ? role : "employee"; }
function getRoleByLegacyRole(legacyRole) { return getAllRoles().find((role) => role.legacyRole === normalizeLegacyRoleValue(legacyRole)) || null; }

function chooseCurrentGroupId() {
  const selectable = getSelectableGroups();
  if (!selectable.length) return "";
  const stored = localStorage.getItem("fyh.schedule.groupId") || "";
  if (selectable.some((group) => group.id === stored)) return stored;
  const actorGroupId = getAccessActor().groupId || "";
  if (selectable.some((group) => group.id === actorGroupId)) return actorGroupId;
  return selectable[0].id;
}

function makeIdMap(rows, valueKey) {
  return new Map((Array.isArray(rows) ? rows : []).map((row) => [row.id, row[valueKey]]));
}

function appendDeletedLabel(value, deleted) {
  const text = String(value || "");
  if (!deleted || text.endsWith("（已刪除）")) return text;
  return `${text}（已刪除）`;
}

function enrichNormalizedState(normalized) {
  const departmentGroups = makeIdMap(groupFeatureState.entityMap.departments, "groupId");
  const departmentDeleted = makeIdMap(groupFeatureState.entityMap.departments, "deleted");
  const memberGroups = makeIdMap(groupFeatureState.entityMap.members, "groupId");
  const memberRoles = makeIdMap(groupFeatureState.entityMap.members, "roleId");
  const memberDeleted = makeIdMap(groupFeatureState.entityMap.members, "deleted");
  const shiftGroups = makeIdMap(groupFeatureState.entityMap.shifts, "groupId");
  const shiftDeleted = makeIdMap(groupFeatureState.entityMap.shifts, "deleted");
  const leaveDeleted = makeIdMap(groupFeatureState.entityMap.leaves, "deleted");
  const overtimeDeleted = makeIdMap(groupFeatureState.entityMap.overtime, "deleted");

  normalized.departments = (normalized.departments || []).map((department) => {
    const deleted = Boolean(department.deleted || departmentDeleted.get(department.id));
    return { ...department, name: appendDeletedLabel(department.name, deleted), groupId: departmentGroups.get(department.id) || "", deleted };
  });
  normalized.members = (normalized.members || []).map((member) => {
    const roleId = memberRoles.get(member.id) || getRoleByLegacyRole(member.role)?.id || "";
    const deleted = Boolean(member.deleted || memberDeleted.get(member.id));
    return { ...member, name: appendDeletedLabel(member.name, deleted), groupId: memberGroups.get(member.id) || "", roleId, role: roleId || member.role, deleted };
  });
  normalized.shifts = (normalized.shifts || []).map((shift) => {
    const deleted = Boolean(shift.deleted || shiftDeleted.get(shift.id));
    return {
      ...shift,
      name: appendDeletedLabel(shift.name, deleted),
      groupId: shiftGroups.get(shift.id) || normalized.departments.find((department) => department.id === shift.applicableDeptId)?.groupId || "",
      hiddenFromToolbar: deleted || Boolean(shift.hiddenFromToolbar),
      deleted
    };
  });
  normalized.leaves = (normalized.leaves || []).map((leave) => {
    const deleted = Boolean(leave.deleted || leaveDeleted.get(leave.id));
    return { ...leave, name: appendDeletedLabel(leave.name, deleted), hiddenFromToolbar: deleted || Boolean(leave.hiddenFromToolbar), deleted };
  });
  normalized.overtime = (normalized.overtime || []).map((overtime) => {
    const deleted = Boolean(overtime.deleted || overtimeDeleted.get(overtime.id));
    return { ...overtime, name: appendDeletedLabel(overtime.name, deleted), hiddenFromToolbar: deleted || Boolean(overtime.hiddenFromToolbar), deleted };
  });
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

function snapshotAllState(normalized) {
  groupFeatureState.allDepartments = deepClone(normalized.departments || []);
  groupFeatureState.allMembers = deepClone(normalized.members || []);
  groupFeatureState.allShifts = deepClone(normalized.shifts || []);
  groupFeatureState.allSchedule = deepClone(normalized.schedule || {});
}

function currentGroupMemberIds() {
  return new Set(groupFeatureState.allMembers.filter((member) => member.groupId === groupFeatureState.currentGroupId).map((member) => member.id));
}

function syncCurrentScopeIntoAll() {
  const groupId = groupFeatureState.currentGroupId;
  if (!groupId || !state || typeof state !== "object") return;
  groupFeatureState.allDepartments = [
    ...groupFeatureState.allDepartments.filter((item) => item.groupId !== groupId),
    ...(state.departments || []).map((item) => ({ ...deepClone(item), groupId }))
  ];
  groupFeatureState.allMembers = [
    ...groupFeatureState.allMembers.filter((item) => item.groupId !== groupId),
    ...(state.members || []).map((item) => ({ ...deepClone(item), groupId: item.groupId || groupId }))
  ];
  groupFeatureState.allShifts = [
    ...groupFeatureState.allShifts.filter((item) => item.groupId !== groupId),
    ...(state.shifts || []).map((item) => ({ ...deepClone(item), groupId: item.groupId || groupId }))
  ];
  const memberIds = currentGroupMemberIds();
  const nextSchedule = {};
  Object.entries(groupFeatureState.allSchedule || {}).forEach(([key, slot]) => {
    if (!memberIds.has(scheduleKeyMemberId(key))) nextSchedule[key] = slot;
  });
  Object.entries(state.schedule || {}).forEach(([key, slot]) => { nextSchedule[key] = deepClone(slot); });
  groupFeatureState.allSchedule = nextSchedule;
}

function applyCurrentGroupScope(targetState = state) {
  const groupId = groupFeatureState.currentGroupId;
  const departments = groupFeatureState.allDepartments.filter((item) => item.groupId === groupId);
  const members = groupFeatureState.allMembers.filter((item) => item.groupId === groupId);
  const shifts = groupFeatureState.allShifts.filter((item) => item.groupId === groupId);
  const memberIds = new Set(members.map((member) => member.id));
  const schedule = {};
  Object.entries(groupFeatureState.allSchedule || {}).forEach(([key, slot]) => {
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
  if (!roleAppliesToGroup(groupId)) return;
  const group = getAllGroups().find((item) => item.id === groupId && item.status === "active");
  if (!group) return;
  syncCurrentScopeIntoAll();
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
  return (groupFeatureState.entityMap.archiveRanges || []).some((range) => range.groupId === groupId && dateString >= range.startDate && dateString <= range.endDate);
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

function ensureFunctionMenuButtons() {
  const menu = document.getElementById("coreActionsMenu");
  if (!menu) return;
  const definitions = [
    ["groupSettingsMenuButton", "群組設定", "group_settings", "group-settings"],
    ["permissionSettingsMenuButton", "權限設定", "permission_settings", "permission-settings"],
    ["scheduleArchiveMenuButton", "班表封存", "schedule_view", "schedule-archive"]
  ];
  definitions.forEach(([id, label, permission, action]) => {
    let button = document.getElementById(id);
    if (!button) {
      button = document.createElement("button");
      button.id = id;
      button.type = "button";
      button.className = "ghost-btn ops-btn group-feature-action";
      button.dataset.groupFeatureAction = action;
      button.textContent = label;
      menu.prepend(button);
    }
    const visible = action === "schedule-archive" ? hasPermission("schedule_view") : hasPermission(permission);
    button.style.display = visible ? "" : "none";
    button.disabled = !visible;
  });
}

function syncPermissionUi() {
  ensureGroupSelector();
  ensureFunctionMenuButtons();
  markArchivedScheduleCells();
  const visibility = {
    shiftSettingsButton: hasPermission("schedule_manage"),
    restComplianceButton: hasPermission("schedule_manage"),
    deptSettingsButton: hasPermission("department_settings"),
    leaveSettingsButton: hasPermission("leave_settings"),
    overtimeSettingsButton: false,
    weekStartSettingsButton: hasPermission("schedule_manage"),
    autoSchedulePreviewButton: hasPermission("schedule_manage"),
    autoFillSchedulePreviewButton: hasPermission("schedule_manage"),
    autoScheduleApplyButton: hasPermission("schedule_manage"),
    autoScheduleCancelButton: hasPermission("schedule_manage"),
    exportSapButton: hasPermission("schedule_manage"),
    exportLeaveButton: hasPermission("schedule_manage"),
    exportOvertimeButton: hasPermission("schedule_manage")
  };
  Object.entries(visibility).forEach(([id, visible]) => {
    const element = document.getElementById(id);
    if (!element) return;
    element.style.display = visible ? "" : "none";
    element.disabled = !visible;
  });
  document.querySelectorAll("[data-open-department-settings]").forEach((element) => { element.style.display = hasPermission("department_settings") ? "" : "none"; });
  document.querySelectorAll("[data-open-member-settings]").forEach((element) => { element.style.display = hasPermission("member_settings") ? "" : "none"; });
  const mealButton = document.querySelector('[data-home-action="meal"]');
  const actorGroup = getActorGroup();
  if (mealButton) mealButton.style.display = actorGroup?.mealEnabled && actorGroup?.status === "active" ? "" : "none";
  document.querySelectorAll('[data-meal-tab="stats"], [data-meal-tab="settings"]').forEach((tab) => { tab.style.display = hasPermission("meal_admin") ? "" : "none"; });
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
  if (!hasPermission("group_settings")) return;
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
  const group = getAllGroups().find((item) => item.id === groupId) || { id: "", code: "", name: "", mealEnabled: false, status: "active", sortOrder: getAllGroups().length };
  modalContext = { category: "group-form", targetId: group.id || "" };
  openEntityListModal({
    title: group.id ? "修改群組" : "新增群組",
    modalClass: "modal modal-form-compact",
    body: `<div class="form-grid two-col"><div class="form-row"><label for="groupCode">群組代碼</label><input id="groupCode" type="text" maxlength="30" value="${escapeHtml(group.code)}"></div><div class="form-row"><label for="groupName">群組名稱</label><input id="groupName" type="text" maxlength="30" value="${escapeHtml(group.name)}"></div><div class="form-row"><label class="checkbox-row"><input id="groupMealEnabled" type="checkbox" ${group.mealEnabled ? "checked" : ""}>可否訂餐</label></div><div class="form-row"><label for="groupStatus">狀態</label><select id="groupStatus"><option value="active" ${group.status === "active" ? "selected" : ""}>啟用</option><option value="inactive" ${group.status === "inactive" ? "selected" : ""}>停用</option></select></div></div>`,
    headerButtons: `<button class="btn-primary" type="button" data-save-schedule-group="true">${group.id ? "儲存修改" : "新增"}</button>`,
    hideFooterClose: true
  });
}

async function saveScheduleGroupFromForm() {
  const code = document.getElementById("groupCode")?.value.trim() || "";
  const name = document.getElementById("groupName")?.value.trim() || "";
  if (!code || !name) { reportValidationError("請填寫群組代碼與群組名稱"); return; }
  const existing = getAllGroups().find((item) => item.id === modalContext.targetId) || null;
  await window.schedulerApi.saveScheduleGroup({ id: existing?.id || "", code, name, mealEnabled: Boolean(document.getElementById("groupMealEnabled")?.checked), status: document.getElementById("groupStatus")?.value || "active", sortOrder: existing?.sortOrder ?? getAllGroups().length });
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

function permissionSummary(role) { return (role.permissions || []).map((permission) => GROUP_PERMISSION_LABELS[permission]).filter(Boolean).join("、") || "-"; }
function renderPermissionSummaryTags(role) {
  const labels = (role.permissions || []).map((permission) => GROUP_PERMISSION_LABELS[permission]).filter(Boolean);
  if (!labels.length) return '<span class="group-unit-empty">-</span>';
  return `<div class="permission-summary-tags">${labels.map((label) => `<span class="group-unit-tag permission-summary-tag">${escapeHtml(label)}</span>`).join("")}</div>`;
}
function roleGroupSummary(role) {
  const names = (role.groupIds || []).map((groupId) => getAllGroups().find((group) => group.id === groupId)?.name).filter(Boolean);
  return names.length ? names.join("、") : "未設定";
}

function openPermissionSettings() {
  if (!hasPermission("permission_settings")) return;
  modalContext = { category: "permission-settings" };
  openEntityListModal({
    title: "權限設定",
    modalClass: "modal modal-wide permission-settings-modal settings-list-modal",
    body: `<div class="records-table-wrap"><table class="records-table permission-settings-table"><thead><tr><th class="permission-role-col">角色名稱</th><th class="permission-group-col">適用群組</th><th class="permission-items-col">權限項目</th><th class="permission-actions-col">操作</th></tr></thead><tbody>${getAllRoles().map((role) => `<tr><td class="permission-role-col">${escapeHtml(role.name)}</td><td class="permission-group-col">${escapeHtml(roleGroupSummary(role))}</td><td class="permission-summary-cell permission-items-col">${renderPermissionSummaryTags(role)}</td><td class="permission-actions-col"><button class="settings-icon-btn" type="button" data-edit-access-role="${escapeHtml(role.id)}" aria-label="編輯" title="編輯">${actionIcon("edit")}</button><button class="settings-icon-btn settings-icon-btn-danger" type="button" data-delete-access-role="${escapeHtml(role.id)}" aria-label="刪除" title="刪除">${actionIcon("delete")}</button></td></tr>`).join("")}</tbody></table></div>`,
    headerButtons: '<button class="btn-primary" type="button" data-add-access-role="true">新增</button>',
    hideFooterClose: true
  });
}

function permissionCheckbox(permission, checked) { return `<label class="permission-check"><input type="checkbox" value="${permission}" data-role-permission="${permission}" ${checked ? "checked" : ""}>${escapeHtml(GROUP_PERMISSION_LABELS[permission])}</label>`; }

function openAccessRoleForm(roleId = "") {
  const role = getAllRoles().find((item) => item.id === roleId) || { id: "", code: "", name: "", permissions: ["schedule_view"], groupIds: [groupFeatureState.currentGroupId].filter(Boolean) };
  const permissions = new Set(role.permissions || []);
  modalContext = { category: "access-role-form", targetId: role.id || "" };
  openEntityListModal({
    title: role.id ? "修改角色" : "新增角色",
    modalClass: "modal modal-wide access-role-form-modal",
    body: `<div class="form-row"><label for="accessRoleName">角色名稱</label><input id="accessRoleName" type="text" maxlength="30" value="${escapeHtml(role.name)}"></div><fieldset class="role-group-fieldset"><legend>適用群組</legend><div class="role-group-grid">${getAllGroups().map((group) => `<label><input type="checkbox" data-role-group="${escapeHtml(group.id)}" ${role.groupIds?.includes(group.id) ? "checked" : ""}>${escapeHtml(group.name)}</label>`).join("")}</div></fieldset><fieldset class="role-permission-fieldset"><legend>權限項目</legend><div class="schedule-permission-row"><span>班表</span><label><input type="checkbox" data-role-permission="schedule_view" ${permissions.has("schedule_view") ? "checked" : ""}>查看</label><label><input type="checkbox" data-role-permission="schedule_manage" ${permissions.has("schedule_manage") ? "checked" : ""}>管理</label></div><div class="role-permission-grid">${["group_settings","department_settings","member_settings","leave_settings","permission_settings","attendance_review","meal_admin"].map((permission) => permissionCheckbox(permission, permissions.has(permission))).join("")}</div></fieldset>`,
    headerButtons: `<button class="btn-primary" type="button" data-save-access-role="true">${role.id ? "儲存修改" : "新增"}</button>`,
    hideFooterClose: true
  });
}

async function saveAccessRoleFromForm() {
  const name = document.getElementById("accessRoleName")?.value.trim() || "";
  if (!name) { reportValidationError("請填寫角色名稱"); return; }
  const existing = getAllRoles().find((role) => role.id === modalContext.targetId) || null;
  const permissions = Array.from(document.querySelectorAll("[data-role-permission]:checked")).map((input) => input.dataset.rolePermission || "").filter(Boolean);
  const groupIds = Array.from(document.querySelectorAll("[data-role-group]:checked")).map((input) => input.dataset.roleGroup || "").filter(Boolean);
  await window.schedulerApi.saveAccessRole({ id: existing?.id || "", code: existing?.code || "", name, permissions, groupIds });
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
  if (!hasPermission("schedule_view")) return;
  const archives = await loadArchiveList(null);
  const currentGroup = getCurrentGroup();
  const visibleDates = typeof getVisibleDates === "function" ? getVisibleDates() : [];
  const startDate = visibleDates[0] || getTodayDateString();
  const endDate = visibleDates[visibleDates.length - 1] || getTodayDateString();
  modalContext = { category: "schedule-archive" };
  openEntityListModal({
    title: "班表封存",
    modalClass: "modal modal-wide schedule-archive-modal settings-list-modal",
    body: `${hasPermission("schedule_manage") && currentGroup ? `<div class="archive-create-row"><div class="form-row"><label>群組</label><div class="readonly-pill">${escapeHtml(currentGroup.name)}</div></div><div class="form-row"><label for="archiveStartDate">開始日期</label><input id="archiveStartDate" type="date" value="${escapeHtml(startDate)}"></div><div class="form-row"><label for="archiveEndDate">結束日期</label><input id="archiveEndDate" type="date" value="${escapeHtml(endDate)}"></div><button class="btn-primary" type="button" data-create-schedule-archive="true">封存</button></div>` : ""}<div class="records-table-wrap"><table class="records-table archive-list-table"><thead><tr><th>群組</th><th>日期範圍</th><th>封存時間</th><th>封存人員</th><th>人員數</th><th>資料筆數</th><th>操作</th></tr></thead><tbody>${(archives || []).map((archive) => `<tr><td>${escapeHtml(archive.group_name || "")}</td><td>${escapeHtml(archive.start_date)}～${escapeHtml(archive.end_date)}</td><td>${escapeHtml(String(archive.archived_at || "").replace("T", " ").slice(0,16))}</td><td>${escapeHtml(archive.archived_by_name || "")}</td><td>${Number(archive.member_count || 0)}</td><td>${Number(archive.entry_count || 0)}</td><td><button class="ghost-btn compact-btn" type="button" data-view-schedule-archive="${escapeHtml(archive.id)}">查看</button>${hasPermission("schedule_manage") && roleAppliesToGroup(archive.group_id) ? `<button class="ghost-btn compact-btn" type="button" data-unarchive-schedule="${escapeHtml(archive.id)}">解除封存</button>` : ""}</td></tr>`).join("") || '<tr><td colspan="7">尚無封存班表</td></tr>'}</tbody></table></div>`,
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
  groupFeatureState.entityMap = await window.schedulerApi.getGroupEntityMap();
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
  groupFeatureState.entityMap = await window.schedulerApi.getGroupEntityMap();
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

function getDepartmentsForGroup(groupId) { return groupFeatureState.allDepartments.filter((department) => department.groupId === groupId && !department.deleted); }
function getShiftsForGroup(groupId) { return groupFeatureState.allShifts.filter((shift) => shift.groupId === groupId && !shift.deleted); }
function renderMemberGroupOptions(selectedGroupId) { return getSelectableGroups().map((group) => `<option value="${escapeHtml(group.id)}" ${group.id === selectedGroupId ? "selected" : ""}>${escapeHtml(group.name)}</option>`).join(""); }
function renderMemberUnitOptions(groupId, selectedDeptId = "") { return getDepartmentsForGroup(groupId).map((department) => `<option value="${escapeHtml(department.id)}" ${department.id === selectedDeptId ? "selected" : ""}>${escapeHtml(department.name)}</option>`).join(""); }
function renderMemberGroupShiftSelector(groupId, selectedIds = []) {
  const shifts = getShiftsForGroup(groupId).filter((shift) => !shift.hiddenFromToolbar);
  return `<div class="schedule-dept-list" id="memberScheduleShiftList" hidden>${shifts.map((shift, index) => { const checked = selectedIds.includes(shift.id); return `<label class="schedule-dept-option" draggable="true" data-schedule-shift-option="${escapeHtml(shift.id)}"><input type="checkbox" value="${escapeHtml(shift.id)}" ${checked ? "checked" : ""}><span class="schedule-dept-rank">${checked ? index + 1 : "-"}</span><span>${escapeHtml(shift.name)}</span></label>`; }).join("")}</div>`;
}
function memberShiftNamesForGroup(groupId, selectedIds) {
  const map = new Map(getShiftsForGroup(groupId).map((shift) => [shift.id, shift.name]));
  const names = (selectedIds || []).map((id) => map.get(id)).filter(Boolean);
  return names.length ? names.join("、") : "未指定";
}
function renderMemberRoleOptions(member) {
  const selectedRoleId = member?.roleId || getRoleById(member?.role)?.id || getRoleByLegacyRole(member?.role)?.id || "";
  const options = hasPermission("permission_settings") ? getAllRoles() : getAllRoles().filter((role) => role.id === selectedRoleId);
  return options.map((role) => `<option value="${escapeHtml(role.id)}" ${role.id === selectedRoleId ? "selected" : ""}>${escapeHtml(role.name)}</option>`).join("");
}

function openMemberForm(mode, memberId = "") {
  const returnTo = modalContext?.category === "department-settings"
    ? captureSettingsReturnContext({ category: "department-settings", view: modalContext.view || departmentSettingsView })
    : modalContext?.category === "member-settings" ? captureSettingsReturnContext({ category: "member-settings" }) : null;
  const employeeRole = getAllRoles().find((role) => role.code === "employee") || getAllRoles()[0] || null;
  const member = mode === "edit" ? state.members.find((item) => item.id === memberId) : {
    id: "", code: "", name: "", groupId: groupFeatureState.currentGroupId,
    deptId: getDepartmentsForGroup(groupFeatureState.currentGroupId)[0]?.id || "",
    hireDate: "", leaveDate: "", payByDay: false, fixedRestWeekday: 0,
    scheduleShiftIds: [], roleId: employeeRole?.id || "", role: employeeRole?.id || ""
  };
  if (!member) return;
  if (!canEditMemberAccount(member)) { showInfoMessage("沒有權限修改此帳號"); return; }
  const groupId = member.groupId || groupFeatureState.currentGroupId;
  const selectedShifts = Array.isArray(member.scheduleShiftIds) ? member.scheduleShiftIds : [];
  modalContext = { mode, category: "member", targetId: memberId, returnTo };
  openEntityListModal({
    title: `${mode === "edit" ? "修改" : "新增"}人員`,
    modalClass: "modal modal-member-form",
    body: `<div class="form-grid two-col"><div class="form-row"><label for="memberCode">工號</label><input id="memberCode" type="text" maxlength="12" value="${escapeHtml(member.code)}"></div><div class="form-row"><label for="memberName">姓名</label><input id="memberName" type="text" maxlength="12" value="${escapeHtml(member.name)}"></div><div class="form-row"><label for="memberRole">權限</label><select id="memberRole" ${hasPermission("permission_settings") ? "" : "disabled"}>${renderMemberCustomRoleOptions(member)}</select></div><div class="form-row"><label for="memberSalaryType">計薪方式</label><select id="memberSalaryType"><option value="monthly" ${member.payByDay ? "" : "selected"}>月薪</option><option value="daily" ${member.payByDay ? "selected" : ""}>日薪</option></select></div><div class="form-row"><label for="memberHireDate">到職日</label><input id="memberHireDate" type="date" value="${escapeHtml(member.hireDate)}"></div><div class="form-row"><label for="memberLeaveDate">離職日</label><input id="memberLeaveDate" type="date" value="${escapeHtml(member.leaveDate)}"></div><div class="form-row"><label for="memberFixedRestWeekday">例假星期</label><select id="memberFixedRestWeekday">${REST_WEEKDAY_OPTIONS.map((option) => `<option value="${option.value}" ${normalizeRestWeekday(member.fixedRestWeekday) === option.value ? "selected" : ""}>${option.label}</option>`).join("")}</select></div><div class="form-row"><label for="memberGroup">所屬群組</label><select id="memberGroup">${renderMemberGroupOptions(groupId)}</select></div><div class="form-row"><label for="memberDept">所屬單位</label><select id="memberDept">${renderMemberUnitOptions(groupId, member.deptId || "")}</select></div>${mode === "edit" ? `<div class="form-row"><button class="ghost-btn" type="button" data-reset-member-password="${escapeHtml(member.code)}">重設密碼為 0000</button></div>` : ""}<div class="form-row form-row-wide"><label>排班班別</label><div class="schedule-dept-summary-row"><div class="readonly-pill schedule-shift-summary">${escapeHtml(memberShiftNamesForGroup(groupId, selectedShifts))}</div><button class="ghost-btn compact-btn" type="button" data-toggle-schedule-shifts="true">設定</button></div>${renderMemberGroupShiftSelector(groupId, selectedShifts)}</div></div>`,
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
    id: mode === "edit" ? modalContext.targetId : uid("m"), code: document.getElementById("memberCode")?.value.trim(), name: document.getElementById("memberName")?.value.trim(),
    groupId, deptId, scheduleShiftIds, positionId: previousMember?.positionId || "", proxyMemberId: "", hireDate, leaveDate,
    payByDay: document.getElementById("memberSalaryType")?.value === "daily", fixedRestWeekday: normalizeRestWeekday(document.getElementById("memberFixedRestWeekday")?.value),
    monthlyRestDays: Math.max(0, Number(previousMember?.monthlyRestDays) || 0), roleId, role: roleId
  };
  if (!payload.code || !payload.name) return reportValidationError("請填寫人員編號與姓名");
  if (!payload.groupId) return reportValidationError("請選擇所屬群組");
  if (!payload.deptId) return reportValidationError("請選擇所屬單位");
  try {
    if (previousMember && previousMember.groupId !== payload.groupId) await window.schedulerApi.validateMemberGroupChange(previousMember.code, payload.groupId);
    await window.schedulerApi.syncMemberProfile(payload, previousMember?.code || "");
    await reloadGroupApplicationState();
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

function renderAttendanceGroupOptions(selectedValue) { return `<option value="">全部群組</option>${getSelectableGroups().map((group) => `<option value="${escapeHtml(group.id)}" ${group.id === selectedValue ? "selected" : ""}>${escapeHtml(group.name)}</option>`).join("")}`; }

function renderAttendanceReviewSectionWithGroups() {
  const review = ensureAttendanceReviewState();
  const filters = review.filters;
  const rows = review.rows || [];
  return `<section class="records-section"><div class="records-admin-toolbar overtime-review-toolbar attendance-review-toolbar"><div class="records-admin-filters overtime-review-filters attendance-review-filters"><label class="records-admin-field"><span>開始日期</span><input type="date" value="${escapeHtml(filters.fromDate || "")}" data-attendance-review-filter="fromDate"></label><label class="records-admin-field"><span>結束日期</span><input type="date" value="${escapeHtml(filters.toDate || "")}" data-attendance-review-filter="toDate"></label><label class="records-admin-field"><span>群組</span><select data-attendance-review-filter="groupId">${renderAttendanceGroupOptions(filters.groupId || "")}</select></label><label class="records-admin-field"><span>人員</span><select data-attendance-review-filter="memberId">${memberOptions(filters.memberId, review.members)}</select></label><label class="records-admin-field"><span>異常</span><select data-attendance-review-filter="issueType"><option value="" ${!filters.issueType ? "selected" : ""}>全部顯示</option>${(review.issueTypes || []).map((type) => `<option value="${escapeHtml(type)}" ${filters.issueType === type ? "selected" : ""}>${escapeHtml(type)}</option>`).join("")}</select></label><label class="records-admin-field"><span>狀態</span><select data-attendance-review-filter="status"><option value="unreviewed" ${filters.status === "unreviewed" ? "selected" : ""}>未審</option><option value="reviewed" ${filters.status === "reviewed" ? "selected" : ""}>已審</option><option value="all" ${filters.status === "all" ? "selected" : ""}>全部</option></select></label></div><div class="records-admin-actions overtime-review-actions attendance-review-actions"><button class="ghost-btn compact-btn" type="button" data-export-attendance-review="true">匯出加班</button><button class="primary-btn compact-btn" type="button" data-attendance-review-batch="reviewed">批次審核</button><button class="ghost-btn compact-btn" type="button" data-attendance-review-batch="returned">批次退回</button></div></div>${review.error ? `<div class="auth-error">${escapeHtml(review.error)}</div>` : ""}<div class="records-table-wrap"><table class="records-table attendance-review-table"><thead><tr><th class="attendance-review-check-col"><input type="checkbox" data-attendance-review-check-all></th><th>日期</th><th>員工</th><th>圖示</th><th>群組－單位</th><th>打卡時間</th><th>上班時數</th><th>加班時數</th><th>備註</th><th>異常</th><th>狀態</th><th>操作</th></tr></thead><tbody>${rows.map((row) => {
    const token = `${row.user_id}:${row.work_date}`;
    const groupUnit = [row.groupName || row.group_name || "", row.departmentName || row.department_name || ""].filter(Boolean).join("-") || "-";
    return `<tr><td><input type="checkbox" data-attendance-review-check="${escapeHtml(token)}"></td><td>${escapeHtml(row.work_date || "")}</td><td>${escapeHtml(row.employee_name || "")}</td><td>${renderScheduleIcon(row)}</td><td>${escapeHtml(groupUnit)}</td><td>${renderPunchLine("上班", row.clock_in_at, row.clock_in_location) || "-"}${renderPunchLine("下班", row.clock_out_at, row.clock_out_location)}</td><td>${row.regularHours ?? ""}</td><td>${row.overtimeHours ?? ""}</td><td>${escapeHtml(row.note || "")}</td><td>${escapeHtml((row.issues || []).join("、") || "正常")}</td><td>${renderReviewStatus(row.reviewed)}</td><td><div class="attendance-review-row-actions"><button class="settings-icon-btn attendance-review-action-btn" type="button" data-edit-attendance-review="${escapeHtml(token)}" aria-label="編輯" title="編輯">${actionIcon("edit")}</button><button class="settings-icon-btn attendance-review-action-btn attendance-review-toggle ${row.reviewed ? "is-reviewed" : "is-unreviewed"}" type="button" data-toggle-attendance-review="${escapeHtml(token)}" data-reviewed="${row.reviewed ? "true" : "false"}" aria-label="${row.reviewed ? "取消審核" : "審核"}" title="${row.reviewed ? "取消審核" : "審核"}"><svg viewBox="0 0 24 24"><path d="M9 4h6l1 2h3v15H5V6h3l1-2z"></path><path d="m9 13 2 2 4-5"></path></svg></button>${row.id ? `<button class="settings-icon-btn attendance-review-action-btn" type="button" data-view-attendance-history="${escapeHtml(row.id)}" aria-label="歷程" title="歷程"><svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7"></path><path d="M3 4v5h5"></path><path d="M12 7v5l3 2"></path></svg></button>` : ""}</div></td></tr>`;
  }).join("") || '<tr><td colspan="12">沒有資料</td></tr>'}</tbody></table></div>${renderAttendanceReviewPagination(review)}</section>`;
}

function bindGroupFeatureEvents() {
  document.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
    if (target.id === "scheduleGroupSelect") { void switchScheduleGroup(target.value); return; }
    if (target.id === "memberGroup") { syncMemberGroupFields(target.value); return; }
    if (target.dataset.rolePermission === "schedule_manage" && target.checked) {
      const view = document.querySelector('[data-role-permission="schedule_view"]');
      if (view) view.checked = true;
      return;
    }
    if (target.dataset.rolePermission === "schedule_view" && !target.checked) {
      const manage = document.querySelector('[data-role-permission="schedule_manage"]');
      if (manage) manage.checked = false;
    }
  });
  document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    const action = button.dataset.groupFeatureAction;
    if (action === "group-settings") { event.preventDefault(); closeCoreActionsMenu(); openGroupSettings(); return; }
    if (action === "permission-settings") { event.preventDefault(); closeCoreActionsMenu(); openPermissionSettings(); return; }
    if (action === "schedule-archive") { event.preventDefault(); closeCoreActionsMenu(); void openScheduleArchive(); return; }
    if (button.dataset.addScheduleGroup !== undefined) { openGroupForm(); return; }
    if (button.dataset.editScheduleGroup) { openGroupForm(button.dataset.editScheduleGroup); return; }
    if (button.dataset.saveScheduleGroup !== undefined) { void saveScheduleGroupFromForm().catch((error) => reportValidationError(error.message)); return; }
    if (button.dataset.toggleScheduleGroup) { void toggleScheduleGroup(button.dataset.toggleScheduleGroup).catch((error) => showInfoMessage(error.message)); return; }
    if (button.dataset.deleteScheduleGroup) { void deleteScheduleGroup(button.dataset.deleteScheduleGroup).catch((error) => showInfoMessage(error.message)); return; }
    if (button.dataset.addAccessRole !== undefined) { openAccessRoleForm(); return; }
    if (button.dataset.editAccessRole) { openAccessRoleForm(button.dataset.editAccessRole); return; }
    if (button.dataset.saveAccessRole !== undefined) { void saveAccessRoleFromForm().catch((error) => reportValidationError(error.message)); return; }
    if (button.dataset.deleteAccessRole) { void deleteAccessRole(button.dataset.deleteAccessRole).catch((error) => showInfoMessage(error.message)); return; }
    if (button.dataset.createScheduleArchive !== undefined) { void createScheduleArchive().catch((error) => reportValidationError(error.message)); return; }
    if (button.dataset.viewScheduleArchive) { void viewScheduleArchive(button.dataset.viewScheduleArchive).catch((error) => showInfoMessage(error.message)); return; }
    if (button.dataset.unarchiveSchedule) { void unarchiveSchedule(button.dataset.unarchiveSchedule).catch((error) => showInfoMessage(error.message)); }
  });
  document.addEventListener("dragstart", (event) => {
    const row = event.target.closest?.("[data-group-row]");
    if (!row) return;
    groupFeatureState.dragGroupId = row.dataset.groupRow || "";
    row.classList.add("is-dragging");
  });
  document.addEventListener("dragover", (event) => {
    const row = event.target.closest?.("[data-group-row]");
    if (!row || !groupFeatureState.dragGroupId) return;
    event.preventDefault();
    const dragging = document.querySelector(`[data-group-row="${groupFeatureState.dragGroupId}"]`);
    if (!dragging || dragging === row) return;
    const rect = row.getBoundingClientRect();
    row.parentElement?.insertBefore(dragging, event.clientY < rect.top + rect.height / 2 ? row : row.nextSibling);
  });
  document.addEventListener("dragend", (event) => {
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
  snapshotAllState(normalized);
  groupFeatureState.initialized = true;
  return applyCurrentGroupScope(normalized);
}

function refreshGroupEntityMap(entityMap) {
  groupFeatureState.entityMap = entityMap && typeof entityMap === "object"
    ? entityMap
    : { departments: [], members: [], shifts: [], leaves: [], overtime: [], archiveRanges: [] };
}
