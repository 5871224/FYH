const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const rendererDir = path.join(root, "src", "renderer");
const rendererPath = path.join(rendererDir, "renderer.js");
const buildPath = path.join(root, "scripts", "build-js.js");
const coreSourcePath = path.join(root, "scripts", "renderer-core-source.js");
const testPath = path.join(root, "tests", "renderer-phase11-modal-ordering.test.js");

function findRange(source, startMarker, endMarker, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end <= start) throw new Error(`找不到${label}的安全拆分邊界`);
  return { start, end, content: source.slice(start, end).trim() };
}

function insertModules(source, marker, replacement, label) {
  if (!source.includes(marker)) throw new Error(`找不到${label}的模組插入點`);
  return source.replace(marker, replacement);
}

const originalRenderer = fs.readFileSync(rendererPath, "utf8");
const modalRange = findRange(originalRenderer, "function closeModal()", "function getReorderedVisibleIds", "彈窗與返回導覽");
const orderingRange = findRange(originalRenderer, "function getReorderedVisibleIds", "function renderHomeDashboard", "班表排序控制");
const modalSource = modalRange.content;
const orderingSource = orderingRange.content;
let renderer = originalRenderer.slice(0, modalRange.start) + originalRenderer.slice(orderingRange.end);
renderer = renderer.replace(/\n{4,}/g, "\n\n\n");

fs.writeFileSync(path.join(rendererDir, "renderer-modal-navigation.js"), `/* 彈窗、返回鍵與設定頁重新開啟控制。\n * 由 renderer.js 拆分；維持既有全域 bundle 執行方式。\n */\n\n${modalSource}\n`);
fs.writeFileSync(path.join(rendererDir, "renderer-schedule-ordering.js"), `/* 班表單位與人員拖曳排序、捲動位置保存。\n * 由 renderer.js 拆分；不變更排序或儲存規則。\n */\n\n${orderingSource}\n`);
fs.writeFileSync(rendererPath, renderer);

const marker = `  "renderer-auth-context.js",\n  "renderer-schedule-keyboard.js",`;
const replacement = `  "renderer-auth-context.js",\n  "renderer-modal-navigation.js",\n  "renderer-schedule-ordering.js",\n  "renderer-schedule-keyboard.js",`;
let build = fs.readFileSync(buildPath, "utf8");
build = insertModules(build, marker, replacement, "JavaScript 建置清單");
fs.writeFileSync(buildPath, build);
let coreSource = fs.readFileSync(coreSourcePath, "utf8");
coreSource = insertModules(coreSource, marker, replacement, "renderer 測試來源清單");
fs.writeFileSync(coreSourcePath, coreSource);

const testSource = `const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const modal = read("src/renderer/renderer-modal-navigation.js");
const ordering = read("src/renderer/renderer-schedule-ordering.js");
const renderer = read("src/renderer/renderer.js");
const build = read("scripts/build-js.js");
const coreSource = read("scripts/renderer-core-source.js");

test("返回鍵遇到彈窗時應只關閉彈窗", () => {
  const modalRoot = { innerHTML: "open" };
  let hidden = 0;
  let rendered = 0;
  const context = {
    modalContext: { category: "x" },
    appView: "schedule",
    APP_BACK_HISTORY_STATE: { schedulerBackGuard: true },
    document: { getElementById: () => modalRoot, querySelector: () => ({}) },
    hideLeaveTooltip: () => { hidden += 1; },
    renderAll: () => { rendered += 1; },
    window: {
      location: { href: "https://example.test" },
      history: { state: { schedulerBackGuard: true }, pushState() {}, replaceState() {} }
    }
  };
  const api = vm.runInNewContext(modal + String.fromCharCode(10) + ";({ handleAppBackNavigation })", context);
  api.handleAppBackNavigation();
  assert.equal(modalRoot.innerHTML, "");
  assert.equal(hidden, 1);
  assert.equal(rendered, 0);
});

test("可見清單排序應保留未顯示項目的原位置", () => {
  const api = vm.runInNewContext(ordering + String.fromCharCode(10) + ";({ getReorderedVisibleIds, applyVisibleOrderById })", {});
  const reordered = api.getReorderedVisibleIds(["A", "B", "C"], "A", "C", true);
  assert.deepEqual(Array.from(reordered), ["B", "C", "A"]);
  const items = [{ id: "A" }, { id: "X" }, { id: "B" }, { id: "C" }];
  const applied = api.applyVisibleOrderById(items, ["C", "A", "B"]);
  assert.deepEqual(Array.from(applied, (item) => item.id), ["C", "X", "A", "B"]);
});

test("第十一階段應移出彈窗與排序控制並維持模組順序", () => {
  const ordered = ["renderer-auth-context.js", "renderer-modal-navigation.js", "renderer-schedule-ordering.js", "renderer-schedule-keyboard.js", "renderer.js"];
  [build, coreSource].forEach((manifest) => {
    let previous = -1;
    ordered.forEach((file) => {
      const index = manifest.indexOf('"' + file + '"');
      assert.ok(index > previous, "模組順序錯誤：" + file);
      previous = index;
    });
  });
  ["closeModal", "handleAppBackNavigation", "reopenModalFromContext", "getReorderedVisibleIds", "reorderScheduleTableDepartment", "reorderScheduleTableMember"].forEach((name) => {
    assert.equal(renderer.includes("function " + name), false, "renderer.js 仍保留 " + name);
  });
  assert.ok(renderer.split(String.fromCharCode(10)).length < 2800, "renderer.js 未明顯縮小");
});
`;
fs.writeFileSync(testPath, testSource);
console.log(JSON.stringify({ modalLines: modalSource.split("\n").length, orderingLines: orderingSource.split("\n").length, rendererLines: renderer.split("\n").length }));
