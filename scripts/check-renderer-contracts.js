const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const required = [
  "supabase/001_current_schema.sql",
  "supabase/002_current_updates.sql",
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
retiredFunctions.forEach((name) => {
  assert(!exists(`supabase/functions/${name}`), `仍保留已淘汰端點：${name}`);
});
assert(!exists("src/renderer/renderer-overtime-employee.js"), "仍保留已淘汰加班申請畫面模組");

const deployScript = read("scripts/deploy-edge-functions.ps1");
for (const name of ["attendance-clock", "attendance-ledger", "attendance-ledger-export", "meal-order"]) {
  assert(deployScript.includes(`"${name}"`), `部署清單缺少正式端點：${name}`);
}
retiredFunctions.forEach((name) => {
  assert(!deployScript.includes(`"${name}"`), `部署清單仍包含已淘汰端點：${name}`);
});

const actionsWorkflow = read(".github/workflows/deploy-pages.yml");
const projectPackage = JSON.parse(read("package.json"));
const workflowFiles = fs.readdirSync(path.join(root, ".github", "workflows"))
  .filter((name) => /\.ya?ml$/i.test(name))
  .sort();
const workflowCommands = [
  "npm run web:publish",
  "npm test",
  "npm run web:check",
  "node scripts/check-normalized-storage.js",
  "node scripts/check-expansion-acceptance.js",
  "node scripts/check-settings-lists.js",
  "npm run renderer:check"
];
assert(actionsWorkflow.includes("name: Validate Web App"), "GitHub Actions 尚未使用單一網站驗證流程");
assert(actionsWorkflow.includes("pull_request:") && actionsWorkflow.includes("push:"), "正式 workflow 缺少 PR 或 main push 觸發");
assert(actionsWorkflow.includes("cancel-in-progress: true"), "正式 workflow 未取消同分支舊驗證");
workflowCommands.forEach((command) => assert(actionsWorkflow.includes(command), `正式 workflow 缺少：${command}`));
assert(!actionsWorkflow.includes("actions/deploy-pages") && !actionsWorkflow.includes("actions/upload-pages-artifact"), "驗證 workflow 不應重複部署 GitHub Pages");
assert(!actionsWorkflow.includes("contents: write") && !/\bgit\s+(?:commit|push)\b/.test(actionsWorkflow), "驗證 workflow 不得修改 PR 分支");
assert(workflowFiles.length === 1 && workflowFiles[0] === "deploy-pages.yml", `仍保留重複 workflow：${workflowFiles.join(", ")}`);
assert(String(projectPackage.scripts?.["ci:check"] || "").includes("npm run renderer:check"), "ci:check 未包含 renderer 驗證");

const currentSchema = read("supabase/001_current_schema.sql");
const databaseUpdates = read("supabase/002_current_updates.sql");
const databaseSources = `${currentSchema}\n${databaseUpdates}`;
assert(databaseSources.includes("create table if not exists public.attendance_days"), "資料庫缺少每日簽到主表");
assert(databaseSources.includes("create table if not exists public.attendance_audit_logs"), "資料庫缺少簽到稽核表");
assert(databaseSources.includes("unique (user_id, work_date)"), "每日簽到缺少每人每日唯一限制");
assert(databaseSources.includes("regular_minutes") && databaseSources.includes("overtime_minutes"), "每日簽到缺少正常與加班分鐘欄位");
assert(databaseSources.includes("alter table public.attendance_days enable row level security"), "每日簽到未啟用 RLS");
assert(databaseSources.includes("attendance_days_select_own"), "員工缺少只讀本人簽到政策");
assert(databaseSources.includes("revoke all on table public.attendance_days from anon"), "每日簽到未明確撤銷匿名權限");
assert(databaseSources.includes("grant select on table public.attendance_days to authenticated"), "登入者缺少受 RLS 保護的簽到讀取權限");
assert(databaseSources.includes("insert into public.attendance_days") && databaseSources.includes("from public.attendance_records"), "舊打卡歷史尚未納入可重複執行的資料遷移");
assert(databaseSources.includes("migration_backfill"), "舊資料遷移缺少稽核紀錄");

const clockFunctionBlock = databaseUpdates.slice(databaseUpdates.lastIndexOf("create or replace function public.save_attendance_clock"));
assert(clockFunctionBlock.includes("public.attendance_days%rowtype"), "正式打卡 RPC 仍使用舊打卡資料型別");
assert(clockFunctionBlock.includes("insert into public.attendance_days"), "正式打卡 RPC 未寫入每日簽到表");
assert(clockFunctionBlock.includes("insert into public.attendance_audit_logs"), "正式打卡 RPC 未寫入簽到稽核表");
assert(!clockFunctionBlock.slice(0, clockFunctionBlock.indexOf("create or replace function public.save_meal_order")).includes("public.attendance_records%rowtype"), "正式打卡 RPC 仍使用舊打卡表");

const mealFunctionBlock = databaseUpdates.slice(databaseUpdates.lastIndexOf("create or replace function public.save_meal_order"));
assert(mealFunctionBlock.includes("public.attendance_days%rowtype"), "正式訂餐 RPC 仍使用舊打卡資料型別");
assert(mealFunctionBlock.includes("clock_in_location->>'departmentId'"), "正式訂餐 RPC 未使用簽到地點快照");

assert(databaseSources.includes("get_my_profile_v2") && databaseSources.includes("get_schedule_directory_v2") && databaseSources.includes("get_employee_admin_directory_v2"), "缺少分用途人員資料 RPC");
assert(databaseSources.includes("drop function if exists public.get_employee_directory_v2"), "混合用途舊人員名錄 RPC 尚未移除");
assert(databaseSources.includes("save_departments_general_v2") && databaseSources.includes("delete_department_general_v2"), "單位安全寫入 RPC 缺失");
assert(databaseSources.includes("get_schedule_export_rows_v2"), "班表匯出資料 RPC 缺失");
assert(databaseSources.includes("revoke select on public.set_employee from authenticated"), "人員主表仍可被所有登入者直接讀取");
assert(databaseSources.includes("MEMBER_HAS_HISTORY"), "人員刪除缺少歷史資料阻擋錯誤碼");
assert(databaseSources.includes("attendance_days") && databaseSources.includes("attendance_audit_logs"), "人員刪除歷史保護未涵蓋新版簽到資料");

const memberDelete = read("supabase/functions/member-delete-v2/index.ts");
const memberAuthAdmin = read("supabase/functions/member-auth-admin/index.ts");
assert(memberDelete.includes('rpc("delete_member_account_v4"'), "帳號刪除未使用歷史保護交易 RPC");
assert(memberAuthAdmin.includes('rpc("delete_member_account_v4"'), "正式人員管理端點未使用歷史保護交易 RPC");
assert(!memberDelete.includes('.from("set_employee").delete()'), "仍存在直接刪除人員資料的流程");

const currentEdgeFiles = [
  "catalog-admin",
  "member-auth-admin",
  "member-order-v2",
  "member-delete-v2",
  "department-attendance-v2",
  "attendance-clock",
  "attendance-ledger",
  "attendance-ledger-export",
  "meal-order",
  "meal-report-v2",
  "meal-cancel-v2"
];
currentEdgeFiles.forEach((name) => {
  const source = read(`supabase/functions/${name}/index.ts`);
  assert(!/profile\?\.is_active|profile\.data\.is_active|is_active:\s*true/.test(source), `${name} 仍依賴已移除的人員 is_active`);
});

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
assert(attendanceExport.includes("attendance_days") && attendanceExport.includes("regular_minutes") && attendanceExport.includes("overtime_minutes"), "簽到匯出未使用正式每日工時欄位");
assert(mealOrder.includes("clock_in_location") && mealOrder.includes('rpc("save_meal_order"'), "訂餐未依正式上班簽到與交易 RPC 處理");
assert(mealOrder.includes("停用品項只能減少或取消"), "停用品項增加數量保護缺失");

const sourceWebApi = read("src/renderer/web-api.js");
assert(sourceWebApi.includes("function isTabletDevice") && sourceWebApi.includes("isAndroidTablet") && sourceWebApi.includes("isIPad"), "正式 web-api 缺少平板 Session 判定");
assert(sourceWebApi.includes("mobileSessionMaxIdleMs") && sourceWebApi.includes("desktopSessionMaxIdleMs"), "登入缺少裝置別閒置期限");
assert(sourceWebApi.includes("function assertSessionActive"), "受驗證請求未檢查 Session 期限");
assert(sourceWebApi.includes("get_my_profile_v2") && sourceWebApi.includes("get_schedule_directory_v2") && sourceWebApi.includes("get_employee_admin_directory_v2") && sourceWebApi.includes("get_department_directory_v2"), "前端尚未使用安全名錄 RPC");
assert(!sourceWebApi.includes("get_employee_directory_v2"), "前端仍使用混合用途舊名錄 RPC");
assert(sourceWebApi.includes('requestFunction("attendance-clock"') && sourceWebApi.includes('action: "today"'), "前端缺少安全今日打卡查詢");
assert(sourceWebApi.includes('requestFunction("attendance-ledger"'), "前端缺少統一簽到簿 API");
assert(sourceWebApi.includes('requestFunction("attendance-ledger-export"'), "前端缺少簽到匯出 API");
retiredFunctions.forEach((name) => assert(!sourceWebApi.includes(name), `前端仍呼叫已淘汰端點：${name}`));
assert(sourceWebApi.includes("async function deleteMealProduct") && sourceWebApi.includes('action: "delete_admin_product"'), "前端缺少安全刪除訂餐品項操作");
assert(sourceWebApi.includes("companySubsidy: Number(payload.companySubsidy)"), "前端未傳送公司補助");

const attendancePage = read("src/renderer/renderer-attendance-page.js");
assert(attendancePage.includes("timeout: 15000") && attendancePage.includes("maximumAge: 0"), "手機定位未取得即時高精準度位置");
assert(attendancePage.includes("submitAttendanceClock") && attendancePage.includes("只能在今天的紀錄列打卡"), "簽到簿表格內打卡限制缺失");
assert(!attendancePage.includes("maybePromptOvertimeAfterClockOut"), "下班後仍保留舊加班提醒流程");

const recordSources = [
  "src/renderer/renderer-records-page.js",
  "src/renderer/renderer-records-views.js",
  "src/renderer/renderer-records-actions.js",
  "src/renderer/renderer-records-events.js"
].map(read).join("\n");
for (const label of ["個人記錄", "簽到審核", "上班時數", "加班時數", "批次審核", "批次退回"]) {
  assert(recordSources.includes(label), `簽到簿畫面缺少：${label}`);
}
assert(!recordSources.includes("加班審核") && !recordSources.includes("打卡管理"), "簽到簿仍顯示已淘汰的獨立管理分頁");

const sourceApp = read("src/renderer/app.js");
const publishedApp = read("docs/app.js");
assert(sourceApp === publishedApp, "src/renderer/app.js 與 docs/app.js 不同步");
assert(sourceApp.includes("attendance-ledger") && sourceApp.includes("簽到審核"), "正式 JavaScript bundle 缺少簽到簿功能");
const sourceCss = read("src/renderer/app.css");
const publishedCss = read("docs/app.css");
assert(sourceCss === publishedCss, "src/renderer/app.css 與 docs/app.css 不同步");
assert(sourceCss.includes(".meal-card") && sourceCss.includes("width: min(1100px, 100%)"), "電腦版訂餐頁寬度未與記錄頁一致");

const sourceIndex = read("src/renderer/index.html");
const publishedIndex = read("docs/index.html");
assert(sourceIndex.includes("app-config.js") && sourceIndex.includes("app.js") && !sourceIndex.includes("v2-api.js"), "來源頁必須只載入正式 JavaScript");
assert(publishedIndex.includes("app-config.js") && publishedIndex.includes("app.js") && !publishedIndex.includes("v2-api.js"), "發布頁必須只載入正式 JavaScript");
const publishedJsFiles = fs.readdirSync(path.join(root, "docs")).filter((name) => name.endsWith(".js"));
assert(publishedJsFiles.every((name) => name === "app-config.js" || name === "app.js"), `docs 含不應發布的 JavaScript：${publishedJsFiles.join(", ")}`);

const authoritativeSpec = read("規格書.md");
assert(authoritativeSpec.includes("簽到簿") && authoritativeSpec.includes("個人記錄") && authoritativeSpec.includes("簽到審核"), "正式規格書缺少新版簽到簿資訊架構");
assert(authoritativeSpec.includes("attendance_days") && authoritativeSpec.includes("attendance_audit_logs"), "正式規格書缺少每日簽到資料模型");
assert(authoritativeSpec.includes("attendance-ledger") && authoritativeSpec.includes("attendance-ledger-export"), "正式規格書缺少新版 Edge Function 契約");
assert(authoritativeSpec.includes("舊打卡資料") && authoritativeSpec.includes("遷移"), "正式規格書缺少舊資料遷移與保留規則");
assert(authoritativeSpec.includes("未登入不顯示班表、員工、打卡、加班與訂餐資料"), "正式規格書缺少未登入資料保護規則");
assert(authoritativeSpec.includes("頁面與資料權限矩陣"), "正式規格書缺少跨頁面權限矩陣");
assert(authoritativeSpec.includes("效能、容量與可用性目標") && authoritativeSpec.includes("100 名有效人員"), "正式規格書缺少可量化效能容量目標");
assert(authoritativeSpec.includes("RPO") && authoritativeSpec.includes("RTO") && authoritativeSpec.includes("發布與回滾"), "正式規格書缺少備份復原或回滾目標");

console.log(`renderer contracts checks passed (${required.length} required files).`);
