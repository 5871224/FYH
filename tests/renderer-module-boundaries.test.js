const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const renderer = read("src/renderer/renderer.js");
const build = read("scripts/build-js.js");
const core = read("scripts/renderer-core-source.js");
const eventRoot = read("src/renderer/renderer-events.js");
const clickEvents = read("src/renderer/renderer-events-click.js");
const dragEvents = read("src/renderer/renderer-events-drag.js");
const formEvents = read("src/renderer/renderer-events-form.js");
const recordsEvents = read("src/renderer/renderer-records-events.js");

const modules = [
  "renderer-runtime-helpers.js",
  "renderer-records-actions.js",
  "renderer-app-shell.js",
  "renderer-persistence.js",
  "renderer-schedule-selection-actions.js",
  "renderer-schedule-assignment-modals.js",
  "renderer-schedule-compliance-settings.js",
  "renderer-auth-actions.js",
  "renderer-export-actions.js",
  "renderer-events-toolbar.js",
  "renderer-events-session.js",
  "renderer-events-click.js",
  "renderer-events-form.js",
  "renderer-events-tooltip.js",
  "renderer-events-drag.js",
  "renderer-events.js"
];
const movedNames = [
  "setSaveStatus",
  "getDepartmentName",
  "getSalaryTypeLabel",
  "normalizeRestWeekday",
  "getRestWeekdayLabel",
  "getDepartmentSummary",
  "getMemberScheduleShiftIds",
  "getMemberHomeDeptId",
  "getMemberScheduleShiftNames",
  "renderMemberScheduleShiftPills",
  "getMemberShiftPriority",
  "memberCanScheduleShift",
  "getMembersForScheduleShift",
  "shiftAllowsDepartment",
  "getItemList",
  "getItem",
  "getItemTextColor",
  "getLeaveLabel",
  "timeValueFromIso",
  "findAttendanceReviewRow",
  "openAttendanceReviewEditModal",
  "saveAttendanceReviewEdit",
  "openAttendanceHistoryModal",
  "setAttendanceReviewed",
  "batchReviewAttendance",
  "openAdminAttendanceCreateModal",
  "saveAdminAttendanceCreate",
  "readMealAdminProducts",
  "commitMealProductOrderFromDom",
  "saveMealSettingsFromPage",
  "renderRecordsPage",
  "syncAppView",
  "renderAll",
  "ensureScheduleSlot",
  "pruneEmptySchedule",
  "buildPersistedState",
  "queueSave",
  "forceSave",
  "clearLeaveFromSlot",
  "clearOvertimeFromSlot",
  "applySelectionToCell",
  "selectChip",
  "removeAssignmentsByItem",
  "openEntityListModal",
  "syncLeaveAssignmentModalUi",
  "syncOvertimeFormUi",
  "openLeaveAssignmentModal",
  "saveLeaveAssignmentFromModal",
  "openOvertimeAssignmentModal",
  "saveOvertimeAssignmentFromModal",
  "syncScheduleOvertimeFormUi",
  "syncScheduleCatalogs",
  "getConfiguredMonthStartDay",
  "formatDateTextFromIso",
  "formatWeekRangeText",
  "getScheduleSlotByDateString",
  "getVisibleScheduleWeeks",
  "buildRestComplianceCalendars",
  "openWeekStartSettingModal",
  "saveWeekStartSettingFromModal",
  "openRestComplianceModal",
  "handleSignIn",
  "handleSignOut",
  "changeScheduleWindowWeeks",
  "exportSapCsv",
  "exportAttendanceReview",
  "exportLeave"
];

test("renderer.js 只保留狀態與啟動流程", () => {
  const topLevelFunctions = [...renderer.matchAll(/^(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/gm)].map((match) => match[1]);
  assert.deepEqual(topLevelFunctions, ["loadApp"]);
  assert.ok(renderer.split(/\r?\n/).length < 160, "renderer.js 仍過大");
  assert.equal(renderer.includes("loadApp();"), true);
  for (const name of movedNames) assert.equal(renderer.includes("function " + name), false, "renderer.js 仍保留 " + name);
});

test("模組應依責任順序進入建置與測試來源", () => {
  [build, core].forEach((manifest) => {
    let previous = manifest.indexOf('"renderer-records-page.js"');
    for (const file of modules) {
      const index = manifest.indexOf('"' + file + '"');
      assert.ok(index > previous, "模組順序錯誤：" + file);
      previous = index;
    }
    assert.ok(manifest.indexOf('"renderer.js"') > previous, "renderer.js 應在責任模組之後");
  });
});

test("事件總控應完整註冊所有責任模組", () => {
  const binders = [
    "bindStaticToolbarEvents", "bindScheduleViewportEvents", "bindScheduleFilterEvents",
    "bindScheduleSessionEvents", "bindDelegatedClickEvents", "bindDelegatedFormEvents",
    "bindScheduleTooltipEvents", "bindDragAndDropEvents", "bindCoreMenuDismissEvent"
  ];
  let previous = -1;
  for (const name of binders) {
    const index = eventRoot.indexOf(name + "();");
    assert.ok(index > previous, "事件註冊順序錯誤：" + name);
    previous = index;
  }
  assert.equal(eventRoot.includes("if (eventsBound)"), true);
});

test("委派事件應保留主要操作入口", () => {
  [
    "dataset.homeAction", "dataset.personalClockAction", "dataset.saveTodayMeal", "dataset.recordsTab",
    "dataset.editAttendanceReview", "dataset.toggleAttendanceReview", "dataset.saveAttendanceReview",
    "dataset.deleteCategory", "dataset.saveLeaveAssignment", "dataset.saveOvertimeAssignment",
    "dataset.saveDepartment", "dataset.deleteDepartment", "dataset.saveMember", "dataset.deleteMember"
  ].forEach((marker) => assert.equal(clickEvents.includes(marker), true, "缺少點擊入口：" + marker));
  ["memberSettingsFilterField", "leaveAssignmentAllDay"].forEach((marker) => {
    assert.equal(formEvents.includes(marker), true, "缺少表單入口：" + marker);
  });
  ["mealReportFilter", "attendanceReviewFilter", "personalAttendanceField"].forEach((marker) => {
    assert.equal(recordsEvents.includes(marker), true, "缺少記錄篩選入口：" + marker);
  });
  ["data-table-department-id", "data-table-member-id", "data-schedule-shift-option", "data-member-card", "data-meal-product-row", "data-sort-item"].forEach((marker) => {
    assert.equal(dragEvents.includes(marker), true, "缺少拖曳入口：" + marker);
  });
});
