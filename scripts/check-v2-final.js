const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const required = [
  "supabase/027_v2_security.sql",
  "supabase/028_v2_attendance_clock.sql",
  "supabase/029_v2_attendance_admin.sql",
  "supabase/030_v2_meal_snapshot.sql",
  "supabase/031_v2_role_department_protection.sql",
  "supabase/032_v2_overtime_batch.sql",
  "supabase/033_v2_employee_visibility.sql",
  "supabase/034_v2_overtime_reapply.sql",
  "supabase/035_v2_last_admin.sql",
  "supabase/036_v2_synchronized_member_delete.sql",
  "supabase/037_v2_meal_subsidy_and_product_delete.sql",
  "supabase/043_harden_private_data_access.sql",
  "supabase/functions/attendance-clock/index.ts",
  "supabase/functions/attendance-clock-safe/index.ts",
  "supabase/functions/attendance-overtime-employee/index.ts",
  "supabase/functions/attendance-overtime-admin-list/index.ts",
  "supabase/functions/attendance-overtime-admin-action/index.ts",
  "supabase/functions/attendance-admin-list-v2/index.ts",
  "supabase/functions/attendance-admin-action-v2/index.ts",
  "supabase/functions/department-attendance-v2/index.ts",
  "supabase/functions/member-delete-v2/index.ts",
  "supabase/functions/personal-records-v2/index.ts",
  "supabase/functions/meal-order/index.ts",
  "supabase/functions/meal-report-v2/index.ts",
  "supabase/functions/meal-cancel-v2/index.ts",
  "src/renderer/v2-api.js",
  "docs/v2-api.js",
  "src/renderer/v2-overtime-employee.js",
  "src/renderer/v2-overtime-admin.js",
  "src/renderer/v2-meal.js",
  "docs/v2-meal.js",
  "src/renderer/v2-meal-api.js",
  "docs/v2-meal-api.js",
  "src/renderer/v2-account.js",
  "src/renderer/v2-attendance-admin.js",
  "src/renderer/v2-records.js",
  "docs/v2-records.js",
  "src/renderer/v2-meal-export.js",
  "docs/v2-meal-export.js"
];

required.forEach((file) => assert(exists(file), `缺少 V2 檔案：${file}`));

const reportRecords = read("supabase/functions/report-records/index.ts");
assert(!reportRecords.includes("full_name, department_id"), "仍查詢不存在的 set_employee.department_id");

const security = read("supabase/027_v2_security.sql");
assert(security.includes("drop policy if exists write_overtime_requests"), "尚未移除加班直接寫入政策");
assert(security.includes("drop policy if exists write_meal_orders"), "尚未移除訂餐直接寫入政策");
assert(security.includes("public.is_effective_user"), "缺少有效任職期間資料庫檢查");

const visibility = read("supabase/033_v2_employee_visibility.sql");
assert(visibility.includes("drop policy if exists v2_restrict_employee_directory"), "未移除舊員工目錄限制政策");
assert(visibility.includes("drop policy if exists v2_restrict_schedule_visibility"), "未移除舊班表限制政策");
const hardenedAccess = read("supabase/043_harden_private_data_access.sql");
assert(hardenedAccess.includes("get_employee_directory_v2"), "缺少安全人員名錄 RPC");
assert(hardenedAccess.includes("get_department_directory_v2"), "缺少安全單位名錄 RPC");
assert(hardenedAccess.includes("drop policy if exists anon_can_read_profiles"), "未移除匿名人員資料政策");
assert(hardenedAccess.includes("drop policy if exists authenticated_can_read_schedule_entries"), "未移除逾期帳號班表旁路政策");
assert(hardenedAccess.includes("revoke select on public.set_employee from authenticated"), "人員主表仍可由所有登入者直接讀取");

const reapply = read("supabase/034_v2_overtime_reapply.sql");
assert(reapply.includes("where is_deleted_by_employee = false"), "軟刪除後重新申請的部分唯一索引缺失");

const lastAdmin = read("supabase/035_v2_last_admin.sql");
assert(lastAdmin.includes("protect_last_effective_admin_v2"), "最後有效管理員保護缺失");
assert(lastAdmin.includes("before update or delete"), "最後管理員更新／刪除觸發器缺失");

const synchronizedDelete = read("supabase/036_v2_synchronized_member_delete.sql");
assert(synchronizedDelete.includes("references auth.users (id)"), "人員資料尚未連結 Auth 使用者");
assert(synchronizedDelete.includes("on delete cascade"), "Auth 與人員資料未使用同交易級聯刪除");
assert(synchronizedDelete.includes("has_synchronized_member_delete_v2"), "同步刪除 migration 檢查函式缺失");

const memberDelete = read("supabase/functions/member-delete-v2/index.ts");
assert(memberDelete.includes("員工沒有刪除帳號權限"), "後端未明確禁止員工刪除帳號");
assert(memberDelete.includes('actor.role === "manager" && target.role === "admin"'), "主管刪除權限未限制為管理員帳號以外");
assert(memberDelete.includes('rpc("has_synchronized_member_delete_v2")'), "刪除前未確認同步刪除 migration");
assert(memberDelete.includes("auth.admin.deleteUser(target.id)"), "帳號刪除未由 Auth 端啟動級聯交易");
assert(!memberDelete.includes('.from("set_employee").delete()'), "仍存在先刪人員資料再刪 Auth 的不同步流程");

const clockSql = read("supabase/028_v2_attendance_clock.sql");
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

const adminSql = read("supabase/029_v2_attendance_admin.sql");
assert(adminSql.includes("p_reason text default ''"), "打卡異動原因未設為選填");
assert(adminSql.includes("old_record, new_record"), "打卡完整新舊快照稽核缺失");
assert(adminSql.includes("if v_in_changed or v_out_changed then"), "只改備註仍可能重置加班");

const overtimeEmployee = read("supabase/functions/attendance-overtime-employee/index.ts");
assert(overtimeEmployee.includes("APPLY_DAYS = 5"), "員工五日加班申請期限缺失");
assert(!overtimeEmployee.includes("不可高於系統計算值"), "員工加班時數仍受系統計算上限限制");
assert(overtimeEmployee.includes("加班申請時數必須大於 0"), "零小時加班申請仍可能送出");

const batchSql = read("supabase/032_v2_overtime_batch.sql");
assert(batchSql.includes("admin_review_overtime_requests_v2"), "加班批次審核交易 RPC 缺失");
assert(batchSql.includes("for update"), "加班批次審核未鎖定資料列");

const adminAction = read("supabase/functions/attendance-overtime-admin-action/index.ts");
assert(adminAction.includes('rpc("admin_review_overtime_requests_v2"'), "管理員加班審核未使用交易 RPC");

const mealOrder = read("supabase/functions/meal-order/index.ts");
assert(mealOrder.includes('rpc("save_meal_order_v2"'), "訂餐未保留第一次訂餐單位快照");
assert(mealOrder.includes("停用品項只能減少或取消"), "停用品項增加數量限制缺失");

const mealSettingsSql = read("supabase/037_v2_meal_subsidy_and_product_delete.sql");
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
const publishedApi = read("docs/v2-api.js");
assert(sourceApi === publishedApi, "src/renderer/v2-api.js 與 docs/v2-api.js 不同步");
assert(sourceApi.includes("safeDepartmentColumns"), "一般單位查詢仍可能包含敏感打卡欄位");
assert(sourceApi.includes("installTabletSessionPolicy"), "平板登入 Session 規則未同步修正");
assert(sourceApi.includes("isAndroidTablet"), "Android 平板 Session 判斷缺失");
assert(sourceApi.includes("isIPad"), "iPad Session 判斷缺失");
assert(sourceApi.includes("30 * 60 * 1000"), "平板未使用電腦版 30 分鐘閒置期限");

const sourceRenderer = read("src/renderer/renderer.js");
const publishedRenderer = read("docs/renderer.js");
const sourceWebApi = read("src/renderer/web-api.js");
assert(sourceWebApi.includes("get_employee_directory_v2") && sourceWebApi.includes("get_department_directory_v2"), "前端尚未改用安全名錄 RPC");
const attendanceClockSource = read("supabase/functions/attendance-clock/index.ts");
assert(sourceRenderer.includes("geolocationError") && sourceWebApi.includes("geolocationError"), "手機定位錯誤未送到打卡 API");
assert(attendanceClockSource.includes("目前位置或網路不符合打卡條件") && !attendanceClockSource.includes("目前 IP ${clientIp}"), "打卡錯誤仍可能暴露距離、精準度或 IP");
assert(sourceWebApi.includes('restSelect("attendance_records"') && sourceWebApi.includes("function getTodayAttendance"), "今日打卡紀錄應直接讀資料庫");
assert(sourceRenderer.includes("function getTodayShiftSummary") && sourceRenderer.includes("clock-today-line"), "打卡頁未顯示今日班別與時間");
assert(sourceRenderer.includes("function formatClockButtonStatus") && !sourceRenderer.includes("上班地點</span>"), "打卡地點與方式應顯示在打卡按鈕內");
assert(sourceRenderer.includes("function maybePromptOvertimeAfterClockOut") && sourceRenderer.includes("是否申請加班"), "下班後未自動詢問加班申請");
assert(sourceRenderer.includes("data-toggle-overtime-panel") && read("src/renderer/v2-overtime-employee.js").includes("data-toggle-overtime-panel"), "加班申請區塊應先顯示勾選框");

const sourceMeal = read("src/renderer/v2-meal.js");
const publishedMeal = read("docs/v2-meal.js");
assert(sourceMeal === publishedMeal, "訂餐輸入驗證來源版與發布版不同步");
assert(sourceMeal.includes('addEventListener("beforeinput"'), "訂餐數量未在輸入前拒絕小數或負數");
assert(sourceMeal.includes('addEventListener("paste"'), "訂餐數量未拒絕貼上無效內容");
assert(sourceMeal.includes("lastValidMealQuantity"), "訂餐無效輸入未保留最後有效整數");
assert(sourceMeal.includes("data-meal-company-subsidy"), "訂餐設定缺少公司補助輸入框");
assert(sourceMeal.includes("data-delete-meal-product"), "訂餐設定缺少品項刪除按鈕");
assert(sourceMeal.includes("width: min(1100px, 100%)"), "電腦版訂餐頁寬度未與記錄頁一致");

const sourceMealApi = read("src/renderer/v2-meal-api.js");
const publishedMealApi = read("docs/v2-meal-api.js");
assert(sourceMealApi === publishedMealApi, "訂餐設定 API 來源版與發布版不同步");
assert(sourceMealApi.includes("deleteMealProduct"), "前端 API 缺少刪除品項操作");
assert(sourceMealApi.includes("companySubsidy"), "前端 API 未傳送公司補助");

const sourceExport = read("src/renderer/v2-meal-export.js");
const publishedExport = read("docs/v2-meal-export.js");
assert(sourceExport === publishedExport, "訂餐 Excel 來源版與發布版不同步");
assert(!sourceExport.includes("首次下訂時間"), "訂餐 Excel 不應顯示首次下訂時間");
assert(!sourceExport.includes("最後修改時間"), "訂餐 Excel 不應顯示最後修改時間");
assert(!sourceExport.includes("員工工號"), "訂餐 Excel 不應顯示員工工號");
assert(!sourceExport.includes('"警告"'), "訂餐 Excel 不應有獨立警告欄");
assert(sourceExport.includes("此訂單所依據的上班打卡已被刪除"), "訂餐 Excel 缺少打卡刪除警告");

const sourceRecords = read("src/renderer/v2-records.js");
const publishedRecords = read("docs/v2-records.js");
assert(sourceRecords === publishedRecords, "記錄頁來源版與發布版不同步");
assert(!sourceRecords.includes('["meal", "訂餐統計", isManager()]'), "記錄頁不應顯示訂餐統計頁籤");
assert(sourceRecords.includes("data-meal-report-view"), "訂餐統計缺少報表切換下拉選單");
assert(sourceRecords.includes('value="item"') && sourceRecords.includes('value="member"'), "訂餐統計缺少品項或人員報表");
assert(sourceRecords.includes("上班打卡已刪除") && !sourceRecords.includes("<th>警告</th>"), "訂餐統計警告應併入備註欄");
assert(sourceRecords.includes("report.memberSummary"), "人員訂餐報表未使用後端公司補助計算結果");
assert(!sourceRecords.includes("days * 55"), "人員訂餐報表仍硬編碼55元補助");

const authoritativeSpec = read("規格書.txt");
assert(authoritativeSpec.includes("未登入不顯示班表、員工、打卡、加班與訂餐資料"), "正式規格書缺少未登入資料保護規則");
assert(authoritativeSpec.includes("固定 IP、原始 GPS、精準度與距離只供管理員及後端服務使用"), "正式規格書缺少敏感打卡資料規則");
assert(authoritativeSpec.includes("公司補助"), "正式規格書缺少公司補助規則");
assert(authoritativeSpec.includes("最大內容寬度") || authoritativeSpec.includes("記錄頁"), "正式規格書未記載訂餐頁版面規則");

const readme = read("README.md");
assert(readme.includes("查看完整班表"), "規格書未明確標示員工可查看完整班表");
assert(readme.includes("警告併入備註欄"), "規格書未明確標示訂餐統計警告併入備註欄");
assert(readme.includes("本次異動原因為選填"), "規格書未明確標示打卡異動原因為選填");
assert(readme.includes("不顯示員工工號、首次下訂時間及最後修改時間"), "規格書未明確標示訂餐報表隱藏欄位");
assert(readme.includes("主管可刪除員工或主管帳號"), "規格書未明確標示主管刪除權限");

const sourceIndex = read("src/renderer/index.html");
const publishedIndex = read("docs/index.html");
assert(sourceIndex.includes("v2-api.js"), "來源頁未載入 V2 API");
assert(publishedIndex.includes("v2-api.js"), "發布頁未載入 V2 API");
assert(sourceIndex.includes("v2-overtime-employee.js"), "來源頁未載入五日加班介面");
assert(publishedIndex.includes("v2-overtime-employee.js"), "發布頁未載入五日加班介面");
assert(sourceIndex.includes("v2-records.js") && sourceIndex.includes("v2-meal-export.js"), "來源頁未載入 V2 記錄或訂餐匯出介面");
assert(publishedIndex.includes("v2-records.js") && publishedIndex.includes("v2-meal-export.js"), "發布頁未載入 V2 記錄或訂餐匯出介面");
assert(sourceIndex.includes("v2-meal-api.js"), "來源頁未載入 V2 訂餐設定 API");
assert(publishedIndex.includes("v2-meal-api.js"), "發布頁未載入 V2 訂餐設定 API");

console.log(`V2 final checks passed (${required.length} required files).`);
