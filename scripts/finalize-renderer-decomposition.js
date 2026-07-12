const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const rendererDir = path.join(root, 'src', 'renderer');
const rendererPath = path.join(rendererDir, 'renderer.js');
const buildPath = path.join(root, 'scripts', 'build-js.js');
const corePath = path.join(root, 'scripts', 'renderer-core-source.js');
const testPath = path.join(root, 'tests', 'renderer-final-decomposition.test.js');

const original = fs.readFileSync(rendererPath, 'utf8');

function findFunctionRange(source, name) {
  const re = new RegExp(`(?:^|\\n)(?:async\\s+)?function\\s+${name.replace(/[$]/g, '\\$&')}\\s*\\(`, 'm');
  const match = re.exec(source);
  if (!match) throw new Error(`找不到函式：${name}`);
  const start = match.index + (match[0].startsWith('\n') ? 1 : 0);
  const next = /\n(?:async\s+)?function\s+[A-Za-z0-9_$]+\s*\(/g;
  next.lastIndex = start + 1;
  const nextMatch = next.exec(source);
  const end = nextMatch ? nextMatch.index + 1 : source.length;
  return { start, end, text: source.slice(start, end).trim() };
}

const ranges = new Map();
function getFunction(name) {
  if (!ranges.has(name)) ranges.set(name, findFunctionRange(original, name));
  return ranges.get(name).text;
}

function writeModule(fileName, title, names) {
  const sections = names.map(getFunction);
  const text = `/* ${title}\n * 由 renderer.js 最終拆分；維持既有全域 bundle 與功能行為。\n */\n\n${sections.join('\n\n')}\n`;
  fs.writeFileSync(path.join(rendererDir, fileName), text, 'utf8');
}

const groups = [
  {
    file: 'renderer-runtime-helpers.js',
    title: '執行狀態、單位、人員、班別與目錄查詢共用工具。',
    names: ['setSaveStatus','getDepartmentName','getPositionName','getSalaryTypeLabel','normalizeRestWeekday','getRestWeekdayLabel','getDepartmentSummary','getMemberScheduleShiftIds','getMemberHomeDeptId','getMemberScheduleShiftNames','renderMemberScheduleShiftPills','getMemberShiftPriority','memberCanScheduleShift','getMembersForScheduleShift','shiftAllowsDepartment','getItemList','getItem','getItemTextColor','getLeaveLabel']
  },
  {
    file: 'renderer-records-actions.js',
    title: '打卡管理、加班審核與訂餐設定操作。',
    names: ['timeValueFromIso','findAttendanceAdminRow','openAttendanceEditModal','saveAttendanceEdit','openAttendanceHistoryModal','openOvertimeReviewModal','reviewOvertime','openAdminOvertimeCreateModal','saveAdminOvertimeCreate','readMealAdminProducts','commitMealProductOrderFromDom','saveMealSettingsFromPage']
  },
  {
    file: 'renderer-app-shell.js',
    title: '記錄頁、主視圖切換與全畫面渲染協調。',
    names: ['renderRecordsPage','syncAppView','renderAll']
  },
  {
    file: 'renderer-persistence.js',
    title: '班表狀態整理、延遲儲存與強制儲存。',
    names: ['ensureScheduleSlot','pruneEmptySchedule','buildPersistedState','queueSave','forceSave']
  },
  {
    file: 'renderer-schedule-selection-actions.js',
    title: '班表工具列選取與套用到儲存格的操作。',
    names: ['clearLegacyLeaveFromSlot','clearLegacyOvertimeFromSlot','applySelectionToCell','selectChip','removeAssignmentsByItem']
  },
  {
    file: 'renderer-schedule-assignment-modals.js',
    title: '通用實體視窗、請假與加班指派表單。',
    names: ['openEntityListModal','syncLeaveAssignmentModalUi','syncOvertimeFormUi','openLeaveAssignmentModal','saveLeaveAssignmentFromModal','openOvertimeAssignmentModal','saveOvertimeAssignmentFromModal','syncScheduleOvertimeFormUi']
  },
  {
    file: 'renderer-schedule-compliance-settings.js',
    title: '班表目錄同步、月週設定與例休檢查畫面。',
    names: ['syncScheduleCatalogs','formatMonthText','formatWeekStartLabel','getConfiguredMonthStartDay','formatDateTextFromIso','formatWeekRangeText','getScheduleSlotByDateString','getVisibleScheduleWeeks','buildRestComplianceCalendars','openWeekStartSettingModal','saveWeekStartSettingFromModal','openRestComplianceModal']
  },
  {
    file: 'renderer-auth-actions.js',
    title: '登入與登出操作。',
    names: ['handleSignIn','handleSignOut']
  },
  {
    file: 'renderer-export-actions.js',
    title: '班表期間切換與 SAP、加班、假別匯出操作。',
    names: ['changeScheduleWindowWeeks','exportSapCsv','exportOvertime','exportLeave']
  }
];

for (const group of groups) writeModule(group.file, group.title, group.names);

const bindRange = findFunctionRange(original, 'bindEvents');
ranges.set('bindEvents', bindRange);
const bindSource = bindRange.text;
const bindBody = bindSource.slice(bindSource.indexOf('{') + 1, bindSource.lastIndexOf('}'));

function section(startMarker, endMarker) {
  const start = bindBody.indexOf(startMarker);
  const end = endMarker ? bindBody.indexOf(endMarker, start + startMarker.length) : bindBody.length;
  if (start < 0 || end < 0 || end <= start) throw new Error(`找不到事件拆分邊界：${startMarker}`);
  return bindBody.slice(start, end).trimEnd();
}

const staticSection = section('  const bindClick =', '  const tableWrap =');
const viewportSection = section('  const tableWrap =', '  const deptFilter =');
const filterSection = section('  const deptFilter =', '  document.body.addEventListener("mousedown", beginScheduleHeaderColumnSelection);');
const sessionSection = section('  document.body.addEventListener("mousedown", beginScheduleHeaderColumnSelection);', '  document.body.addEventListener("click", async (event) => {');
const clickSection = section('  document.body.addEventListener("click", async (event) => {', '  document.body.addEventListener("input", (event) => {');
const formSection = section('  document.body.addEventListener("input", (event) => {', '  document.body.addEventListener("mouseover", (event) => {');
const tooltipSection = section('  document.body.addEventListener("mouseover", (event) => {', '  document.body.addEventListener("dragstart", (event) => {');
const dragSection = section('  document.body.addEventListener("dragstart", (event) => {', '  document.addEventListener("click", (event) => {');
const dismissSection = section('  document.addEventListener("click", (event) => {', null);

function wrapBinder(name, title, content) {
  return `/* ${title}\n * 由 renderer.js 最終拆分；事件註冊順序與原行為不變。\n */\n\nfunction ${name}() {\n${content}\n}\n`;
}

fs.writeFileSync(path.join(rendererDir, 'renderer-events-toolbar.js'),
  `/* 工具列、班表捲動與篩選事件。\n * 由 renderer.js 最終拆分；事件註冊順序與原行為不變。\n */\n\nfunction bindStaticToolbarEvents() {\n${staticSection}\n}\n\nfunction bindScheduleViewportEvents() {\n${viewportSection}\n}\n\nfunction bindScheduleFilterEvents() {\n${filterSection}\n}\n`, 'utf8');
fs.writeFileSync(path.join(rendererDir, 'renderer-events-session.js'), wrapBinder('bindScheduleSessionEvents', '班表選取、鍵盤、返回鍵與 Session 逾時事件。', sessionSection), 'utf8');
fs.writeFileSync(path.join(rendererDir, 'renderer-events-click.js'), wrapBinder('bindDelegatedClickEvents', '按鈕、儲存格與雙擊的委派事件。', clickSection), 'utf8');
fs.writeFileSync(path.join(rendererDir, 'renderer-events-form.js'), wrapBinder('bindDelegatedFormEvents', '輸入欄位與選單異動的委派事件。', formSection), 'utf8');
fs.writeFileSync(path.join(rendererDir, 'renderer-events-tooltip.js'), wrapBinder('bindScheduleTooltipEvents', '班表請假與加班提示框事件。', tooltipSection), 'utf8');
fs.writeFileSync(path.join(rendererDir, 'renderer-events-drag.js'), wrapBinder('bindDragAndDropEvents', '班表、設定、人員與訂餐品項拖曳事件。', dragSection), 'utf8');
fs.writeFileSync(path.join(rendererDir, 'renderer-events.js'),
`/* 全域事件註冊總控。\n * 由 renderer.js 最終拆分；只協調各責任模組。\n */\n\nfunction bindCoreMenuDismissEvent() {\n${dismissSection}\n}\n\nfunction bindEvents() {\n  if (eventsBound) {\n    return;\n  }\n  eventsBound = true;\n  bindStaticToolbarEvents();\n  bindScheduleViewportEvents();\n  bindScheduleFilterEvents();\n  bindScheduleSessionEvents();\n  bindDelegatedClickEvents();\n  bindDelegatedFormEvents();\n  bindScheduleTooltipEvents();\n  bindDragAndDropEvents();\n  bindCoreMenuDismissEvent();\n}\n`, 'utf8');

const movedNames = groups.flatMap((group) => group.names).concat(['bindEvents']);
const removeRanges = movedNames.map((name) => ranges.has(name) ? ranges.get(name) : findFunctionRange(original, name));
removeRanges.sort((a, b) => b.start - a.start);
let renderer = original;
for (const range of removeRanges) renderer = renderer.slice(0, range.start) + renderer.slice(range.end);
renderer = renderer.replace(/\n{4,}/g, '\n\n\n').trimEnd() + '\n';
fs.writeFileSync(rendererPath, renderer, 'utf8');

const newModules = groups.map((group) => group.file).concat([
  'renderer-events-toolbar.js',
  'renderer-events-session.js',
  'renderer-events-click.js',
  'renderer-events-form.js',
  'renderer-events-tooltip.js',
  'renderer-events-drag.js',
  'renderer-events.js'
]);

function updateManifest(filePath) {
  let source = fs.readFileSync(filePath, 'utf8');
  const marker = '  "renderer-records-page.js",\n  "renderer.js",';
  if (!source.includes(marker)) throw new Error(`找不到模組清單插入點：${filePath}`);
  const inserted = ['  "renderer-records-page.js",', ...newModules.map((name) => `  "${name}",`), '  "renderer.js",'].join('\n');
  source = source.replace(marker, inserted);
  fs.writeFileSync(filePath, source, 'utf8');
}
updateManifest(buildPath);
updateManifest(corePath);

const expectedMoved = movedNames.filter((name) => name !== 'bindEvents');
const testSource = `const test = require("node:test");\nconst assert = require("node:assert/strict");\nconst fs = require("node:fs");\nconst path = require("node:path");\n\nconst root = path.resolve(__dirname, "..");\nconst read = (file) => fs.readFileSync(path.join(root, file), "utf8");\nconst renderer = read("src/renderer/renderer.js");\nconst build = read("scripts/build-js.js");\nconst core = read("scripts/renderer-core-source.js");\nconst eventRoot = read("src/renderer/renderer-events.js");\nconst clickEvents = read("src/renderer/renderer-events-click.js");\nconst dragEvents = read("src/renderer/renderer-events-drag.js");\nconst formEvents = read("src/renderer/renderer-events-form.js");\n\nconst modules = ${JSON.stringify(newModules, null, 2)};\nconst movedNames = ${JSON.stringify(expectedMoved, null, 2)};\n\ntest("最終拆分後 renderer.js 只保留狀態與啟動流程", () => {\n  const topLevelFunctions = [...renderer.matchAll(/^(?:async\\s+)?function\\s+([A-Za-z0-9_$]+)\\s*\\(/gm)].map((match) => match[1]);\n  assert.deepEqual(topLevelFunctions, ["loadApp", "refreshScheduleCatalogsAfterInitialRender"]);\n  assert.ok(renderer.split(/\\r?\\n/).length < 160, "renderer.js 仍過大");\n  assert.equal(renderer.includes("loadApp();"), true);\n  for (const name of movedNames) assert.equal(renderer.includes("function " + name), false, "renderer.js 仍保留 " + name);\n});\n\ntest("最終模組應依原責任順序進入建置與測試來源", () => {\n  [build, core].forEach((manifest) => {\n    let previous = manifest.indexOf('"renderer-records-page.js"');\n    for (const file of modules) {\n      const index = manifest.indexOf('"' + file + '"');\n      assert.ok(index > previous, "模組順序錯誤：" + file);\n      previous = index;\n    }\n    assert.ok(manifest.indexOf('"renderer.js"') > previous, "renderer.js 應在最終模組之後");\n  });\n});\n\ntest("事件總控應完整註冊所有責任模組", () => {\n  const binders = [\n    "bindStaticToolbarEvents", "bindScheduleViewportEvents", "bindScheduleFilterEvents",\n    "bindScheduleSessionEvents", "bindDelegatedClickEvents", "bindDelegatedFormEvents",\n    "bindScheduleTooltipEvents", "bindDragAndDropEvents", "bindCoreMenuDismissEvent"\n  ];\n  let previous = -1;\n  for (const name of binders) {\n    const index = eventRoot.indexOf(name + "();");\n    assert.ok(index > previous, "事件註冊順序錯誤：" + name);\n    previous = index;\n  }\n  assert.equal(eventRoot.includes("if (eventsBound)"), true);\n});\n\ntest("委派事件應保留主要操作入口", () => {\n  [\n    "dataset.homeAction", "dataset.clockAction", "dataset.saveTodayMeal", "dataset.recordsTab",\n    "dataset.deleteCategory", "dataset.saveLeaveAssignment", "dataset.saveOvertimeAssignment",\n    "dataset.saveDepartment", "dataset.deleteDepartment", "dataset.saveMember", "dataset.deleteMember"\n  ].forEach((marker) => assert.equal(clickEvents.includes(marker), true, "缺少點擊入口：" + marker));\n  ["memberSettingsFilterField", "mealReportFilter", "toggleOvertimePanel", "leaveAssignmentAllDay"].forEach((marker) => {\n    assert.equal(formEvents.includes(marker), true, "缺少表單入口：" + marker);\n  });\n  ["data-table-department-id", "data-table-member-id", "data-schedule-shift-option", "data-member-card", "data-meal-product-row", "data-sort-item"].forEach((marker) => {\n    assert.equal(dragEvents.includes(marker), true, "缺少拖曳入口：" + marker);\n  });\n});\n`;
fs.writeFileSync(testPath, testSource, 'utf8');

console.log(JSON.stringify({
  rendererLines: renderer.split(/\r?\n/).length,
  movedFunctionCount: movedNames.length,
  modules: newModules
}, null, 2));
