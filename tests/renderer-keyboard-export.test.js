const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const keyboard = read("src/renderer/renderer-schedule-keyboard.js");
const renderer = read("src/renderer/renderer.js");
const build = read("scripts/build-js.js");
const coreSource = read("scripts/renderer-core-source.js");

test("Ctrl+C 應複製目前班表選取範圍", async () => {
  let copied = 0;
  let prevented = 0;
  const context = {
    state: { tableView: "member", selected: { type: null, id: null } },
    scheduleRangeSelection: { anchor: { row: 0, col: 0 } },
    document: { querySelector: () => null },
    isTypingTarget: () => false,
    canEditSchedule: () => true,
    copyScheduleRangeToClipboard: () => { copied += 1; return true; },
    undoSchedule: async () => {},
    redoSchedule: async () => {},
    rememberScheduleUndoSnapshot: () => {},
    clearSelectedScheduleCells: async () => true,
    discardLastScheduleUndoSnapshot: () => {},
    pasteScheduleClipboard: async () => true,
    renderToolbar: () => {},
    renderTable: () => {},
    clearScheduleRangeSelection: () => {}
  };
  const api = vm.runInNewContext(keyboard + "\n;({ handleScheduleGridKeydown })", context);
  await api.handleScheduleGridKeydown({
    key: "c",
    ctrlKey: true,
    metaKey: false,
    shiftKey: false,
    target: null,
    preventDefault: () => { prevented += 1; }
  });
  assert.equal(copied, 1);
  assert.equal(prevented, 1);
});

test("班表操作應保留復原、重做、複製、剪下、貼上與刪除入口", () => {
  ["undoSchedule", "redoSchedule", "copyScheduleRangeToClipboard", "clearSelectedScheduleCells", "pasteScheduleClipboard"].forEach((name) => {
    assert.equal(keyboard.includes(name), true, "缺少班表操作：" + name);
  });
});

test("鍵盤與正式匯出操作應維持明確模組順序", () => {
  const ordered = [
    "renderer-auth-context.js",
    "renderer-schedule-keyboard.js",
    "renderer-attendance-page.js",
    "renderer-export-actions.js",
    "renderer.js"
  ];
  [build, coreSource].forEach((manifest) => {
    let previous = -1;
    ordered.forEach((file) => {
      const index = manifest.indexOf('"' + file + '"');
      assert.ok(index > previous, "模組順序錯誤：" + file);
      previous = index;
    });
  });
  ["beginScheduleHeaderColumnSelection", "handleScheduleGridKeydown", "openExportPeriodDialog", "runPeriodExport"].forEach((name) => {
    assert.equal(renderer.includes("function " + name), false, "renderer.js 仍保留 " + name);
  });
  assert.ok(renderer.split("\n").length < 2950, "renderer.js 未明顯縮小");
});
