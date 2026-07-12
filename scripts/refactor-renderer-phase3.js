const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const rendererDir = path.join(root, "src", "renderer");
const rendererPath = path.join(rendererDir, "renderer.js");
const buildPath = path.join(root, "scripts", "build-js.js");
const coreSourcePath = path.join(root, "scripts", "renderer-core-source.js");

function extractBeforeNextLine(source, startMarker, nextMarker) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`找不到區塊起點：${startMarker}`);
  const boundary = source.indexOf(`\n${nextMarker}`, start + startMarker.length);
  if (boundary < 0) throw new Error(`找不到下一區塊：${nextMarker}`);
  return {
    block: source.slice(start, boundary).trim(),
    source: source.slice(0, start) + source.slice(boundary + 1)
  };
}

function replaceRequired(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`找不到替換位置：${label}`);
  return source.replace(search, replacement);
}

let renderer = fs.readFileSync(rendererPath, "utf8");
const originalLineCount = renderer.split(/\r?\n/).length;
const interaction = extractBeforeNextLine(
  renderer,
  "function getSlot(memberId, day) {",
  "function getLeaveByCode(code) {"
);
renderer = interaction.source.replace(/^\s+/, "").replace(/\n{3,}/g, "\n\n");
const nextLineCount = renderer.split(/\r?\n/).length;
if (originalLineCount - nextLineCount < 400) {
  throw new Error(`renderer.js 第三階段拆分行數不足：${originalLineCount} -> ${nextLineCount}`);
}
if (nextLineCount >= 6350) {
  throw new Error(`renderer.js 第三階段後仍過長：${nextLineCount} 行`);
}

fs.writeFileSync(
  path.join(rendererDir, "renderer-schedule-interaction.js"),
  `/* 班表儲存格選取、複製貼上、儲存與復原\n * 由 renderer.js 第三階段拆分；維持既有全域 bundle 執行方式。\n */\n\n${interaction.block}\n`,
  "utf8"
);
fs.writeFileSync(rendererPath, renderer, "utf8");

let build = fs.readFileSync(buildPath, "utf8");
build = replaceRequired(
  build,
  '  "renderer-state-normalization.js",\n  "renderer.js",',
  '  "renderer-state-normalization.js",\n  "renderer-schedule-interaction.js",\n  "renderer.js",',
  "build-js 第三階段模組順序"
);
fs.writeFileSync(buildPath, build, "utf8");

let coreSource = fs.readFileSync(coreSourcePath, "utf8");
coreSource = replaceRequired(
  coreSource,
  '  "renderer-state-normalization.js",\n  "renderer.js"',
  '  "renderer-state-normalization.js",\n  "renderer-schedule-interaction.js",\n  "renderer.js"',
  "renderer 核心來源清單"
);
fs.writeFileSync(coreSourcePath, coreSource, "utf8");

const phase2TestPath = path.join(root, "tests", "renderer-phase2-modules.test.js");
let phase2Test = fs.readFileSync(phase2TestPath, "utf8");
phase2Test = replaceRequired(
  phase2Test,
  "  assert.equal(RENDERER_CORE_FILES.length, 8);",
  '  assert.equal(RENDERER_CORE_FILES.includes("renderer.js"), true);',
  "第二階段核心模組數量測試"
);
fs.writeFileSync(phase2TestPath, phase2Test, "utf8");

const testSource = `const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const { RENDERER_CORE_FILES, readRendererCore } = require("../scripts/renderer-core-source.js");

function evaluateInteraction(exportExpression, context = {}) {
  const source = fs.readFileSync(path.join(root, "src", "renderer", "renderer-schedule-interaction.js"), "utf8");
  return vm.runInNewContext(\`\${source}\\n;\${exportExpression}\`, context);
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
      toDateString: (year, month, day) => \`\${year}-\${String(month + 1).padStart(2, "0")}-\${String(day).padStart(2, "0")}\`
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
  for (const marker of movedMarkers) assert.equal(renderer.includes(marker), false, \`renderer.js 仍包含：\${marker}\`);

  const moduleOrder = RENDERER_CORE_FILES.map((name) => build.indexOf(\`\"\${name}\"\`));
  assert.equal(RENDERER_CORE_FILES.includes("renderer-schedule-interaction.js"), true);
  assert.equal(moduleOrder.every((index) => index >= 0), true);
  assert.equal(moduleOrder.every((index, position) => position === 0 || index > moduleOrder[position - 1]), true);
  assert.equal(renderer.split(/\\r?\\n/).length < 6350, true);
  assert.equal(readRendererCore(root).includes("function restoreScheduleSnapshot(snapshot)"), true);
});
`;
fs.writeFileSync(path.join(root, "tests", "renderer-phase3-schedule-interaction.test.js"), testSource, "utf8");

console.log(`renderer.js 第三階段已由 ${originalLineCount} 行降至 ${nextLineCount} 行。`);
