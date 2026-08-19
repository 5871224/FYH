const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// 固定補丁整併前實際使用的自動補班預覽、套用與共用按鈕分流行為。
// 同時確認原有自動排班流程未被自動補班模組取代。
const root = path.resolve(__dirname, "..");
const autoFillPath = path.join(root, "src", "renderer", "renderer-auto-fill-schedule.js");
const autoSchedulePath = path.join(root, "src", "renderer", "renderer-auto-schedule.js");
const scheduleInteractionPath = path.join(root, "src", "renderer", "renderer-schedule-interaction.js");

function extractNamedFunction(source, name) {
  const marker = "async function " + name + "(";
  const start = source.indexOf(marker);
  if (start < 0) throw new Error("找不到共用函式：" + name);
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error("共用函式未完整結束：" + name);
}

function evaluateAutoFill(context, expression) {
  const autoFillSource = fs.readFileSync(autoFillPath, "utf8");
  const interactionSource = fs.readFileSync(scheduleInteractionPath, "utf8");
  const sharedHelper = extractNamedFunction(interactionSource, "applySchedulePreviewSlots");
  return vm.runInNewContext(sharedHelper + "\n" + autoFillSource + "\n;" + expression, context);
}

test("自動補班只處理月薪人員的完全空白格", () => {
  const context = {
    state: {
      shifts: [{ id: "A" }],
      departments: [{ id: "D1", hiddenFromSchedule: false }, { id: "D2", hiddenFromSchedule: true }],
      members: [
        { id: "M1", name: "月薪甲", deptId: "D1", payByDay: false, scheduleShiftIds: ["A"] },
        { id: "M2", name: "日薪乙", deptId: "D1", payByDay: true, scheduleShiftIds: ["A"] },
        { id: "M3", name: "未設班別", deptId: "D1", payByDay: false, scheduleShiftIds: [] },
        { id: "M4", name: "隱藏單位", deptId: "D2", payByDay: false, scheduleShiftIds: ["A"] }
      ],
      schedule: { "M1_2026-07-01": { leave: "L" } }
    },
    autoSchedulePreview: null,
    getMemberHomeDeptId: (member) => member.deptId,
    isMemberActiveOnDateString: () => true,
    isDepartmentOperatingOnDate: () => true,
    getScheduleKeyForDateString: (memberId, date) => memberId + "_" + date,
    getBlockingSameShiftConditions: () => [],
    noteScheduleConditionBlocks: () => {}
  };
  const api = evaluateAutoFill(context, "({ buildAutoFillSchedulePreview })");
  const preview = api.buildAutoFillSchedulePreview(["2026-07-01", "2026-07-02"]);
  assert.deepEqual(Object.keys(preview.slots), ["M1_2026-07-02"]);
  assert.equal(preview.slots["M1_2026-07-02"].shift, "A");
  assert.equal(preview.warnings.length, 1);
  assert.equal(preview.warnings[0].includes("未設班別"), true);
});

test("套用自動補班應建立復原點並只儲存變更格", async () => {
  const persisted = [];
  const messages = [];
  let undoCount = 0;
  const context = {
    state: { shifts: [], departments: [], members: [], schedule: {} },
    autoSchedulePreview: {
      previewType: "auto-fill-schedule",
      slots: {
        "M1_2026-07-01": { shift: "A", leave: null, overtime: null },
        "M2_2026-07-01": { shift: "B", leave: null, overtime: null }
      }
    },
    promptManagerAccess: () => true,
    confirmAction: async () => true,
    parseScheduleKeyParts: (key) => ({ memberId: key.split("_")[0], dateString: key.slice(3) }),
    rememberScheduleUndoSnapshot: () => { undoCount += 1; },
    deepClone: (value) => JSON.parse(JSON.stringify(value)),
    pruneEmptySchedule: () => {},
    renderAll: () => {},
    persistScheduleCells: async (cells) => { persisted.push(...cells); },
    showInfoMessage: (message) => messages.push(message)
  };
  const api = evaluateAutoFill(context, "({ applyAutoFillSchedulePreview })");
  await api.applyAutoFillSchedulePreview();
  assert.equal(undoCount, 1);
  assert.equal(Object.keys(context.state.schedule).length, 2);
  assert.equal(persisted.length, 2);
  assert.equal(context.autoSchedulePreview, null);
  assert.equal(messages.some((message) => message.includes("共寫入 2 格")), true);
});

test("共用套用與取消按鈕應依預覽類型分流", async () => {
  const source = fs.readFileSync(autoSchedulePath, "utf8");
  let applied = 0;
  let canceled = 0;
  const context = {
    autoSchedulePreview: { previewType: "auto-fill-schedule" },
    isAutoFillSchedulePreview: () => true,
    applyAutoFillSchedulePreview: async () => { applied += 1; },
    cancelAutoFillSchedulePreview: () => { canceled += 1; }
  };
  const api = vm.runInNewContext(source + "\n;({ applyAutoSchedulePreview, cancelAutoSchedulePreview })", context);
  await api.applyAutoSchedulePreview();
  api.cancelAutoSchedulePreview();
  assert.equal(applied, 1);
  assert.equal(canceled, 1);
});

test("自動補班應由正式模組提供而非覆蓋自動排班函式", () => {
  const autoFill = fs.readFileSync(autoFillPath, "utf8");
  const autoSchedule = fs.readFileSync(autoSchedulePath, "utf8");
  const toolbarEvents = fs.readFileSync(path.join(root, "src", "renderer", "renderer-events-toolbar.js"), "utf8");
  const build = fs.readFileSync(path.join(root, "scripts", "build-js.js"), "utf8");
  const core = fs.readFileSync(path.join(root, "scripts", "renderer-core-source.js"), "utf8");
  assert.equal(fs.existsSync(path.join(root, "src", "renderer", "v2-auto-fill-schedule.js")), false);
  assert.equal(build.includes("v2-auto-fill-schedule.js"), false);
  assert.equal(build.includes("renderer-auto-fill-schedule.js"), true);
  assert.equal(core.includes("renderer-auto-fill-schedule.js"), true);
  assert.equal(autoFill.includes("applyAutoSchedulePreview ="), false);
  assert.equal(autoFill.includes("cancelAutoSchedulePreview ="), false);
  assert.equal(autoSchedule.includes("if (isAutoFillSchedulePreview())"), true);
  assert.equal(toolbarEvents.includes("bindAutoFillScheduleControls();"), true);
});
