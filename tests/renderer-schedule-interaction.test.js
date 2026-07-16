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

test("手動更新班表儲存格時應同步更新同一人員的統計欄", () => {
  class FakeHTMLElement {}
  const statsCell = { innerHTML: "舊統計" };
  const row = { querySelector: (selector) => selector === ".stats-col" ? statsCell : null };
  const cell = Object.assign(new FakeHTMLElement(), {
    dataset: { memberId: "M", date: "2026-07-12" },
    innerHTML: "舊班表",
    closest: (selector) => selector === "tr" ? row : null
  });
  const interaction = evaluateInteraction(
    "({ renderScheduleCell })",
    {
      HTMLElement: FakeHTMLElement,
      document: { querySelectorAll: () => [cell] },
      state: {
        tableView: "member",
        tableStatsVisible: true,
        members: [{ id: "M", name: "測試人員" }],
        schedule: { M_2026_6_12: { shift: "A" } }
      },
      getScheduleKeyForDateString: () => "M_2026_6_12",
      renderCellInner: () => "新班表",
      renderMemberStats: () => "新統計"
    }
  );

  interaction.renderScheduleCell("M", "2026-07-12");
  assert.equal(cell.innerHTML, "新班表");
  assert.equal(statsCell.innerHTML, "新統計");
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

  const interactionIndex = RENDERER_CORE_FILES.indexOf("renderer-schedule-interaction.js");
  const rendererIndex = RENDERER_CORE_FILES.indexOf("renderer.js");
  const moduleOrder = RENDERER_CORE_FILES.map((name) => build.indexOf(`"${name}"`));
  assert.equal(interactionIndex >= 0 && interactionIndex < rendererIndex, true);
  assert.equal(moduleOrder.every((index) => index >= 0), true);
  assert.equal(moduleOrder.every((index, position) => position === 0 || index > moduleOrder[position - 1]), true);
  assert.equal(renderer.split(/\r?\n/).length < 6350, true);
  assert.equal(readRendererCore(root).includes("function restoreScheduleSnapshot(snapshot)"), true);
});
