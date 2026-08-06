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
