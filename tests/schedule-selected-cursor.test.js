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
  assert.match(toolbar, /Array\.from\(localizedName\)\.slice\(0, 2\)/);
  assert.match(toolbar, /data:image\/svg\+xml/);
  assert.match(toolbar, /&quot;/);
  assert.match(toolbar, /stroke-opacity="0\.32"/);
});

test("只有人員檢視可編輯班表格套用自訂游標", () => {
  const toolbar = read("src/renderer/renderer-schedule-toolbar.js");
  const css = read("src/renderer/css/schedule.css");
  assert.match(toolbar, /!selected \|\| !canEditSchedule\(\) \|\| state\.tableView !== "member"/);
  assert.match(toolbar, /table\.classList\.add\("schedule-item-cursor-active"\)/);
  assert.match(toolbar, /table\.style\.setProperty\("--schedule-item-cursor", cursor\)/);
  assert.match(css, /#mainTable\.schedule-item-cursor-active \.cell:not\(\.inactive-cell\):not\(\.archived-schedule-cell\):not\(\[data-readonly="true"\]\)/);
  assert.match(css, /cursor: var\(--schedule-item-cursor, pointer\)/);
});

test("取消班別假別選取後還原一般游標", () => {
  const toolbar = read("src/renderer/renderer-schedule-toolbar.js");
  assert.match(toolbar, /table\.classList\.remove\("schedule-item-cursor-active"\)/);
  assert.match(toolbar, /table\.style\.removeProperty\("--schedule-item-cursor"\)/);
  assert.match(toolbar, /syncSelectedScheduleItemCursor\(\)/);
});
