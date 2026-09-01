const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const write = (relative, content) => fs.writeFileSync(path.join(root, relative), content, "utf8");

function replaceOnce(relative, before, after, label) {
  let source = read(relative);
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${relative}: missing ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`${relative}: duplicate ${label}`);
  source = source.slice(0, first) + after + source.slice(first + before.length);
  write(relative, source);
}

const config = "src/renderer/app-config.js";
replaceOnce(
  config,
  '    "群組設定": "Cài đặt nhóm",\n    "週期設定": "Cài đặt chu kỳ",',
  '    "群組設定": "Cài đặt nhóm",\n    "修改群組": "Sửa nhóm",\n    "新增群組": "Thêm nhóm",\n    "週期設定": "Cài đặt chu kỳ",',
  "group form title translations"
);
replaceOnce(
  config,
  '    "排班條件": "Điều kiện xếp ca",\n    "自動排班預覽": "Xem trước xếp ca tự động",',
  '    "排班條件": "Điều kiện xếp ca",\n    "修改排班條件": "Sửa điều kiện xếp ca",\n    "新增排班條件": "Thêm điều kiện xếp ca",\n    "封存班表": "Lịch đã lưu trữ",\n    "自動排班預覽": "Xem trước xếp ca tự động",',
  "schedule function title translations"
);
replaceOnce(
  config,
  '  function translateDynamic(text) {\n    const month = text.match(/^(\\d{4})\\s*年\\s*(\\d{1,2})\\s*月$/);',
  '  function translateDynamic(text, entityMap) {\n    const conditionTitle = text.match(/^排班條件－(.+)$/);\n    if (conditionTitle) return `Điều kiện xếp ca－${entityMap.get(conditionTitle[1]) || conditionTitle[1]}`;\n    const archiveTitle = text.match(/^(.+)封存班表$/);\n    if (archiveTitle) return `${entityMap.get(archiveTitle[1]) || archiveTitle[1]}－Lịch đã lưu trữ`;\n    const month = text.match(/^(\\d{4})\\s*年\\s*(\\d{1,2})\\s*月$/);',
  "dynamic function title translations"
);
replaceOnce(
  config,
  '    const translated = fixedVi.get(trimmed) || entityMap.get(trimmed) || translateDynamic(trimmed);',
  '    const translated = fixedVi.get(trimmed) || entityMap.get(trimmed) || translateDynamic(trimmed, entityMap);',
  "dynamic translator entity map"
);
replaceOnce(
  config,
  '  function dateHeader(dateString) {\n    const date = toDateObject(dateString);\n    return `${date.getMonth() + 1}/${date.getDate()}<span>${WEEKDAYS[date.getDay()]}</span>`;\n  }',
  '  function dateHeader(dateString) {\n    const date = toDateObject(dateString);\n    const weekdayLabels = window.fyhI18n?.isVietnamese?.() ? ["CN", "T2", "T3", "T4", "T5", "T6", "T7"] : WEEKDAYS;\n    return `${date.getMonth() + 1}/${date.getDate()}<span>${weekdayLabels[date.getDay()]}</span>`;\n  }',
  "print weekday localization"
);

const layout = "src/renderer/renderer-schedule-layout.js";
replaceOnce(
  layout,
  'function renderStickyTableHeader(dates) {',
  'function getScheduleWeekdayLabel(weekday) {\n  const labels = window.fyhI18n?.isVietnamese?.()\n    ? ["CN", "T2", "T3", "T4", "T5", "T6", "T7"]\n    : WEEKDAY_LABELS;\n  return labels[weekday] || "";\n}\n\nfunction renderStickyTableHeader(dates) {',
  "schedule weekday helper"
);
replaceOnce(
  layout,
  '${date.getMonth() + 1}/${day}<span>${WEEKDAY_LABELS[weekday]}</span>',
  '${date.getMonth() + 1}/${day}<span>${getScheduleWeekdayLabel(weekday)}</span>',
  "schedule weekday header usage"
);

const testFile = "tests/vietnamese-localization.test.js";
replaceOnce(
  testFile,
  '    \'"功能": "Chức năng"\'\n',
  '    \'"功能": "Chức năng"\',\n    \'"修改群組": "Sửa nhóm"\',\n    \'"新增群組": "Thêm nhóm"\',\n    \'"修改排班條件": "Sửa điều kiện xếp ca"\',\n    \'"新增排班條件": "Thêm điều kiện xếp ca"\'\n',
  "function title assertions"
);
replaceOnce(
  testFile,
  '  assert.doesNotMatch(source, /position:fixed;right:10px;bottom:10px/);\n});',
  '  assert.doesNotMatch(source, /position:fixed;right:10px;bottom:10px/);\n  assert.ok(source.includes("text.match(/^排班條件－(.+)$/)"));\n  assert.ok(source.includes("text.match(/^(.+)封存班表$/)"));\n});\n\ntest("schedule weekday headers switch to Vietnamese labels", () => {\n  const layout = read("src/renderer/renderer-schedule-layout.js");\n  const config = read("src/renderer/app-config.js");\n  assert.ok(layout.includes(\'["CN", "T2", "T3", "T4", "T5", "T6", "T7"]\'));\n  assert.ok(layout.includes("getScheduleWeekdayLabel(weekday)"));\n  assert.ok(config.includes(\'["CN", "T2", "T3", "T4", "T5", "T6", "T7"]\'));\n});',
  "weekday and dynamic title regression test"
);

console.log("Vietnamese function titles and weekday labels updated");
