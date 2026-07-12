const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// 固定補丁整併前實際使用的復原／重做按鈕、堆疊與快捷鍵行為。
const root = path.resolve(__dirname, "..");
const interactionPath = path.join(root, "src", "renderer", "renderer-schedule-interaction.js");

function evaluateHistory(overrides = {}) {
  const source = fs.readFileSync(interactionPath, "utf8");
  const start = source.indexOf("let scheduleHistoryBusy");
  const end = source.indexOf("function parseScheduleKeyParts", start);
  const historySource = source.slice(start, end);
  const buttons = { undo: { disabled: false, setAttribute() {}, addEventListener() {} }, redo: { disabled: false, setAttribute() {}, addEventListener() {} } };
  const context = {
    scheduleUndoStack: [], scheduleRedoStack: [], state: { schedule: {} }, SCHEDULE_HISTORY_LIMIT: 20,
    deepClone: (value) => JSON.parse(JSON.stringify(value)), canEditSchedule: () => true,
    restoreScheduleSnapshot: async () => true, showInfoMessage: () => {},
    document: { getElementById: (id) => id === "scheduleUndoButton" ? buttons.undo : id === "scheduleRedoButton" ? buttons.redo : null },
    window: {}, ...overrides
  };
  const api = vm.runInNewContext(historySource + "\n;({ syncScheduleHistoryButtons, pushScheduleHistorySnapshot, undoSchedule, redoSchedule, bindScheduleHistoryControls })", context);
  return { api, context, buttons };
}

test("復原與重做按鈕應依堆疊及權限狀態停用", () => {
  const { api, context, buttons } = evaluateHistory();
  api.syncScheduleHistoryButtons();
  assert.equal(buttons.undo.disabled, true);
  context.scheduleUndoStack.push({ A: 1 });
  api.syncScheduleHistoryButtons();
  assert.equal(buttons.undo.disabled, false);
  assert.equal(buttons.redo.disabled, true);
});

test("復原應將目前班表推入重做堆疊並還原目標快照", async () => {
  let restored = null;
  const { api, context } = evaluateHistory({ restoreScheduleSnapshot: async (value) => { restored = value; return true; } });
  context.state.schedule = { current: true };
  context.scheduleUndoStack.push({ previous: true });
  assert.equal(await api.undoSchedule(), true);
  assert.deepEqual(JSON.parse(JSON.stringify(restored)), { previous: true });
  assert.deepEqual(JSON.parse(JSON.stringify(context.scheduleRedoStack[0])), { current: true });
});

test("班表歷程控制應由正式互動模組提供而非覆蓋函式", () => {
  const source = fs.readFileSync(interactionPath, "utf8");
  const renderer = fs.readFileSync(path.join(root, "src", "renderer", "renderer.js"), "utf8");
  const build = fs.readFileSync(path.join(root, "scripts", "build-js.js"), "utf8");
  assert.equal(fs.existsSync(path.join(root, "src", "renderer", "v2-schedule-history-controls.js")), false);
  assert.equal(build.includes("v2-schedule-history-controls.js"), false);
  assert.equal(source.includes("pushScheduleUndoSnapshot = function"), false);
  assert.equal(source.includes("discardLastScheduleUndoSnapshot = function"), false);
  assert.equal(source.includes("async function undoSchedule()"), true);
  assert.equal(source.includes("async function redoSchedule()"), true);
  assert.equal(renderer.includes("await (redoRequested ? redoSchedule() : undoSchedule())"), true);
  assert.equal(renderer.includes("bindScheduleHistoryControls();"), true);
});
