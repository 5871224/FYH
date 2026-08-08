const assert = require("assert");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const { readRendererCore } = require("./renderer-core-source.js");
const renderer = readRendererCore(rootDir);
const browserExporter = fs.readFileSync(path.join(rootDir, "src", "renderer", "browser-exporter.js"), "utf8");
const styles = fs.readFileSync(path.join(rootDir, "src", "renderer", "app.css"), "utf8");
const webApi = fs.readFileSync(path.join(rootDir, "src", "renderer", "web-api.js"), "utf8");

assert(renderer.includes('class="settings-table-wrap"'), "settings list should render table wrap");
assert(renderer.includes('data-sort-category="${category}"'), "settings list should keep drag category on rows");
assert(renderer.includes("function renderActionIconButton"), "action icon helper should exist");
assert(renderer.includes('renderActionIconButton("edit"'), "edit actions should use the shared icon helper");
assert(renderer.includes('renderActionIconButton("delete"'), "delete actions should use the shared icon helper");
assert(renderer.includes('data-sort-category="department"'), "department settings should support drag sorting");
assert(renderer.includes("const activeMembers = state.members.filter((member) => !member.deleted && isMemberCurrentlyActive(member));"), "department settings should filter members by active and non-deleted status");
assert(renderer.includes("const homeMembers = activeMembers.filter"), "department view should show active home members");
assert(renderer.includes("departmentAddress") && renderer.includes("departmentLatitude") && renderer.includes("departmentLongitude"), "department form should expose attendance address and coordinates");
assert(renderer.includes("departmentPublicIp") && renderer.includes("departmentAttendanceEnabled"), "department form should expose attendance IP and enabled flag");
assert(
  webApi.includes('callRpc("save_department_v3"')
    && webApi.includes('callRpc("get_department_attendance_settings_v3"')
    && !webApi.includes("save_department_attendance_fields_bulk")
    && !webApi.includes("mapDepartmentWriteRow"),
  "department general/group/attendance access should use the canonical permission-aware RPCs"
);
assert(renderer.includes("這個單位仍有班別使用"), "department delete should warn when shifts still use the department");
assert(!renderer.includes("const memberRows = activeMembers.map"), "department member view should be removed");
assert(!renderer.includes('data-set-department-view="member"') && !renderer.includes("人員檢視"), "department settings should not render the old view switch");
assert(renderer.includes('data-drop-member="${escapeHtml(member.id)}"'), "department settings should support safely escaped member drop targets");
assert(renderer.includes('<span>${escapeHtml(member.name)}</span>'), "department settings should show member names without employee codes");
assert(renderer.includes("openListSettings(context.listCategory);"), "saving list items should return to their settings list");
assert(renderer.includes("openDepartmentSettings();"), "saving departments should return to department settings");
assert(renderer.includes("openMemberSettings();"), "saving members should return to member settings");
assert(renderer.includes("state.shifts = nextList;"), "shift reorder should persist to state.shifts");
assert(renderer.includes("state.leaves = nextList;"), "leave reorder should persist to state.leaves");
assert(renderer.includes("state.departments = nextList;"), "department reorder should persist to state.departments");
assert(!renderer.includes("function mergeDefaultLeaves"), "leave settings should not restore deleted default leave types");
assert(renderer.includes("await forceSave();"), "settings changes should persist through the explicit preferences API");
assert(renderer.includes("async function applySelectionToCell") && renderer.includes("await finishScheduleCellMutation(memberId, dateString);"), "schedule cell edits should persist immediately");
assert(renderer.includes("function renderScheduleCell(memberId, dateString)") && renderer.includes("saveScheduleCell"), "schedule cell edits should update only changed cells");
assert(renderer.includes("function getChangedScheduleCells(previousSchedule, nextSchedule)") && renderer.includes("await persistScheduleCells(changedCells);"), "schedule history restores should persist only changed cells");
assert(renderer.includes("const SCHEDULE_HISTORY_LIMIT = 20") && renderer.includes("let scheduleUndoStack = []") && renderer.includes("let scheduleRedoStack = []"), "schedule undo and redo should keep bounded multi-step stacks");
assert(renderer.includes("async function finishScheduleCellMutationWithUndo") && renderer.includes("pushScheduleUndoSnapshot(previousSchedule);"), "direct schedule cell edits should be undoable without full schedule saves");
assert(renderer.includes('if ((event.ctrlKey || event.metaKey) && (key === "z" || key === "y"))'), "schedule undo and redo should work without requiring a selected cell");
assert(renderer.includes("async function applyAutoSchedulePreview"), "auto schedule apply flow should remain async");
assert(!renderer.includes("}, 250);"), "save queue should not debounce database writes");
assert(!renderer.includes('data-open-leave-request="true"'), "floating toolbar should not show the leave request button");
assert(!renderer.includes('data-open-overtime-request="true"'), "floating toolbar should not show the overtime request button");
assert(renderer.includes("function previewSortableSettingsItem"), "sortable settings rows should preview insertion position while dragging");
assert(renderer.includes("function commitSortedListFromDom"), "sortable settings rows should commit the live drag order");
assert(renderer.includes("function commitDepartmentMemberOrderFromDom"), "department member drag order should commit from the live DOM order");
assert(renderer.includes('document.querySelectorAll(".drag-preview-active, .schedule-order-insert-before, .schedule-order-insert-after")'), "drag preview cleanup should remove stale classes even when an item is dropped in place");
assert(renderer.includes("function reopenSettingsModalPreservingScroll") && renderer.includes("reopenSettingsModalPreservingScroll(returnTo)"), "settings rerender should restore modal scroll position through the shared helper");
assert(renderer.includes("function isDepartmentVisibleInScheduleRange"), "department hidden flag should be part of schedule table visibility");
assert(renderer.includes(".filter((department) => isDepartmentVisibleInScheduleRange(department))"), "hidden departments should be excluded from schedule table groups and filters");
assert(renderer.includes("function shiftHasVisibleDepartment"), "shift view should hide shifts that only belong to hidden departments");
assert(renderer.includes("function getMembersForScheduleShift"), "shift settings should compute eligible members");
assert(renderer.includes('data-shift-schedule-member="${escapeHtml(member.id)}"'), "shift settings should render schedulable members");
assert(renderer.includes("openMemberForm(\"edit\", memberId);"), "double-clicking a shift member should open that member");
assert(renderer.includes("function renderMemberScheduleShiftPills"), "member settings should render shift pills");
assert(renderer.includes('class="member-shift-pill-list"'), "member settings should show schedule shifts as pills");
assert(renderer.includes("<div>到職日<br>離職日</div>"), "member settings should merge hire and leave date columns");
assert(renderer.includes("state.shifts.filter((shift) => !shift.hiddenFromToolbar).map((shift) => [shift.name.trim(), shift.id])"), "member import should only accept visible schedule shifts");
assert(renderer.includes("syncMemberProfile"), "member import should persist member accounts through the canonical member API");
assert(webApi.includes("function normalizeTextArray"), "web api should normalize Postgres text arrays");
assert(renderer.includes("function renderMemberRoleOptions") && renderer.includes("getAllAccessRoles"), "member settings should render configured access roles instead of fixed legacy role choices");
assert(renderer.includes("function canEditMemberAccount") && renderer.includes('hasPermission("member_settings")'), "member editing capability should derive from member_settings");
assert(browserExporter.includes("function parseRoleLabel"), "member import/export should preserve role labels as data compatibility only");
assert(webApi.includes("scheduleShiftIds"), "member schedule shifts should stay on uuid-backed scheduleShiftIds");
assert(browserExporter.includes('["工號", "姓名", "排班班別", "權限", "到職日", "離職日", "計薪方式", "例假星期", "所屬單位"]'), "member export should place home department after rest weekday");
assert(browserExporter.includes('const departmentColumn = getHeaderColumnIndex(sheet, ["所屬單位", "單位"], 9);'), "member import should read the home department after rest weekday by default");

assert(styles.includes(".catalog-settings-modal"), "catalog settings modal styles should exist");
assert(styles.includes(".department-settings-modal"), "department settings modal styles should exist");
assert(styles.includes(".settings-table-row-shift"), "shift table row styles should exist");
assert(styles.includes(".settings-member-chip"), "shift schedulable member chips should be styled");
assert(styles.includes(".member-shift-pill"), "member shift pills should be styled");
assert(!styles.includes(".member-table-row {\n  grid-template-columns: repeat(9"), "member settings table should not use equal-width columns");
assert(styles.includes("minmax(280px, 2.7fr)") && styles.includes("minmax(240px, 2.5fr)"), "shift/member assignment columns should be wider than compact columns");
assert(styles.includes(".settings-table-row-leave"), "leave table row styles should exist");
assert(styles.includes(".settings-table-code"), "leave settings code column styles should exist");
assert(styles.includes(".settings-icon-btn"), "settings icon button styles should exist");
assert(styles.includes(".member-main") && styles.includes("font-size: inherit;"), "member name size should match department text size");
assert(renderer.includes('<span class="member-pay-type">PT</span>'), "daily-pay schedule members should show a PT label after their name");
assert(styles.includes(".member-pay-type") && styles.includes("font-size: 0.85em;"), "daily-pay PT label should be smaller than the member name");
assert(styles.includes(".member-pay-type") && styles.includes("white-space: nowrap;"), "daily-pay PT label should not wrap");
assert(!styles.includes(".pay-daily-row .member-main"), "daily-pay schedule members should not use highlighted name background");
assert(styles.includes(".member-inline-list"), "department row should render inline member list");
assert(styles.includes(".drag-preview-active"), "drag preview style should exist");

console.log("settings list checks passed");
