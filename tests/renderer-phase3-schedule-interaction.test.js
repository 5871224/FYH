const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const { RENDERER_CORE_FILES, readRendererCore } = require("../scripts/renderer-core-source.js");

function evaluateInteraction(exportExpression, context = {}) {
  const source = fs.readFileSync(path.join(root, "src", "renderer", "renderer-schedule-interaction.js"), "utf8");
  return vm.runInNewContext(`${source}\n;${exportExpression}`, context);
}

test("班表剪貼簿資料應移除舊申請欄位", () => {
  const interaction = evaluateInteraction(
    "({ cleanSlotMeta, serializeScheduleSlotForClipboard })"
  );
  const meta = interaction.cleanSlotMeta({ displayName: "事假", requestId: "old", requestStatus: "approved" });
  assert.deepEqual(JSON.parse(JSON.stringify(meta)), { displayName: "事假" });

  const slot = interaction.serializeScheduleSlotForClipboard({
    shift: "shift-1",
    leave: "leave-1",
    leaveMeta: { displayName: "事假", requestId: "old" },
    overtime: null
  });
  assert.equal(slot.shift, "shift-1");
  assert.equal(slot.leaveMeta.requestId, undefined);
});

test("班表鍵值解析應支援含底線的人員代碼", () => {
  const interaction = evaluateInteraction(
    "({ parseScheduleKeyParts, getChangedScheduleCells })",
    {
      toDateString: (year, month, day) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    }
  );

  assert.deepEqual(
    JSON.parse(JSON.stringify(interaction.parseScheduleKeyParts("member_with_underscore_2026_6_12"))),
    { memberId: "member_with_underscore", dateString: "2026-07-12" }
  );

  const changed = interaction.getChangedScheduleCells(
    { member_2026_6_12: { shift: "A" } },
    { member_2026_6_12: { shift: "B" }, member_2026_6_13: { shift: "A" } }
  );
  assert.equal(changed.length, 2);
  assert.equal(changed.some((item) => item.dateString === "2026-07-13"), true);
});

test("第三階段應維持核心來源與建置順序", () => {
  const renderer = fs.readFileSync(path.join(root, "src", "renderer", "renderer.js"), "utf8");
  const build = fs.readFileSync(path.join(root, "scripts", "build-js.js"), "utf8");
  const movedMarkers = [
    "function getSlot(memberId, day) {",
    "function getScheduleCellFromEvent(event) {",
    "function copyScheduleRangeToClipboard() {",
    "function restoreScheduleSnapshot(snapshot) {"
  ];
  for (const marker of movedMarkers) assert.equal(renderer.includes(marker), false, `renderer.js 仍包含：${marker}`);

  const moduleOrder = RENDERER_CORE_FILES.map((name) => build.indexOf(`"${name}"`));
  assert.equal(RENDERER_CORE_FILES.includes("renderer-schedule-interaction.js"), true);
  assert.equal(moduleOrder.every((index) => index >= 0), true);
  assert.equal(moduleOrder.every((index, position) => position === 0 || index > moduleOrder[position - 1]), true);
  assert.equal(renderer.split(/\r?\n/).length < 6350, true);
  assert.equal(readRendererCore(root).includes("function restoreScheduleSnapshot(snapshot)"), true);
});
