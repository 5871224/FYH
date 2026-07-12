const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8").replace(/^\uFEFF/, "");
const write = (file, content) => fs.writeFileSync(path.join(root, file), `${content.trimEnd()}\n`, "utf8");

function mustReplace(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`找不到整合位置：${label}`);
  return source.replace(from, to);
}

function walkFiles(directory, predicate) {
  const results = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) results.push(...walkFiles(fullPath, predicate));
    if (entry.isFile() && predicate(fullPath)) results.push(fullPath);
  }
  return results;
}

// 共用登入後資料狀態工廠與重設流程。
let foundation = read("src/renderer/renderer-foundation.js");
const stateFactories = `function createAttendanceState() {
  return { loading: false, saving: false, record: null, serverDate: "", error: "" };
}

function createAttendanceOvertimeState() {
  return { loading: false, expanded: false, status: null, error: "" };
}

function createMealOrderState() {
  return { loading: false, status: null, error: "" };
}

function resetLoadedUserRuntimeState() {
  currentMember = null;
  attendanceState = createAttendanceState();
  attendanceOvertimeState = createAttendanceOvertimeState();
  mealOrderState = createMealOrderState();
  recordsState = createRecordsState();
  appInfo = null;
}

`;
foundation = mustReplace(foundation, "function createRecordsState() {", `${stateFactories}function createRecordsState() {`, "使用者狀態工廠");
write("src/renderer/renderer-foundation.js", foundation);

let renderer = read("src/renderer/renderer.js");
renderer = mustReplace(renderer, `let attendanceState = {
  loading: false,
  saving: false,
  record: null,
  serverDate: "",
  error: ""
};
let attendanceOvertimeState = {
  loading: false,
  expanded: false,
  status: null,
  error: ""
};
let mealOrderState = {
  loading: false,
  status: null,
  error: ""
};`, `let attendanceState = createAttendanceState();
let attendanceOvertimeState = createAttendanceOvertimeState();
let mealOrderState = createMealOrderState();`, "主程式狀態初始值");
renderer = mustReplace(renderer, `      state = createEmptyState();
      currentMember = null;
      attendanceState = { loading: false, saving: false, record: null, serverDate: "", error: "" };
      attendanceOvertimeState = { loading: false, expanded: false, status: null, error: "" };
      mealOrderState = { loading: false, status: null, error: "" };
      recordsState = createRecordsState();
      appInfo = null;`, `      state = createEmptyState();
      resetLoadedUserRuntimeState();`, "未登入狀態重設");
renderer = mustReplace(renderer, `    state = createEmptyState();
    currentSession = null;
    currentProfile = null;
    currentMember = null;
    attendanceState = { loading: false, saving: false, record: null, serverDate: "", error: "" };
    attendanceOvertimeState = { loading: false, expanded: false, status: null, error: "" };
    mealOrderState = { loading: false, status: null, error: "" };
    recordsState = createRecordsState();
    appInfo = null;`, `    state = createEmptyState();
    currentSession = null;
    currentProfile = null;
    resetLoadedUserRuntimeState();`, "載入失敗狀態重設");
write("src/renderer/renderer.js", renderer);

let authActions = read("src/renderer/renderer-auth-actions.js");
authActions = mustReplace(authActions, `  currentSession = null;
  currentProfile = null;
  currentMember = null;
  attendanceState = { loading: false, saving: false, record: null, serverDate: "", error: "" };
  attendanceOvertimeState = { loading: false, expanded: false, status: null, error: "" };
  mealOrderState = { loading: false, status: null, error: "" };
  recordsState = createRecordsState();
  appInfo = null;`, `  currentSession = null;
  currentProfile = null;
  resetLoadedUserRuntimeState();`, "登出狀態重設");
write("src/renderer/renderer-auth-actions.js", authActions);

// 記錄頁篩選只保留正式記錄事件處理器。
let formEvents = read("src/renderer/renderer-events-form.js");
for (const [block, label] of [
  [`    if (target instanceof HTMLSelectElement && target.dataset.mealReportFilter) {
      recordsState.mealFilters[target.dataset.mealReportFilter] = target.value || "";
      return;
    }
`, "選單訂餐統計篩選"],
  [`    if (target instanceof HTMLSelectElement && target.dataset.overtimeReviewFilter) {
      recordsState.overtimeReview.filters[target.dataset.overtimeReviewFilter] = target.value || "";
      return;
    }
`, "選單加班審核篩選"],
  [`    if (target instanceof HTMLSelectElement && target.dataset.attendanceFilter) {
      const field = target.dataset.attendanceFilter;
      if (field === "issueType") {
        const showAll = target.value === "__all__";
        recordsState.attendanceAdmin.filters.abnormalOnly = !showAll;
        recordsState.attendanceAdmin.filters.issueType = showAll ? "" : target.value || "";
      } else {
        recordsState.attendanceAdmin.filters[field] = target.value || "";
      }
      return;
    }
`, "選單打卡管理篩選"],
  [`    if (target.dataset.mealReportFilter) {
      recordsState.mealFilters[target.dataset.mealReportFilter] = target.value || "";
      return;
    }
`, "輸入訂餐統計篩選"],
  [`    if (target.dataset.overtimeReviewFilter) {
      recordsState.overtimeReview.filters[target.dataset.overtimeReviewFilter] = target.value || "";
      return;
    }
`, "輸入加班審核篩選"],
  [`    if (target.dataset.attendanceFilter) {
      const field = target.dataset.attendanceFilter;
      recordsState.attendanceAdmin.filters[field] = target.type === "checkbox" ? target.checked : target.value || "";
      return;
    }
`, "輸入打卡管理篩選"]
]) {
  formEvents = mustReplace(formEvents, block, "", label);
}
write("src/renderer/renderer-events-form.js", formEvents);

// 自動排班與自動補班共用預覽套用流程。
let scheduleInteraction = read("src/renderer/renderer-schedule-interaction.js");
const persistFunction = `async function persistScheduleCells(cells) {
  const payloads = [];
  (Array.isArray(cells) ? cells : []).forEach(({ memberId, dateString }) => {
    const member = state.members.find((item) => item.id === memberId);
    if (!member) {
      return;
    }
    const key = getScheduleKeyForDateString(memberId, dateString);
    payloads.push({
      memberId,
      memberCode: member.code || "",
      dateString,
      slot: key ? state.schedule[key] || null : null
    });
  });
  if (payloads.length) {
    await window.schedulerApi.saveScheduleCells(payloads);
  }
}`;
const previewHelper = `${persistFunction}

async function applySchedulePreviewSlots(previewSlots) {
  const changedCells = Object.keys(previewSlots || {}).map(parseScheduleKeyParts).filter(Boolean);
  if (!changedCells.length) {
    autoSchedulePreview = null;
    renderAll();
    return 0;
  }
  rememberScheduleUndoSnapshot();
  Object.entries(previewSlots).forEach(([key, slot]) => {
    state.schedule[key] = deepClone(slot);
  });
  autoSchedulePreview = null;
  pruneEmptySchedule();
  renderAll();
  await persistScheduleCells(changedCells);
  return changedCells.length;
}`;
scheduleInteraction = mustReplace(scheduleInteraction, persistFunction, previewHelper, "排班預覽共用套用函式");
write("src/renderer/renderer-schedule-interaction.js", scheduleInteraction);

let autoFill = read("src/renderer/renderer-auto-fill-schedule.js");
autoFill = mustReplace(autoFill, `  const previewSlots = autoSchedulePreview?.slots || {};
  const changedCells = Object.keys(previewSlots).map(parseScheduleKeyParts).filter(Boolean);
  if (!changedCells.length) {
    autoSchedulePreview = null;
    renderAll();
    showInfoMessage("自動補班預覽沒有需要套用的變更");
    return;
  }
  rememberScheduleUndoSnapshot();
  Object.entries(previewSlots).forEach(([key, slot]) => {
    state.schedule[key] = deepClone(slot);
  });
  autoSchedulePreview = null;
  pruneEmptySchedule();
  renderAll();
  await persistScheduleCells(changedCells);
  showInfoMessage(\`已套用自動補班預覽，共寫入 \${changedCells.length} 格\`);`, `  const changedCount = await applySchedulePreviewSlots(autoSchedulePreview?.slots || {});
  if (!changedCount) {
    showInfoMessage("自動補班預覽沒有需要套用的變更");
    return;
  }
  showInfoMessage(\`已套用自動補班預覽，共寫入 \${changedCount} 格\`);`, "自動補班套用流程");
write("src/renderer/renderer-auto-fill-schedule.js", autoFill);

let autoSchedule = read("src/renderer/renderer-auto-schedule.js");
autoSchedule = mustReplace(autoSchedule, `  const previewSlots = autoSchedulePreview.slots || {};
  const changedCells = Object.keys(previewSlots).map(parseScheduleKeyParts).filter(Boolean);
  if (!changedCells.length) {
    autoSchedulePreview = null;
    renderAll();
    showInfoMessage("自動排班預覽沒有需要套用的變更");
    return;
  }
  rememberScheduleUndoSnapshot();
  Object.entries(previewSlots).forEach(([key, slot]) => {
    state.schedule[key] = deepClone(slot);
  });
  autoSchedulePreview = null;
  pruneEmptySchedule();
  renderAll();
  await persistScheduleCells(changedCells);
  showInfoMessage("已套用自動排班預覽");`, `  const changedCount = await applySchedulePreviewSlots(autoSchedulePreview.slots || {});
  if (!changedCount) {
    showInfoMessage("自動排班預覽沒有需要套用的變更");
    return;
  }
  showInfoMessage("已套用自動排班預覽");`, "自動排班套用流程");
write("src/renderer/renderer-auto-schedule.js", autoSchedule);

// 正式化記錄頁 DOM data-* 與 class 名稱。
const tokenMap = new Map([
  ["data-v2-personal-filter", "data-personal-record-filter"],
  ["v2PersonalFilter", "personalRecordFilter"],
  ["data-v2-personal-page", "data-personal-record-page"],
  ["v2PersonalPage", "personalRecordPage"],
  ["data-v2-meal-page", "data-meal-report-page"],
  ["v2MealPage", "mealReportPage"],
  ["data-v2-overtime-page", "data-overtime-review-page"],
  ["v2OvertimePage", "overtimeReviewPage"],
  ["data-v2-attendance-page", "data-attendance-admin-page"],
  ["v2AttendancePage", "attendanceAdminPage"],
  ["data-v2-overtime-batch", "data-overtime-review-batch"],
  ["v2OvertimeBatch", "overtimeReviewBatch"],
  ["data-v2-admin-overtime-create", "data-admin-overtime-create"],
  ["v2AdminOvertimeCreate", "adminOvertimeCreate"],
  ["data-v2-delete-record-overtime", "data-delete-record-overtime"],
  ["v2DeleteRecordOvertime", "deleteRecordOvertime"],
  ["data-v2-cancel-record-meal", "data-cancel-record-meal"],
  ["v2CancelRecordMeal", "cancelRecordMeal"],
  ["data-v2-overtime-check-all", "data-overtime-review-check-all"],
  ["v2OvertimeCheckAll", "overtimeReviewCheckAll"],
  ["data-v2-overtime-check", "data-overtime-review-check"],
  ["v2OvertimeCheck", "overtimeReviewCheck"],
  ["v2-personal-record-table", "personal-record-table"],
  ["v2-overtime-review-table", "overtime-review-table"],
  ["v2-overtime-check-col", "overtime-review-check-col"],
  ["v2-overtime-date-col", "overtime-review-date-col"],
  ["v2-overtime-status-col", "overtime-review-status-col"],
  ["v2-overtime-action-col", "overtime-review-action-col"],
  ["v2-overtime-action-buttons", "overtime-review-action-buttons"]
]);
const sourceFiles = [
  ...walkFiles(path.join(root, "src", "renderer"), (file) => /\.(?:js|css)$/.test(file) && !/[\\/]app\.(?:js|css)$/.test(file)),
  ...walkFiles(path.join(root, "tests"), (file) => file.endsWith(".js")),
  ...walkFiles(path.join(root, "scripts"), (file) => file.endsWith(".js") && !file.endsWith("consolidate-js-helpers.js"))
];
for (const filePath of sourceFiles) {
  let source = fs.readFileSync(filePath, "utf8");
  const original = source;
  for (const [from, to] of tokenMap) source = source.split(from).join(to);
  if (source !== original) fs.writeFileSync(filePath, source, "utf8");
}

// 架構稽核納入正式 CI。
let audit = read("scripts/audit-js-duplicates.js");
audit += `\nconst forbiddenUiMarkers = [];\nfor (const file of files) {\n  sources.get(file).split("\\n").forEach((line, index) => {\n    if (/data-v2-|(?:^|[.\\s\"'])v2-[a-z]/i.test(line)) forbiddenUiMarkers.push({ file, line: index + 1, text: line.trim() });\n  });\n}\nif (process.argv.includes("--check")) {\n  if (assignmentOverrides.length) {\n    console.error(\`Found \${assignmentOverrides.length} function override assignment(s).\`);\n    process.exitCode = 1;\n  }\n  if (forbiddenUiMarkers.length) {\n    console.error(\`Found \${forbiddenUiMarkers.length} deprecated v2 UI marker(s).\`);\n    process.exitCode = 1;\n  }\n}\n`;
write("scripts/audit-js-duplicates.js", audit);

let packageJson = JSON.parse(read("package.json"));
packageJson.scripts["js:architecture"] = "node scripts/audit-js-duplicates.js --check";
if (!packageJson.scripts["ci:check"].includes("npm run js:architecture")) {
  packageJson.scripts["ci:check"] += " && npm run js:architecture";
}
write("package.json", JSON.stringify(packageJson, null, 2));

const tests = `const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function rendererSource() {
  const js = fs.readdirSync(path.join(root, "src/renderer"))
    .filter((file) => file.endsWith(".js") && file !== "app.js")
    .map((file) => read("src/renderer/" + file));
  const css = fs.readdirSync(path.join(root, "src/renderer/css"))
    .filter((file) => file.endsWith(".css"))
    .map((file) => read("src/renderer/css/" + file));
  return [...js, ...css].join("\\n");
}

test("記錄頁不再使用 v2 UI 標記", () => {
  const source = rendererSource();
  assert.doesNotMatch(source, /data-v2-/);
  assert.doesNotMatch(source, /(?:^|[.\\s\"'])v2-(?:personal|overtime)/m);
  assert.match(source, /data-personal-record-filter/);
  assert.match(source, /data-overtime-review-check/);
});

test("記錄篩選只由正式記錄事件處理器更新並重新載入", () => {
  const formEvents = read("src/renderer/renderer-events-form.js");
  const recordsEvents = read("src/renderer/renderer-records-events.js");
  assert.doesNotMatch(formEvents, /dataset\\.(?:mealReportFilter|overtimeReviewFilter|attendanceFilter)/);
  assert.match(recordsEvents, /scheduleRecordsReload\\("meal", loadMealReport\\)/);
  assert.match(recordsEvents, /scheduleRecordsReload\\("overtime", loadOvertimeReview\\)/);
  assert.match(recordsEvents, /scheduleRecordsReload\\("attendance", loadAttendanceAdmin\\)/);
});

test("登入資料狀態由工廠與單一重設函式提供", () => {
  const foundation = read("src/renderer/renderer-foundation.js");
  const renderer = read("src/renderer/renderer.js");
  const auth = read("src/renderer/renderer-auth-actions.js");
  for (const name of ["createAttendanceState", "createAttendanceOvertimeState", "createMealOrderState", "resetLoadedUserRuntimeState"]) {
    assert.match(foundation, new RegExp("function " + name + "\\\\("));
  }
  assert.equal((renderer.match(/resetLoadedUserRuntimeState\\(\\)/g) || []).length, 2);
  assert.equal((auth.match(/resetLoadedUserRuntimeState\\(\\)/g) || []).length, 1);
  assert.doesNotMatch(renderer + auth, /attendanceState = \\{ loading: false/);
});

test("自動排班預覽只由共用函式寫入與儲存", () => {
  const interaction = read("src/renderer/renderer-schedule-interaction.js");
  const autoFill = read("src/renderer/renderer-auto-fill-schedule.js");
  const autoSchedule = read("src/renderer/renderer-auto-schedule.js");
  assert.match(interaction, /async function applySchedulePreviewSlots/);
  assert.match(autoFill, /applySchedulePreviewSlots\\(autoSchedulePreview\\?\\.slots/);
  assert.match(autoSchedule, /applySchedulePreviewSlots\\(autoSchedulePreview\\.slots/);
  assert.doesNotMatch(autoFill + autoSchedule, /Object\\.entries\\(previewSlots\\)/);
});
`;
write("tests/js-deduplication.test.js", tests);

let spec = read("規格書.md");
if (!spec.includes("### JavaScript 共用流程與正式 UI 命名")) {
  spec += `\n\n### JavaScript 共用流程與正式 UI 命名\n\n- 記錄頁 DOM 屬性與 CSS class 不得使用 ` + "`data-v2-*`" + ` 或 ` + "`.v2-*`" + ` 舊版標記。\n- 訂餐統計、加班審核與打卡管理篩選只由記錄事件模組處理並觸發資料重載。\n- 登入資料狀態使用工廠函式建立，未登入、載入失敗與登出共用同一重設流程。\n- 自動排班與自動補班預覽共用班表寫入、復原快照與批次儲存流程。\n- 正式 CI 執行 JavaScript 架構稽核，禁止覆蓋式函式指定與舊版 UI 標記。\n`;
}
write("規格書.md", spec);

console.log("JavaScript shared flows consolidated.");
