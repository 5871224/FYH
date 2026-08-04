const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const required = [
  "supabase/001_current_schema.sql",
  "supabase/002_current_updates.sql",
  "supabase/003_attendance_ledger.sql",
  "supabase/functions/attendance-clock/index.ts",
  "supabase/functions/attendance-ledger/index.ts",
  "supabase/functions/attendance-ledger-export/index.ts",
  "supabase/functions/meal-order/index.ts",
  "supabase/functions/department-attendance-v2/index.ts",
  "supabase/functions/member-delete-v2/index.ts",
  "supabase/functions/member-auth-admin/index.ts",
  "supabase/functions/member-order-v2/index.ts",
  "supabase/functions/catalog-admin/index.ts",
  "supabase/functions/meal-report-v2/index.ts",
  "supabase/functions/meal-cancel-v2/index.ts",
  "src/renderer/renderer-attendance-page.js",
  "src/renderer/renderer-records-page.js",
  "src/renderer/renderer-records-views.js",
  "src/renderer/renderer-records-actions.js",
  "src/renderer/renderer-records-events.js",
  "src/renderer/web-api.js",
  "src/renderer/app.js",
  "docs/app.js",
  "scripts/build-js.js",
  "scripts/deploy-edge-functions.ps1",
  "README.md",
  "規格書.md"
];
required.forEach((file) => assert(exists(file), `缺少正式檔案：${file}`));

const retiredFunctions = [
  "attendance-overtime-employee",
  "attendance-overtime-admin-list",
  "attendance-overtime-admin-action",
  "attendance-admin-list-v2",
  "attendance-admin-action-v2",
  "personal-records-v2",
  "attendance-clock-safe",
  "report-records"
];
retiredFunctions.forEach((name) => assert(!exists(`supabase/functions/${name}`), `仍保留已淘汰端點：${name}`));
assert(!exists("src/renderer/renderer-overtime-employee.js"), "仍保留已淘汰加班申請畫面模組");

const deployScript = read("scripts/deploy-edge-functions.ps1");
for (const name of ["attendance-clock", "attendance-ledger", "attendance-ledger-export", "meal-order"]) {
  assert(deployScript.includes(`"${name}"`), `部署清單缺少正式端點：${name}`);
}
retiredFunctions.forEach((name) => assert(!deployScript.includes(`"${name}"`), `部署清單仍包含已淘汰端點：${name}`));
assert(deployScript.includes("003_attendance_ledger.sql"), "部署說明缺少第三階段簽到 SQL");

const workflow = read(".github/workflows/deploy-pages.yml");
const workflowFiles = fs.readdirSync(path.join(root, ".github", "workflows")).filter((name) => /\.ya?ml$/i.test(name));
for (const command of [
  "npm run web:publish",
  "npm test",
  "npm run web:check",
  "node scripts/check-normalized-storage.js",
  "node scripts/check-expansion-acceptance.js",
  "node scripts/check-settings-lists.js",
  "npm run renderer:check"
]) assert(workflow.includes(command), `正式 workflow 缺少：${command}`);
assert(workflow.includes("pull_request:") && workflow.includes("push:") && workflow.includes("cancel-in-progress: true"), "正式 workflow 觸發或取消舊執行規則不完整");
assert(!workflow.includes("actions/deploy-pages") && !workflow.includes("contents: write") && !/\bgit\s+(?:commit|push)\b/.test(workflow), "驗證 workflow 不得部署或修改 PR 分支");
assert(workflowFiles.length === 1 && workflowFiles[0] === "deploy-pages.yml", `仍保留重複 workflow：${workflowFiles.join(", ")}`);

const databaseSources = [
  "supabase/001_current_schema.sql",
  "supabase/002_current_updates.sql",
  "supabase/003_attendance_ledger.sql"
].map(read).join("\n");
const ledgerSql = read("supabase/003_attendance_ledger.sql");
assert(ledgerSql.includes("create table if not exists public.attendance_days"), "資料庫缺少每日簽到主表");
assert(ledgerSql.includes("create table if not exists public.attendance_audit_logs"), "資料庫缺少簽到稽核表");
assert(ledgerSql.includes("constraint attendance_days_user_date_key unique (user_id, work_date)"), "每日簽到缺少每人每日唯一限制");
assert(ledgerSql.includes("regular_minutes") && ledgerSql.includes("overtime_minutes"), "每日簽到缺少正常與加班分鐘欄位");
assert(ledgerSql.includes("alter table public.attendance_days enable row level security"), "每日簽到未啟用 RLS");
assert(ledgerSql.includes("attendance_days_select_own"), "員工缺少只讀本人簽到政策");
assert(ledgerSql.includes("revoke all on table public.attendance_days from public, anon, authenticated"), "每日簽到未明確撤銷預設權限");
assert(ledgerSql.includes("grant select on table public.attendance_days to authenticated"), "登入者缺少受 RLS 保護的簽到讀取權限");
assert(ledgerSql.includes("insert into public.attendance_days") && ledgerSql.includes("from public.attendance_records"), "舊打卡歷史未納入可重複執行的遷移");
assert(ledgerSql.includes("from public.attendance_overtime_requests") && ledgerSql.includes("overtime_minutes"), "舊加班資料未遷移至每日簽到");
assert(ledgerSql.includes("from public.attendance_action_logs") && ledgerSql.includes("migration_backfill"), "舊稽核資料或遷移稽核標記缺失");
assert(ledgerSql.includes("public.attendance_days%rowtype"), "正式打卡或訂餐 RPC 仍使用舊資料型別");
assert(ledgerSql.includes("clock_in_location->>'departmentId'"), "正式訂餐 RPC 未使用簽到地點快照");
assert(ledgerSql.includes("create or replace function public.delete_member_account_v4"), "人員歷史保護未更新至新版簽到資料");
assert(ledgerSql.includes("public.attendance_audit_logs") && ledgerSql.includes("MEMBER_HAS_HISTORY"), "人員刪除保護未涵蓋簽到稽核資料");

assert(databaseSources.includes("get_my_profile_v2") && databaseSources.includes("get_schedule_directory_v2") && databaseSources.includes("get_employee_admin_directory_v2"), "缺少分用途人員資料 RPC");
assert(databaseSources.includes("drop function if exists public.get_employee_directory_v2"), "混合用途舊人員名錄 RPC 尚未移除");
assert(databaseSources.includes("save_departments_general_v2") && databaseSources.includes("delete_department_general_v2"), "單位安全寫入 RPC 缺失");
assert(databaseSources.includes("get_schedule_export_rows_v2"), "班表匯出資料 RPC 缺失");
assert(databaseSources.includes("revoke select on public.set_employee from authenticated"), "人員主表仍可被所有登入者直接讀取");

const memberDelete = read("supabase/functions/member-delete-v2/index.ts");
const memberAuth = read("supabase/functions/member-auth-admin/index.ts");
assert(memberDelete.includes('rpc("delete_member_account_v4"'), "帳號刪除未使用歷史保護交易 RPC");
assert(memberAuth.includes('rpc("delete_member_account_v4"'), "人員管理端點未使用歷史保護交易 RPC");
assert(!memberDelete.includes('.from("set_employee").delete()'), "仍存在直接刪除人員資料的流程");

const attendanceClock = read("supabase/functions/attendance-clock/index.ts");
const attendanceLedger = read("supabase/functions/attendance-ledger/index.ts");
const attendanceExport = read("supabase/functions/attendance-ledger-export/index.ts");
const mealOrder = read("supabase/functions/meal-order/index.ts");
for (const [name, source] of [
  ["attendance-clock", attendanceClock],
  ["attendance-ledger", attendanceLedger],
  ["attendance-ledger-export", attendanceExport],
  ["meal-order", mealOrder]
]) {
  assert(source.includes("attendance_days"), `${name} 未使用每日簽到表`);
  assert(!source.includes("attendance_records"), `${name} 仍讀取舊打卡表`);
}
assert(attendanceClock.includes("safeAttendanceRecord") && attendanceClock.includes("record: safeAttendanceRecord"), "員工打卡回應未過濾敏感定位資料");
assert(attendanceClock.includes("MAX_GPS_DISTANCE_METERS = 300") && attendanceClock.includes("MAX_GPS_ACCURACY_METERS = 300"), "手機 GPS 距離或精準度限制缺失");
assert(attendanceClock.includes("isAndroidTablet") && attendanceClock.includes("isIPad"), "平板裝置判定缺失");
assert(attendanceClock.includes('rpc("save_attendance_clock"'), "打卡端點未使用原子 RPC");
assert(attendanceLedger.includes("function requireAdmin") && attendanceLedger.includes('actor?.role !== "admin"'), "簽到審核未限制為管理員");
for (const action of ["personal_list", "personal_save", "review_list", "review_save", "review_set", "history"]) {
  assert(attendanceLedger.includes(`body?.action === "${action}"`), `簽到簿缺少操作：${action}`);
}
assert(attendanceLedger.includes("hoursToMinutes") && attendanceLedger.includes("0.5 小時"), "簽到工時未限制為半小時單位");
assert(attendanceLedger.includes("reviewed_at") && attendanceLedger.includes("attendance_audit_logs"), "簽到審核或稽核流程缺失");
assert(attendanceExport.includes("regular_minutes") && attendanceExport.includes("overtime_minutes"), "簽到匯出未使用正式每日工時欄位");
assert(mealOrder.includes("clock_in_location") && mealOrder.includes('rpc("save_meal_order"'), "訂餐未依正式上班簽到與交易 RPC 處理");
assert(mealOrder.includes("停用品項只能減少或取消"), "停用品項增加數量保護缺失");

const currentEdgeFiles = ["catalog-admin", "member-auth-admin", "member-order-v2", "member-delete-v2", "department-attendance-v2", "attendance-clock", "attendance-ledger", "attendance-ledger-export", "meal-order", "meal-report-v2", "meal-cancel-v2"];
currentEdgeFiles.forEach((name) => {
  const source = read(`supabase/functions/${name}/index.ts`);
  assert(!/profile\?\.is_active|profile\.data\.is_active|is_active:\s*true/.test(source), `${name} 仍依賴已移除的人員 is_active`);
});

const webApi = read("src/renderer/web-api.js");
assert(webApi.includes("function isTabletDevice") && webApi.includes("isAndroidTablet") && webApi.includes("isIPad"), "正式 web-api 缺少平板 Session 判定");
assert(webApi.includes("mobileSessionMaxIdleMs") && webApi.includes("desktopSessionMaxIdleMs") && webApi.includes("function assertSessionActive"), "登入缺少裝置別閒置期限或請求驗證");
assert(webApi.includes("get_my_profile_v2") && webApi.includes("get_schedule_directory_v2") && webApi.includes("get_employee_admin_directory_v2") && webApi.includes("get_department_directory_v2"), "前端尚未使用安全名錄 RPC");
assert(!webApi.includes("get_employee_directory_v2"), "前端仍使用混合用途舊名錄 RPC");
assert(webApi.includes('requestFunction("attendance-clock"') && webApi.includes('action: "today"'), "前端缺少安全今日打卡查詢");
assert(webApi.includes('requestFunction("attendance-ledger"'), "前端缺少統一簽到簿 API");
assert(webApi.includes('requestFunction("attendance-ledger-export"'), "前端缺少簽到匯出 API");
retiredFunctions.forEach((name) => assert(!webApi.includes(name), `前端仍呼叫已淘汰端點：${name}`));
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
assert(readme.includes("003_attendance_ledger.sql") && readme.includes("001_current_schema.sql") && readme.includes("002_current_updates.sql"), "README 未說明完整 SQL 執行順序");
const spec = read("規格書.md");
assert(spec.includes("簽到簿") && spec.includes("個人記錄") && spec.includes("簽到審核"), "正式規格書缺少新版簽到簿資訊架構");
assert(spec.includes("attendance_days") && spec.includes("attendance_audit_logs"), "正式規格書缺少每日簽到資料模型");
assert(spec.includes("attendance-ledger") && spec.includes("attendance-ledger-export"), "正式規格書缺少新版 Edge Function 契約");
assert(spec.includes("舊打卡資料") && spec.includes("遷移"), "正式規格書缺少舊資料遷移與保留規則");
assert(spec.includes("未登入不顯示班表、員工、打卡、加班與訂餐資料"), "正式規格書缺少未登入資料保護規則");
assert(spec.includes("頁面與資料權限矩陣") && spec.includes("RPO") && spec.includes("RTO"), "正式規格書缺少權限或維運目標");

console.log(`renderer contracts checks passed (${required.length} required files).`);
