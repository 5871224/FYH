const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (file, content) => fs.writeFileSync(path.join(root, file), content, "utf8");

const sqlPath = "supabase/002_current_updates.sql";
let sql = read(sqlPath).trimEnd();
const marker = "區段 21：所有角色使用相同班表人員有效期間";
if (!sql.includes(marker)) {
  sql += `\n\n\n-- ============================================================================================\n-- ${marker}\n-- ============================================================================================\n\nbegin;\n\n-- 班表人員列、排序與 PT 標記不得因登入角色不同。\n-- 到職日、離職日、日薪狀態與可排班班別是班表顯示必要資料，\n-- 對所有有效登入者提供；帳號角色、工號及其他管理資料仍維持遮罩。\ncreate or replace function public.get_employee_directory_v2()\nreturns table (\n  id uuid,\n  employee_code text,\n  full_name text,\n  role text,\n  home_department_id uuid,\n  position_name text,\n  hire_date date,\n  leave_date date,\n  pay_by_day boolean,\n  is_active boolean,\n  created_at timestamptz,\n  updated_at timestamptz,\n  schedule_department_ids text[],\n  monthly_rest_days integer,\n  fixed_rest_weekday integer,\n  schedule_shift_ids uuid[],\n  sort_order integer\n)\nlanguage sql\nstable\nsecurity definer\nset search_path = public, pg_catalog\nas $$\n  with actor as (\n    select\n      employee.id,\n      employee.role in ('admin', 'manager') as manager_access,\n      public.is_effective_user(employee.id) as effective\n    from public.set_employee employee\n    where employee.id = auth.uid()\n  )\n  select\n    target.id,\n    case when actor.manager_access or target.id = actor.id then target.employee_code else '' end,\n    target.full_name,\n    case when actor.manager_access or target.id = actor.id then target.role else 'employee' end,\n    target.home_department_id,\n    case when actor.manager_access or target.id = actor.id then target.position_name else null end,\n    target.hire_date,\n    target.leave_date,\n    target.pay_by_day,\n    target.is_active,\n    target.created_at,\n    target.updated_at,\n    case when actor.manager_access or target.id = actor.id then target.schedule_department_ids else '{}'::text[] end,\n    case when actor.manager_access or target.id = actor.id then target.monthly_rest_days else 0 end,\n    case when actor.manager_access or target.id = actor.id then target.fixed_rest_weekday else 0 end,\n    target.schedule_shift_ids,\n    target.sort_order\n  from actor\n  join public.set_employee target\n    on target.id = actor.id\n    or (actor.effective and target.is_active)\n  order by target.sort_order, target.full_name, target.id\n$$;\n\nrevoke all on function public.get_employee_directory_v2() from public, anon;\ngrant execute on function public.get_employee_directory_v2() to authenticated, service_role;\n\ncommit;\n`;
  write(sqlPath, sql);
}

const specPath = "規格書.md";
let spec = read(specPath);
const oldLogic = `9. 班表加班與打卡加班申請彼此獨立。\n10. 手機版頂端控制列允許換行，不因單行擠壓造成水平溢出。`;
const newLogic = `9. 班表加班與打卡加班申請彼此獨立。\n10. 同一日期範圍、檢視模式與篩選條件下，員工、主管與管理員看到的人員列、單位分組、排序、PT 標記及班表格內容必須完全一致；角色差異只影響編輯工具與操作權限。\n11. 人員是否出現在班表，統一依正式的啟用狀態、到職日與離職日判斷。班表日期範圍完全晚於離職日的人員不顯示；完全早於到職日的人員不顯示；歷史範圍與任職期間重疊時仍保留歷史班表。\n12. 安全人員名錄必須向所有有效登入者提供班表顯示必要的到職日、離職日、日薪狀態及可排班班別；工號、角色與管理專用欄位仍依權限遮罩。\n13. 手機版頂端控制列允許換行，不因單行擠壓造成水平溢出。`;
if (!spec.includes(newLogic)) {
  if (!spec.includes(oldLogic)) throw new Error("找不到班表邏輯規格插入位置");
  spec = spec.replace(oldLogic, newLogic);
  write(specPath, spec);
}

const checkPath = "scripts/check-v2-final.js";
let check = read(checkPath);
const checkMarker = "所有角色班表名錄一致性缺失";
if (!check.includes(checkMarker)) {
  const insertBefore = `const authoritativeSpec = read("規格書.md");`;
  const assertions = `const scheduleDirectorySql = databaseUpdates.slice(databaseUpdates.lastIndexOf("區段 21：所有角色使用相同班表人員有效期間"));\nassert(scheduleDirectorySql.includes("target.hire_date,") && !scheduleDirectorySql.includes("then target.hire_date else null"), "${checkMarker}：到職日仍依角色遮罩");\nassert(scheduleDirectorySql.includes("target.leave_date,") && !scheduleDirectorySql.includes("then target.leave_date else null"), "${checkMarker}：離職日仍依角色遮罩");\nassert(scheduleDirectorySql.includes("target.pay_by_day,") && scheduleDirectorySql.includes("target.schedule_shift_ids,"), "${checkMarker}：班表必要人員屬性仍依角色不同");\n\n`;
  if (!check.includes(insertBefore)) throw new Error("找不到 V2 final 規格檢查插入位置");
  check = check.replace(insertBefore, assertions + insertBefore);
  check = check.replace(
    `assert(authoritativeSpec.includes("手機優先"), "正式規格書缺少響應式介面規則");`,
    `assert(authoritativeSpec.includes("手機優先"), "正式規格書缺少響應式介面規則");\nassert(authoritativeSpec.includes("員工、主管與管理員看到的人員列") && authoritativeSpec.includes("角色差異只影響編輯工具"), "正式規格書缺少所有角色班表一致規則");`
  );
  write(checkPath, check);
}

console.log("schedule role visibility fix prepared");
