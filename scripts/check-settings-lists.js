const assert = require("assert");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(rootDir, ...parts), "utf8");
const { readRendererCore } = require("./renderer-core-source.js");
const renderer = readRendererCore(rootDir);
const browserExporter = read("src", "renderer", "browser-exporter.js");
const styles = read("src", "renderer", "app.css");
const webApi = read("src", "renderer", "web-api.js");
const apiContract = read("src", "backend", "api-contract.js");
const masterDataService = read("src", "backend", "services", "native-master-data-service.js");
const settingsService = read("src", "backend", "services", "native-settings-service.js");

// Settings UI structure and shared actions.
assert(renderer.includes('class="settings-table-wrap"'), "settings list should render table wrap");
assert(renderer.includes('data-sort-category="${category}"'), "settings list should keep drag category on rows");
assert(renderer.includes("function renderActionIconButton"), "action icon helper should exist");
assert(renderer.includes('renderActionIconButton("edit"'), "edit actions should use the shared icon helper");
assert(renderer.includes('renderActionIconButton("delete"'), "delete actions should use the shared icon helper");
assert(renderer.includes('data-sort-category="department"'), "department settings should support drag sorting");
assert(renderer.includes("const activeMembers = state.members.filter((member) => !member.deleted && isMemberCurrentlyActive(member));"), "department settings should filter active members");
assert(renderer.includes("const homeMembers = activeMembers.filter"), "department view should show active home members");
assert(renderer.includes("departmentAddress") && renderer.includes("departmentLatitude") && renderer.includes("departmentLongitude"), "department form should expose attendance coordinates");
assert(renderer.includes("departmentPublicIp") && renderer.includes("departmentAttendanceEnabled"), "department form should expose attendance IP and enabled flag");

// Browser settings access must use named FYH APIs. Supabase RPC/REST is not a frontend contract.
assert(webApi.includes('request("/api/v1/settings/department",{method:"PUT"'), "department save should use FYH API");
assert(webApi.includes('request("/api/v1/settings/department/delete",{method:"POST"'), "department delete should use FYH API");
assert(webApi.includes('request("/api/v1/settings/shift",{method:"PUT"'), "shift save should use FYH API");
assert(webApi.includes('request("/api/v1/settings/catalog",{method:"PUT"'), "leave/overtime save should use FYH API");
assert(webApi.includes('request("/api/v1/settings/catalog/delete",{method:"POST"'), "catalog delete should use FYH API");
assert(webApi.includes('request("/api/v1/settings/order",{method:"PUT"'), "settings reorder should use FYH API");
assert(webApi.includes('request("/api/v1/attendance/department-settings")'), "department attendance data should use FYH API");
assert(!webApi.includes("callRpc(") && !webApi.includes("/rest/v1/") && !webApi.includes("requestFunction("), "settings browser access must not depend on Supabase transports");
for (const route of ["departmentSave", "departmentDelete", "shiftSave", "catalogSave", "catalogDelete", "settingsReorder", "attendanceDepartmentSettings"]) {
  assert(apiContract.includes(`${route}: Object.freeze(`), `FYH API contract should expose ${route}`);
}

// Native backend owns validation and persistence responsibilities.
assert(masterDataService.includes("repository.saveDepartment(employeeId, normalized)"), "department save should use native repository");
assert(masterDataService.includes("repository.deleteDepartment(employeeId"), "department delete should use native repository");
assert(masterDataService.includes("repository.saveShift(employeeId"), "shift save should use native repository");
assert(masterDataService.includes("repository.saveCatalogItem(employeeId"), "catalog save should use native repository");
assert(masterDataService.includes("repository.deleteCatalogItem("), "catalog delete should use native repository");
assert(masterDataService.includes("attendanceEnabled: Boolean(source.attendanceEnabled)"), "department attendance enabled flag should be normalized by backend");
assert(masterDataService.includes("applicableDepartmentId"), "shift should use the canonical applicable department id");
assert(settingsService.includes("settingsRepository.reorderSettings(employeeId, category, normalizedIds)"), "settings ordering should use native repository");
assert(settingsService.includes("new Set(normalizedIds).size !== normalizedIds.length"), "settings ordering should reject duplicate ids");

// Department and member interactions.
assert(renderer.includes("這個單位仍有班別使用"), "department delete should warn when shifts still use the department");
assert(!renderer.includes("const memberRows = activeMembers.map"), "department member view should be removed");
assert(!renderer.includes('data-set-department-view="member"') && !renderer.includes("人員檢視"), "department settings should not render old view switch");
assert(renderer.includes('data-drop-member="${escapeHtml(member.id)}"'), "department settings should support escaped member drop targets");
assert(renderer.includes('<span>${escapeHtml(member.name)}</span>'), "department settings should show member names without employee codes");
assert(renderer.includes("openListSettings(context.listCategory);"), "saving list items should return to their settings list");
assert(renderer.includes("openDepartmentSettings();"), "saving departments should return to department settings");
assert(renderer.includes("openMemberSettings();"), "saving members should return to member settings");

// Ordering and persistence remain immediate and UUID-backed.
assert(renderer.includes("state.shifts = nextList;"), "shift reorder should persist to state.shifts");
assert(renderer.includes("state.leaves = nextList;"), "leave reorder should persist to state.leaves");
assert(renderer.includes("state.departments = nextList;"), "department reorder should persist to state.departments");
assert(!renderer.includes("function mergeDefaultLeaves"), "leave settings should not restore deleted defaults");
assert(renderer.includes("await forceSave();"), "settings changes should persist through explicit preferences API");
assert(renderer.includes("async function applySelectionToCell") && renderer.includes("await finishScheduleCellMutation(memberId, dateString);"), "schedule cell edits should persist immediately");
assert(renderer.includes("function renderScheduleCell(memberId, dateString)") && renderer.includes("saveScheduleCell"), "schedule cell edits should update changed cells");
assert(renderer.includes("function getChangedScheduleCells(previousSchedule, nextSchedule)") && renderer.includes("await persistScheduleCells(changedCells);"), "schedule restores should persist changed cells only");
assert(renderer.includes("const SCHEDULE_HISTORY_LIMIT = 20") && renderer.includes("let scheduleUndoStack = []") && renderer.includes("let scheduleRedoStack = []"), "schedule history should remain bounded");
assert(renderer.includes("async function finishScheduleCellMutationWithUndo") && renderer.includes("pushScheduleUndoSnapshot(previousSchedule);"), "direct cell edits should remain undoable");
assert(!renderer.includes("}, 250);"), "save queue should not debounce database writes");

// Drag/drop and visibility rules.
assert(renderer.includes("function previewSortableSettingsItem"), "sortable settings should preview insertion position");
assert(renderer.includes("function commitSortedListFromDom"), "sortable settings should commit live DOM order");
assert(renderer.includes("function commitDepartmentMemberOrderFromDom"), "department member order should commit from DOM order");
assert(renderer.includes('document.querySelectorAll(".drag-preview-active, .schedule-order-insert-before, .schedule-order-insert-after")'), "drag preview cleanup should remove stale classes");
assert(renderer.includes("function reopenSettingsModalPreservingScroll") && renderer.includes("reopenSettingsModalPreservingScroll(returnTo)"), "settings rerender should preserve scroll");
assert(renderer.includes("function isDepartmentVisibleInScheduleRange"), "department visibility should affect schedule range");
assert(renderer.includes(".filter((department) => isDepartmentVisibleInScheduleRange(department))"), "hidden departments should be excluded from schedule groups");
assert(renderer.includes("function shiftHasVisibleDepartment"), "shift view should honor hidden departments");

// Shift/member settings contracts.
assert(renderer.includes("function getMembersForScheduleShift"), "shift settings should compute eligible members");
assert(renderer.includes('data-shift-schedule-member="${escapeHtml(member.id)}"'), "shift settings should render schedulable members");
assert(renderer.includes("openMemberForm(\"edit\", memberId);"), "double-clicking a shift member should open member edit");
assert(renderer.includes("function renderMemberScheduleShiftPills"), "member settings should render shift pills");
assert(renderer.includes('class="member-shift-pill-list"'), "member settings should show schedule shifts as pills");
assert(renderer.includes("<div>到職日<br>離職日</div>"), "member settings should merge hire and leave date columns");
assert(renderer.includes("state.shifts.filter((shift) => !shift.hiddenFromToolbar).map((shift) => [shift.name.trim(), shift.id])"), "member import should accept visible schedule shifts only");
assert(renderer.includes("syncMemberProfile"), "member import should persist through canonical member API");
assert(webApi.includes("function normalizeTextArray"), "web api should normalize Postgres text arrays");
assert(renderer.includes("function getAllRoles()") && renderer.includes("groupFeatureState.bundle?.roles") && renderer.includes("getAllRoles().map((role) =>"), "member settings should render configured roles");
assert(!renderer.includes("function renderMemberRoleOptions"), "duplicate legacy role renderer should remain removed");
assert(renderer.includes("function canEditMemberAccount") && renderer.includes('hasPermission("member_settings")'), "member editing should derive from member_settings");
assert(webApi.includes("scheduleShiftIds"), "member schedule shifts should remain UUID-backed");

// Import/export field contracts.
assert(browserExporter.includes("roleName: roleText") && browserExporter.includes("roleNameById") && !browserExporter.includes("parseRoleLabel"), "member import/export should use configured role names");
assert(browserExporter.includes('["工號", "姓名", "排班班別", "權限", "到職日", "離職日", "計薪方式", "例假星期", "所屬單位"]'), "member export column order should remain canonical");
assert(browserExporter.includes('const departmentColumn = getHeaderColumnIndex(sheet, ["所屬單位", "單位"], 9);'), "member import should read home department from canonical position");

// Settings CSS architecture.
assert(styles.includes(".catalog-settings-modal"), "catalog settings modal styles should exist");
assert(styles.includes(".department-settings-modal"), "department settings modal styles should exist");
assert(styles.includes(".settings-table-row-shift"), "shift row styles should exist");
assert(styles.includes(".settings-member-chip"), "shift member chips should be styled");
assert(styles.includes(".member-shift-pill"), "member shift pills should be styled");
assert(!styles.includes(".member-table-row {\n  grid-template-columns: repeat(9"), "member settings should not use equal-width columns");
assert(styles.includes("minmax(280px, 2.7fr)") && styles.includes("minmax(240px, 2.5fr)"), "assignment columns should stay wider than compact columns");
assert(styles.includes(".settings-table-row-leave") && styles.includes(".settings-table-code"), "leave table styles should exist");
assert(styles.includes(".settings-icon-btn"), "settings icon button styles should exist");
assert(styles.includes(".member-main") && styles.includes("font-size: inherit;"), "member name size should match department text");
assert(renderer.includes('<span class="member-pay-type">PT</span>'), "daily-pay members should show PT label");
assert(styles.includes(".member-pay-type") && styles.includes("font-size: 0.85em;") && styles.includes("white-space: nowrap;"), "PT label should remain compact");
assert(!styles.includes(".pay-daily-row .member-main"), "daily-pay members should not use highlighted name background");
assert(styles.includes(".member-inline-list") && styles.includes(".drag-preview-active"), "department member list and drag preview styles should exist");

console.log("settings list checks passed for FYH API architecture");
