const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

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
  assert.match(toolbar, /\(!selected && !cancelLabel\) \|\| !canEditSchedule\(\) \|\| state\.tableView !== "member"/);
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

test("班別取消、假別取消顯示浮動兩列文字，支援中越文並能恢復原始游標", () => {
  const toolbar = read("src/renderer/renderer-schedule-toolbar.js");
  const css = read("src/renderer/css/schedule.css");
  let vietnamese = false;
  class FakeElement {
    constructor() {
      const classes = new Set();
      this.classList = {
        add: (name) => classes.add(name),
        remove: (name) => classes.delete(name),
        contains: (name) => classes.has(name)
      };
      this.style = {};
      this.hidden = false;
      this.isConnected = true;
      this.textContent = "";
    }
    setAttribute() {}
    getBoundingClientRect() { return { width: 46, height: 42 }; }
    closest() { return cell; }
  }
  const table = new FakeElement(), cell = new FakeElement(), target = new FakeElement();
  let preview;
  const context = vm.createContext({
    state: { selected: { type: "", id: "" }, tableView: "member" },
    Element: FakeElement,
    HTMLElement: FakeElement,
    document: {
      getElementById: (id) => id === "mainTable" ? table : null,
      createElement: () => new FakeElement(),
      body: { appendChild: (el) => { preview = el; } }
    },
    window: { innerWidth: 800, innerHeight: 600 },
    canEditSchedule: () => true,
    fyhLocalization: { isVietnamese: () => vietnamese },
    getItem: () => ({ name: "早班", color: "#F0BB78" }),
    getLocalizedName: (item) => item.name,
    getItemTextColor: () => "#333333",
    target
  });
  vm.runInContext(toolbar, context);
  for (const [type, zh, vi] of [
    ["cancel-shift", "班別\n取消", "Ca làm\nHủy"],
    ["cancel-leave", "假別\n取消", "Loại nghỉ\nHủy"]
  ]) {
    context.state.selected = { type, id: "" };
    for (const useVi of [false, true]) {
      vietnamese = useVi;
      vm.runInContext("syncSelectedScheduleItemCursor()", context);
      assert.equal(preview.textContent, useVi ? vi : zh);
      assert.equal(preview.classList.contains("schedule-item-pointer-cancel"), true);
      assert.equal(table.classList.contains("schedule-item-cursor-active"), true);
      vm.runInContext("updateSelectedScheduleItemPointerPreview({ target, clientX: 100, clientY: 100 })", context);
      assert.equal(preview.hidden, false);
    }
  }
  context.state.selected = { type: "shift", id: "s1" };
  vm.runInContext("syncSelectedScheduleItemCursor()", context);
  assert.equal(preview.textContent, "早班");
  assert.equal(preview.classList.contains("schedule-item-pointer-cancel"), false);
  context.state.selected = { type: "", id: "" };
  vm.runInContext("syncSelectedScheduleItemCursor()", context);
  assert.equal(preview.hidden, true);
  assert.equal(table.classList.contains("schedule-item-cursor-active"), false);
  assert.ok(css.includes(".schedule-item-pointer-preview.schedule-item-pointer-cancel {"));
  assert.ok(css.includes("white-space: pre-line;"));
});
