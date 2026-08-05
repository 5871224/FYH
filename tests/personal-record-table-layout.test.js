const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("個人記錄未打卡欄保持空白且地點同列", () => {
  const source = read("src/renderer/renderer-records-views.js");
  assert.equal(source.includes("attendance-empty-value"), false);
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
