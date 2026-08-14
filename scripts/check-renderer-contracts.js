const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const required = [
  "src/renderer/index.html",
  "src/renderer/app.css",
  "src/renderer/app.js",
  "src/renderer/web-api.js",
  "src/renderer/renderer-foundation.js",
  "src/renderer/renderer-app-shell.js",
  "src/renderer/renderer-main-pages.js",
  "src/renderer/renderer-attendance-page.js",
  "src/renderer/renderer-records-page.js",
  "src/renderer/renderer-records-views.js",
  "src/renderer/renderer-records-actions.js",
  "src/renderer/renderer-records-events.js",
  "docs/index.html",
  "docs/app.css",
  "docs/app.js",
  "supabase/001_current_schema.sql",
  "supabase/002_current_updates.sql",
  "supabase/functions/attendance-clock/index.ts",
  "supabase/functions/attendance-ledger/index.ts",
  "supabase/functions/attendance-ledger-export/index.ts",
  "supabase/functions/meal-order/index.ts"
];
for (const file of required) assert(exists(file), `缺少正式檔案：${file}`);

const foundation = read("src/renderer/renderer-foundation.js");
const shell = read("src/renderer/renderer-app-shell.js");
const mainPages = read("src/renderer/renderer-main-pages.js");
const attendancePage = read("src/renderer/renderer-attendance-page.js");
const recordSources = [
  "src/renderer/renderer-records-page.js",
  "src/renderer/renderer-records-views.js",
  "src/renderer/renderer-records-actions.js",
  "src/renderer/renderer-records-events.js"
].map(read).join("\n");
const webApi = read("src/renderer/web-api.js");
const build = read("scripts/build-js.js");
const coreSource = read("scripts/renderer-core-source.js");
const deployment = read("scripts/deploy-edge-functions.ps1");
const schemaSql = read("supabase/001_current_schema.sql");
const updatesSql = read("supabase/002_current_updates.sql");
const databaseSql = `${schemaSql}
${updatesSql}`;
const attendanceClock = read("supabase/functions/attendance-clock/index.ts");
const attendanceLedger = read("supabase/functions/attendance-ledger/index.ts");
const attendanceExport = read("supabase/functions/attendance-ledger-export/index.ts");
const mealOrder = read("supabase/functions/meal-order/index.ts");

for (const moduleName of [
  "renderer-foundation.js",
  "renderer-attendance-page.js",
  "renderer-records-page.js",
  "renderer-records-views.js",
  "renderer-records-actions.js",
  "renderer-records-events.js"
]) {
  assert(build.includes(moduleName), `JavaScript 建置清單缺少：${moduleName}`);
  assert(coreSource.includes(moduleName), `測試核心來源缺少：${moduleName}`);
}
for (const removed of ["renderer-overtime-employee.js", "renderer-v2-personal-page.js", "renderer-v2-overtime-page.js"]) {
  assert(!build.includes(removed) && !coreSource.includes(removed), `建置仍包含舊模組：${removed}`);
}

assert(foundation.includes("createAttendanceState") && foundation.includes("createRecordsState"), "缺少簽到簿正式狀態");
assert(!foundation.includes("createAttendanceOvertimeState") && !foundation.includes("attendanceOvertimeState"), "仍保留獨立加班申請狀態");
assert(mainPages.includes('data-home-action="records"') && mainPages.includes('home-action-title">簽到簿'), "首頁導覽未改為簽到簿");
assert(!mainPages.includes('data-home-action="attendance"'), "首頁仍保留獨立打卡入口");
assert(shell.includes("function renderRecordsPage") && shell.includes('appView === "records"'), "主視圖未整合簽到簿");

for (const endpoint of ["attendance-ledger", "attendance-ledger-export", "attendance-clock"]) {
  assert(webApi.includes(endpoint), `web-api 未使用：${endpoint}`);
}
for (const oldEndpoint of [
  "personal-records-v2",
  "attendance-admin-list-v2",
  "attendance-admin-action-v2",
  "attendance-overtime-employee",
  "attendance-overtime-admin-list",
  "attendance-overtime-admin-action"
]) {
  assert(!webApi.includes(oldEndpoint), `web-api 仍引用舊端點：${oldEndpoint}`);
}

for (const label of ["個人記錄", "簽到審核", "上班時數", "加班時數", "批次審核", "批次退回"]) {
  assert(recordSources.includes(label), `簽到簿畫面缺少：${label}`);
}
assert(!recordSources.includes("加班審核") && !recordSources.includes("打卡管理"), "仍顯示已淘汰的獨立管理分頁");
assert(attendancePage.includes("submitAttendanceClock") && attendancePage.includes("只能在今天的紀錄列打卡"), "今日列打卡限制缺失");
assert(attendancePage.includes("timeout: 15000") && attendancePage.includes("maximumAge: 0"), "手機定位未使用即時位置設定");
assert(!attendancePage.includes("maybePromptOvertimeAfterClockOut"), "下班後仍保留舊加班提醒流程");

assert(databaseSql.includes("create table if not exists public.attendance_days"), "SQL 缺少 attendance_days");
assert(databaseSql.includes("create table if not exists public.attendance_audit_logs"), "SQL 缺少 attendance_audit_logs");
for (const oldTable of ["attendance_records", "attendance_action_logs", "attendance_overtime_requests", "overtime_review_logs"]) {
  assert(!databaseSql.includes(oldTable), `正式 SQL 仍包含淘汰結構：${oldTable}`);
}

for (const endpoint of ["attendance-clock", "attendance-ledger", "attendance-ledger-export", "meal-order"]) {
  assert(deployment.includes(`\"${endpoint}\"`), `部署清單缺少：${endpoint}`);
}
for (const oldEndpoint of [
  "attendance-overtime",
  "attendance-clock-safe",
  "attendance-overtime-employee",
  "attendance-overtime-admin-list",
  "attendance-overtime-admin-action",
  "attendance-admin-list-v2",
  "attendance-admin-action-v2",
  "personal-records-v2",
  "report-records"
]) {
  assert(!deployment.includes(`\"${oldEndpoint}\"`), `部署清單仍包含舊端點：${oldEndpoint}`);
}

assert(attendanceClock.includes('from("attendance_days")') && !attendanceClock.includes('from("attendance_records")'), "打卡後端未完全切換新版資料表");
assert(attendanceLedger.includes('from("attendance_days")') && attendanceLedger.includes('from("attendance_audit_logs")'), "簽到簿後端未使用正式資料表");
assert(!attendanceLedger.includes('from("attendance_records")') && !attendanceLedger.includes('from("attendance_overtime_requests")'), "簽到簿後端仍使用舊資料表");
assert(attendanceExport.includes('from("attendance_days")'), "簽到匯出未使用 attendance_days");
assert(mealOrder.includes('from("attendance_days")') && !mealOrder.includes('from("attendance_records")'), "訂餐仍依賴舊打卡表");

assert(read("src/renderer/app.js") === read("docs/app.js"), "JavaScript 發布成品不同步");
assert(read("src/renderer/app.css") === read("docs/app.css"), "CSS 發布成品不同步");
for (const indexFile of ["src/renderer/index.html", "docs/index.html"]) {
  const index = read(indexFile);
  assert(index.includes("app-config.js") && index.includes("app.js") && !index.includes("v2-api.js"), `${indexFile} 未只載入正式 JavaScript`);
}

const readme = read("README.md");
for (const sqlFile of ["001_current_schema.sql", "002_current_updates.sql"]) {
  assert(readme.includes(sqlFile), `README 未說明 SQL：${sqlFile}`);
}
assert(!readme.includes("003_attendance_ledger.sql") && !readme.includes("004_remove_legacy_attendance.sql"), "README 仍描述淘汰 SQL 階段");
const spec = read("規格書.md");
assert(spec.includes("簽到簿") && spec.includes("個人記錄") && spec.includes("簽到審核"), "規格書缺少新版簽到簿資訊架構");
assert(spec.includes("attendance_days") && spec.includes("attendance_audit_logs"), "規格書缺少每日簽到資料模型");
assert(spec.includes("attendance-ledger") && spec.includes("attendance-ledger-export"), "規格書缺少新版 Edge Function 契約");
assert(spec.includes("唯一正式資料結構") && spec.includes("不進行資料遷移"), "規格書缺少單一正式資料結構決策");
assert(spec.includes("未登入不顯示班表、員工、打卡、加班與訂餐資料"), "規格書缺少未登入資料保護規則");
assert(spec.includes("頁面與資料權限矩陣") && spec.includes("RPO") && spec.includes("RTO"), "規格書缺少權限或維運目標");

console.log(`renderer contracts checks passed (${required.length} required files).`);
