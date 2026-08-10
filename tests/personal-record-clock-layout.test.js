const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const css = fs.readFileSync(path.join(root, "src/renderer/css/pages.css"), "utf8");

test("個人記錄表格加寬打卡欄並保留完整審核欄", () => {
  assert.match(css, /\.attendance-ledger-table \{[\s\S]*?min-width: 964px;/);
  assert.match(css, /\.personal-record-clock-col \{\s*width: 176px;/);
  assert.match(css, /\.personal-record-review-col \{\s*width: 68px;/);
  assert.equal(css.includes("min-width: 1010px;"), false);
});

test("上下班打卡按鈕使用不同顏色", () => {
  assert.match(css, /data-personal-clock-action="clock_in"[\s\S]*?#c9832f/);
  assert.match(css, /data-personal-clock-action="clock_out"[\s\S]*?#3f8b63/);
  assert.match(css, /data-personal-clock-action\] \{[\s\S]*?color: #fff;/);
});
