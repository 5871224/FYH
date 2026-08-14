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
  "src/backend/api-contract.js",
  "src/backend/session-store.js",
  "src/backend/native-attendance.js",
  "src/backend/native-meal.js",
  "src/backend/services/native-member-service.js",
  "docs/index.html",
  "docs/app.css",
  "docs/app.js",
  "supabase/001_current_schema.sql",
  "supabase/002_current_updates.sql"
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
const apiContract = read("src/backend/api-contract.js");
const sessionStore = read("src/backend/session-store.js");
const attendanceBackend = read("src/backend/native-attendance.js");
const mealBackend = read("src/backend/native-meal.js");
const memberService = read("src/backend/services/native-member-service.js");
const schemaSql = read("supabase/001_current_schema.sql");
const updatesSql = read("supabase/002_current_updates.sql");
const databaseSql = `${schemaSql}\n${updatesSql}`;

// Renderer build/source modules stay explicit and ordered.
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

// The renderer only talks to named FYH API routes.
for (const pathText of [
  "/api/v1/attendance/today",
  "/api/v1/attendance/clock",
  "/api/v1/attendance/personal/list",
  "/api/v1/attendance/review/list",
  "/api/v1/attendance/review/export",
  "/api/v1/meal/today",
  "/api/v1/members"
]) {
  assert(webApi.includes(pathText), `web-api 未使用 FYH API：${pathText}`);
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
assert(!webApi.includes("callRpc("), "renderer 不得直接呼叫 Supabase RPC");
assert(!webApi.includes("requestFunction("), "renderer 不得直接呼叫 Supabase Edge Function");
assert(!webApi.includes("/rest/v1/"), "renderer 不得直接呼叫 Supabase REST");

for (const route of [
  "attendanceToday", "attendanceClock", "attendancePersonalList", "attendancePersonalSave",
  "attendanceReviewList", "attendanceReviewSave", "attendanceReviewSet", "attendanceHistory", "attendanceExport",
  "mealToday", "mealSave", "mealCancel", "mealAdminSettings", "mealAdminSettingsSave", "mealProductDelete", "mealReport",
  "membersDirectory", "memberSave", "memberPasswordReset", "memberDelete"
]) {
  assert(apiContract.includes(`${route}: Object.freeze(`), `FYH API contract 缺少：${route}`);
}

// Attendance-ledger UI remains intact independent of backend provider.
for (const label of ["個人記錄", "簽到審核", "上班時數", "加班時數", "批次審核", "批次退回"]) {
  assert(recordSources.includes(label), `簽到簿畫面缺少：${label}`);
}
assert(!recordSources.includes("加班審核") && !recordSources.includes("打卡管理"), "仍顯示已淘汰的獨立管理分頁");
assert(attendancePage.includes("submitAttendanceClock") && attendancePage.includes("只能在今天的紀錄列打卡"), "今日列打卡限制缺失");
assert(attendancePage.includes("timeout: 15000") && attendancePage.includes("maximumAge: 0"), "手機定位未使用即時位置設定");
assert(!attendancePage.includes("maybePromptOvertimeAfterClockOut"), "下班後仍保留舊加班提醒流程");

// Session and domain logic belongs to FYH backend rather than renderer/Edge Functions/RPCs.
assert(sessionStore.includes("PHONE_SESSION_IDLE_MS = 48 * 60 * 60 * 1000"), "Backend 缺少手機 Session 規則");
assert(sessionStore.includes("DESKTOP_SESSION_IDLE_MS = 30 * 60 * 1000"), "Backend 缺少桌機 Session 規則");
assert(attendanceBackend.includes("public.attendance_days"), "簽到 Backend 未使用 attendance_days");
assert(attendanceBackend.includes("public.attendance_audit_logs"), "簽到 Backend 未使用 attendance_audit_logs");
assert(attendanceBackend.includes("database.transaction(async(tx)=>"), "打卡 Backend 未使用 Native transaction");
assert(attendanceBackend.includes("for update"), "打卡 Backend 未鎖定每日簽到列");
assert(!attendanceBackend.includes("public.save_attendance_clock"), "打卡 Backend 仍依賴舊 DB RPC");
assert(attendanceBackend.includes("attendance_review"), "簽到審核 Backend 缺少權限驗證");
assert(mealBackend.includes("public.attendance_days"), "訂餐 Backend 未使用新版簽到模型");
assert(mealBackend.includes("database.transaction(async(tx)=>"), "訂餐 Backend 未使用 Native transaction");
assert(mealBackend.includes("delete from public.meal_orders"), "訂餐 Backend 未在交易中重建當日訂單");
assert(!mealBackend.includes("public.save_meal_order"), "訂餐 Backend 仍依賴舊 DB RPC");
assert(memberService.includes("memberRepository.saveMember"), "人員管理未使用 Native Repository");
assert(memberService.includes("memberRepository.resetPassword"), "人員密碼重設未使用 Native Repository");
assert(memberService.includes("memberRepository.deleteMember"), "人員刪除未使用 Native Repository");

// Normalized storage contract.
assert(databaseSql.includes("create table if not exists public.attendance_days"), "SQL 缺少 attendance_days");
assert(databaseSql.includes("create table if not exists public.attendance_audit_logs"), "SQL 缺少 attendance_audit_logs");
for (const oldTable of ["attendance_records", "attendance_action_logs", "attendance_overtime_requests", "overtime_review_logs"]) {
  assert(!databaseSql.includes(oldTable), `正式 SQL 仍包含淘汰結構：${oldTable}`);
}

// Built renderer artifacts must match published static files.
assert(read("src/renderer/app.js") === read("docs/app.js"), "JavaScript 發布成品不同步");
assert(read("src/renderer/app.css") === read("docs/app.css"), "CSS 發布成品不同步");
for (const indexFile of ["src/renderer/index.html", "docs/index.html"]) {
  const index = read(indexFile);
  assert(index.includes("app-config.js") && index.includes("app.js") && !index.includes("v2-api.js"), `${indexFile} 未只載入正式 JavaScript`);
}

// Documentation keeps the current normalized information architecture.
const readme = read("README.md");
for (const sqlFile of ["001_current_schema.sql", "002_current_updates.sql"]) {
  assert(readme.includes(sqlFile), `README 未說明 SQL：${sqlFile}`);
}
assert(!readme.includes("003_attendance_ledger.sql") && !readme.includes("004_remove_legacy_attendance.sql"), "README 仍描述淘汰 SQL 階段");
const spec = read("規格書.md");
assert(spec.includes("簽到簿") && spec.includes("個人記錄") && spec.includes("簽到審核"), "規格書缺少新版簽到簿資訊架構");
assert(spec.includes("attendance_days") && spec.includes("attendance_audit_logs"), "規格書缺少每日簽到資料模型");
assert(spec.includes("唯一正式資料結構") && spec.includes("不進行資料遷移"), "規格書缺少單一正式資料結構決策");
assert(spec.includes("未登入不顯示班表、員工、打卡、加班與訂餐資料"), "規格書缺少未登入資料保護規則");
assert(spec.includes("頁面與資料權限矩陣") && spec.includes("RPO") && spec.includes("RTO"), "規格書缺少權限或維運目標");

console.log(`renderer contracts checks passed for FYH API (${required.length} required files).`);
