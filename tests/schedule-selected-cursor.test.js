const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("班別與假別選取後建立對應色塊游標", () => {
  const toolbar = read("src/renderer/renderer-schedule-toolbar.js");
  assert.match(toolbar, /function buildSelectedScheduleItemCursor\(type, item\)/);
  assert.match(toolbar, /type !== "shift" && type !== "leave"/);
  assert.match(toolbar, /const color = String\(item\.color/);
  assert.match(toolbar, /getItemTextColor\(item, color\)/);
  assert.match(toolbar, /const label = String\(getLocalizedName\(item, fallbackLabel\)/);
  assert.match(toolbar, /const charCount = Array\.from\(label\)\.length/);
  assert.match(toolbar, /Math\.min\(128, Math\.max\(48/);
  assert.match(toolbar, /data:image\/svg\+xml/);
  assert.match(toolbar, /&quot;/);
  assert.match(toolbar, /stroke-opacity="0\.32"/);
});

test("人員檢視所有班表格都套用自訂游標，但不可操作格仍由既有邏輯阻擋", () => {
  const toolbar = read("src/renderer/renderer-schedule-toolbar.js");
  const css = read("src/renderer/css/schedule.css");
  assert.match(toolbar, /!selected \|\| !canEditSchedule\(\) \|\| state\.tableView !== "member"/);
  assert.match(toolbar, /table\.classList\.add\("schedule-item-cursor-active"\)/);
  assert.match(toolbar, /table\.style\.setProperty\("--schedule-item-cursor", cursor\)/);
  assert.match(css, /#mainTable\.schedule-item-cursor-active \.cell \{/);
  assert.doesNotMatch(css, /schedule-item-cursor-active \.cell:not\(/);
  assert.match(css, /cursor: var\(--schedule-item-cursor, pointer\)/);
});

test("取消班別假別選取後還原一般游標", () => {
  const toolbar = read("src/renderer/renderer-schedule-toolbar.js");
  assert.match(toolbar, /table\.classList\.remove\("schedule-item-cursor-active"\)/);
  assert.match(toolbar, /table\.style\.removeProperty\("--schedule-item-cursor"\)/);
  assert.match(toolbar, /syncSelectedScheduleItemCursor\(\)/);
});
