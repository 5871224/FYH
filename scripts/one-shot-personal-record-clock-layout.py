from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSS = ROOT / "src/renderer/css/pages.css"
SPEC = ROOT / "規格書.md"
TEST = ROOT / "tests/personal-record-clock-layout.test.js"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8-sig")


def write(path: Path, text: str) -> None:
    path.write_text(text.replace("\r\n", "\n").rstrip() + "\n", encoding="utf-8")


css = read(CSS)

width_replacements = {
    "  min-width: 1010px;": "  min-width: 920px;",
    "  width: 112px;\n}\n\n.attendance-ledger-table .personal-schedule-icon-col": "  width: 98px;\n}\n\n.attendance-ledger-table .personal-schedule-icon-col",
    "  width: 112px;\n}\n\n.attendance-ledger-table .personal-record-clock-col": "  width: 104px;\n}\n\n.attendance-ledger-table .personal-record-clock-col",
    "  width: 150px;": "  width: 128px;",
    "  width: 102px;\n  text-align: center;": "  width: 88px;\n  text-align: center;",
    "  width: 190px;": "  width: 170px;",
    "  width: 132px;": "  width: 124px;",
    "  width: 64px;\n  padding-right: 6px;": "  width: 68px;\n  padding-right: 6px;",
}
for old, new in width_replacements.items():
    if old not in css:
        raise RuntimeError(f"找不到欄寬設定：{old}")
    css = css.replace(old, new, 1)

button_anchor = '''.attendance-clock-buttons,
.attendance-review-row-actions {
  align-items: center;
  flex-wrap: wrap;
}
'''
button_styles = '''.attendance-clock-buttons,
.attendance-review-row-actions {
  align-items: center;
  flex-wrap: wrap;
}

.attendance-clock-buttons [data-personal-clock-action] {
  border: none;
  color: #fff;
  font-weight: 800;
  box-shadow: 0 4px 10px rgba(72, 52, 31, 0.16);
}

.attendance-clock-buttons [data-personal-clock-action="clock_in"] {
  background: linear-gradient(135deg, #c9832f 0%, #9b5c17 100%);
}

.attendance-clock-buttons [data-personal-clock-action="clock_out"] {
  background: linear-gradient(135deg, #3f8b63 0%, #286346 100%);
}

.attendance-clock-buttons [data-personal-clock-action]:hover {
  color: #fff;
  filter: brightness(1.06);
  transform: translateY(-1px);
}
'''
if button_styles not in css:
    if button_anchor not in css:
        raise RuntimeError("找不到打卡按鈕樣式插入點")
    css = css.replace(button_anchor, button_styles, 1)

write(CSS, css)

spec = read(SPEC)
marker = "#### 個人記錄表格欄寬與打卡按鈕"
if marker not in spec:
    spec += '''

#### 個人記錄表格欄寬與打卡按鈕

1. 個人記錄表格在一般電腦寬度下應完整顯示到最右側審核欄，不應因打卡時間欄過寬而裁切。
2. 打卡時間欄以容納「上班／下班時間＋地點」單行內容為原則，不額外保留大面積左右空白。
3. 上班打卡按鈕使用棕橘色，下班打卡按鈕使用綠色，兩者需維持白色高對比文字。
'''
write(SPEC, spec)

TEST.write_text('''const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const css = fs.readFileSync(path.join(root, "src/renderer/css/pages.css"), "utf8");

test("個人記錄表格縮窄打卡欄並保留完整審核欄", () => {
  assert.match(css, /\\.attendance-ledger-table \\{[\\s\\S]*?min-width: 920px;/);
  assert.match(css, /\\.personal-record-clock-col \\{\\s*width: 128px;/);
  assert.match(css, /\\.personal-record-review-col \\{\\s*width: 68px;/);
  assert.equal(css.includes("min-width: 1010px;"), false);
});

test("上下班打卡按鈕使用不同顏色", () => {
  assert.match(css, /data-personal-clock-action="clock_in"[\\s\\S]*?#c9832f/);
  assert.match(css, /data-personal-clock-action="clock_out"[\\s\\S]*?#3f8b63/);
  assert.match(css, /data-personal-clock-action\\] \\{[\\s\\S]*?color: #fff;/);
});
''', encoding="utf-8")

print("personal record clock layout updated")
