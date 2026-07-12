const test = require("node:test");
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
