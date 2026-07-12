const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const rendererDir = path.join(root, "src", "renderer");
const interactionPath = path.join(rendererDir, "renderer-schedule-interaction.js");
const rendererPath = path.join(rendererDir, "renderer.js");
const patchPath = path.join(rendererDir, "v2-schedule-history-controls.js");
const buildPath = path.join(root, "scripts", "build-js.js");
const testPath = path.join(root, "tests", "renderer-phase7-schedule-history.test.js");

let interaction = fs.readFileSync(interactionPath, "utf8");
interaction = interaction.replace(
  "function pushScheduleUndoSnapshot(snapshot = state.schedule || {}) {\n  scheduleUndoStack.push(deepClone(snapshot));\n  if (scheduleUndoStack.length > SCHEDULE_HISTORY_LIMIT) {\n    scheduleUndoStack.shift();\n  }\n  scheduleRedoStack = [];\n}",
  "function pushScheduleUndoSnapshot(snapshot = state.schedule || {}) {\n  scheduleUndoStack.push(deepClone(snapshot));\n  if (scheduleUndoStack.length > SCHEDULE_HISTORY_LIMIT) {\n    scheduleUndoStack.shift();\n  }\n  scheduleRedoStack = [];\n  syncScheduleHistoryButtons();\n}"
);
interaction = interaction.replace(
  "function discardLastScheduleUndoSnapshot() {\n  scheduleUndoStack.pop();\n}",
  "function discardLastScheduleUndoSnapshot() {\n  scheduleUndoStack.pop();\n  syncScheduleHistoryButtons();\n}"
);
const historyMarker = "function parseScheduleKeyParts(key) {";
const historyIndex = interaction.indexOf(historyMarker);
if (historyIndex < 0) throw new Error("找不到班表鍵值解析函式");
const historySource = `let scheduleHistoryBusy = false;

function getScheduleUndoButton() {
  return document.getElementById("scheduleUndoButton");
}

function getScheduleRedoButton() {
  return document.getElementById("scheduleRedoButton");
}

function syncScheduleHistoryButtons() {
  const editable = typeof canEditSchedule === "function" && canEditSchedule();
  const undoButton = getScheduleUndoButton();
  const redoButton = getScheduleRedoButton();
  if (undoButton) {
    undoButton.disabled = scheduleHistoryBusy || !editable || scheduleUndoStack.length === 0;
    undoButton.setAttribute("aria-disabled", String(undoButton.disabled));
  }
  if (redoButton) {
    redoButton.disabled = scheduleHistoryBusy || !editable || scheduleRedoStack.length === 0;
    redoButton.setAttribute("aria-disabled", String(redoButton.disabled));
  }
}

function pushScheduleHistorySnapshot(stack, snapshot) {
  stack.push(deepClone(snapshot || {}));
  if (stack.length > SCHEDULE_HISTORY_LIMIT) {
    stack.shift();
  }
}

async function undoSchedule() {
  if (scheduleHistoryBusy || !canEditSchedule() || !scheduleUndoStack.length) {
    syncScheduleHistoryButtons();
    return false;
  }
  scheduleHistoryBusy = true;
  const targetSnapshot = scheduleUndoStack.pop();
  pushScheduleHistorySnapshot(scheduleRedoStack, state.schedule || {});
  syncScheduleHistoryButtons();
  try {
    await restoreScheduleSnapshot(targetSnapshot);
    return true;
  } catch (error) {
    showInfoMessage(\`上一步失敗：\${error.message || error}\`);
    return false;
  } finally {
    scheduleHistoryBusy = false;
    syncScheduleHistoryButtons();
  }
}

async function redoSchedule() {
  if (scheduleHistoryBusy || !canEditSchedule() || !scheduleRedoStack.length) {
    syncScheduleHistoryButtons();
    return false;
  }
  scheduleHistoryBusy = true;
  const targetSnapshot = scheduleRedoStack.pop();
  pushScheduleHistorySnapshot(scheduleUndoStack, state.schedule || {});
  syncScheduleHistoryButtons();
  try {
    await restoreScheduleSnapshot(targetSnapshot);
    return true;
  } catch (error) {
    showInfoMessage(\`下一步失敗：\${error.message || error}\`);
    return false;
  } finally {
    scheduleHistoryBusy = false;
    syncScheduleHistoryButtons();
  }
}

function bindScheduleHistoryControls() {
  getScheduleUndoButton()?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void undoSchedule();
  });
  getScheduleRedoButton()?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void redoSchedule();
  });
  window.schedulerScheduleHistory = {
    undo: undoSchedule,
    redo: redoSchedule,
    sync: syncScheduleHistoryButtons
  };
  syncScheduleHistoryButtons();
}

`;
interaction = interaction.slice(0, historyIndex) + historySource + interaction.slice(historyIndex);
fs.writeFileSync(interactionPath, interaction);

let renderer = fs.readFileSync(rendererPath, "utf8");
const oldKeydown = `  if ((event.ctrlKey || event.metaKey) && (key === "z" || key === "y")) {
    event.preventDefault();
    const redoRequested = key === "y" || event.shiftKey;
    const targetStack = redoRequested ? scheduleRedoStack : scheduleUndoStack;
    const snapshot = targetStack.pop();
    if (!snapshot) {
      return;
    }
    const oppositeStack = redoRequested ? scheduleUndoStack : scheduleRedoStack;
    oppositeStack.push(deepClone(state.schedule || {}));
    if (oppositeStack.length > SCHEDULE_HISTORY_LIMIT) {
      oppositeStack.shift();
    }
    await restoreScheduleSnapshot(snapshot);
    return;
  }`;
const newKeydown = `  if ((event.ctrlKey || event.metaKey) && (key === "z" || key === "y")) {
    event.preventDefault();
    const redoRequested = key === "y" || event.shiftKey;
    await (redoRequested ? redoSchedule() : undoSchedule());
    return;
  }`;
if (!renderer.includes(oldKeydown)) throw new Error("找不到舊班表復原快捷鍵區段");
renderer = renderer.replace(oldKeydown, newKeydown);
const bindMarker = '  bindClick("coreActionsToggle", (event) => {';
if (!renderer.includes(bindMarker)) throw new Error("找不到事件綁定起點");
renderer = renderer.replace(bindMarker, `  bindScheduleHistoryControls();\n\n${bindMarker}`);
fs.writeFileSync(rendererPath, renderer);

if (!fs.existsSync(patchPath)) throw new Error("找不到待移除的班表復原補丁");
fs.unlinkSync(patchPath);
let build = fs.readFileSync(buildPath, "utf8");
build = build.replace(/^\s*"v2-schedule-history-controls\.js",?\r?\n/m, "");
fs.writeFileSync(buildPath, build);

const testSource = `const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

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
  const api = vm.runInNewContext(historySource + "\\n;({ syncScheduleHistoryButtons, pushScheduleHistorySnapshot, undoSchedule, redoSchedule, bindScheduleHistoryControls })", context);
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
`;
fs.writeFileSync(testPath, testSource);
console.log("schedule history patch merged into canonical interaction module");
