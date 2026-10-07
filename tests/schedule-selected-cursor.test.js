const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("班別與假別選取後建立 HTML 浮動游標標籤", () => {
  const toolbar = read("src/renderer/renderer-schedule-toolbar.js");
  assert.match(toolbar, /function getSelectedScheduleItemPointerPreview\(\)/);
  assert.match(toolbar, /preview\.className = "schedule-item-pointer-preview"/);
  assert.match(toolbar, /const name = String\(getLocalizedName\(selected\.item\)\)\.trim\(\)/);
  assert.match(toolbar, /preview\.textContent = name/);
  assert.match(toolbar, /preview\.style\.backgroundColor = color/);
  assert.match(toolbar, /getItemTextColor\(selected\.item, color\)/);
  assert.doesNotMatch(toolbar, /data:image\/svg\+xml/);
});

test("人員檢視所有班表格使用浮動標籤且不可操作格仍只改外觀", () => {
  const toolbar = read("src/renderer/renderer-schedule-toolbar.js");
  const css = read("src/renderer/css/schedule.css");
  assert.match(toolbar, /!selected \|\| !canEditSchedule\(\) \|\| state\.tableView !== "member"/);
  assert.match(toolbar, /table\.classList\.add\("schedule-item-cursor-active"\)/);
  assert.match(css, /#mainTable\.schedule-item-cursor-active \.cell \{/);
  assert.match(css, /cursor: none/);
  assert.match(css, /\.schedule-item-pointer-preview \{/);
  assert.match(css, /font-size: 10px/);
  assert.match(css, /pointer-events: none/);
  assert.doesNotMatch(css, /schedule-item-cursor-active \.cell:not\(/);
});

test("浮動游標會跟隨滑鼠並在視窗邊緣避讓", () => {
  const toolbar = read("src/renderer/renderer-schedule-toolbar.js");
  const events = read("src/renderer/renderer-events-session.js");
  assert.match(toolbar, /function updateSelectedScheduleItemPointerPreview\(event\)/);
  assert.match(toolbar, /target\.closest\("#mainTable \.cell"\)/);
  assert.match(toolbar, /event\.clientX \+ 2/);
  assert.match(toolbar, /event\.clientY \+ 2/);
  assert.match(toolbar, /left \+ rect\.width \+ margin > window\.innerWidth/);
  assert.match(toolbar, /top \+ rect\.height \+ margin > window\.innerHeight/);
  assert.match(events, /addEventListener\("mousemove", updateSelectedScheduleItemPointerPreview\)/);
  assert.match(events, /hideSelectedScheduleItemPointerPreview\(\)/);
});

test("取消班別假別選取後恢復一般游標並隱藏浮動標籤", () => {
  const toolbar = read("src/renderer/renderer-schedule-toolbar.js");
  assert.match(toolbar, /table\.classList\.remove\("schedule-item-cursor-active"\)/);
  assert.match(toolbar, /preview\.hidden = true/);
  assert.match(toolbar, /syncSelectedScheduleItemCursor\(\)/);
});
