from pathlib import Path
import re

ROOT = Path('.')


def read(path):
    return (ROOT / path).read_text(encoding='utf-8')


def write(path, text):
    (ROOT / path).write_text(text, encoding='utf-8')


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 occurrence, got {count}')
    return text.replace(old, new, 1)


def replace_between(text, start_marker, end_marker, replacement, label):
    start = text.find(start_marker)
    if start < 0:
        raise SystemExit(f'{label}: start marker not found')
    end = text.find(end_marker, start)
    if end < 0:
        raise SystemExit(f'{label}: end marker not found')
    return text[:start] + replacement + text[end:]

# -----------------------------------------------------------------------------
# index.html: function menu is rendered from canonical permissions, not static
# markup followed by hide/show patches. Remove CSS that scans child styles and
# remove the one-time category listener snapshot.
# -----------------------------------------------------------------------------
path = 'src/renderer/index.html'
text = read(path)
text = text.replace('''    .core-actions-menu-category:not(:has(.ops-btn:not([hidden]):not([style*="display: none"]))) {\n      display: none;\n    }\n\n''', '')
menu_start = '            <div class="core-actions-menu" id="coreActionsMenu" aria-hidden="true" role="menu">\n'
menu_end_marker = '          </div>\n          <button class="ghost-btn compact-btn user-menu-auth" id="coreHomeButton"'
start = text.find(menu_start)
end = text.find(menu_end_marker, start)
if start < 0 or end < 0:
    raise SystemExit('index function menu markers not found')
text = text[:start] + '            <div class="core-actions-menu" id="coreActionsMenu" aria-hidden="true" role="menu"></div>\n' + text[end:]
inline_start = '  <script>\n    (() => {\n      const menu = document.getElementById("coreActionsMenu");\n      if (!menu) return;\n      const touchLikePointer = window.matchMedia("(hover: none), (pointer: coarse)");'
inline_pos = text.find(inline_start)
if inline_pos >= 0:
    inline_end = text.find('  </script>', inline_pos)
    if inline_end < 0:
        raise SystemExit('index touch menu script end not found')
    inline_end += len('  </script>')
    text = text[:inline_pos] + text[inline_end:]
write(path, text)

# -----------------------------------------------------------------------------
# Canonical permission menu model and toolbar control rendering.
# -----------------------------------------------------------------------------
path = 'src/renderer/renderer-groups-permissions-archive.js'
text = read(path)
start_marker = 'function ensureFunctionMenuButtons() {'
end_marker = 'function groupUnitNames(group)'
new_block = r'''function getFunctionMenuSections() {
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

'''
text = replace_between(text, start_marker, end_marker, new_block, 'groups permission UI block')
write(path, text)

# -----------------------------------------------------------------------------
# Auth/UI capability helpers: exact permissions only. Remove the generic
# hasManagementAccess / manager-action patch layer.
# -----------------------------------------------------------------------------
path = 'src/renderer/renderer-auth-context.js'
text = read(path)
old = '''function hasManagementAccess() {\n  const commonPermissions = getCommonPermissions();\n  if (commonPermissions.some((permission) => ["settings", "export", "leave_settings"].includes(permission))) return true;\n  const groupMap = getAccessActor().groupPermissions;\n  return Boolean(groupMap && typeof groupMap === "object" && Object.values(groupMap).some((permissions) =>\n    Array.isArray(permissions) && permissions.some((permission) => permission === "schedule_manage" || permission === "department_settings")\n  ));\n}\n\n'''
text = replace_once(text, old, '', 'remove hasManagementAccess')
insert_after = '''function canEditSchedule() {\n  return hasGroupPermission(groupFeatureState.currentGroupId, "schedule_manage");\n}\n'''
new_after = insert_after + '''\nfunction canUseScheduleToolbar() {\n  return canEditSchedule() || hasCommonPermission("leave_settings");\n}\n\nfunction requireCommonUiPermission(permission, label = "此功能") {\n  if (!isLoggedIn()) {\n    openSignInDialog(`${label}前請先登入`);\n    return false;\n  }\n  if (!hasCommonPermission(permission)) {\n    showInfoMessage(`沒有${label}權限`);\n    return false;\n  }\n  return true;\n}\n\nfunction requireCurrentGroupUiPermission(permission, label = "此功能") {\n  if (!isLoggedIn()) {\n    openSignInDialog(`${label}前請先登入`);\n    return false;\n  }\n  if (!hasGroupPermission(groupFeatureState.currentGroupId, permission)) {\n    showInfoMessage(`沒有${label}權限`);\n    return false;\n  }\n  return true;\n}\n'''
text = replace_once(text, insert_after, new_after, 'insert exact UI permission helpers')
# remove generic prompt helper
prompt_start = 'function promptManagerAccess(message) {'
prompt_end = 'function shouldDefaultCollapseToolbar()'
text = replace_between(text, prompt_start, prompt_end, '', 'remove promptManagerAccess')
# replace syncRoleUi completely
sync_start = 'function syncRoleUi() {'
sync_end = 'function renderAuthBar() {'
new_sync = r'''function syncRoleUi() {
  const toolbarCard = document.querySelector(".toolbar-floating-card");
  const toolbarGrid = document.getElementById("toolbarGrid");
  const toolbarEnabled = canUseScheduleToolbar();
  initializeToolbarCollapse();
  if (toolbarGrid) toolbarGrid.hidden = !toolbarEnabled;
  if (toolbarCard) toolbarCard.classList.toggle("toolbar-floating-card-compact", !toolbarEnabled);
  syncToolbarCollapseUi();
  ["shiftChips", "leaveChips", "overtimeChips"].forEach((id) => {
    const element = document.getElementById(id);
    if (!element) return;
    element.classList.toggle("chips-readonly", !canEditSchedule());
  });
  syncPermissionUi();
}

'''
text = replace_between(text, sync_start, sync_end, new_sync, 'replace syncRoleUi')
# replace renderAuthBar completely
bar_start = 'function renderAuthBar() {'
bar_end = 'function renderAuthGate() {'
new_bar = r'''function renderAuthBar() {
  const toggle = document.getElementById("coreActionsToggle");
  const menu = document.getElementById("coreActionsMenu");
  const shell = document.getElementById("coreActionsShell");
  const homeButton = document.getElementById("coreHomeButton");
  if (!toggle || !menu) return;
  const loggedIn = isLoggedIn();
  const hasFunctions = loggedIn && hasFunctionMenuAccess();
  toggle.textContent = "功能";
  toggle.title = "開啟功能";
  toggle.hidden = !hasFunctions;
  if (shell) shell.hidden = !hasFunctions;
  if (homeButton) homeButton.hidden = !loggedIn;
  if (!hasFunctions) closeCoreActionsMenu();
}

'''
text = replace_between(text, bar_start, bar_end, new_bar, 'replace renderAuthBar')
write(path, text)

# -----------------------------------------------------------------------------
# Function-menu events are delegated from the stable container, so render cycles
# cannot lose handlers. Touch interaction is delegated too; no snapshot of menu
# categories is retained.
# -----------------------------------------------------------------------------
path = 'src/renderer/renderer-events-toolbar.js'
text = read(path)
insert_marker = 'function bindStaticToolbarEvents() {'
delegated = r'''function closeFunctionMenuTouchSections(menu, except = null) {
  menu.querySelectorAll(".core-actions-menu-category.touch-open").forEach((category) => {
    if (category === except) return;
    category.classList.remove("touch-open");
    category.querySelector(":scope > .core-actions-menu-trigger")?.setAttribute("aria-expanded", "false");
  });
}

async function runFunctionMenuAction(action) {
  if (action === "week-start-settings") return openWeekStartSettingModal();
  if (action === "auto-schedule-preview") return previewAutoSchedule();
  if (action === "auto-fill-schedule-preview") return openAutoFillSchedulePeriodModal();
  if (action === "auto-schedule-apply") return applyAutoSchedulePreview();
  if (action === "auto-schedule-cancel") return cancelAutoSchedulePreview();
  if (action === "export-workday") return openExportPeriodDialog("workday");
  if (action === "export-sap") return openExportPeriodDialog("sap");
  if (action === "export-leave") return openExportPeriodDialog("leave");
  if (action === "export-overtime") return openExportPeriodDialog("overtime");
}

function bindCoreActionsMenuEvents() {
  const menu = document.getElementById("coreActionsMenu");
  if (!menu) return;
  const touchLikePointer = window.matchMedia("(hover: none), (pointer: coarse)");
  menu.addEventListener("click", (event) => {
    const trigger = event.target instanceof Element ? event.target.closest(".core-actions-menu-trigger") : null;
    if (trigger && touchLikePointer.matches) {
      event.preventDefault();
      event.stopPropagation();
      const category = trigger.closest(".core-actions-menu-category");
      if (!category) return;
      const opening = !category.classList.contains("touch-open");
      closeFunctionMenuTouchSections(menu, category);
      category.classList.toggle("touch-open", opening);
      trigger.setAttribute("aria-expanded", opening ? "true" : "false");
      if (opening) trigger.focus({ preventScroll: true });
      return;
    }
    const button = event.target instanceof Element ? event.target.closest("button[data-function-menu-action]") : null;
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const action = button.dataset.functionMenuAction || "";
    closeCoreActionsMenu();
    void runFunctionMenuAction(action);
  });
  document.addEventListener("click", (event) => {
    if (event.target instanceof Node && menu.contains(event.target)) return;
    closeFunctionMenuTouchSections(menu);
  });
}

'''
text = replace_once(text, insert_marker, delegated + insert_marker, 'insert delegated function menu events')
text = replace_once(text, '  bindAutoFillScheduleControls();\n', '  bindAutoFillScheduleControls();\n  bindCoreActionsMenuEvents();\n', 'bind core actions menu events')
# Remove direct bindings for dynamic function menu controls.
patterns = [
'''  bindClick("exportScheduleButton", () => {\n    closeCoreActionsMenu();\n    openExportPeriodDialog("workday");\n  });\n''',
'''  bindClick("exportSapButton", () => {\n    closeCoreActionsMenu();\n    openExportPeriodDialog("sap");\n  });\n''',
'''  bindClick("exportOvertimeButton", () => {\n    closeCoreActionsMenu();\n    openExportPeriodDialog("overtime");\n  });\n''',
'''  bindClick("exportLeaveButton", () => {\n    closeCoreActionsMenu();\n    openExportPeriodDialog("leave");\n  });\n''',
'''  bindClick("weekStartSettingsButton", () => {\n    closeCoreActionsMenu();\n    openWeekStartSettingModal();\n  });\n''',
'''  bindClick("autoSchedulePreviewButton", async () => {\n    closeCoreActionsMenu();\n    await previewAutoSchedule();\n  });\n''',
'''  bindClick("autoScheduleApplyButton", async () => {\n    closeCoreActionsMenu();\n    await applyAutoSchedulePreview();\n  });\n''',
'''  bindClick("autoScheduleCancelButton", () => {\n    closeCoreActionsMenu();\n    cancelAutoSchedulePreview();\n  });\n'''
]
for i, old in enumerate(patterns, 1):
    text = replace_once(text, old, '', f'remove direct function menu binding {i}')
write(path, text)

# Auto-fill button is now dynamic; retain only delegated modal action binding.
path = 'src/renderer/renderer-auto-fill-schedule.js'
text = read(path)
old = '''function bindAutoFillScheduleControls() {\n  document.getElementById("autoFillSchedulePreviewButton")?.addEventListener("click", (event) => {\n    event.preventDefault();\n    event.stopPropagation();\n    openAutoFillSchedulePeriodModal();\n  });\n\n  document.body.addEventListener("click", async (event) => {'''
new = '''function bindAutoFillScheduleControls() {\n  document.body.addEventListener("click", async (event) => {'''
text = replace_once(text, old, new, 'auto fill delegated binding')
text = text.replace('promptManagerAccess("自動補班需先登入主管帳號")', 'requireCurrentGroupUiPermission("schedule_manage", "自動補班")')
text = text.replace('promptManagerAccess("套用自動補班需先登入主管帳號")', 'requireCurrentGroupUiPermission("schedule_manage", "套用自動補班")')
write(path, text)

# Auto scheduling exact permission.
path = 'src/renderer/renderer-auto-schedule.js'
text = read(path)
text = text.replace('promptManagerAccess("自動排班需先登入主管帳號")', 'requireCurrentGroupUiPermission("schedule_manage", "自動排班")')
text = text.replace('promptManagerAccess("套用自動排班需先登入主管帳號")', 'requireCurrentGroupUiPermission("schedule_manage", "套用自動排班")')
write(path, text)

# Week settings and rest compliance exact permissions.
path = 'src/renderer/renderer-schedule-compliance-settings.js'
text = read(path)
text = text.replace('promptManagerAccess("設定週期規則前請先登入主管帳號")', 'requireCommonUiPermission("settings", "週期設定")')
text = text.replace('promptManagerAccess("執行例休檢查前請先登入主管帳號")', 'requireCurrentGroupUiPermission("schedule_manage", "例休檢查")')
write(path, text)

# Sticky header edit affordances use their exact permission, never a generic role.
path = 'src/renderer/renderer-schedule-layout.js'
text = read(path)
old = '''  const renderCell = (label, dataAttr = "") => `\n    <div class="table-sticky-cell-title">\n      <span class="table-sticky-cell-label">${label}</span>\n      ${hasManagementAccess() && dataAttr ? renderActionIconButton("edit", `${dataAttr}=\\"true\\"`, "table-header-settings-btn") : ""}\n    </div>\n  `;'''
new = '''  const renderCell = (label, allowed = false, dataAttr = "") => `\n    <div class="table-sticky-cell-title">\n      <span class="table-sticky-cell-label">${label}</span>\n      ${allowed && dataAttr ? renderActionIconButton("edit", `${dataAttr}=\\"true\\"`, "table-header-settings-btn") : ""}\n    </div>\n  `;'''
text = replace_once(text, old, new, 'sticky header renderCell exact permission')
text = text.replace('deptCell.innerHTML = renderCell("班別");', 'deptCell.innerHTML = renderCell("班別");')
text = replace_once(text, '  deptCell.innerHTML = renderCell("單位", "data-open-department-settings");\n  personCell.innerHTML = renderCell("人員", "data-open-member-settings");', '  deptCell.innerHTML = renderCell("單位", canManageDepartmentsInCurrentGroup(), "data-open-department-settings");\n  personCell.innerHTML = renderCell("人員", canManageMembersInCurrentGroup(), "data-open-member-settings");', 'sticky header exact controls')
text = replace_once(text, '  const managerButtonAllowance = hasManagementAccess() && state.tableView !== "shift" ? 28 : 0;', '  const departmentButtonAllowance = canManageDepartmentsInCurrentGroup() && state.tableView !== "shift" ? 28 : 0;\n  const memberButtonAllowance = canManageMembersInCurrentGroup() && state.tableView !== "shift" ? 28 : 0;', 'layout exact button allowance')
text = text.replace('measureTextWidth("單位", headerStyle) + managerButtonAllowance', 'measureTextWidth("單位", headerStyle) + departmentButtonAllowance')
text = text.replace('measureTextWidth("人員", headerStyle) + managerButtonAllowance', 'measureTextWidth("人員", headerStyle) + memberButtonAllowance')
write(path, text)

# Tooltip edit action is schedule editing, not any management capability.
path = 'src/renderer/renderer-schedule-tooltip.js'
text = read(path).replace('${hasManagementAccess()\n        ? (isLeave', '${canEditSchedule()\n        ? (isLeave')
write(path, text)

# Schedule toolbar is only for schedule editing or leave settings; export/settings
# alone must not make it appear.
path = 'src/renderer/renderer-app-shell.js'
text = read(path).replace('const showToolbar = showSchedule && hasManagementAccess();', 'const showToolbar = showSchedule && canUseScheduleToolbar();')
write(path, text)

# Home meal card is rendered only when the actor group supports meals; no later DOM
# hiding pass is needed.
path = 'src/renderer/renderer-main-pages.js'
text = read(path)
text = replace_once(text, '  if (!isLoggedIn()) {\n    homeCard.innerHTML = "";\n    return;\n  }\n  homeCard.innerHTML = `', '  if (!isLoggedIn()) {\n    homeCard.innerHTML = "";\n    return;\n  }\n  const actorGroup = getActorGroup();\n  const showMeal = actorGroup?.mealEnabled && actorGroup?.status === "active";\n  homeCard.innerHTML = `', 'home meal capability')
meal_button = '''      <button class="home-action-card" type="button" data-home-action="meal">\n        <span class="home-action-title">訂餐</span>\n      </button>'''
text = replace_once(text, meal_button, '''      ${showMeal ? `<button class="home-action-card" type="button" data-home-action="meal">\n        <span class="home-action-title">訂餐</span>\n      </button>` : ""}''', 'conditional meal home card')
write(path, text)

# Exact permission requirements for delegated privileged actions.
path = 'src/renderer/renderer-events-click.js'
text = read(path)
text = text.replace('promptManagerAccess(`修改${type === "shift" ? "班別" : "假別"}需先登入主管帳號`);', 'requireCurrentGroupUiPermission("schedule_manage", `修改${type === "shift" ? "班別" : "假別"}`);')
insert_marker = 'function bindDelegatedClickEvents() {'
helper = r'''function getUiActionPermissionRequirement(target) {
  const departmentAction = target.dataset.openDepartmentSettings
    || target.dataset.openAddDepartment
    || target.dataset.editDepartment
    || target.dataset.saveDepartment
    || target.dataset.deleteDepartment
    || target.dataset.exportDepartments
    || target.dataset.importDepartments;
  if (departmentAction) return { scope: "group", permission: "department_settings", label: "單位設定" };

  const memberAction = target.dataset.openMemberSettings
    || target.dataset.openAddMember
    || target.dataset.toggleScheduleShifts
    || target.dataset.editMember
    || target.dataset.saveMember
    || target.dataset.deleteMember
    || target.dataset.resetMemberPassword
    || target.dataset.exportMembers
    || target.dataset.importMembers;
  if (memberAction) return { scope: "group", permission: "schedule_manage", label: "人員管理" };

  if (target.dataset.editLeaveAssignment || target.dataset.editOvertimeAssignment
      || target.dataset.saveLeaveAssignment || target.dataset.saveOvertimeAssignment
      || target.dataset.generateAutoSchedule) {
    return { scope: "group", permission: "schedule_manage", label: "班表管理" };
  }

  if (target.dataset.saveWeekStart) return { scope: "common", permission: "settings", label: "週期設定" };

  const catalogCategory = target.dataset.deleteCategory
    || target.dataset.openAdd
    || target.dataset.editItem
    || target.dataset.exportSettings
    || target.dataset.importSettings
    || (target.dataset.saveNamedItem ? target.dataset.saveNamedItem.split(":")[0] : "")
    || (target.dataset.saveShift ? "shift" : "");
  if (catalogCategory === "shift") return { scope: "group", permission: "schedule_manage", label: "班別設定" };
  if (catalogCategory === "leave" || catalogCategory === "overtime") {
    return { scope: "common", permission: "leave_settings", label: "假別設定" };
  }
  return null;
}

function allowUiActionByPermission(target) {
  const requirement = getUiActionPermissionRequirement(target);
  if (!requirement) return true;
  return requirement.scope === "common"
    ? requireCommonUiPermission(requirement.permission, requirement.label)
    : requireCurrentGroupUiPermission(requirement.permission, requirement.label);
}

'''
text = replace_once(text, insert_marker, helper + insert_marker, 'insert exact delegated action permission')
manager_start = '    const managerOnlyAction = Boolean('
manager_end = '    if (target.dataset.openDepartmentSettings) {'
text = replace_between(text, manager_start, manager_end, '    if (!allowUiActionByPermission(target)) return;\n', 'replace generic delegated manager guard')
write(path, text)

# Any remaining generic prompt/management checks are forbidden.
remaining = []
for file in sorted((ROOT / 'src/renderer').glob('renderer-*.js')):
    source = file.read_text(encoding='utf-8')
    for token in ('hasManagementAccess', 'promptManagerAccess', 'manager-action', 'syncFunctionMenuCategoryVisibility'):
        if token in source:
            remaining.append(f'{file}: {token}')
if remaining:
    raise SystemExit('Forbidden generic permission patterns remain:\n' + '\n'.join(remaining))

# Existing test is replaced with the canonical function-menu contract.
write('tests/function-menu-permission-mapping.test.js', r'''const fs = require("node:fs");
const test = require("node:test");
const assert = require("node:assert/strict");

const groups = fs.readFileSync("src/renderer/renderer-groups-permissions-archive.js", "utf8");
const events = fs.readFileSync("src/renderer/renderer-events-toolbar.js", "utf8");
const html = fs.readFileSync("src/renderer/index.html", "utf8");

test("功能選單在渲染時依正式權限建立分類", () => {
  assert.ok(groups.includes('if (hasCommonPermission("settings"))'));
  assert.ok(groups.includes('if (hasGroupPermission(groupId, "schedule_manage"))'));
  assert.ok(groups.includes('if (hasCommonPermission("export"))'));
  assert.ok(groups.includes('data-function-menu-section="${section.id}"'));
  assert.ok(groups.includes('data-function-menu-action="${item.action}"'));
});

test("班表管理只建立排班分類，不隱含設定或匯出", () => {
  assert.ok(groups.includes('id: "schedule",\n      label: "排班"'));
  assert.ok(groups.includes('id: "settings",\n      label: "設定"'));
  assert.ok(groups.includes('id: "export",\n      label: "匯出"'));
  assert.ok(!groups.includes('syncFunctionMenuCategoryVisibility'));
  assert.ok(!html.includes(':has(.ops-btn'));
});

test("動態功能選單使用容器事件委派，重新渲染不會遺失事件", () => {
  assert.ok(events.includes('function bindCoreActionsMenuEvents()'));
  assert.ok(events.includes('button[data-function-menu-action]'));
  assert.ok(events.includes('runFunctionMenuAction(action)'));
  assert.ok(!events.includes('bindClick("exportScheduleButton"'));
  assert.ok(!events.includes('bindClick("weekStartSettingsButton"'));
});
''')

# Architecture guard: fail CI if generic manager visibility patches return.
write('tests/permission-ui-architecture.test.js', r'''const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const rendererDir = path.join("src", "renderer");
const rendererSources = fs.readdirSync(rendererDir)
  .filter((name) => name.startsWith("renderer-") && name.endsWith(".js"))
  .map((name) => fs.readFileSync(path.join(rendererDir, name), "utf8"))
  .join("\n");
const html = fs.readFileSync(path.join(rendererDir, "index.html"), "utf8");

test("禁止以泛用主管權限控制個別功能", () => {
  assert.ok(!rendererSources.includes("hasManagementAccess"));
  assert.ok(!rendererSources.includes("promptManagerAccess"));
  assert.ok(!rendererSources.includes("manager-action"));
});

test("禁止先渲染全部功能再掃 DOM 子項目補隱藏父分類", () => {
  assert.ok(!rendererSources.includes("syncFunctionMenuCategoryVisibility"));
  assert.ok(!html.includes(":has(.ops-btn"));
  assert.ok(!html.includes('class="core-actions-menu-category" role="none"'));
});

test("敏感 UI 使用各自的正式權限", () => {
  const layout = fs.readFileSync(path.join(rendererDir, "renderer-schedule-layout.js"), "utf8");
  const tooltip = fs.readFileSync(path.join(rendererDir, "renderer-schedule-tooltip.js"), "utf8");
  const shell = fs.readFileSync(path.join(rendererDir, "renderer-app-shell.js"), "utf8");
  assert.ok(layout.includes('canManageDepartmentsInCurrentGroup()'));
  assert.ok(layout.includes('canManageMembersInCurrentGroup()'));
  assert.ok(tooltip.includes('canEditSchedule()'));
  assert.ok(shell.includes('showSchedule && canUseScheduleToolbar()'));
});
''')
