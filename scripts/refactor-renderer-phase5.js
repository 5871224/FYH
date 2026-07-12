const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const rendererDir = path.join(root, "src", "renderer");
const rendererPath = path.join(rendererDir, "renderer.js");
const buildPath = path.join(root, "scripts", "build-js.js");
const coreSourcePath = path.join(root, "scripts", "renderer-core-source.js");
const testPath = path.join(root, "tests", "renderer-phase5-schedule-rendering.test.js");

const blocks = [
  { file: "renderer-schedule-toolbar.js", start: "renderDeptFilter", end: "getMemberEightWeekStats" },
  { file: "renderer-schedule-groups.js", start: "getMemberEightWeekStats", end: "getReorderedVisibleIds" },
  { file: "renderer-schedule-cells.js", start: "getVisibleShiftRows", end: "renderTable" },
  { file: "renderer-schedule-table.js", start: "renderTable", end: "renderHomeDashboard" }
];

function functionStart(source, name) {
  const match = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(source);
  if (!match) throw new Error(`找不到函式：${name}`);
  return match.index;
}

function insertBeforeRenderer(source, fileNames) {
  const marker = /  "renderer\.js",?/;
  if (!marker.test(source)) throw new Error("清單找不到 renderer.js");
  const lines = fileNames.map((file) => `  "${file}",`).join("\n");
  return source.replace(marker, `${lines}\n  "renderer.js",`);
}

let renderer = fs.readFileSync(rendererPath, "utf8");
const ranges = blocks.map((block) => {
  const start = functionStart(renderer, block.start);
  const end = functionStart(renderer, block.end);
  if (end <= start) throw new Error(`區塊順序錯誤：${block.start} -> ${block.end}`);
  return { ...block, start, end, content: renderer.slice(start, end).trim() + "\n" };
});

ranges.sort((left, right) => right.start - left.start).forEach((range) => {
  renderer = renderer.slice(0, range.start) + renderer.slice(range.end);
});
fs.writeFileSync(rendererPath, renderer.replace(/\n{3,}/g, "\n\n").trimEnd() + "\n");

for (const range of ranges) {
  fs.writeFileSync(path.join(rendererDir, range.file), range.content);
}

const moduleNames = blocks.map((block) => block.file);
fs.writeFileSync(buildPath, insertBeforeRenderer(fs.readFileSync(buildPath, "utf8"), moduleNames));
fs.writeFileSync(coreSourcePath, insertBeforeRenderer(fs.readFileSync(coreSourcePath, "utf8"), moduleNames));

const testLines = [
  'const test = require("node:test");',
  'const assert = require("node:assert/strict");',
  'const fs = require("node:fs");',
  'const path = require("node:path");',
  'const vm = require("node:vm");',
  '',
  'const root = path.resolve(__dirname, "..");',
  'const { RENDERER_CORE_FILES, readRendererCore } = require("../scripts/renderer-core-source.js");',
  'const moduleNames = ["renderer-schedule-toolbar.js", "renderer-schedule-groups.js", "renderer-schedule-cells.js", "renderer-schedule-table.js"];',
  '',
  'function evaluate(files, expression, context) {',
  '  const source = files.map((file) => fs.readFileSync(path.join(root, "src", "renderer", file), "utf8")).join("\\n");',
  '  return vm.runInNewContext(source + "\\n;" + expression, context);',
  '}',
  '',
  'test("班表文字大小應依段落數與字數判定", () => {',
  '  const api = evaluate(["renderer-schedule-cells.js"], "({ getScheduleSegmentSizeClass })", {});',
  '  assert.equal(api.getScheduleSegmentSizeClass({ name: "早" }, 1), "seg-label-xlarge");',
  '  assert.equal(api.getScheduleSegmentSizeClass({ name: "早班" }, 2), "seg-label-large");',
  '  assert.equal(api.getScheduleSegmentSizeClass({ name: "早班組" }, 2), "seg-label-medium");',
  '  assert.equal(api.getScheduleSegmentSizeClass({ name: "早班組別" }, 2), "");',
  '});',
  '',
  'test("八週統計應分開計算例假、休息日、休息日出勤與未排", () => {',
  '  const dates = ["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04"];',
  '  const slots = {',
  '    "M_2026-07-01": { leave: "regular" },',
  '    "M_2026-07-02": { leave: "rest" },',
  '    "M_2026-07-03": { leave: "rest", shift: "A" }',
  '  };',
  '  const context = {',
  '    getVisibleDates: () => dates,',
  '    isMemberActiveOnDateString: () => true,',
  '    getDisplayedSlot: (memberId, date) => slots[memberId + "_" + date] || null,',
  '    getItem: (_category, id) => id === "regular" ? { code: "0036" } : id === "rest" ? { code: "0047" } : null',
  '  };',
  '  const api = evaluate(["renderer-schedule-groups.js"], "({ getMemberEightWeekStats })", context);',
  '  assert.deepEqual(JSON.parse(JSON.stringify(api.getMemberEightWeekStats({ id: "M" }))), { regular: 1, rest: 1, restWork: 1, unassigned: 1 });',
  '});',
  '',
  'test("儲存格渲染應保留班別、假別與加班三段資訊", () => {',
  '  const items = { shift: { A: { name: "早班", color: "#111111" } }, leave: { L: { name: "事假", color: "#222222", code: "0010" } }, overtime: { O: { name: "加班", color: "#333333" } } };',
  '  const context = {',
  '    state: { schedule: {} },',
  '    getItem: (category, id) => items[category][id] || null,',
  '    getItemTextColor: () => "#ffffff", textColor: () => "#ffffff", escapeHtml: String,',
  '    shouldPromptLeaveDetail: () => false',
  '  };',
  '  const api = evaluate(["renderer-schedule-cells.js"], "({ renderCellInner })", context);',
  '  const html = api.renderCellInner("K", "M", "2026-07-01", { shift: "A", leave: "L", overtime: "O", overtimeMeta: {} }, false);',
  '  assert.equal((html.match(/class="seg"/g) || []).length, 3);',
  '  assert.equal(html.includes("早班") && html.includes("事假") && html.includes("加班"), true);',
  '});',
  '',
  'test("第五階段應移出班表渲染並維持建置順序", () => {',
  '  const renderer = fs.readFileSync(path.join(root, "src", "renderer", "renderer.js"), "utf8");',
  '  const build = fs.readFileSync(path.join(root, "scripts", "build-js.js"), "utf8");',
  '  ["function renderToolbar() {", "function getVisibleTableGroups() {", "function renderCellInner", "function renderTable() {"].forEach((marker) => assert.equal(renderer.includes(marker), false, "renderer.js 仍包含：" + marker));',
  '  moduleNames.forEach((name) => assert.equal(RENDERER_CORE_FILES.includes(name), true));',
  '  const order = RENDERER_CORE_FILES.map((name) => build.indexOf("\\\"" + name + "\\\""));',
  '  assert.equal(order.every((index) => index >= 0), true);',
  '  assert.equal(order.every((index, position) => position === 0 || index > order[position - 1]), true);',
  '  assert.equal(renderer.split(/\\r?\\n/).length < 5450, true);',
  '  assert.equal(readRendererCore(root).includes("function renderTable()"), true);',
  '});',
  ''
];
fs.writeFileSync(testPath, testLines.join("\n"));
console.log(`renderer phase 5 prepared: ${ranges.length} rendering blocks moved; renderer lines: ${renderer.split(/\r?\n/).length}`);
