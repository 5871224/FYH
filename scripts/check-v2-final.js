const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const required = [
  "supabase/002_current_updates.sql",
  "supabase/functions/attendance-clock/index.ts",
  "supabase/functions/attendance-clock-safe/index.ts",
  "supabase/functions/attendance-overtime-employee/index.ts",
  "supabase/functions/attendance-overtime-admin-list/index.ts",
  "supabase/functions/attendance-overtime-admin-action/index.ts",
  "supabase/functions/attendance-admin-list-v2/index.ts",
  "supabase/functions/attendance-admin-action-v2/index.ts",
  "supabase/functions/department-attendance-v2/index.ts",
  "supabase/functions/member-delete-v2/index.ts",
  "supabase/functions/member-auth-admin/index.ts",
  "supabase/functions/personal-records-v2/index.ts",
  "supabase/functions/meal-order/index.ts",
  "supabase/functions/meal-report-v2/index.ts",
  "supabase/functions/meal-cancel-v2/index.ts",
  "src/renderer/v2-api.js",
  "src/renderer/app.js",
  "docs/app.js",
  "scripts/build-js.js",
  "src/renderer/renderer-overtime-employee.js",
  "src/renderer/v2-overtime-admin.js",
  "src/renderer/v2-meal.js",
  "src/renderer/v2-account.js",
  "src/renderer/v2-attendance-admin.js",
  "src/renderer/v2-records.js",
  "src/renderer/v2-meal-export.js",
];

required.forEach((file) => assert(exists(file), `缺少 V2 檔案：${file}`));

const actionsWorkflow = read(".github/workflows/deploy-pages.yml");
const projectPackage = JSON.parse(read("package.json"));
assert(actionsWorkflow.includes("name: Validate and Deploy Pages"), "GitHub Actions 尚未使用單一驗證後部署流程");
assert(actionsWorkflow.includes("pull_request:") && actionsWorkflow.includes("push:"), "單一 workflow 缺少 Pull Request 或 main push 觸發");
assert(actionsWorkflow.includes("needs: validate"), "Pages 部署未明確依賴完整驗證");
assert(actionsWorkflow.includes("npm run ci:check"), "單一 workflow 未使用共用完整檢查指令");
assert(actionsWorkflow.includes("actions/upload-pages-artifact@v5") && actionsWorkflow.includes("actions/deploy-pages@v5"), "Pages artifact 或部署工作缺失");
assert(!exists(".github/workflows/v2-alignment.yml") && !exists(".github/workflows/v2-final-check.yml"), "仍保留重複的獨立 V2 workflow");
assert(String(projectPackage.scripts?.["ci:check"] || "").includes("npm run v2:check"), "ci:check 未包含完整 V2 驗證");

const reportRecords = read("supabase/functions/report-records/index.ts");
assert(!reportRecords.includes("full_name, department_id"), "仍查詢不存在的 set_employee.department_id");

const currentSchema = read("supabase/001_current_schema.sql");
const databaseUpdates = read("supabase/002_current_updates.sql");
const security = databaseUpdates;
assert(security.includes("drop policy if exists write_overtime_requests"), "尚未移除加班直接寫入政策");
assert(security.includes("drop policy if exists write_meal_orders"), "尚未移除訂餐直接寫入政策");
assert(security.includes("public.is_effective_user"), "缺少有效任職期間資料庫檢查");

const visibility = databaseUpdates;
assert(visibility.includes("drop policy if exists v2_restrict_employee_directory"), "未移除舊員工目錄限制政策");
assert(visibility.includes("drop policy if exists v2_restrict_schedule_visibility"), "未移除舊班表限制政策");
const hardenedAccess = databaseUpdates;
assert(hardenedAccess.includes("get_my_profile_v2") && hardenedAccess.includes("get_schedule_directory_v2") && hardenedAccess.includes("get_employee_admin_directory_v2"), "缺少分用途人員資料 RPC");
assert(hardenedAccess.includes("drop function if exists public.get_employee_directory_v2"), "混合用途舊人員名錄 RPC 尚未移除");
assert(hardenedAccess.includes("save_departments_general_v2") && hardenedAccess.includes("delete_department_general_v2"), "單位一般欄位安全寫入 RPC 缺失");
assert(hardenedAccess.includes("get_schedule_export_rows_v2"), "班表匯出正式資料 RPC 缺失");
assert(hardenedAccess.includes("get_department_directory_v2"), "缺少安全單位名錄 RPC");
assert(hardenedAccess.includes("drop policy if exists anon_can_read_profiles"), "未移除匿名人員資料政策");
assert(hardenedAccess.includes("drop policy if exists authenticated_can_read_schedule_entries"), "未移除逾期帳號班表旁路政策");
assert(hardenedAccess.includes("revoke select on public.set_employee from authenticated"), "人員主表仍可由所有登入者直接讀取");

const reapply = databaseUpdates;
assert(reapply.includes("where is_deleted_by_employee = false"), "軟刪除後重新申請的部分唯一索引缺失");

const lastAdmin = databaseUpdates;
assert(lastAdmin.includes("protect_last_effective_admin_v2"), "最後有效管理員保護缺失");
assert(lastAdmin.includes("before update or delete"), "最後管理員更新／刪除觸發器缺失");

const synchronizedDelete = databaseUpdates;
assert(synchronizedDelete.includes("references auth.users (id)"), "人員資料尚未連結 Auth 使用者");
assert(synchronizedDelete.includes("on delete cascade"), "Auth 與人員資料未使用同交易級聯刪除");
assert(synchronizedDelete.includes("has_synchronized_member_delete_v2"), "同步刪除 migration 檢查函式缺失");

const memberDelete = read("supabase/functions/member-delete-v2/index.ts");
assert(memberDelete.includes("員工沒有刪除帳號權限"), "後端未明確禁止員工刪除帳號");
assert(memberDelete.includes('actor.role === "manager" && target.role === "admin"'), "主管刪除權限未限制為管理員帳號以外");
assert(memberDelete.includes('rpc("delete_member_account_v4"'), "帳號刪除未使用歷史保護交易 RPC");
assert(!memberDelete.includes('.from("set_employee").delete()'), "仍存在前端直接刪除人員資料的不同步流程");
const memberAuthAdmin = read("supabase/functions/member-auth-admin/index.ts");
assert(memberAuthAdmin.includes('rpc("delete_member_account_v4"'), "正式人員管理端點未使用歷史保護交易 RPC");
assert(memberAuthAdmin.includes("status: 409") && memberAuthAdmin.includes("result?.blocked"), "已有歷史資料時未回傳阻擋狀態");
assert(!memberAuthAdmin.includes("is_active"), "人員管理端點仍依賴 is_active");
assert(databaseUpdates.includes("MEMBER_HAS_HISTORY"), "人員刪除缺少穩定歷史阻擋錯誤碼");
assert(!databaseUpdates.includes("create or replace function public.block_direct_member_deactivation_v2"), "人員停用函式仍會被建立");
assert(!databaseUpdates.includes("create trigger block_direct_member_deactivation_v2"), "人員停用 trigger 仍會被建立");
assert(databaseUpdates.includes("drop trigger if exists block_direct_member_deactivation_v2") && databaseUpdates.includes("drop function if exists public.block_direct_member_deactivation_v2"), "人員停用 trigger 清理 migration 缺失");
assert(databaseUpdates.includes("alter table public.set_employee drop column if exists is_active"), "人員 is_active 欄位移除 migration 缺失");
assert(databaseUpdates.includes("is_employee_account_effective") && databaseUpdates.includes("is_employee_employed_on"), "人員有效期共用函式缺失");


const setEmployeeBlock = currentSchema.slice(currentSchema.indexOf("create table if not exists public.set_employee"), currentSchema.indexOf("create table if not exists public.set_shift"));
assert(!setEmployeeBlock.includes("is_active"), "set_employee 現行結構仍包含 is_active");
const employeeEdgeFiles = [
  "report-records", "catalog-admin", "attendance-overtime-admin-list", "attendance-overtime-admin-action",
  "member-auth-admin", "meal-report-v2", "member-order-v2", "personal-records-v2",
  "attendance-admin-action-v2", "attendance-clock", "meal-order", "member-delete-v2",
  "meal-cancel-v2", "attendance-admin-list-v2", "attendance-overtime-employee",
  "department-attendance-v2"
];
employeeEdgeFiles.forEach((name) => {
  const source = read(`supabase/functions/${name}/index.ts`);
  assert(!/profile\?\.is_active|profile\.data\.is_active|select\("[^"]*is_active[^"]*hire_date|is_active:\s*true/.test(source), `${name} 仍依賴人員 is_active`);
});

const clockSql = databaseUpdates;
assert(clockSql.includes("clock_in_company_latitude"), "上班公司座標快照缺失");
assert(clockSql.includes("clock_out_company_longitude"), "下班公司座標快照缺失");
assert(clockSql.includes("and clock_out_at is null"), "下班打卡冪等條件缺失");

const attendanceClock = read("supabase/functions/attendance-clock/index.ts");
assert(attendanceClock.includes("safeAttendanceRecord"), "打卡端點未過濾員工可見欄位");
assert(attendanceClock.includes("record: safeAttendanceRecord"), "打卡回應仍可能直接回傳原始 GPS 或 IP");
assert(attendanceClock.includes("isAndroidTablet"), "Android 平板判定修正缺失");
assert(attendanceClock.includes("isIPad"), "iPad 判定修正缺失");
assert(!attendanceClock.includes("clock_in_ip:"), "員工打卡回應仍暴露上班 IP");
assert(!attendanceClock.includes("clock_in_latitude:"), "員工打卡回應仍暴露上班 GPS");

const safeClock = read("supabase/functions/attendance-clock-safe/index.ts");
assert(!safeClock.includes("clock_in_ip:"), "備援安全打卡回應仍暴露 IP");
assert(!safeClock.includes("clock_in_latitude:"), "備援安全打卡回應仍暴露 GPS");

const adminSql = databaseUpdates;
assert(adminSql.includes("p_reason text default ''"), "打卡異動原因未設為選填");
assert(adminSql.includes("old_record, new_record"), "打卡完整新舊快照稽核缺失");
assert(adminSql.includes("if v_in_changed or v_out_changed then"), "只改備註仍可能重置加班");

const overtimeEmployee = read("supabase/functions/attendance-overtime-employee/index.ts");
assert(overtimeEmployee.includes("APPLY_DAYS = 5"), "員工五日加班申請期限缺失");
assert(!overtimeEmployee.includes("不可高於系統計算值"), "員工加班時數仍受系統計算上限限制");
assert(!overtimeEmployee.includes("提早或延後時間未達 30 分鐘"), "員工加班申請仍受 30 分鐘資格門檻限制");
assert(!overtimeEmployee.includes("沒有可計算的班別"), "員工加班申請仍強制要求班別");
assert(overtimeEmployee.includes("加班申請時數必須大於 0"), "零小時加班申請仍可能送出");

const batchSql = databaseUpdates;
assert(batchSql.includes("admin_review_overtime_requests_v2"), "加班批次審核交易 RPC 缺失");
assert(batchSql.includes("for update"), "加班批次審核未鎖定資料列");

const adminAction = read("supabase/functions/attendance-overtime-admin-action/index.ts");
assert(adminAction.includes('rpc("admin_review_overtime_requests_v2"'), "管理員加班審核未使用交易 RPC");

const mealOrder = read("supabase/functions/meal-order/index.ts");
assert(mealOrder.includes('rpc("save_meal_order_v2"'), "訂餐未保留第一次訂餐單位快照");
assert(mealOrder.includes("停用品項只能減少或取消"), "停用品項增加數量限制缺失");

const mealSettingsSql = databaseUpdates;
assert(mealSettingsSql.includes("company_subsidy integer"), "公司補助資料庫欄位缺失");
assert(mealSettingsSql.includes("check (company_subsidy > 0)"), "公司補助正整數資料庫限制缺失");
assert(mealSettingsSql.includes("delete_meal_product_v2"), "安全刪除訂餐品項 RPC 缺失");
assert(mealSettingsSql.includes("此品項已有訂餐記錄"), "已有訂餐歷史的品項刪除保護缺失");
assert(mealOrder.includes("delete_admin_product"), "訂餐 Edge Function 缺少刪除品項操作");
assert(mealOrder.includes("公司補助只能輸入正整數"), "訂餐 Edge Function 缺少公司補助驗證");

const mealReport = read("supabase/functions/meal-report-v2/index.ts");
assert(mealReport.includes("companySubsidy"), "訂餐報表未讀取公司補助");
assert(mealReport.includes("row.amount - days * companySubsidy"), "人員報表自付額未使用公司補助");

const sourceApi = read("src/renderer/v2-api.js");
const sourceApp = read("src/renderer/app.js");
const publishedApp = read("docs/app.js");
assert(sourceApp === publishedApp, "src/renderer/app.js 與 docs/app.js 不同步");
assert(!sourceApi.includes("safeDepartmentColumns") && !sourceApi.includes("runManagerSafeWrite") && !sourceApi.includes("managerSafeFetch"), "前端仍使用攔截 fetch 的補丁式權限控制");
assert(sourceApi.includes("installTabletSessionPolicy"), "平板登入 Session 規則未同步修正");
assert(sourceApi.includes("isAndroidTablet"), "Android 平板 Session 判斷缺失");
assert(sourceApi.includes("isIPad"), "iPad Session 判斷缺失");
assert(sourceApi.includes("30 * 60 * 1000"), "平板未使用電腦版 30 分鐘閒置期限");

const { readRendererCore } = require("./renderer-core-source.js");
const sourceRenderer = readRendererCore(root);
const sourceWebApi = read("src/renderer/web-api.js");
assert(sourceWebApi.includes("get_my_profile_v2") && sourceWebApi.includes("get_schedule_directory_v2") && sourceWebApi.includes("get_employee_admin_directory_v2") && sourceWebApi.includes("get_department_directory_v2"), "前端尚未依用途使用安全名錄 RPC");
assert(!sourceWebApi.includes("get_employee_directory_v2"), "前端仍使用混合用途舊人員名錄 RPC");
const loadStateSource = sourceWebApi.slice(sourceWebApi.indexOf("async function loadState()"), sourceWebApi.indexOf("async function syncLeaveAndOvertimeCatalogs"));
assert(!loadStateSource.includes("getEmployeeAdminDirectoryRows"), "一般登入初始化仍預載完整管理名錄");
assert(sourceWebApi.includes("async function loadEmployeeAdminDirectory()"), "前端缺少管理名錄延遲載入介面");
assert(sourceWebApi.includes('restRpc("save_departments_general_v2"') && sourceWebApi.includes('restRpc("delete_department_general_v2"'), "單位新增修改刪除未使用安全 RPC");
assert(!sourceWebApi.includes('restInsert("set_departments"'), "前端仍直接 upsert 單位主表");
assert(sourceWebApi.includes('restRpc("get_schedule_export_rows_v2"') && sourceWebApi.includes("loadScheduleExportRows"), "前端缺少班表正式匯出資料查詢");
const saveStateSource = sourceWebApi.slice(sourceWebApi.indexOf("async function saveState(state)"), sourceWebApi.indexOf("async function syncCatalogs(state)"));
assert(!sourceWebApi.includes("profile?.is_active") && !saveStateSource.includes("is_active:"), "前端仍依賴人員 is_active");
assert(sourceRenderer.includes("async function ensureManagerDirectoryLoaded()") && sourceRenderer.includes("await ensureManagerDirectoryLoaded();"), "班表與設定頁未依需要載入管理名錄");
const attendanceClockSource = read("supabase/functions/attendance-clock/index.ts");
assert(sourceRenderer.includes("geolocationError") && sourceWebApi.includes("geolocationError"), "手機定位錯誤未送到打卡 API");
assert(attendanceClockSource.includes("目前位置或網路不符合打卡條件") && !attendanceClockSource.includes("目前 IP ${clientIp}"), "打卡錯誤仍可能暴露距離、精準度或 IP");
assert(sourceWebApi.includes('requestFunction("attendance-clock", {') && sourceWebApi.includes('action: "today"'), "今日打卡紀錄應使用安全 Edge Function 回應");
assert(sourceRenderer.includes("function getTodayShiftSummary") && sourceRenderer.includes("clock-today-line"), "打卡頁未顯示今日班別與時間");
assert(sourceRenderer.includes("function formatClockButtonStatus") && !sourceRenderer.includes("上班地點</span>"), "打卡地點與方式應顯示在打卡按鈕內");
const overtimePromptSource = sourceRenderer.slice(sourceRenderer.indexOf("async function maybePromptOvertimeAfterClockOut"), sourceRenderer.indexOf("async function submitAttendanceClock"));
assert(overtimePromptSource.includes("return false") && !overtimePromptSource.includes("confirmAction"), "下班打卡後仍可能自動建議加班");
const sourceOvertimeUi = read("src/renderer/renderer-overtime-employee.js");
assert(sourceRenderer.includes("data-toggle-overtime-panel") && sourceOvertimeUi.includes("data-toggle-overtime-panel"), "加班申請區塊應先顯示勾選框");
assert(sourceOvertimeUi.includes("overtime-hours-grid"), "提早上班與延後下班時數未固定在同一個雙欄群組");

const sourceMeal = read("src/renderer/v2-meal.js");
const sourceExporter = read("src/renderer/browser-exporter.js");
const sourceLiveReports = read("src/renderer/v2-live-report-filters.js");
assert(sourceExporter.includes("getOfficialLeaveRows") && sourceExporter.includes("getOfficialOvertimeRows"), "請假或加班匯出未使用正式後端資料列");
assert(sourceLiveReports.includes("api.loadScheduleExportRows") && sourceLiveReports.includes("exportRows"), "期間匯出仍只依賴畫面班表資料");
assert(sourceLiveReports.includes("getVisibleDateRange"), "匯出期間未預設目前八週班表範圍");

assert(sourceMeal.includes('addEventListener("beforeinput"'), "訂餐數量未在輸入前拒絕小數或負數");
assert(sourceMeal.includes('addEventListener("paste"'), "訂餐數量未拒絕貼上無效內容");
assert(sourceMeal.includes("lastValidMealQuantity"), "訂餐無效輸入未保留最後有效整數");
assert(sourceMeal.includes("data-meal-company-subsidy"), "訂餐設定缺少公司補助輸入框");
assert(sourceMeal.includes("data-delete-meal-product"), "訂餐設定缺少品項刪除按鈕");
const sourceUiSystem = read("src/renderer/app.css");
const publishedUiSystem = read("docs/app.css");
assert(sourceUiSystem === publishedUiSystem, "共用介面樣式來源版與發布版不同步");
assert(sourceUiSystem.includes(".meal-card") && sourceUiSystem.includes("width: min(1100px, 100%)"), "電腦版訂餐頁寬度未與記錄頁一致");

assert(sourceWebApi.includes("async function deleteMealProduct") && sourceWebApi.includes('action: "delete_admin_product"'), "前端 API 缺少刪除品項操作");
assert(sourceWebApi.includes('action: "admin_settings"') && sourceWebApi.includes('action: "save_admin_settings"'), "訂餐管理 API 操作名稱與後端不一致");
assert(!sourceWebApi.includes('action: "admin_get"') && !sourceWebApi.includes('action: "admin_save"'), "訂餐管理仍使用後端不支援的操作名稱");
assert(sourceWebApi.includes("companySubsidy: Number(payload.companySubsidy)"), "前端 API 未傳送公司補助");

const sourceExport = read("src/renderer/v2-meal-export.js");
assert(!sourceExport.includes("首次下訂時間"), "訂餐 Excel 不應顯示首次下訂時間");
assert(!sourceExport.includes("最後修改時間"), "訂餐 Excel 不應顯示最後修改時間");
assert(!sourceExport.includes("員工工號"), "訂餐 Excel 不應顯示員工工號");
assert(!sourceExport.includes('"警告"'), "訂餐 Excel 不應有獨立警告欄");
assert(sourceExport.includes("row.amount - mealDays * companySubsidy"), "訂餐 Excel 未依公司補助計算人員自付額");

const sourceRecords = read("src/renderer/v2-records.js");
assert(!sourceRecords.includes('["meal", "訂餐統計", isManager()]'), "記錄頁不應顯示訂餐統計頁籤");
assert(sourceRecords.includes("data-meal-report-view"), "訂餐統計缺少報表切換下拉選單");
assert(sourceRecords.includes('value="item"') && sourceRecords.includes('value="member"'), "訂餐統計缺少品項或人員報表");
assert(sourceRecords.includes("上班打卡已刪除") && !sourceRecords.includes("<th>警告</th>"), "訂餐統計警告應併入備註欄");
assert(sourceRecords.includes("report.memberSummary"), "人員訂餐報表未使用後端公司補助計算結果");
assert(!sourceRecords.includes("days * 55"), "人員訂餐報表仍硬編碼55元補助");

const scheduleDirectorySql = databaseUpdates.slice(databaseUpdates.lastIndexOf("區段 22：依頁面用途拆分人員資料 RPC"));
assert(scheduleDirectorySql.includes("get_my_profile_v2") && scheduleDirectorySql.includes("get_schedule_directory_v2") && scheduleDirectorySql.includes("get_employee_admin_directory_v2"), "人員資料用途分流 migration 缺失");
assert(scheduleDirectorySql.includes("employee.hire_date") && scheduleDirectorySql.includes("employee.leave_date") && scheduleDirectorySql.includes("employee.pay_by_day"), "共同班表名錄缺少一致顯示欄位");
assert(!scheduleDirectorySql.includes("case when actor.manager_access or employee.id = actor.id then employee.hire_date"), "共同班表名錄仍依角色遮罩顯示欄位");

const authoritativeSpec = read("規格書.md");
assert(authoritativeSpec.includes("未登入不顯示班表、員工、打卡、加班與訂餐資料"), "正式規格書缺少未登入資料保護規則");
assert(authoritativeSpec.includes("單位打卡設定中的地址、座標與固定對外 IP") && authoritativeSpec.includes("個別打卡紀錄的原始 GPS"), "正式規格書未區分打卡設定與個人定位稽核資料");
assert(authoritativeSpec.includes("公司補助"), "正式規格書缺少公司補助規則");
assert(authoritativeSpec.includes("手機優先"), "正式規格書缺少響應式介面規則");
assert(authoritativeSpec.includes("員工、主管與管理員看到的人員列") && authoritativeSpec.includes("角色差異只影響編輯工具"), "正式規格書缺少所有角色班表一致規則");
assert(authoritativeSpec.includes("get_my_profile_v2") && authoritativeSpec.includes("get_schedule_directory_v2") && authoritativeSpec.includes("get_employee_admin_directory_v2"), "正式規格書缺少人員資料用途分流");
assert(authoritativeSpec.includes("頁面與資料權限矩陣"), "正式規格書缺少跨頁面權限矩陣");
assert(authoritativeSpec.includes("管理名錄採依頁面延遲載入"), "正式規格書缺少管理名錄延遲載入規則");
assert(authoritativeSpec.includes("不得只依賴目前畫面的記憶體資料") && authoritativeSpec.includes("已離職、停用"), "正式規格書缺少班表歷史匯出規則");
assert(authoritativeSpec.includes("單位一般欄位 RPC") && authoritativeSpec.includes("不可見狀態"), "正式規格書缺少單位安全儲存與錯誤提示規則");
assert(authoritativeSpec.includes("# 第八章　共通互動、非功能性與設計交付"), "正式規格書缺少共通互動與非功能性章節");
assert(authoritativeSpec.includes("初次載入") && authoritativeSpec.includes("資料衝突") && authoritativeSpec.includes("未儲存修改"), "正式規格書缺少共通頁面狀態或未儲存資料規則");
assert(authoritativeSpec.includes("效能、容量與可用性目標") && authoritativeSpec.includes("100 名有效人員"), "正式規格書缺少可量化效能容量目標");
assert(authoritativeSpec.includes("Wireframe 與設計交付") && authoritativeSpec.includes("WCAG 2.1 AA"), "正式規格書缺少設計交付或無障礙目標");
assert(authoritativeSpec.includes("# 第九章　API、資料生命週期、維運與測試"), "正式規格書缺少 API 與維運章節");
assert(authoritativeSpec.includes("MEAL_CUTOFF_PASSED") && authoritativeSpec.includes("HTTP 狀態碼"), "正式規格書缺少 API 錯誤契約");
assert(authoritativeSpec.includes("RPO") && authoritativeSpec.includes("RTO") && authoritativeSpec.includes("發布與回滾"), "正式規格書缺少備份復原或回滾目標");
assert(authoritativeSpec.includes("需求編號與追蹤矩陣") && authoritativeSpec.includes("TC-MEAL-001"), "正式規格書缺少需求追蹤與測試案例格式");

assert(authoritativeSpec.includes("可查看所有人員完整班表") || authoritativeSpec.includes("可查看完整班表與統計欄"), "正式規格書未明確標示員工可查看完整班表");
assert(authoritativeSpec.includes("警告併入備註"), "正式規格書未明確標示訂餐統計警告併入備註欄");
assert(authoritativeSpec.includes("本次異動原因；此欄選填"), "正式規格書未明確標示打卡異動原因為選填");
assert(authoritativeSpec.includes("不顯示員工工號、第一次下訂時間與最後修改時間"), "正式規格書未明確標示訂餐報表隱藏欄位");
assert(authoritativeSpec.includes("刪除符合條件的員工或主管帳號"), "正式規格書未明確標示主管刪除權限");

const sourceIndex = read("src/renderer/index.html");
const publishedIndex = read("docs/index.html");
assert(sourceIndex.includes("app-config.js") && sourceIndex.includes("app.js") && !sourceIndex.includes("v2-api.js"), "來源頁必須只載入 app-config.js 與 app.js");
assert(publishedIndex.includes("app-config.js") && publishedIndex.includes("app.js") && !publishedIndex.includes("v2-api.js"), "發布頁必須只載入 app-config.js 與 app.js");
assert(sourceApp.includes("installV2ApiOverrides") && sourceApp.includes("installV2MealUi") && sourceApp.includes("installV2RecordsUi"), "JavaScript bundle 缺少必要 V2 模組");
const publishedJsFiles = fs.readdirSync(path.join(root, "docs")).filter((name) => name.endsWith(".js"));
assert(publishedJsFiles.every((name) => name === "app-config.js" || name === "app.js"), `docs 含有不應發布的 JavaScript 原始模組：${publishedJsFiles.join(", ")}`);

console.log(`V2 final checks passed (${required.length} required files).`);
