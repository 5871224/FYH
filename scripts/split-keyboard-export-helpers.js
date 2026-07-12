const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const rendererDir = path.join(root, "src", "renderer");
const rendererPath = path.join(rendererDir, "renderer.js");
const buildPath = path.join(root, "scripts", "build-js.js");
const coreSourcePath = path.join(root, "scripts", "renderer-core-source.js");
const testPath = path.join(root, "tests", "renderer-phase10-keyboard-export.test.js");

function findRange(source, startMarker, endMarker, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end <= start) {
    throw new Error(`找不到${label}的安全拆分邊界`);
  }
  return { start, end, content: source.slice(start, end).trim() };
}

function insertModules(source, marker, replacement, label) {
  if (!source.includes(marker)) {
    throw new Error(`找不到${label}的模組插入點`);
  }
  return source.replace(marker, replacement);
}

let renderer = fs.readFileSync(rendererPath, "utf8");

const exportRange = findRange(
  renderer,
  "function hasSapLeaveRows()",
  "function shouldPromptLeaveDetail",
  "匯出資料存在性判斷"
);
const exportSource = exportRange.content;
renderer = renderer.slice(0, exportRange.start) + renderer.slice(exportRange.end);

const keyboardRange = findRange(
  renderer,
  "function beginScheduleHeaderColumnSelection",
  "function getLeaveLabel",
  "班表鍵盤與範圍選取"
);
const keyboardSource = keyboardRange.content;
renderer = renderer.slice(0, keyboardRange.start) + renderer.slice(keyboardRange.end);
renderer = renderer.replace(/\n{4,}/g, "\n\n\n");

fs.writeFileSync(
  path.join(rendererDir, "renderer-schedule-keyboard.js"),
  `/* 班表欄列、範圍選取與鍵盤剪貼簿控制。\n * 由 renderer.js 拆分；維持既有全域 bundle 執行方式。\n */\n\n${keyboardSource}\n`
);
fs.writeFileSync(
  path.join(rendererDir, "renderer-export-availability.js"),
  `/* 班表匯出按鈕所需的資料存在性判斷。\n * 由 renderer.js 拆分；不變更匯出格式或資料內容。\n */\n\n${exportSource}\n`
);
fs.writeFileSync(rendererPath, renderer);

const moduleMarker = `  "renderer-auth-context.js",\n  "renderer-attendance-page.js",`;
const moduleReplacement = `  "renderer-auth-context.js",\n  "renderer-schedule-keyboard.js",\n  "renderer-export-availability.js",\n  "renderer-attendance-page.js",`;

let build = fs.readFileSync(buildPath, "utf8");
build = insertModules(build, moduleMarker, moduleReplacement, "JavaScript 建置清單");
fs.writeFileSync(buildPath, build);

let coreSource = fs.readFileSync(coreSourcePath, "utf8");
coreSource = insertModules(coreSource, moduleMarker, moduleReplacement, "renderer 測試來源清單");
fs.writeFileSync(coreSourcePath, coreSource);

const testSource = `const test = require("node:test");
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
  const api = vm.runInNewContext(keyboard + "\\n;({ handleScheduleGridKeydown })", context);
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
  const api = vm.runInNewContext(availability + "\\n;({ hasSapLeaveRows, hasOvertimeRows, hasLeaveRows })", context);
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
  assert.ok(renderer.split("\\n").length < 2950, "renderer.js 未明顯縮小");
});
`;
fs.writeFileSync(testPath, testSource);

console.log(JSON.stringify({
  keyboardLines: keyboardSource.split("\n").length,
  exportAvailabilityLines: exportSource.split("\n").length,
  rendererLines: renderer.split("\n").length
}));
