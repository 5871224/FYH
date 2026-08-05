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
  "src/renderer/renderer.js",
  "src/renderer/renderer-foundation.js",
  "src/renderer/renderer-app-shell.js",
  "src/renderer/renderer-main-pages.js",
  "src/renderer/renderer-attendance-page.js",
  "src/renderer/renderer-records-page.js",
  "src/renderer/renderer-records-views.js",
  "src/renderer/renderer-records-actions.js",
  "src/renderer/renderer-records-events.js",
  "src/renderer/renderer-events-click.js",
  "src/renderer/renderer-events-form.js",
  "src/renderer/renderer-events-session.js",
  "docs/index.html",
  "docs/app.css",
  "docs/app.js",
  "supabase/functions/attendance-clock/index.ts",
  "supabase/functions/attendance-ledger/index.ts",
  "supabase/functions/attendance-ledger-export/index.ts"
];
for (const file of required) assert(exists(file), `缺少正式檔案：${file}`);

const renderer = read("src/renderer/renderer.js");
const foundation = read("src/renderer/renderer-foundation.js");
const shell = read("src/renderer/renderer-app-shell.js");
const mainPages = read("src/renderer/renderer-main-pages.js");
const webApi = read("src/renderer/web-api.js");
const css = read("src/renderer/app.css");
const build = read("scripts/build-js.js");
const coreSource = read("scripts/renderer-core-source.js");
const deployment = read("scripts/deploy-edge-functions.ps1");
const attendanceClock = read("supabase/functions/attendance-clock/index.ts");
const attendanceLedger = read("supabase/functions/attendance-ledger/index.ts");
const attendanceExport = read("supabase/functions/attendance-ledger-export/index.ts");
const mealOrder = read("supabase/functions/meal-order/index.ts");
const schema = read("supabase/001_current_schema.sql") + "\n" + read("supabase/002_current_updates.sql") + "\n" + read("supabase/003_attendance_ledger.sql") + "\n" + read("supabase/004_remove_legacy_attendance.sql");

for (const file of [
  "renderer-foundation.js",
  "renderer-attendance-page.js",
  "renderer-records-page.js",
  "renderer-records-views.js",
  "renderer-records-actions.js",
  "renderer-records-events.js"
]) {
  assert(build.includes(file), `JavaScript 建置清單缺少：${file}`);
  assert(coreSource.includes(file), `測試核心來源缺少：${file}`);
}
for (const removed of ["renderer-overtime-employee.js", "renderer-v2-personal-page.js", "renderer-v2-overtime-page.js"]) {
  assert(!build.includes(removed) && !coreSource.includes(removed), `建置仍包含舊模組：${removed}`);
}

assert(foundation.includes("createAttendanceState") && foundation.includes("createRecordsState"), "缺少簽到簿正式狀態工廠");
assert(!foundation.includes("createAttendanceOvertimeState") && !renderer.includes("attendanceOvertimeState"), "仍保留獨立加班申請狀態");
assert(shell.includes('id: "records"') && shell.includes('label: "簽到簿"'), "首頁導覽未改為簽到簿");
assert(!shell.includes('id: "attendance"') || !shell.includes('label: "打卡"'), "首頁仍保留獨立打卡入口");
assert(mainPages.includes("renderRecordsPage"), "主頁未使用簽到簿畫面");

for (const name of ["getPersonalRecords", "savePersonalAttendance", "getAttendanceReview", "saveAttendanceReview", "setAttendanceReviewed", "getAttendanceHistory", "clockAttendance", "exportAttendanceLedger"]) {
  assert(webApi.includes(`async function ${name}`), `web-api 缺少：${name}`);
}
for (const endpoint of ["attendance-ledger", "attendance-ledger-export", "attendance-clock"]) assert(webApi.includes(endpoint), `web-api 未使用：${endpoint}`);
for (const oldEndpoint of ["personal-records-v2", "attendance-admin-list-v2", "attendance-admin-action-v2", "attendance-overtime-employee", "attendance-overtime-admin-list", "attendance-overtime-admin-action"]) {
  assert(!webApi.includes(oldEndpoint), `web-api 仍引用舊端點：${oldEndpoint}`);
}

assert(schema.includes("create table if not exists public.attendance_days"), "SQL 缺少 attendance_days");
assert(schema.includes("create table if not exists public.attendance_audit_logs"), "SQL 缺少 attendance_audit_logs");
assert(schema.includes("drop table if exists public.attendance_records"), "SQL 未移除舊 attendance_records");
assert(schema.includes("drop table if exists public.attendance_overtime_requests"), "SQL 未移除舊加班申請表");
assert(schema.includes("public.attendance_days") && schema.includes("public.attendance_audit_logs"), "SQL 未使用新版每日簽到模型");

for (const name of ["attendance-clock", "attendance-ledger", "attendance-ledger-export", "meal-order"]) assert(deployment.includes(`\"${name}\"`), `部署清單缺少：${name}`);
for (const oldEndpoint of ["attendance-overtime", "attendance-clock-safe", "attendance-overtime-employee", "attendance-overtime-admin-list", "attendance-overtime-admin-action", "attendance-admin-list-v2", "attendance-admin-action-v2", "personal-records-v2", "report-records"]) {
  assert(!deployment.includes(`\"${oldEndpoint}\"`), `部署清單仍包含舊端點：${oldEndpoint}`);
}

assert(attendanceClock.includes('from("attendance_days")') && attendanceClock.includes("save_attendance_clock"), "打卡後端未使用新版每日簽到模型");
assert(!attendanceClock.includes('from("attendance_records")'), "打卡後端仍使用 attendance_records");
assert(attendanceLedger.includes('from("attendance_days")') && attendanceLedger.includes('from("attendance_audit_logs")'), "簽到簿後端未使用正式資料表");
assert(!attendanceLedger.includes('from("attendance_records")') && !attendanceLedger.includes('from("attendance_overtime_requests")'), "簽到簿後端仍使用舊資料表");
assert(attendanceExport.includes('from("attendance_days")'), "簽到匯出未使用 attendance_days");
assert(mealOrder.includes('from("attendance_days")') && !mealOrder.includes('from("attendance_records")'), "訂餐仍依賴舊打卡表");

assert(webApi.includes("async function deleteMealProduct") && webApi.includes('action: "delete_admin_product"'), "前端缺少安全刪除訂餐品項操作");
assert(webApi.includes("companySubsidy: Number(payload.companySubsidy)"), "前端未傳送公司補助");

const attendancePage = read("src/renderer/renderer-attendance-page.js");
assert(attendancePage.includes("timeout: 15000") && attendancePage.includes("maximumAge: 0"), "手機定位未取得即時高精準度位置");
assert(attendancePage.includes("submitAttendanceClock") && attendancePage.includes("只能在今天的紀錄列打卡"), "簽到簿表格內打卡限制缺失");
assert(!attendancePage.includes("maybePromptOvertimeAfterClockOut"), "下班後仍保留舊加班提醒流程");

const recordSources = ["src/renderer/renderer-records-page.js", "src/renderer/renderer-records-views.js", "src/renderer/renderer-records-actions.js", "src/renderer/renderer-records-events.js"].map(read).join("\n");
for (const label of ["個人記錄", "簽到審核", "上班時數", "加班時數", "批次審核", "批次退回"]) assert(recordSources.includes(label), `簽到簿畫面缺少：${label}`);
assert(!recordSources.includes("加班審核") && !recordSources.includes("打卡管理"), "簽到簿仍顯示已淘汰的獨立管理分頁");

const sourceApp = read("src/renderer/app.js");
const docsApp = read("docs/app.js");
assert(sourceApp === docsApp, "src/renderer/app.js 與 docs/app.js 不同步");
assert(sourceApp.includes("attendance-ledger") && sourceApp.includes("簽到審核"), "正式 JavaScript bundle 缺少簽到簿功能");
assert(read("src/renderer/app.css") === read("docs/app.css"), "src/renderer/app.css 與 docs/app.css 不同步");
const sourceIndex = read("src/renderer/index.html");
const docsIndex = read("docs/index.html");
assert(sourceIndex.includes("app-config.js") && sourceIndex.includes("app.js") && !sourceIndex.includes("v2-api.js"), "來源頁必須只載入正式 JavaScript");
assert(docsIndex.includes("app-config.js") && docsIndex.includes("app.js") && !docsIndex.includes("v2-api.js"), "發布頁必須只載入正式 JavaScript");

const readme = read("README.md");
for (const sqlFile of ["001_current_schema.sql", "002_current_updates.sql", "003_attendance_ledger.sql", "004_remove_legacy_attendance.sql"]) assert(readme.includes(sqlFile), `README 未說明 SQL：${sqlFile}`);
const spec = read("規格書.md");
assert(spec.includes("簽到簿") && spec.includes("個人記錄") && spec.includes("簽到審核"), "正式規格書缺少新版簽到簿資訊架構");
assert(spec.includes("attendance_days") && spec.includes("attendance_audit_logs"), "正式規格書缺少每日簽到資料模型");
assert(spec.includes("attendance-ledger") && spec.includes("attendance-ledger-export"), "正式規格書缺少新版 Edge Function 契約");
assert(spec.includes("尚未正式上線") && spec.includes("舊出勤資料不保留"), "正式規格書缺少舊資料清理決策");
assert(spec.includes("未登入不顯示班表、員工、打卡、加班與訂餐資料"), "正式規格書缺少未登入資料保護規則");
assert(spec.includes("頁面與資料權限矩陣") && spec.includes("RPO") && spec.includes("RTO"), "正式規格書缺少權限或維運目標");

console.log(`renderer contracts checks passed (${required.length} required files).`);
