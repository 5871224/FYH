from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
VIEWS = ROOT / "src/renderer/renderer-records-views.js"
CSS = ROOT / "src/renderer/css/pages.css"
SPEC = ROOT / "規格書.md"
TEST = ROOT / "tests/personal-record-table-layout.test.js"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8-sig")


def write(path: Path, text: str) -> None:
    path.write_text(text.replace("\r\n", "\n").rstrip() + "\n", encoding="utf-8")


views = read(VIEWS)

views, count = re.subn(
    r'''function renderPunchLine\(label, value, location\) \{.*?\n\}\n\nfunction renderPersonalClockCell''',
    '''function renderPunchLine(label, value, location) {
  if (!value) return "";
  const place = attendanceLocationName(location);
  return `<div class="attendance-punch-line"><span>${escapeHtml(label)} ${escapeHtml(formatRecordDateTime(value))}</span>${place ? `<small>${escapeHtml(place)}</small>` : ""}</div>`;
}

function renderPersonalClockCell''',
    views,
    count=1,
    flags=re.S,
)
if count != 1:
    raise RuntimeError("找不到 renderPunchLine")

old_clock_return = '''  return `<div class="attendance-clock-stack">${lines.join("") || '<span class="attendance-empty-value">-</span>'}${buttons}</div>`;'''
new_clock_return = '''  return `<div class="attendance-clock-stack">${lines.join("")}${buttons}</div>`;'''
if old_clock_return not in views:
    raise RuntimeError("找不到打卡空白顯示")
views = views.replace(old_clock_return, new_clock_return, 1)

views, count = re.subn(
    r'''function renderPersonalHoursInput\(record, field\) \{.*?\n\}\n\nfunction renderReviewStatus''',
    '''function renderPersonalHoursInput(record, field) {
  const value = record[field];
  const editable = record.editable !== false && !record.reviewed;
  const displayValue = value === null || value === undefined ? "" : escapeHtml(String(value));
  if (!editable) return `<span class="attendance-hours-value">${displayValue}</span>`;
  return `<input class="attendance-hours-input" type="number" min="0" step="0.5" inputmode="decimal" value="${displayValue}" data-personal-attendance-field="${field}" data-personal-attendance-date="${escapeHtml(record.date)}">`;
}

function renderReviewStatus''',
    views,
    count=1,
    flags=re.S,
)
if count != 1:
    raise RuntimeError("找不到 renderPersonalHoursInput")

old_head = '''<thead><tr><th>日期</th><th class="personal-schedule-icon-col">圖示</th><th>班別</th><th>打卡時間</th><th>上班時數</th><th>加班時數</th><th>備註</th><th>訂餐</th><th>審核</th></tr></thead>'''
new_head = '''<thead><tr><th class="personal-record-date-col">日期</th><th class="personal-schedule-icon-col">圖示</th><th class="personal-record-shift-col">班別</th><th class="personal-record-clock-col">打卡時間</th><th class="personal-record-hours-col">上班時數</th><th class="personal-record-hours-col">加班時數</th><th class="personal-record-note-col">備註</th><th class="personal-record-meal-col">訂餐</th><th class="personal-record-review-col">審核</th></tr></thead>'''
if old_head not in views:
    raise RuntimeError("找不到個人記錄表頭")
views = views.replace(old_head, new_head, 1)

replacements = {
    '''        <td>${escapeHtml(record.date || "")}</td>''': '''        <td class="personal-record-date-col">${escapeHtml(record.date || "")}</td>''',
    '''        <td>${escapeHtml(record.shiftName || "-")}<br><span>${escapeHtml(record.shiftTime || "")}</span></td>''': '''        <td class="personal-record-shift-col">${escapeHtml(record.shiftName || "-")}<br><span>${escapeHtml(record.shiftTime || "")}</span></td>''',
    '''        <td>${renderPersonalClockCell(record)}</td>''': '''        <td class="personal-record-clock-col">${renderPersonalClockCell(record)}</td>''',
    '''        <td>${renderPersonalHoursInput(record, "regularHours")}</td>''': '''        <td class="personal-record-hours-col">${renderPersonalHoursInput(record, "regularHours")}</td>''',
    '''        <td>${renderPersonalHoursInput(record, "overtimeHours")}</td>''': '''        <td class="personal-record-hours-col">${renderPersonalHoursInput(record, "overtimeHours")}</td>''',
    '''        <td>${record.editable !== false && !record.reviewed
          ? `<textarea class="attendance-note-input" rows="2" data-personal-attendance-field="note" data-personal-attendance-date="${escapeHtml(record.date)}">${escapeHtml(record.note || "")}</textarea>`
          : escapeHtml(record.note || "")}</td>''': '''        <td class="personal-record-note-col">${record.editable !== false && !record.reviewed
          ? `<input class="attendance-note-input" type="text" value="${escapeHtml(record.note || "")}" data-personal-attendance-field="note" data-personal-attendance-date="${escapeHtml(record.date)}">`
          : escapeHtml(record.note || "")}</td>''',
    '''        <td><span class="meal-record-text">${escapeHtml(record.mealText || "-")}</span>${record.mealClockDeletedWarning ? '<br><span class="auth-error-inline">所依據的上班打卡已被刪除</span>' : ""}</td>''': '''        <td class="personal-record-meal-col"><span class="meal-record-text">${escapeHtml(record.mealText || "-")}</span>${record.mealClockDeletedWarning ? '<br><span class="auth-error-inline">所依據的上班打卡已被刪除</span>' : ""}</td>''',
    '''        <td>${renderReviewStatus(record.reviewed)}</td>''': '''        <td class="personal-record-review-col">${renderReviewStatus(record.reviewed)}</td>''',
}
for old, new in replacements.items():
    if old not in views:
        raise RuntimeError(f"找不到要調整的個人記錄欄位：{old[:60]}")
    views = views.replace(old, new, 1)

write(VIEWS, views)

css = read(CSS)
old_flex = '''.attendance-clock-stack,
.attendance-punch-line {
  flex-direction: column;
  align-items: flex-start;
}

.attendance-punch-line small {
  color: var(--muted-text, #667085);
  line-height: 1.25;
}'''
new_flex = '''.attendance-clock-stack {
  flex-direction: column;
  align-items: flex-start;
}

.attendance-punch-line {
  flex-direction: row;
  align-items: baseline;
  flex-wrap: nowrap;
  white-space: nowrap;
}

.attendance-punch-line small {
  color: var(--muted-text, #667085);
  line-height: 1.25;
  white-space: nowrap;
}'''
if old_flex not in css:
    raise RuntimeError("找不到打卡時間排列樣式")
css = css.replace(old_flex, new_flex, 1)

old_note = '''.attendance-note-input {
  width: 180px;
  min-width: 140px;
  resize: vertical;
}'''
new_note = '''.attendance-note-input {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  height: 40px;
}'''
if old_note not in css:
    raise RuntimeError("找不到備註輸入樣式")
css = css.replace(old_note, new_note, 1)

anchor = '''.attendance-ledger-table .is-today-row {
  background: rgba(55, 138, 221, 0.06);
}
'''
layout_css = '''.attendance-ledger-table {
  table-layout: fixed;
  min-width: 1010px;
}

.attendance-ledger-table .personal-record-date-col {
  width: 112px;
}

.attendance-ledger-table .personal-schedule-icon-col {
  width: 48px;
}

.attendance-ledger-table .personal-record-shift-col {
  width: 112px;
}

.attendance-ledger-table .personal-record-clock-col {
  width: 150px;
}

.attendance-ledger-table .personal-record-hours-col {
  width: 102px;
  text-align: center;
}

.attendance-ledger-table .personal-record-note-col {
  width: 190px;
}

.attendance-ledger-table .personal-record-meal-col {
  width: 132px;
}

.attendance-ledger-table .personal-record-review-col {
  width: 64px;
  padding-right: 6px;
  padding-left: 6px;
  text-align: center;
}

.attendance-ledger-table td {
  overflow: hidden;
}

.attendance-hours-value {
  display: inline-block;
  min-width: 0;
}

'''
if layout_css not in css:
    if anchor not in css:
        raise RuntimeError("找不到簽到簿樣式插入點")
    css = css.replace(anchor, anchor + "\n" + layout_css, 1)

css = css.replace('''  .attendance-note-input {
    width: 150px;
  }
''', '''  .attendance-note-input {
    width: 100%;
  }
''', 1)
write(CSS, css)

spec = read(SPEC)
old_spec = '''個人頁只顯示必要地點名稱與來源，不顯示原始 GPS、IP、定位精準度、距離或完整 JSON。'''
new_spec = '''個人頁只顯示必要地點名稱與來源，不顯示原始 GPS、IP、定位精準度、距離或完整 JSON。

個人記錄表格顯示規則：

1. 未打卡且非今日的打卡時間欄保持空白，不顯示「-」。
2. 打卡地點與對應時間顯示在同一行。
3. 只有今日未審資料顯示上班時數、加班時數及備註輸入框；其他日期只顯示純文字值或空白。
4. 備註使用單行輸入框，且不得超出備註欄或覆蓋訂餐欄。
5. 審核欄採固定窄欄呈現。'''
if old_spec not in spec:
    raise RuntimeError("找不到個人記錄規格插入點")
spec = spec.replace(old_spec, new_spec, 1)
write(SPEC, spec)

TEST.write_text('''const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("個人記錄未打卡欄保持空白且地點同列", () => {
  const source = read("src/renderer/renderer-records-views.js");
  assert.equal(source.includes("attendance-empty-value">-"), false);
  assert.equal(source.includes('class="attendance-punch-line"'), true);
});

test("非當日工時不渲染停用輸入框", () => {
  const source = read("src/renderer/renderer-records-views.js");
  assert.equal(source.includes('if (!editable) return `<span class="attendance-hours-value">'), true);
  assert.equal(source.includes('${editable ? "" : "disabled"}'), false);
});

test("備註使用單行輸入框並限制在欄內", () => {
  const source = read("src/renderer/renderer-records-views.js");
  const css = read("src/renderer/css/pages.css");
  assert.equal(source.includes('<textarea class="attendance-note-input"'), false);
  assert.equal(source.includes('<input class="attendance-note-input" type="text"'), true);
  assert.equal(css.includes(".personal-record-note-col"), true);
  assert.equal(css.includes("width: 100%;"), true);
});
''', encoding="utf-8")

print("personal record table layout updated")
