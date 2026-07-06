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
  "supabase/functions/meal-report-v2/index.ts",
  "supabase/functions/meal-cancel-v2/index.ts",
  "src/renderer/v2-api.js",
  "docs/v2-api.js",
  "src/renderer/v2-overtime-employee.js",
  "src/renderer/v2-overtime-admin.js",
  "src/renderer/v2-meal.js",
  "src/renderer/v2-account.js",
  "src/renderer/v2-attendance-admin.js",
  "src/renderer/v2-records.js",
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
assert(visibility.includes("as restrictive"), "員工資料／班表可見範圍未使用限制型政策");
assert(visibility.includes("member_id = auth.uid()"), "員工仍可能讀取他人班表");
assert(visibility.includes("id = auth.uid()"), "員工仍可能讀取他人人員資料");

const reapply = read("supabase/034_v2_overtime_reapply.sql");
assert(reapply.includes("where is_deleted_by_employee = false"), "軟刪除後重新申請的部分唯一索引缺失");

const lastAdmin = read("supabase/035_v2_last_admin.sql");
assert(lastAdmin.includes("protect_last_effective_admin_v2"), "最後有效管理員保護缺失");
assert(lastAdmin.includes("before update or delete"), "最後管理員更新／刪除觸發器缺失");

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
assert(adminSql.includes("p_reason text default ''"), "打卡管理異動原因缺失");
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

const sourceApi = read("src/renderer/v2-api.js");
const publishedApi = read("docs/v2-api.js");
assert(sourceApi === publishedApi, "src/renderer/v2-api.js 與 docs/v2-api.js 不同步");
assert(sourceApi.includes("safeDepartmentColumns"), "一般單位查詢仍可能包含敏感打卡欄位");

const sourceExport = read("src/renderer/v2-meal-export.js");
const publishedExport = read("docs/v2-meal-export.js");
assert(sourceExport === publishedExport, "訂餐 Excel 來源版與發布版不同步");
assert(sourceExport.includes("最後修改時間"), "訂餐 Excel 缺少最後修改時間");
assert(sourceExport.includes("此訂單所依據的上班打卡已被刪除"), "訂餐 Excel 缺少打卡刪除警告");

const sourceIndex = read("src/renderer/index.html");
const publishedIndex = read("docs/index.html");
assert(sourceIndex.includes("v2-api.js"), "來源頁未載入 V2 API");
assert(publishedIndex.includes("v2-api.js"), "發布頁未載入 V2 API");
assert(sourceIndex.includes("v2-overtime-employee.js"), "來源頁未載入五日加班介面");
assert(publishedIndex.includes("v2-overtime-employee.js"), "發布頁未載入五日加班介面");

console.log(`V2 final checks passed (${required.length} required files).`);
