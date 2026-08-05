const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("個人記錄重繪會保存並還原視窗及表格捲動位置", () => {
  const page = read("src/renderer/renderer-records-page.js");
  const actions = read("src/renderer/renderer-records-actions.js");
  const spec = read("規格書.md");

  assert.match(page, /function captureRecordsScrollPosition\(\)/);
  assert.match(page, /windowX: window\.scrollX/);
  assert.match(page, /windowY: window\.scrollY/);
  assert.match(page, /#recordsCard \.records-table-wrap/);
  assert.match(page, /function restoreRecordsScrollPosition\(snapshot\)/);
  assert.match(page, /window\.scrollTo\(snapshot\.windowX, snapshot\.windowY\)/);
  assert.match(page, /element\.scrollTop = entry\.top/);
  assert.match(page, /element\.scrollLeft = entry\.left/);

  assert.match(actions, /const scrollSnapshot = captureRecordsScrollPosition\(\);\s*renderAll\(\);\s*restoreRecordsScrollPosition\(scrollSnapshot\);/);
  assert.match(spec, /必須保留視窗垂直位置及表格水平／垂直捲動位置/);
});
