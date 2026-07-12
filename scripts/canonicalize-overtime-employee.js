const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const rendererDir = path.join(root, "src", "renderer");
const rendererPath = path.join(rendererDir, "renderer.js");
const modulePath = path.join(rendererDir, "renderer-overtime-employee.js");
const oldOvertimePath = path.join(rendererDir, "v2-overtime-employee.js");
const oldClockPath = path.join(rendererDir, "v2-clock-page-refinement.js");
const buildPath = path.join(root, "scripts", "build-js.js");
const corePath = path.join(root, "scripts", "renderer-core-source.js");
const finalCheckPath = path.join(root, "scripts", "check-v2-final.js");
const alignmentPath = path.join(root, "scripts", "check-v2-alignment.js");
const testPath = path.join(root, "tests", "renderer-phase7-overtime-patches.test.js");

function removeRange(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end <= start) {
    throw new Error(`找不到函式區段：${startMarker} -> ${endMarker}`);
  }
  return source.slice(0, start) + source.slice(end);
}

let renderer = fs.readFileSync(rendererPath, "utf8");
renderer = removeRange(renderer, "function formatClockButtonStatus(record, kind) {", "function getBrowserPosition() {");
renderer = removeRange(renderer, "async function loadTodayAttendanceOvertime(shouldRender = true) {", "async function maybePromptOvertimeAfterClockOut(status) {");
renderer = removeRange(renderer, "async function submitTodayOvertimeRequest() {", "async function loadTodayMealOrder() {");
renderer = removeRange(renderer, "function renderTodayOvertimePanel() {", "function renderMealPage() {");
fs.writeFileSync(rendererPath, renderer.replace(/\n{3,}/g, "\n\n").trimEnd() + "\n");

const moduleSource = `function getSelectedOvertimeDate() {
  return attendanceOvertimeState.selectedWorkDate || getTodayDateString();
}

function formatOvertimeShiftTime(value) {
  const match = String(value || "").match(/^(\\d{1,2}):(\\d{2})/);
  return match ? \`${'${String(Number(match[1])).padStart(2, "0")}:${match[2]}'}\` : "--:--";
}

function formatOvertimeAttendanceTime(value) {
  if (!value) return "--:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).format(date);
}

function formatOvertimeHours(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? String(number) : "0";
}

function renderOvertimeEstimate(stateValue, eligibility) {
  const shiftName = stateValue?.shift?.name || "未排班";
  const shiftStart = formatOvertimeShiftTime(stateValue?.shift?.start_time);
  const shiftEnd = formatOvertimeShiftTime(stateValue?.shift?.end_time);
  const clockIn = formatOvertimeAttendanceTime(stateValue?.attendance?.clock_in_at);
  const clockOut = formatOvertimeAttendanceTime(stateValue?.attendance?.clock_out_at);
  const earlyHours = formatOvertimeHours(eligibility?.earlyHours);
  const lateHours = formatOvertimeHours(eligibility?.lateHours);
  const totalHours = formatOvertimeHours(eligibility?.totalHours);
  return \`${'${escapeHtml(shiftName)}：${escapeHtml(shiftStart)} ~ ${escapeHtml(shiftEnd)}　打卡：${escapeHtml(clockIn)} ~ ${escapeHtml(clockOut)}<br>提早 ${escapeHtml(earlyHours)} 小時 + 延後 ${escapeHtml(lateHours)} 小時 = 估算 ${escapeHtml(totalHours)} 小時'}\`;
}

function formatClockButtonStatus(record, kind) {
  const at = kind === "in" ? record.clock_in_at : record.clock_out_at;
  if (!at) return "尚未打卡";
  const departmentName = kind === "in"
    ? record.clock_in_department_name_snapshot
    : record.clock_out_department_name_snapshot;
  const source = kind === "in" ? record.clock_in_source : record.clock_out_source;
  return \`${'${formatClockTime(at)} 在【${departmentName || "未設定"}】打卡${source ? ` (${source})` : ""}'}\`;
}

async function loadTodayAttendanceOvertime(shouldRender = true) {
  if (!isLoggedIn()) return null;
  const workDate = getSelectedOvertimeDate();
  attendanceOvertimeState = { ...attendanceOvertimeState, loading: true, error: "", selectedWorkDate: workDate };
  if (shouldRender) renderAll();
  let status = null;
  try {
    const [dateResult, result] = await Promise.all([
      window.schedulerApi.getEmployeeOvertimeDates(),
      window.schedulerApi.getAttendanceOvertimeForDate(workDate)
    ]);
    status = result;
    attendanceOvertimeState = {
      ...attendanceOvertimeState,
      loading: false,
      status,
      dates: dateResult.dates || [],
      selectedWorkDate: workDate,
      error: ""
    };
  } catch (error) {
    attendanceOvertimeState = {
      ...attendanceOvertimeState,
      loading: false,
      status: null,
      selectedWorkDate: workDate,
      error: error.message || "讀取加班申請狀態失敗"
    };
  }
  if (shouldRender) renderAll();
  return status;
}

async function submitTodayOvertimeRequest() {
  if (attendanceOvertimeState.loading) return;
  const workDate = getSelectedOvertimeDate();
  const earlyHours = Number(document.getElementById("overtimeEarlyHours")?.value || 0);
  const lateHours = Number(document.getElementById("overtimeLateHours")?.value || 0);
  const note = document.getElementById("overtimeEmployeeNote")?.value || "";
  attendanceOvertimeState = { ...attendanceOvertimeState, loading: true, error: "" };
  renderAll();
  try {
    await window.schedulerApi.submitAttendanceOvertime({ workDate, earlyHours, lateHours, note });
    await loadTodayAttendanceOvertime(false);
    showInfoMessage(\`${'${workDate} 加班申請已送出'}\`);
  } catch (error) {
    attendanceOvertimeState = { ...attendanceOvertimeState, loading: false, error: error.message || "送出加班申請失敗" };
  }
  renderAll();
}

async function deleteTodayOvertimeRequest() {
  const workDate = getSelectedOvertimeDate();
  const confirmed = await confirmAction(\`確定要刪除 \${workDate} 的加班申請嗎？\`);
  if (!confirmed) return;
  attendanceOvertimeState = { ...attendanceOvertimeState, loading: true, error: "" };
  renderAll();
  try {
    await window.schedulerApi.deleteAttendanceOvertime(workDate);
    await loadTodayAttendanceOvertime(false);
    showInfoMessage("加班申請已刪除");
  } catch (error) {
    attendanceOvertimeState = { ...attendanceOvertimeState, loading: false, error: error.message || "刪除加班申請失敗" };
  }
  renderAll();
}

function renderTodayOvertimePanel() {
  const checked = Boolean(attendanceOvertimeState.expanded);
  const toggle = \`<label class="overtime-use-label"><input type="checkbox" data-toggle-overtime-panel="true" \${checked ? "checked" : ""}> 加班申請</label>\`;
  if (!checked) {
    return \`<section class="overtime-request-panel overtime-request-toggle-only">\${toggle}</section>\`;
  }

  const stateValue = attendanceOvertimeState.status;
  const eligibility = stateValue?.eligibility || null;
  const request = stateValue?.request || null;
  const workDate = getSelectedOvertimeDate();
  const dateRows = attendanceOvertimeState.dates || [];
  const dateValues = [...new Set([workDate, ...dateRows.map((row) => row.workDate).filter(Boolean)])]
    .sort((left, right) => String(right).localeCompare(String(left)));
  const selector = \`<div class="form-row overtime-date-row"><label for="overtimeWorkDate">申請日期</label><select id="overtimeWorkDate">\${dateValues.map((date) => \`<option value="\${escapeHtml(date)}" \${date === workDate ? "selected" : ""}>\${escapeHtml(date)}</option>\`).join("")}</select></div>\`;

  if (attendanceOvertimeState.loading) {
    return \`<section class="overtime-request-panel">\${toggle}\${selector}<p class="clock-loading">讀取加班狀態...</p></section>\`;
  }
  if (attendanceOvertimeState.error) {
    return \`<section class="overtime-request-panel">\${toggle}\${selector}<div class="auth-error">\${escapeHtml(attendanceOvertimeState.error)}</div></section>\`;
  }
  if (!stateValue) {
    return \`<section class="overtime-request-panel">\${toggle}\${selector}</section>\`;
  }

  if (request) {
    const canDelete = request.status === "pending" || request.status === "returned";
    return \`<section class="overtime-request-panel">
      \${toggle}
      \${selector}
      <div class="overtime-request-status-row">
        <p class="home-subtitle overtime-request-status">\${getOvertimeStatusLabel(request.status)}，合計 \${Number(request.total_overtime_hours || 0)} 小時</p>
        \${canDelete ? '<button class="ghost-btn" type="button" data-delete-today-overtime="true">刪除申請</button>' : ""}
      </div>
      \${request.attendance_changed_warning ? '<div class="auth-error">打卡時間已異動，需重新審核</div>' : ""}
      <div class="clock-status-grid overtime-hours-summary"><div><span>提早上班</span><strong>\${Number(request.early_overtime_hours || 0)} 小時</strong></div><div><span>延後下班</span><strong>\${Number(request.late_overtime_hours || 0)} 小時</strong></div></div>
    </section>\`;
  }

  if (!eligibility?.eligible) {
    return \`<section class="overtime-request-panel">\${toggle}\${selector}<p class="home-subtitle">\${escapeHtml(eligibility?.reasons?.[0] || "目前不可申請加班")}</p></section>\`;
  }

  return \`<section class="overtime-request-panel">
    \${toggle}
    \${selector}
    <p class="home-subtitle overtime-estimate-text">\${renderOvertimeEstimate(stateValue, eligibility)}</p>
    <div class="form-grid two-col overtime-hours-grid">
      <div class="form-row"><label for="overtimeEarlyHours">提早上班時數</label><input id="overtimeEarlyHours" type="number" min="0" step="0.5" value="\${Number(eligibility.earlyHours || 0)}"></div>
      <div class="form-row"><label for="overtimeLateHours">延後下班時數</label><input id="overtimeLateHours" type="number" min="0" step="0.5" value="\${Number(eligibility.lateHours || 0)}"></div>
      <div class="form-row form-row-wide"><label for="overtimeEmployeeNote">加班備註</label><input id="overtimeEmployeeNote" type="text" placeholder="可填寫加班原因或補充說明"></div>
    </div>
    <button class="btn-primary overtime-submit-btn" type="button" data-submit-today-overtime="true">送出加班申請</button>
  </section>\`;
}

document.addEventListener("change", (event) => {
  const target = event.target;
  if (target instanceof HTMLSelectElement && target.id === "overtimeWorkDate") {
    attendanceOvertimeState = { ...attendanceOvertimeState, selectedWorkDate: target.value };
    void loadTodayAttendanceOvertime();
  }
});
`;
fs.writeFileSync(modulePath, moduleSource);

for (const oldPath of [oldOvertimePath, oldClockPath]) {
  if (!fs.existsSync(oldPath)) throw new Error(`找不到待整併補丁：${oldPath}`);
  fs.unlinkSync(oldPath);
}

function updateManifest(filePath) {
  let source = fs.readFileSync(filePath, "utf8");
  source = source.replace(/^\s*"v2-overtime-employee\.js",?\r?\n/m, "");
  source = source.replace(/^\s*"v2-clock-page-refinement\.js",?\r?\n/m, "");
  const marker = /  "renderer\.js",?/;
  if (!marker.test(source)) throw new Error(`清單找不到 renderer.js：${filePath}`);
  source = source.replace(marker, '  "renderer-overtime-employee.js",\n  "renderer.js",');
  fs.writeFileSync(filePath, source);
}
updateManifest(buildPath);
updateManifest(corePath);

for (const checkPath of [finalCheckPath, alignmentPath]) {
  let source = fs.readFileSync(checkPath, "utf8");
  source = source.replaceAll("src/renderer/v2-overtime-employee.js", "src/renderer/renderer-overtime-employee.js");
  fs.writeFileSync(checkPath, source);
}

const testSource = `const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const modulePath = path.join(root, "src", "renderer", "renderer-overtime-employee.js");

function evaluate(state = {}) {
  const source = fs.readFileSync(modulePath, "utf8");
  const context = {
    attendanceOvertimeState: { expanded: false, loading: false, status: null, error: "", dates: [], ...state },
    getTodayDateString: () => "2026-07-12",
    escapeHtml: String,
    formatClockTime: () => "08:30",
    getOvertimeStatusLabel: (status) => status === "approved" ? "已核准" : status === "returned" ? "退回" : "待審",
    isLoggedIn: () => true,
    renderAll: () => {},
    showInfoMessage: () => {},
    confirmAction: async () => true,
    window: { schedulerApi: {} },
    document: { addEventListener: () => {}, getElementById: () => null },
    HTMLSelectElement: class {}
  };
  return { context, api: vm.runInNewContext(source + "\n;({ formatClockButtonStatus, renderTodayOvertimePanel, renderOvertimeEstimate })", context) };
}

test("打卡按鈕狀態應保留時間、單位與打卡方式", () => {
  const { api } = evaluate();
  const text = api.formatClockButtonStatus({ clock_in_at: "2026-07-12T00:30:00Z", clock_in_department_name_snapshot: "門市", clock_in_source: "GPS" }, "in");
  assert.equal(text, "08:30 在【門市】打卡 (GPS)");
  assert.equal(api.formatClockButtonStatus({}, "out"), "尚未打卡");
});

test("加班面板收合時應只顯示勾選入口", () => {
  const { api } = evaluate({ expanded: false });
  const html = api.renderTodayOvertimePanel();
  assert.equal(html.includes("overtime-request-toggle-only"), true);
  assert.equal(html.includes("overtimeWorkDate"), false);
});

test("可申請加班時應保留日期、估算、雙欄時數與備註", () => {
  const { api } = evaluate({
    expanded: true,
    selectedWorkDate: "2026-07-11",
    dates: [{ workDate: "2026-07-10" }],
    status: {
      shift: { name: "早班", start_time: "8:00", end_time: "17:00" },
      attendance: { clock_in_at: "2026-07-11T00:00:00Z", clock_out_at: "2026-07-11T10:00:00Z" },
      eligibility: { eligible: true, earlyHours: 0.5, lateHours: 1, totalHours: 1.5 }
    }
  });
  const html = api.renderTodayOvertimePanel();
  assert.equal(html.includes('id="overtimeWorkDate"'), true);
  assert.equal(html.includes("2026-07-11") && html.includes("2026-07-10"), true);
  assert.equal(html.includes("overtime-estimate-text") && html.includes("估算 1.5 小時"), true);
  assert.equal(html.includes("overtime-hours-grid") && html.includes('id="overtimeEmployeeNote" type="text"'), true);
});

test("既有申請應保留打卡異動警告與刪除規則", () => {
  const { api } = evaluate({
    expanded: true,
    selectedWorkDate: "2026-07-11",
    status: { request: { status: "returned", total_overtime_hours: 2, early_overtime_hours: 1, late_overtime_hours: 1, attendance_changed_warning: true } }
  });
  const html = api.renderTodayOvertimePanel();
  assert.equal(html.includes("打卡時間已異動，需重新審核"), true);
  assert.equal(html.includes("data-delete-today-overtime"), true);
});

test("員工加班應只有一個正式模組且不再覆蓋全域函式", () => {
  const source = fs.readFileSync(modulePath, "utf8");
  const renderer = fs.readFileSync(path.join(root, "src", "renderer", "renderer.js"), "utf8");
  const build = fs.readFileSync(path.join(root, "scripts", "build-js.js"), "utf8");
  assert.equal(fs.existsSync(path.join(root, "src", "renderer", "v2-overtime-employee.js")), false);
  assert.equal(fs.existsSync(path.join(root, "src", "renderer", "v2-clock-page-refinement.js")), false);
  assert.equal(build.includes("renderer-overtime-employee.js"), true);
  assert.equal(build.includes("v2-overtime-employee.js") || build.includes("v2-clock-page-refinement.js"), false);
  ["formatClockButtonStatus", "loadTodayAttendanceOvertime", "submitTodayOvertimeRequest", "deleteTodayOvertimeRequest", "renderTodayOvertimePanel"].forEach((name) => {
    assert.equal(source.includes(name + " = function"), false);
    assert.equal((source.match(new RegExp("function " + name + "\\\\b", "g")) || []).length, 1);
    assert.equal(renderer.includes("function " + name), false);
  });
});
`;
fs.writeFileSync(testPath, testSource);
console.log("employee overtime and clock refinement patches merged into canonical module");
