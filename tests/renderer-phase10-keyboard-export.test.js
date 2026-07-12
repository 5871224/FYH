const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const keyboard = read("src/renderer/renderer-schedule-keyboard.js");
const availability = read("src/renderer/renderer-export-availability.js");
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

test("匯出資料存在性判斷應保留假別分類與加班規則", () => {
  let leaveCode = "0036";
  const context = {
    state: {
      year: 2026,
      month: 6,
      departments: [{ id: "D1", hiddenFromSchedule: false }],
      members: [{ id: "M1", deptId: "D1", payByDay: false }],
      schedule: { "M1-2026-6-1": { leave: "L1", overtime: "O1" } }
    },
    daysInMonth: () => 1,
    isMemberActiveOnDate: () => true,
    scheduleKey: (memberId, year, month, day) => [memberId, year, month, day].join("-"),
    getItem: () => ({ code: leaveCode })
  };
  const api = vm.runInNewContext(availability + "\n;({ hasSapLeaveRows, hasOvertimeRows, hasLeaveRows })", context);
  assert.equal(api.hasSapLeaveRows(), true);
  assert.equal(api.hasLeaveRows(), false);
  assert.equal(api.hasOvertimeRows(), true);
  leaveCode = "0001";
  assert.equal(api.hasSapLeaveRows(), false);
  assert.equal(api.hasLeaveRows(), true);
});

test("班表操作應保留復原、重做、複製、剪下、貼上與刪除入口", () => {
  ["undoSchedule", "redoSchedule", "copyScheduleRangeToClipboard", "clearSelectedScheduleCells", "pasteScheduleClipboard"].forEach((name) => {
    assert.equal(keyboard.includes(name), true, "缺少班表操作：" + name);
  });
});

test("第十階段應移出操作與匯出判斷並維持模組順序", () => {
  const ordered = [
    "renderer-auth-context.js",
    "renderer-schedule-keyboard.js",
    "renderer-export-availability.js",
    "renderer-attendance-page.js",
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
  ["beginScheduleHeaderColumnSelection", "handleScheduleGridKeydown", "hasSapLeaveRows", "hasOvertimeRows", "hasLeaveRows"].forEach((name) => {
    assert.equal(renderer.includes("function " + name), false, "renderer.js 仍保留 " + name);
  });
  assert.ok(renderer.split("\n").length < 2950, "renderer.js 未明顯縮小");
});
