from pathlib import Path


def read(path):
    return Path(path).read_text(encoding="utf-8-sig")


def write(path, text):
    Path(path).write_text(text.replace("\r\n", "\n").rstrip() + "\n", encoding="utf-8")


def replace_once(path, old, new):
    text = read(path)
    if old not in text:
        raise RuntimeError(f"找不到待更新區段：{path}")
    write(path, text.replace(old, new, 1))


replace_once(
    "src/renderer/css/foundation.css",
    ".records-card {\n  width: min(1100px, 100%);\n  margin: 0 auto;\n  padding: clamp(18px, 4vw, 34px);",
    ".records-card {\n  width: min(1280px, 100%);\n  margin: 0 auto;\n  padding: clamp(18px, 2.2vw, 26px);",
)

replace_once(
    "src/renderer/css/foundation.css",
    "body.is-records-view .app-shell {\n  justify-content: flex-start;\n  padding-bottom: 20px;\n}",
    "body.is-records-view .app-shell {\n  justify-content: flex-start;\n  padding-right: 12px;\n  padding-bottom: 20px;\n  padding-left: 12px;\n}",
)

pages_path = "src/renderer/css/pages.css"
pages = read(pages_path)
toolbar_css = """.attendance-review-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  align-items: end;
}

.attendance-review-filters {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
  width: 100%;
  min-width: 0;
  align-items: end;
}

.attendance-review-filters .records-admin-field {
  min-width: 0;
}

.attendance-review-filters :is(input, select) {
  width: 100%;
  min-width: 0;
}

.attendance-review-actions {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  width: 100%;
  min-width: 0;
}

"""
if toolbar_css.strip() not in pages:
    marker = ".attendance-review-table {\n"
    if marker not in pages:
        raise RuntimeError("找不到簽到審核表格樣式")
    pages = pages.replace(marker, toolbar_css + marker, 1)

replacements = {
    ".attendance-review-table {\n  table-layout: fixed;\n  min-width: 1020px;\n}": ".attendance-review-table {\n  table-layout: fixed;\n  min-width: 1000px;\n}",
    ".attendance-review-table .attendance-review-check-col {\n  width: 32px;": ".attendance-review-table .attendance-review-check-col {\n  width: 30px;",
    ".attendance-review-table .attendance-review-date-col {\n  width: 92px;": ".attendance-review-table .attendance-review-date-col {\n  width: 90px;",
    ".attendance-review-table .attendance-review-employee-col {\n  width: 94px;": ".attendance-review-table .attendance-review-employee-col {\n  width: 86px;",
    ".attendance-review-table .attendance-review-shift-col {\n  width: 94px;": ".attendance-review-table .attendance-review-shift-col {\n  width: 90px;",
    ".attendance-review-table .attendance-review-clock-col {\n  width: 136px;": ".attendance-review-table .attendance-review-clock-col {\n  width: 126px;",
    ".attendance-review-table .attendance-review-hours-col {\n  width: 70px;": ".attendance-review-table .attendance-review-hours-col {\n  width: 64px;",
    ".attendance-review-table .attendance-review-note-col {\n  width: 112px;": ".attendance-review-table .attendance-review-note-col {\n  width: 104px;",
    ".attendance-review-table .attendance-review-issue-col {\n  width: 76px;": ".attendance-review-table .attendance-review-issue-col {\n  width: 74px;",
    ".attendance-review-table .attendance-review-status-col {\n  width: 58px;": ".attendance-review-table .attendance-review-status-col {\n  width: 56px;",
    ".attendance-review-table .attendance-review-operation-col {\n  width: 108px;\n  padding-right: 4px;\n  padding-left: 4px;\n}": ".attendance-review-table .attendance-review-operation-col {\n  width: 112px;\n  padding-right: 4px;\n  padding-left: 4px;\n  white-space: nowrap;\n}",
}
for old, new in replacements.items():
    if old not in pages:
        raise RuntimeError(f"找不到欄寬樣式：{old.splitlines()[0]}")
    pages = pages.replace(old, new, 1)

action_css = """
.attendance-review-row-actions {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 0;
  white-space: nowrap;
}

.attendance-review-row-actions .attendance-review-action-btn {
  flex: 0 0 30px;
  width: 30px;
  min-width: 30px;
  height: 30px;
}

@media (max-width: 980px) {
  .attendance-review-filters {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .attendance-review-filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .attendance-review-actions {
    flex-wrap: wrap;
    justify-content: flex-start;
  }
}
"""
if action_css.strip() not in pages:
    marker = ".attendance-ledger-table td {\n"
    if marker not in pages:
        raise RuntimeError("找不到簽到簿表格後續樣式")
    pages = pages.replace(marker, action_css + "\n" + marker, 1)
write(pages_path, pages)

spec_path = "規格書.md"
spec = read(spec_path)
old_spec = "13. 操作與歷程。\n\n### 3.3.3 管理操作"
new_spec = """13. 操作與歷程。

簽到審核桌面版面規則：

1. 簽到簿主卡片使用較寬的桌面版內容寬度，並縮減不必要的左右內距，操作欄不得被內容區裁切。
2. 開始日期、結束日期、人員、異常及狀態五個篩選欄位在寬螢幕排列於同一列；功能按鈕另列靠右排列。
3. 螢幕寬度不足時，篩選欄位依序改為三欄及兩欄，按鈕列可換行，但不得造成整頁水平溢出。
4. 表格優先壓縮選取、人員、班別、打卡時間、時數及狀態等欄位，保留操作欄完整寬度。
5. 編輯、審核及歷程三個 SVG 圖示固定同一列顯示，不得換行或被裁切。

### 3.3.3 管理操作"""
if old_spec not in spec:
    raise RuntimeError("找不到規格書簽到審核欄位區段")
write(spec_path, spec.replace(old_spec, new_spec, 1))

Path("tests/attendance-review-wide-layout.test.js").write_text(
    '''const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("簽到審核使用寬版容器、整齊篩選列與完整操作欄", () => {
  const foundation = read("src/renderer/css/foundation.css");
  const pages = read("src/renderer/css/pages.css");
  const spec = read("規格書.md");

  assert.match(foundation, /\\.records-card \\{[\\s\\S]*width: min\\(1280px, 100%\\)/);
  assert.match(foundation, /body\\.is-records-view \\.app-shell \\{[\\s\\S]*padding-right: 12px;[\\s\\S]*padding-left: 12px/);
  assert.match(pages, /\\.attendance-review-filters \\{[\\s\\S]*grid-template-columns: repeat\\(5, minmax\\(0, 1fr\\)\\)/);
  assert.match(pages, /\\.attendance-review-actions \\{[\\s\\S]*justify-content: flex-end/);
  assert.match(pages, /\\.attendance-review-operation-col \\{[\\s\\S]*width: 112px;[\\s\\S]*white-space: nowrap/);
  assert.match(pages, /\\.attendance-review-row-actions \\{[\\s\\S]*flex-wrap: nowrap/);
  assert.match(pages, /\\.attendance-review-action-btn \\{[\\s\\S]*flex: 0 0 30px/);
  assert.match(spec, /功能按鈕另列靠右排列/);
  assert.match(spec, /三個 SVG 圖示固定同一列顯示/);
});
''',
    encoding="utf-8",
)
