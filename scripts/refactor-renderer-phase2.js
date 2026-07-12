const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const rendererDir = path.join(root, "src", "renderer");
const rendererPath = path.join(rendererDir, "renderer.js");
const buildPath = path.join(root, "scripts", "build-js.js");

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

function writeModule(fileName, title, body) {
  const outputPath = path.join(rendererDir, fileName);
  fs.writeFileSync(
    outputPath,
    `/* ${title}\n * 由 renderer.js 第二階段拆分；維持既有全域 bundle 執行方式。\n */\n\n${body.trim()}\n`,
    "utf8"
  );
}

function replaceRequired(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`找不到替換位置：${label}`);
  return source.replace(search, replacement);
}

let renderer = fs.readFileSync(rendererPath, "utf8");
const originalLineCount = renderer.split(/\r?\n/).length;

const uiHelpers = extractBeforeNextLine(
  renderer,
  "function reportValidationError(message) {",
  "function isMemberActiveOnDate(member, year, month, day) {"
);
renderer = uiHelpers.source;

const visibility = extractBeforeNextLine(
  renderer,
  "function isMemberActiveOnDate(member, year, month, day) {",
  "function textColor(hex) {"
);
renderer = visibility.source;

const stateNormalization = extractBeforeNextLine(
  renderer,
  "function textColor(hex) {",
  "function setSaveStatus(message, saving = false) {"
);
renderer = stateNormalization.source;

renderer = renderer.replace(/^\s+/, "").replace(/\n{3,}/g, "\n\n");
const nextLineCount = renderer.split(/\r?\n/).length;
if (originalLineCount - nextLineCount < 450) {
  throw new Error(`renderer.js 第二階段拆分行數不足：${originalLineCount} -> ${nextLineCount}`);
}
if (nextLineCount >= 6800) {
  throw new Error(`renderer.js 第二階段後仍過長：${nextLineCount} 行`);
}

writeModule(
  "renderer-ui-helpers.js",
  "共用訊息、操作確認與時間輸入元件工具",
  uiHelpers.block
);
writeModule(
  "renderer-visibility.js",
  "人員與單位任職、營運及班表顯示區間判定",
  visibility.block
);
writeModule(
  "renderer-state-normalization.js",
  "排班狀態清理、目錄正規化與顏色工具",
  stateNormalization.block
);
fs.writeFileSync(rendererPath, renderer, "utf8");

let build = fs.readFileSync(buildPath, "utf8");
build = replaceRequired(
  build,
  '  "renderer-date-utils.js",\n  "renderer.js",',
  [
    '  "renderer-date-utils.js",',
    '  "renderer-ui-helpers.js",',
    '  "renderer-visibility.js",',
    '  "renderer-state-normalization.js",',
    '  "renderer.js",'
  ].join("\n"),
  "build-js renderer 模組順序"
);
fs.writeFileSync(buildPath, build, "utf8");

const coreSourceHelper = `const fs = require("node:fs");
const path = require("node:path");

const RENDERER_CORE_FILES = [
  "renderer-foundation.js",
  "renderer-settings-navigation.js",
  "renderer-schedule-layout.js",
  "renderer-date-utils.js",
  "renderer-ui-helpers.js",
  "renderer-visibility.js",
  "renderer-state-normalization.js",
  "renderer.js"
];

function readRendererCore(rootDir) {
  return RENDERER_CORE_FILES
    .map((file) => fs.readFileSync(path.join(rootDir, "src", "renderer", file), "utf8"))
    .join("\\n");
}

module.exports = { RENDERER_CORE_FILES, readRendererCore };
`;
fs.writeFileSync(path.join(root, "scripts", "renderer-core-source.js"), coreSourceHelper, "utf8");

const checkSettingsPath = path.join(root, "scripts", "check-settings-lists.js");
let checkSettings = fs.readFileSync(checkSettingsPath, "utf8");
checkSettings = checkSettings.replace(
  /const rendererFiles = \[[\s\S]*?\];\nconst renderer = rendererFiles[\s\S]*?\.join\("\\n"\);/,
  'const { readRendererCore } = require("./renderer-core-source.js");\nconst renderer = readRendererCore(rootDir);'
);
if (!checkSettings.includes("readRendererCore(rootDir)")) throw new Error("設定檢查未改用 renderer 核心來源");
fs.writeFileSync(checkSettingsPath, checkSettings, "utf8");

const checkNormalizedPath = path.join(root, "scripts", "check-normalized-storage.js");
let checkNormalized = fs.readFileSync(checkNormalizedPath, "utf8");
checkNormalized = replaceRequired(
  checkNormalized,
  'const renderer = fs.readFileSync(path.join(rootDir, "src", "renderer", "renderer.js"), "utf8");',
  'const { readRendererCore } = require("./renderer-core-source.js");\nconst renderer = readRendererCore(rootDir);',
  "normalized storage renderer 來源"
);
fs.writeFileSync(checkNormalizedPath, checkNormalized, "utf8");

const checkExpansionPath = path.join(root, "scripts", "check-expansion-acceptance.js");
let checkExpansion = fs.readFileSync(checkExpansionPath, "utf8");
checkExpansion = replaceRequired(
  checkExpansion,
  'const renderer = read("src", "renderer", "renderer.js");',
  'const { readRendererCore } = require("./renderer-core-source.js");\nconst renderer = readRendererCore(rootDir);',
  "expansion acceptance renderer 來源"
);
fs.writeFileSync(checkExpansionPath, checkExpansion, "utf8");

const checkFinalPath = path.join(root, "scripts", "check-v2-final.js");
let checkFinal = fs.readFileSync(checkFinalPath, "utf8");
checkFinal = replaceRequired(
  checkFinal,
  'const sourceRenderer = read("src/renderer/renderer.js");',
  'const { readRendererCore } = require("./renderer-core-source.js");\nconst sourceRenderer = readRendererCore(root);',
  "V2 final renderer 來源"
);
fs.writeFileSync(checkFinalPath, checkFinal, "utf8");

const testSource = `const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const { RENDERER_CORE_FILES, readRendererCore } = require("../scripts/renderer-core-source.js");

function evaluateModule(fileName, exportExpression, context = {}) {
  const source = fs.readFileSync(path.join(root, "src", "renderer", fileName), "utf8");
  return vm.runInNewContext(\`\${source}\\n;\${exportExpression}\`, context);
}

test("共用訊息與時間輸入工具應保留既有格式", () => {
  const helpers = evaluateModule(
    "renderer-ui-helpers.js",
    "({ formatSchedulerError, buildTimeOptions, splitTimeValue })",
    {
      normalizeTimeText: (value) => /^\\d{2}:\\d{2}$/.test(String(value)) ? String(value) : ""
    }
  );

  assert.equal(helpers.formatSchedulerError(new Error("一般錯誤")), "一般錯誤");
  assert.equal(helpers.formatSchedulerError(null, "備援訊息"), "備援訊息");
  assert.equal(helpers.buildTimeOptions("08", ["07", "08"]).includes('value="08" selected'), true);
  assert.deepEqual(Array.from(helpers.splitTimeValue("08:30")), ["08", "30"]);
});

test("任職與營運區間判定應包含起訖日", () => {
  const visibility = evaluateModule(
    "renderer-visibility.js",
    "({ isMemberActiveOnDate, doesDateRangeOverlapMonth, doesDateRangeOverlapRange, isDepartmentVisibleInSchedule, isDepartmentOperatingOnDate })",
    {
      toDateString: (year, month, day) => \`\${year}-\${String(month + 1).padStart(2, "0")}-\${String(day).padStart(2, "0")}\`,
      daysInMonth: (year, month) => new Date(year, month + 1, 0).getDate(),
      getVisibleDateRange: () => ({ startDate: "2026-07-01", endDate: "2026-08-25" })
    }
  );

  const member = { hireDate: "2026-07-02", leaveDate: "2026-07-04" };
  assert.equal(visibility.isMemberActiveOnDate(member, 2026, 6, 2), true);
  assert.equal(visibility.isMemberActiveOnDate(member, 2026, 6, 4), true);
  assert.equal(visibility.isMemberActiveOnDate(member, 2026, 6, 5), false);
  assert.equal(visibility.doesDateRangeOverlapMonth("2026-06-20", "2026-07-01", 2026, 6), true);
  assert.equal(visibility.doesDateRangeOverlapRange("2026-08-25", "", "2026-07-01", "2026-08-25"), true);
  assert.equal(visibility.isDepartmentVisibleInSchedule({ hiddenFromSchedule: false }), true);
  assert.equal(visibility.isDepartmentOperatingOnDate({ startDate: "2026-07-01", endDate: "2026-07-31" }, "2026-07-31"), true);
});

test("狀態正規化工具應保留顏色與排班清理規則", () => {
  const normalization = evaluateModule(
    "renderer-state-normalization.js",
    "({ textColor, autoLeaveTextColor, sanitizeDepartment, sanitizeHoliday, cleanupScheduleEntries })",
    {
      COLORS: [{ hex: "#378ADD" }],
      LEAVE_CATALOG: [{ code: "0010", name: "事假" }],
      LEGACY_LEAVE_NAME_MAP: {},
      uid: (prefix) => \`\${prefix}-id\`,
      normalizeRole: () => "employee",
      normalizeRestWeekday: () => 0,
      createEmptyState: () => ({}),
      toDateObject: () => null,
      normalizeScheduleLoadedRanges: () => []
    }
  );

  assert.equal(normalization.textColor("#ffffff"), "#2b241c");
  assert.equal(normalization.autoLeaveTextColor("#000000"), "#ffffff");
  assert.equal(normalization.sanitizeDepartment({ name: "測試單位" }, 0).name, "測試單位");
  assert.equal(normalization.sanitizeHoliday({ date: "2026-07-12", name: "測試假日" }, 0).date, "2026-07-12");

  const cleaned = normalization.cleanupScheduleEntries({
    A: { shift: "shift-1", leave: "missing", overtime: null },
    B: { shift: "missing", leave: null, overtime: null }
  }, {
    shifts: [{ id: "shift-1" }],
    leaves: [],
    overtime: []
  });
  assert.equal(Boolean(cleaned.A), true);
  assert.equal(Boolean(cleaned.B), false);
});

test("renderer 第二階段拆分應維持核心來源與建置順序", () => {
  const renderer = fs.readFileSync(path.join(root, "src", "renderer", "renderer.js"), "utf8");
  const build = fs.readFileSync(path.join(root, "scripts", "build-js.js"), "utf8");
  const movedMarkers = [
    "function reportValidationError(message) {",
    "function isMemberActiveOnDate(member, year, month, day) {",
    "function textColor(hex) {",
    "function normalizeState(payload) {"
  ];
  for (const marker of movedMarkers) assert.equal(renderer.includes(marker), false, \`renderer.js 仍包含：\${marker}\`);

  const moduleOrder = RENDERER_CORE_FILES.map((name) => build.indexOf(\`\"\${name}\"\`));
  assert.equal(moduleOrder.every((index) => index >= 0), true);
  assert.equal(moduleOrder.every((index, position) => position === 0 || index > moduleOrder[position - 1]), true);
  assert.equal(renderer.split(/\\r?\\n/).length < 6800, true);
  assert.equal(readRendererCore(root).includes("function normalizeState(payload)"), true);
});
`;
fs.writeFileSync(path.join(root, "tests", "renderer-phase2-modules.test.js"), testSource, "utf8");

console.log(`renderer.js 第二階段已由 ${originalLineCount} 行降至 ${nextLineCount} 行。`);
