from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding="utf-8-sig")


def write(path, text):
    (ROOT / path).write_text(text.replace("\r\n", "\n").rstrip() + "\n", encoding="utf-8")


def replace_once(text, old, new, label):
    if text.count(old) != 1:
        raise RuntimeError(f"{label}: expected one match, got {text.count(old)}")
    return text.replace(old, new, 1)


def regex_once(text, pattern, replacement, label):
    result, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, got {count}")
    return result


exporter_path = "src/renderer/browser-exporter.js"
exporter = read(exporter_path)
exporter = regex_once(
    exporter,
    r"  function runSelfCheck\(\) \{.*?\n  \}\n\n  runSelfCheck\(\);",
    '''  function runSelfCheck() {
    const payload = {
      state: { departments: [] },
      exportRows: [
        {
          employee_code: "SELF_CHECK",
          employee_name: "Self Check",
          home_department_id: null,
          pay_by_day: false,
          work_date: "2026-07-17",
          leave_type_id: "leave-rest",
          leave_code: "0047",
          leave_name: "休息日",
          leave_all_day: true,
          overtime_type_id: "overtime-id",
          overtime_start_time: "18:00:00",
          overtime_end_time: "20:00:00",
          overtime_use_rest_1: false,
          overtime_use_rest_2: false
        },
        {
          employee_code: "SELF_CHECK",
          employee_name: "Self Check",
          home_department_id: null,
          pay_by_day: false,
          work_date: "2026-07-18",
          leave_type_id: "leave-off",
          leave_code: "0036",
          leave_name: "例假",
          leave_all_day: true
        }
      ]
    };
    const csv = buildSapLeaveCsvContent(payload);
    if (!csv.includes("REST") || !csv.includes("OFF")) {
      throw new Error("browser exporter self-check failed");
    }
    if (normalizeImportedDate("2025/01/02") !== "2025-01-02") {
      throw new Error("browser exporter date self-check failed");
    }
    if (getOvertimeExportRows(payload).length !== 1) {
      throw new Error("browser exporter overtime rows self-check failed");
    }
  }

  runSelfCheck();''',
    "canonical exporter self check",
)
write(exporter_path, exporter)

core_path = "scripts/renderer-core-source.js"
core = read(core_path)
for line in ['  "renderer-export-availability.js",\n', '  "renderer-period-exports.js",\n']:
    if line not in core:
        raise RuntimeError(f"renderer core list missing {line.strip()}")
    core = core.replace(line, "", 1)
write(core_path, core)

keyboard_path = "tests/renderer-keyboard-export.test.js"
keyboard = read(keyboard_path)
keyboard = keyboard.replace('const availability = read("src/renderer/renderer-export-availability.js");\n', "", 1)
keyboard = regex_once(
    keyboard,
    r'''test\("匯出資料存在性判斷應保留假別分類與加班規則", \(\) => \{.*?\n\}\);\n\n''',
    "",
    "remove obsolete local export availability test",
)
keyboard = replace_once(
    keyboard,
    '''test("第十階段應移出操作與匯出判斷並維持模組順序", () => {
  const ordered = [
    "renderer-auth-context.js",
    "renderer-schedule-keyboard.js",
    "renderer-export-availability.js",
    "renderer-attendance-page.js",
    "renderer.js"
  ];''',
    '''test("鍵盤與正式匯出操作應維持明確模組順序", () => {
  const ordered = [
    "renderer-auth-context.js",
    "renderer-schedule-keyboard.js",
    "renderer-attendance-page.js",
    "renderer-export-actions.js",
    "renderer.js"
  ];''',
    "keyboard module order",
)
keyboard = replace_once(
    keyboard,
    '''  ["beginScheduleHeaderColumnSelection", "handleScheduleGridKeydown", "hasSapLeaveRows", "hasOvertimeRows", "hasLeaveRows"].forEach((name) => {
    assert.equal(renderer.includes("function " + name), false, "renderer.js 仍保留 " + name);
  });''',
    '''  ["beginScheduleHeaderColumnSelection", "handleScheduleGridKeydown", "openExportPeriodDialog", "runPeriodExport"].forEach((name) => {
    assert.equal(renderer.includes("function " + name), false, "renderer.js 仍保留 " + name);
  });''',
    "keyboard moved marker list",
)
write(keyboard_path, keyboard)

state_test_path = "tests/state-export-audit-cleanup.test.js"
state_test = read(state_test_path)
state_test = replace_once(
    state_test,
    '''test("期間匯出使用共用月份天數函式", () => {
  const source = read("src/renderer/renderer-period-exports.js");
  assert.equal((source.match(/function daysInMonth\\s*\\(/g) || []).length, 0);
  assert.match(source, /Math\\.min\\(startDay, daysInMonth\\(year, month\\)\\)/);
});''',
    '''test("正式期間匯出直接整合於操作模組並使用共用月份天數函式", () => {
  const source = read("src/renderer/renderer-export-actions.js");
  assert.equal((source.match(/function daysInMonth\\s*\\(/g) || []).length, 0);
  assert.match(source, /Math\\.min\\(startDay, daysInMonth\\(year, month\\)\\)/);
  assert.match(source, /async function runPeriodExport/);
  assert.equal(fs.existsSync(path.join(root, "src/renderer/renderer-period-exports.js")), false);
});''',
    "state export module test",
)
write(state_test_path, state_test)

# 部署說明只保留全新環境的兩個正式 SQL 檔。
deploy_path = "scripts/deploy-edge-functions.ps1"
deploy = read(deploy_path)
deploy = replace_once(
    deploy,
    '''Write-Host "1. supabase/001_current_schema.sql" -ForegroundColor Yellow
Write-Host "2. supabase/002_current_updates.sql" -ForegroundColor Yellow
Write-Host "3. supabase/003_attendance_ledger.sql" -ForegroundColor Yellow
Write-Host "4. supabase/004_remove_legacy_attendance.sql" -ForegroundColor Yellow''',
    '''Write-Host "1. supabase/001_current_schema.sql" -ForegroundColor Yellow
Write-Host "2. supabase/002_current_updates.sql" -ForegroundColor Yellow''',
    "canonical SQL deployment instructions",
)
write(deploy_path, deploy)

# 對齊檢查不得再要求遷移或清理檔，也不得驗證舊資料回填。
alignment_path = "scripts/check-renderer-alignment.js"
alignment = read(alignment_path)
alignment = replace_once(
    alignment,
    '  "supabase/003_attendance_ledger.sql",\n',
    "",
    "remove third SQL from alignment required files",
)
alignment = replace_once(
    alignment,
    'assert(deployScript.includes("003_attendance_ledger.sql"), "Deployment instructions are missing the attendance ledger SQL stage");',
    '''assert(deployScript.includes("001_current_schema.sql") && deployScript.includes("002_current_updates.sql"), "Deployment instructions are missing the canonical SQL stages");
assert(!deployScript.includes("003_attendance_ledger.sql") && !deployScript.includes("004_remove_legacy_attendance.sql"), "Deployment instructions still contain retired SQL stages");''',
    "canonical deployment alignment assertion",
)
alignment = replace_once(
    alignment,
    '''const schema = [
  "supabase/001_current_schema.sql",
  "supabase/002_current_updates.sql",
  "supabase/003_attendance_ledger.sql"
].map(read).join("\\n");''',
    '''const schema = [
  "supabase/001_current_schema.sql",
  "supabase/002_current_updates.sql"
].map(read).join("\\n");''',
    "canonical alignment schema sources",
)
alignment = replace_once(
    alignment,
    '''assert(schema.includes("insert into public.attendance_days") && schema.includes("from public.attendance_records"), "Legacy attendance history backfill is missing");
assert(schema.includes("migration_backfill"), "Attendance migration audit marker is missing");''',
    '''for (const retiredName of ["attendance_records", "attendance_action_logs", "attendance_overtime_requests", "overtime_review_logs"]) {
  assert(!schema.includes(retiredName), `Canonical database sources still contain retired structure: ${retiredName}`);
}''',
    "remove legacy backfill alignment assertions",
)
write(alignment_path, alignment)

# 正式契約檢查改驗證 001/002 已直接包含唯一資料模型。
contracts_path = "scripts/check-renderer-contracts.js"
contracts = read(contracts_path)
contracts = replace_once(
    contracts,
    '''  "supabase/003_attendance_ledger.sql",
  "supabase/004_remove_legacy_attendance.sql",''',
    '''  "supabase/001_current_schema.sql",
  "supabase/002_current_updates.sql",''',
    "canonical contract required SQL files",
)
contracts = replace_once(
    contracts,
    '''const ledgerSql = read("supabase/003_attendance_ledger.sql");
const cleanupSql = read("supabase/004_remove_legacy_attendance.sql");''',
    '''const schemaSql = read("supabase/001_current_schema.sql");
const updatesSql = read("supabase/002_current_updates.sql");
const databaseSql = `${schemaSql}\n${updatesSql}`;''',
    "canonical contract SQL variables",
)
contracts = replace_once(
    contracts,
    '''assert(ledgerSql.includes("create table if not exists public.attendance_days"), "SQL 缺少 attendance_days");
assert(ledgerSql.includes("create table if not exists public.attendance_audit_logs"), "SQL 缺少 attendance_audit_logs");
for (const oldTable of ["attendance_records", "attendance_action_logs", "attendance_overtime_requests", "overtime_review_logs"]) {
  assert(cleanupSql.includes(`drop table if exists public.${oldTable}`), `清理 SQL 未移除：${oldTable}`);
}
assert(cleanupSql.includes("舊出勤資料表仍未完整移除"), "清理 SQL 缺少移除後驗證");''',
    '''assert(databaseSql.includes("create table if not exists public.attendance_days"), "SQL 缺少 attendance_days");
assert(databaseSql.includes("create table if not exists public.attendance_audit_logs"), "SQL 缺少 attendance_audit_logs");
for (const oldTable of ["attendance_records", "attendance_action_logs", "attendance_overtime_requests", "overtime_review_logs"]) {
  assert(!databaseSql.includes(oldTable), `正式 SQL 仍包含淘汰結構：${oldTable}`);
}''',
    "canonical contract database assertions",
)
contracts = replace_once(
    contracts,
    '''for (const sqlFile of ["001_current_schema.sql", "002_current_updates.sql", "003_attendance_ledger.sql", "004_remove_legacy_attendance.sql"]) {
  assert(readme.includes(sqlFile), `README 未說明 SQL：${sqlFile}`);
}''',
    '''for (const sqlFile of ["001_current_schema.sql", "002_current_updates.sql"]) {
  assert(readme.includes(sqlFile), `README 未說明 SQL：${sqlFile}`);
}
assert(!readme.includes("003_attendance_ledger.sql") && !readme.includes("004_remove_legacy_attendance.sql"), "README 仍描述淘汰 SQL 階段");''',
    "canonical README SQL assertions",
)
contracts = replace_once(
    contracts,
    'assert(spec.includes("尚未正式上線") && spec.includes("舊出勤資料不保留"), "規格書缺少舊資料清理決策");',
    'assert(spec.includes("唯一正式資料結構") && spec.includes("不進行資料遷移"), "規格書缺少單一正式資料結構決策");',
    "canonical spec architecture assertion",
)
write(contracts_path, contracts)
