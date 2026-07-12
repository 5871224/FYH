const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8").replace(/^\uFEFF/, "");
const write = (file, content) => fs.writeFileSync(path.join(root, file), `${content.trimEnd()}\n`, "utf8");

function extractFunction(source, marker, occurrence = 1) {
  let start = -1;
  let from = 0;
  for (let index = 0; index < occurrence; index += 1) {
    start = source.indexOf(marker, from);
    if (start < 0) throw new Error(`找不到函式：${marker}（第 ${occurrence} 次）`);
    from = start + marker.length;
  }
  const braceStart = source.indexOf("{", start);
  if (braceStart < 0) throw new Error(`找不到函式起始大括號：${marker}`);
  let depth = 0;
  let mode = "code";
  let escaped = false;
  for (let index = braceStart; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (mode === "line") {
      if (char === "\n") mode = "code";
      continue;
    }
    if (mode === "block") {
      if (char === "*" && next === "/") {
        mode = "code";
        index += 1;
      }
      continue;
    }
    if (["single", "double", "template"].includes(mode)) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if ((mode === "single" && char === "'") || (mode === "double" && char === '"') || (mode === "template" && char === "`")) {
        mode = "code";
      }
      continue;
    }
    if (char === "/" && next === "/") {
      mode = "line";
      index += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      mode = "block";
      index += 1;
      continue;
    }
    if (char === "'") { mode = "single"; continue; }
    if (char === '"') { mode = "double"; continue; }
    if (char === "`") { mode = "template"; continue; }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`函式未完整結束：${marker}`);
}

function declaration(block, assignment, finalName) {
  const asyncPattern = new RegExp(`^${assignment}\\s*=\\s*async function\\s+\\w+`);
  const normalPattern = new RegExp(`^${assignment}\\s*=\\s*function\\s+\\w+`);
  if (asyncPattern.test(block)) return block.replace(asyncPattern, `async function ${finalName}`);
  if (normalPattern.test(block)) return block.replace(normalPattern, `function ${finalName}`);
  throw new Error(`無法轉換覆蓋函式：${assignment}`);
}

function removeFunction(source, marker, occurrence = 1) {
  const block = extractFunction(source, marker, occurrence);
  const start = source.indexOf(block);
  let end = start + block.length;
  if (source[end] === ";") end += 1;
  while (source[end] === "\n") end += 1;
  return `${source.slice(0, start)}${source.slice(end)}`;
}

function mustReplace(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`找不到替換位置：${label}`);
  return source.replace(from, to);
}

const recordsPatch = read("src/renderer/v2-records.js");
const personalPatch = read("src/renderer/v2-personal-record-layout.js");
const overtimePatch = read("src/renderer/v2-overtime-admin.js");
const attendancePatch = read("src/renderer/v2-attendance-admin.js");
const formalPage = read("src/renderer/renderer-records-page.js");
const formalViews = read("src/renderer/renderer-records-views.js");
const formalActions = read("src/renderer/renderer-records-actions.js");

const ensureRecordsState = extractFunction(recordsPatch, "function ensureState()")
  .replace("function ensureState", "function ensureRecordsState");
const loadRecordsPage = declaration(extractFunction(recordsPatch, "loadRecordsPage = async function"), "loadRecordsPage", "loadRecordsPage")
  .replaceAll("ensureState", "ensureRecordsState");
const loadMealReport = declaration(extractFunction(recordsPatch, "loadMealReport = async function"), "loadMealReport", "loadMealReport")
  .replaceAll("ensureState", "ensureRecordsState");
const ensureOvertimeReviewState = extractFunction(overtimePatch, "function ensureReviewState()")
  .replace("function ensureReviewState", "function ensureOvertimeReviewState");
const loadOvertimeReview = declaration(extractFunction(overtimePatch, "loadOvertimeReview = async function"), "loadOvertimeReview", "loadOvertimeReview")
  .replaceAll("ensureReviewState", "ensureOvertimeReviewState");
const loadAttendanceAdmin = declaration(extractFunction(attendancePatch, "loadAttendanceAdmin = async function"), "loadAttendanceAdmin", "loadAttendanceAdmin");
const loadMealAdminSettings = extractFunction(formalPage, "async function loadMealAdminSettings");

write("src/renderer/renderer-records-page.js", `/* 記錄頁、管理報表及分頁資料讀取控制。\n * 所有記錄功能使用正式 API 與單一狀態初始化來源。\n */\n\n${ensureRecordsState}\n\n${ensureOvertimeReviewState}\n\n${loadRecordsPage}\n\n${loadMealReport}\n\n${loadOvertimeReview}\n\n${loadAttendanceAdmin}\n\n${loadMealAdminSettings}`);

const viewParts = [
  extractFunction(formalViews, "function formatRecordDateTime"),
  extractFunction(formalViews, "function renderHomeIconButton"),
  declaration(extractFunction(recordsPatch, "renderRecordsTabs = function"), "renderRecordsTabs", "renderRecordsTabs"),
  extractFunction(formalViews, "function memberOptions"),
  extractFunction(formalViews, "function departmentOptions"),
  extractFunction(personalPatch, "function findSegmentItem"),
  extractFunction(personalPatch, "function normalizeScheduleSegments"),
  extractFunction(personalPatch, "function renderScheduleIcon"),
  extractFunction(personalPatch, "function punchLine"),
  declaration(extractFunction(personalPatch, "renderPersonalRecordsSection = function"), "renderPersonalRecordsSection", "renderPersonalRecordsSection"),
  declaration(extractFunction(recordsPatch, "renderMealReportSection = function"), "renderMealReportSection", "renderMealReportSection")
    .replaceAll("ensureState", "ensureRecordsState"),
  extractFunction(overtimePatch, "function formatHours"),
  extractFunction(overtimePatch, "function formatPunchTime"),
  extractFunction(overtimePatch, "function pageButtons").replace("function pageButtons", "function renderOvertimeReviewPagination"),
  declaration(extractFunction(overtimePatch, "renderOvertimeReviewSection = function"), "renderOvertimeReviewSection", "renderOvertimeReviewSection")
    .replaceAll("ensureReviewState", "ensureOvertimeReviewState")
    .replace("pageButtons(review)", "renderOvertimeReviewPagination(review)"),
  declaration(extractFunction(attendancePatch, "renderAttendanceAdminSection = function"), "renderAttendanceAdminSection", "renderAttendanceAdminSection"),
  extractFunction(formalViews, "function renderMealSettingsSection")
];
write("src/renderer/renderer-records-views.js", `/* 個人記錄、訂餐統計、加班審核、打卡管理與訂餐設定畫面。\n * 每種畫面只保留一份正式實作。\n */\n\n${viewParts.join("\n\n")}`);

const attendanceActions = [
  extractFunction(formalActions, "function timeValueFromIso"),
  extractFunction(formalActions, "function findAttendanceAdminRow"),
  declaration(extractFunction(attendancePatch, "openAttendanceEditModal = function"), "openAttendanceEditModal", "openAttendanceEditModal"),
  declaration(extractFunction(attendancePatch, "saveAttendanceEdit = async function"), "saveAttendanceEdit", "saveAttendanceEdit"),
  declaration(extractFunction(attendancePatch, "openAttendanceHistoryModal = async function"), "openAttendanceHistoryModal", "openAttendanceHistoryModal")
];
const overtimeActions = [
  declaration(extractFunction(overtimePatch, "openOvertimeReviewModal = function"), "openOvertimeReviewModal", "openOvertimeReviewModal")
    .replaceAll("ensureReviewState", "ensureOvertimeReviewState"),
  declaration(extractFunction(overtimePatch, "reviewOvertime = async function"), "reviewOvertime", "reviewOvertime"),
  declaration(extractFunction(overtimePatch, "openAdminOvertimeCreateModal = function"), "openAdminOvertimeCreateModal", "openAdminOvertimeCreateModal")
    .replaceAll("ensureReviewState", "ensureOvertimeReviewState"),
  extractFunction(overtimePatch, "async function createForEmployee").replace("async function createForEmployee", "async function createAdminOvertimeForEmployee"),
  extractFunction(overtimePatch, "async function batchReview").replace("async function batchReview", "async function batchReviewOvertime")
];
const cancelMeal = extractFunction(recordsPatch, "async function cancelMeal").replace("async function cancelMeal", "async function cancelMealFromRecords");
const deleteRecordOvertime = `async function deleteRecordOvertime(workDate) {\n  const confirmed = await confirmAction(\`確定刪除 \${workDate} 的加班申請嗎？\`);\n  if (!confirmed) return;\n  try {\n    await window.schedulerApi.deleteAttendanceOvertime(workDate);\n    await loadRecordsPage();\n  } catch (error) {\n    showInfoMessage(error.message || "刪除加班申請失敗");\n  }\n}`;
const mealActions = [
  extractFunction(formalActions, "function readMealAdminProducts"),
  extractFunction(formalActions, "function commitMealProductOrderFromDom"),
  extractFunction(formalActions, "async function deleteMealProduct"),
  extractFunction(formalActions, "async function saveMealSettingsFromPage")
];
write("src/renderer/renderer-records-actions.js", `/* 打卡管理、加班審核、個人記錄與訂餐設定操作。\n * 後載入覆蓋已整合為唯一正式函式。\n */\n\n${attendanceActions.join("\n\n")}\n\n${overtimeActions.join("\n\n")}\n\n${cancelMeal}\n\n${deleteRecordOvertime}\n\n${mealActions.join("\n\n")}`);

const recordsEvents = `/* 記錄頁篩選、分頁、批次審核與個人操作事件。 */\n\nconst recordsReloadTimers = new Map();\n\nfunction scheduleRecordsReload(key, callback) {\n  const previous = recordsReloadTimers.get(key);\n  if (previous) clearTimeout(previous);\n  recordsReloadTimers.set(key, setTimeout(() => {\n    recordsReloadTimers.delete(key);\n    if (typeof callback === "function") void callback();\n  }, 0));\n}\n\nfunction bindRecordsEvents() {\n  document.addEventListener("change", (event) => {\n    const target = event.target;\n    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;\n\n    if (target.dataset.v2PersonalFilter !== undefined) {\n      ensureRecordsState().personalFilters[target.dataset.v2PersonalFilter] = target.value;\n      recordsState.personalPage = 1;\n      scheduleRecordsReload("personal", loadRecordsPage);\n      return;\n    }\n    if (target.dataset.mealReportFilter !== undefined) {\n      recordsState.mealFilters[target.dataset.mealReportFilter] = target.value || "";\n      recordsState.mealPage = 1;\n      scheduleRecordsReload("meal", loadMealReport);\n      return;\n    }\n    if (target.dataset.mealReportView !== undefined) {\n      recordsState.mealReportView = target.value || "detail";\n      renderAll();\n      return;\n    }\n    if (target.dataset.overtimeReviewFilter !== undefined) {\n      ensureOvertimeReviewState().filters[target.dataset.overtimeReviewFilter] = target.value || "";\n      recordsState.overtimeReview.page = 1;\n      scheduleRecordsReload("overtime", loadOvertimeReview);\n      return;\n    }\n    if (target.dataset.attendanceFilter !== undefined) {\n      const field = target.dataset.attendanceFilter;\n      if (field === "issueType") {\n        const showAll = target.value === "__all__";\n        recordsState.attendanceAdmin.filters.abnormalOnly = !showAll;\n        recordsState.attendanceAdmin.filters.issueType = showAll ? "" : target.value || "";\n      } else {\n        recordsState.attendanceAdmin.filters[field] = target.value || "";\n      }\n      recordsState.attendanceAdmin.page = 1;\n      scheduleRecordsReload("attendance", loadAttendanceAdmin);\n      return;\n    }\n    if (target instanceof HTMLInputElement && target.dataset.v2OvertimeCheckAll !== undefined) {\n      document.querySelectorAll("[data-v2-overtime-check]").forEach((input) => { input.checked = target.checked; });\n    }\n  });\n\n  document.addEventListener("click", (event) => {\n    const target = event.target.closest("button");\n    if (!target) return;\n    if (target.dataset.v2PersonalPage) {\n      const page = Number(target.dataset.v2PersonalPage || 1);\n      if (page > 0) { recordsState.personalPage = page; void loadRecordsPage(); }\n      return;\n    }\n    if (target.dataset.v2MealPage) {\n      const page = Number(target.dataset.v2MealPage || 1);\n      if (page > 0) { recordsState.mealPage = page; void loadMealReport(); }\n      return;\n    }\n    if (target.dataset.v2OvertimePage) {\n      const page = Number(target.dataset.v2OvertimePage || 1);\n      if (page > 0) { ensureOvertimeReviewState().page = page; void loadOvertimeReview(); }\n      return;\n    }\n    if (target.dataset.v2AttendancePage) {\n      const page = Number(target.dataset.v2AttendancePage || 1);\n      if (page > 0) { recordsState.attendanceAdmin.page = page; void loadAttendanceAdmin(); }\n      return;\n    }\n    if (target.dataset.v2OvertimeBatch) { void batchReviewOvertime(target.dataset.v2OvertimeBatch); return; }\n    if (target.dataset.v2AdminOvertimeCreate) { void createAdminOvertimeForEmployee(target.dataset.v2AdminOvertimeCreate); return; }\n    if (target.dataset.v2DeleteRecordOvertime) { void deleteRecordOvertime(target.dataset.v2DeleteRecordOvertime); return; }\n    if (target.dataset.v2CancelRecordMeal) { void cancelMealFromRecords(); }\n  });\n}`;
write("src/renderer/renderer-records-events.js", recordsEvents);

let events = read("src/renderer/renderer-events.js");
events = mustReplace(events, "  bindDelegatedFormEvents();\n", "  bindDelegatedFormEvents();\n  bindRecordsEvents();\n", "記錄事件總控");
write("src/renderer/renderer-events.js", events);

let liveFilters = read("src/renderer/v2-live-report-filters.js");
liveFilters = liveFilters.replace("(function installV2LiveReportFilters()", "(function installPeriodExports()");
liveFilters = liveFilters.replace("  const timers = new Map();\n", "");
liveFilters = removeFunction(liveFilters, "function scheduleReload");
liveFilters = removeFunction(liveFilters, "async function loadPersonalRecordsLive");
const changeStart = liveFilters.indexOf('  document.addEventListener("change",');
const clickStart = liveFilters.indexOf('  document.addEventListener("click",', changeStart);
if (changeStart < 0 || clickStart < 0) throw new Error("找不到舊即時篩選事件區塊");
liveFilters = `${liveFilters.slice(0, changeStart)}${liveFilters.slice(clickStart)}`
  .replaceAll("v2ExportPeriodStart", "exportPeriodStart")
  .replaceAll("v2ExportPeriodEnd", "exportPeriodEnd")
  .replaceAll("data-v2-run-period-export", "data-run-period-export")
  .replaceAll("dataset.v2RunPeriodExport", "dataset.runPeriodExport");
write("src/renderer/renderer-period-exports.js", liveFilters);

let webApi = read("src/renderer/web-api.js");
const personalOld = extractFunction(webApi, "async function getPersonalRecords()");
webApi = mustReplace(webApi, personalOld, `async function getPersonalRecords(filters = {}) {\n    ensureSignedIn();\n    return requestFunction("personal-records-v2", filters);\n  }`, "個人記錄正式 API");
const mealStatsOld = extractFunction(webApi, "async function getMealStatsReport()");
webApi = mustReplace(webApi, mealStatsOld, `async function getMealStatsReport(filters = {}) {\n    return getMealReport(filters);\n  }`, "舊訂餐報表相容介面");
const attendanceListOld = extractFunction(webApi, "async function getAttendanceAdminRecords");
webApi = mustReplace(webApi, attendanceListOld, `async function getAttendanceAdminRecords(filters = {}) {\n    ensureSignedIn();\n    return requestFunction("attendance-admin-list-v2", filters);\n  }`, "打卡管理清單 API");
const attendanceHistoryOld = extractFunction(webApi, "async function getAttendanceAdminHistory");
webApi = mustReplace(webApi, attendanceHistoryOld, `async function getAttendanceAdminHistory(recordId) {\n    ensureSignedIn();\n    return requestFunction("attendance-admin-action-v2", { action: "history", recordId });\n  }`, "打卡歷程 API");
const attendanceSaveOld = extractFunction(webApi, "async function saveAttendanceAdminRecord");
webApi = mustReplace(webApi, attendanceSaveOld, `async function saveAttendanceAdminRecord(record) {\n    ensureSignedIn();\n    return requestFunction("attendance-admin-action-v2", { action: "save", record });\n  }`, "打卡儲存 API");
webApi = removeFunction(webApi, "async function getOvertimeReviewList", 2);
webApi = removeFunction(webApi, "async function reviewOvertimeRequest", 2);
webApi = removeFunction(webApi, "async function createAdminOvertimeRequest", 2);
const mealReportOld = extractFunction(webApi, "async function getMealReport");
webApi = mustReplace(webApi, mealReportOld, `async function getMealReport(filters = {}) {\n    ensureSignedIn();\n    return requestFunction("meal-report-v2", filters);\n  }`, "訂餐統計 API");
const mealAdminMarker = "  async function getMealAdminSettings()";
if (!webApi.includes(mealAdminMarker)) throw new Error("找不到訂餐管理 API 插入點");
webApi = webApi.replace(mealAdminMarker, `  async function cancelTodayMealOrder() {\n    ensureSignedIn();\n    return requestFunction("meal-cancel-v2", {});\n  }\n\n${mealAdminMarker}`);
webApi = mustReplace(webApi, "    getMealReport,\n", "    getMealReport,\n    cancelTodayMealOrder,\n", "API 輸出取消訂餐");
webApi = mustReplace(webApi, "const details = Array.isArray(report?.details) ? report.details : [];", "const details = Array.isArray(report?.exportDetails) ? report.exportDetails : (Array.isArray(report?.details) ? report.details : []);", "訂餐匯出完整明細");
write("src/renderer/web-api.js", webApi);

let build = read("scripts/build-js.js");
for (const file of ["v2-records.js", "v2-personal-record-layout.js", "v2-overtime-admin.js", "v2-attendance-admin.js", "v2-live-report-filters.js"]) {
  build = build.replace(`  "${file}",\n`, "");
}
build = mustReplace(build, '  "renderer-records-page.js",\n', '  "renderer-records-page.js",\n  "renderer-records-events.js",\n', "記錄事件建置順序");
build = mustReplace(build, '  "renderer-export-actions.js",\n', '  "renderer-export-actions.js",\n  "renderer-period-exports.js",\n', "期間匯出建置順序");
write("scripts/build-js.js", build);

let core = read("scripts/renderer-core-source.js");
core = mustReplace(core, '  "renderer-records-page.js",\n', '  "renderer-records-page.js",\n  "renderer-records-events.js",\n', "核心來源記錄事件");
core = mustReplace(core, '  "renderer-export-actions.js",\n', '  "renderer-export-actions.js",\n  "renderer-period-exports.js",\n', "核心來源期間匯出");
write("scripts/renderer-core-source.js", core);

for (const file of [
  "src/renderer/v2-records.js",
  "src/renderer/v2-personal-record-layout.js",
  "src/renderer/v2-overtime-admin.js",
  "src/renderer/v2-attendance-admin.js",
  "src/renderer/v2-live-report-filters.js"
]) fs.rmSync(path.join(root, file));

let alignment = read("scripts/check-v2-alignment.js");
for (const file of ["src/renderer/v2-overtime-admin.js", "src/renderer/v2-attendance-admin.js", "src/renderer/v2-records.js"]) {
  alignment = alignment.replace(`  "${file}",\n`, "");
}
const alignmentAnchor = "requiredFiles.forEach((file) => assert(exists(file), `Missing V2 file: ${file}`));";
alignment = mustReplace(alignment, alignmentAnchor, `${alignmentAnchor}\n["v2-records.js", "v2-personal-record-layout.js", "v2-overtime-admin.js", "v2-attendance-admin.js", "v2-live-report-filters.js"].forEach((file) => assert(!exists(\`src/renderer/\${file}\`), \`Record UI still depends on late-loaded patch: \${file}\`));`, "V2 alignment 舊檔禁止");
write("scripts/check-v2-alignment.js", alignment);

let finalCheck = read("scripts/check-v2-final.js");
for (const file of ["src/renderer/v2-overtime-admin.js", "src/renderer/v2-attendance-admin.js", "src/renderer/v2-records.js"]) {
  finalCheck = finalCheck.replace(`  "${file}",\n`, "");
}
finalCheck = mustReplace(finalCheck, 'assert(sourceApp.includes("function isTabletDevice")', '["v2-records.js", "v2-personal-record-layout.js", "v2-overtime-admin.js", "v2-attendance-admin.js", "v2-live-report-filters.js"].forEach((file) => assert(!exists(`src/renderer/${file}`), `記錄管理仍依賴後載入補丁：${file}`));\nassert(sourceApp.includes("function isTabletDevice")', "V2 final 舊檔禁止");
write("scripts/check-v2-final.js", finalCheck);

const tests = `const fs = require("node:fs");\nconst path = require("node:path");\nconst test = require("node:test");\nconst assert = require("node:assert/strict");\n\nconst root = path.resolve(__dirname, "..");\nconst read = (file) => fs.readFileSync(path.join(root, file), "utf8");\nconst formalFiles = [\n  "src/renderer/renderer-records-page.js",\n  "src/renderer/renderer-records-views.js",\n  "src/renderer/renderer-records-actions.js",\n  "src/renderer/renderer-records-events.js",\n  "src/renderer/renderer-period-exports.js"\n];\nconst formalSource = formalFiles.map(read).join("\\n");\n\ntest("記錄與管理畫面不再依賴後載入補丁", () => {\n  for (const file of ["v2-records.js", "v2-personal-record-layout.js", "v2-overtime-admin.js", "v2-attendance-admin.js", "v2-live-report-filters.js"]) {\n    assert.equal(fs.existsSync(path.join(root, "src/renderer", file)), false);\n    assert.doesNotMatch(read("scripts/build-js.js"), new RegExp(file.replace(".", "\\\\.")));\n  }\n});\n\ntest("記錄主要函式各只有一份正式宣告", () => {\n  for (const name of ["loadRecordsPage", "renderPersonalRecordsSection", "renderMealReportSection", "renderOvertimeReviewSection", "renderAttendanceAdminSection", "openAttendanceEditModal", "reviewOvertime"]) {\n    const matches = formalSource.match(new RegExp(\`(?:async\\\\s+)?function\\\\s+\${name}\\\\s*\\\\(\`, "g")) || [];\n    assert.equal(matches.length, 1, \`\${name} 應只有一份正式實作\`);\n    assert.doesNotMatch(formalSource, new RegExp(\`\${name}\\\\s*=\\\\s*(?:async\\\\s+)?function\`));\n  }\n});\n\ntest("正式 web API 使用 V2 記錄與管理端點且沒有同名重複宣告", () => {\n  const api = read("src/renderer/web-api.js");\n  for (const endpoint of ["personal-records-v2", "meal-report-v2", "meal-cancel-v2", "attendance-admin-list-v2", "attendance-admin-action-v2", "attendance-overtime-admin-list", "attendance-overtime-admin-action"]) {\n    assert.match(api, new RegExp(endpoint));\n  }\n  for (const name of ["getOvertimeReviewList", "reviewOvertimeRequest", "createAdminOvertimeRequest", "getAttendanceAdminRecords"]) {\n    const matches = api.match(new RegExp(\`async\\\\s+function\\\\s+\${name}\\\\s*\\\\(\`, "g")) || [];\n    assert.equal(matches.length, 1, \`web-api 的 \${name} 不得重複宣告\`);\n  }\n});\n\ntest("分頁、批次審核、即時篩選與完整訂餐匯出仍存在", () => {\n  assert.match(formalSource, /data-v2-personal-page/);\n  assert.match(formalSource, /data-v2-overtime-batch/);\n  assert.match(formalSource, /scheduleRecordsReload/);\n  assert.match(read("src/renderer/web-api.js"), /report\\?\\.exportDetails/);\n});\n`;
write("tests/renderer-records-admin-consolidation.test.js", tests);

let spec = read("規格書.md");
if (!spec.includes("### 記錄與管理模組單一來源規則")) {
  spec += `\n\n### 記錄與管理模組單一來源規則\n\n- 個人記錄、訂餐統計、加班審核及打卡管理均由正式 renderer 模組提供，不得以後載入檔案覆蓋。\n- 記錄篩選、分頁與批次操作集中由正式記錄事件模組處理。\n- 個人記錄、訂餐報表與打卡管理 API 必須直接使用正式 V2 Edge Function；同名 API 函式不得重複宣告。\n`;
}
write("規格書.md", spec);

console.log("Records and admin patches consolidated.");
