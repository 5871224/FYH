const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const componentsPath = path.join(root, "src", "renderer", "css", "components.css");
const scheduleCssPath = path.join(root, "src", "renderer", "css", "schedule.css");
const webApiPath = path.join(root, "src", "renderer", "web-api.js");
const catalogRendererPath = path.join(root, "src", "renderer", "renderer-settings-catalog.js");
const specPath = path.join(root, "規格書.md");
const testPath = path.join(root, "tests", "settings-width-and-catalog-delete.test.js");

function replaceOnce(source, oldValue, newValue, label) {
  if (!source.includes(oldValue)) {
    throw new Error(`找不到待修正內容：${label}`);
  }
  console.log(`修正：${label}`);
  return source.replace(oldValue, newValue);
}

let components = fs.readFileSync(componentsPath, "utf8");

components = replaceOnce(
  components,
  "  --schedule-nav-control-height: var(--ui-control-height);\n",
  "  --schedule-nav-control-height: var(--ui-control-height);\n  --settings-drag-column-width: 30px;\n  --settings-action-column-width: 72px;\n",
  "設定表格共用欄寬變數"
);

components = replaceOnce(
  components,
  "  grid-template-columns: 30px 104px minmax(86px, .9fr) minmax(170px, 1.45fr) 64px 108px 84px 78px 76px;",
  "  grid-template-columns: var(--settings-drag-column-width) 104px minmax(86px, .9fr) minmax(170px, 1.45fr) 64px 108px 84px 78px var(--settings-action-column-width);",
  "人員設定欄寬使用共用變數"
);

components = replaceOnce(
  components,
  "  grid-template-columns: 30px minmax(76px, .55fr) minmax(96px, .65fr) minmax(64px, .42fr) minmax(280px, 2.7fr) minmax(92px, .62fr) minmax(68px, .45fr) minmax(72px, .45fr);",
  "  grid-template-columns: var(--settings-drag-column-width) minmax(76px, .55fr) minmax(96px, .65fr) minmax(64px, .42fr) minmax(280px, 2.7fr) minmax(92px, .62fr) minmax(68px, .45fr) var(--settings-action-column-width);",
  "班別設定欄寬使用共用變數"
);

components = replaceOnce(
  components,
  ".catalog-settings-modal .settings-table-row-leave,\n.catalog-settings-modal .settings-table-row-overtime {\n  grid-template-columns: 30px repeat(7, minmax(0, 1fr));\n}",
  ".catalog-settings-modal .settings-table-row-leave,\n.catalog-settings-modal .settings-table-row-overtime {\n  grid-template-columns: var(--settings-drag-column-width) repeat(6, minmax(0, 1fr)) var(--settings-action-column-width);\n}",
  "假別與加班設定欄寬使用共用變數"
);

components = replaceOnce(
  components,
  ".member-settings-modal .member-table {\n  width: max-content;\n  min-width: 100%;\n}",
  ".member-settings-modal .member-table {\n  width: 100%;\n  min-width: 0;\n}",
  "人員表格配合彈窗寬度"
);

components = replaceOnce(
  components,
  ".catalog-settings-modal .settings-table,\n.department-settings-modal .department-settings-table {\n  width: max-content;\n  min-width: 100%;\n}",
  ".catalog-settings-modal .settings-table {\n  width: 100%;\n  min-width: 0;\n}\n\n.department-settings-modal .department-settings-table {\n  width: max-content;\n  min-width: 100%;\n}",
  "目錄設定表格配合彈窗寬度"
);

components = replaceOnce(
  components,
  ".catalog-settings-modal .settings-table-row-shift {\n  min-width: 1040px;\n  grid-template-columns: 30px 120px 120px 90px minmax(300px, 1fr) 130px 90px 76px;\n}\n\n.catalog-settings-modal .settings-table-row-leave {\n  min-width: 880px;\n  grid-template-columns: 30px 130px 100px 150px 100px 100px 90px 76px;\n}\n\n.catalog-settings-modal .settings-table-row-overtime {\n  min-width: 1060px;\n  grid-template-columns: 30px 130px 150px 160px 160px 160px 90px 76px;\n}\n",
  ".catalog-settings-modal .settings-table-row > *,\n.member-settings-modal .member-table-row > * {\n  min-width: 0;\n}\n",
  "移除超過彈窗寬度的第二套固定欄寬"
);

components = replaceOnce(
  components,
  "    grid-template-columns: 30px 92px minmax(72px, .85fr) minmax(150px, 1.25fr) 54px 92px 72px 68px 70px;",
  "    grid-template-columns: var(--settings-drag-column-width) 92px minmax(72px, .85fr) minmax(150px, 1.25fr) 54px 92px 72px 68px var(--settings-action-column-width);",
  "中等寬度人員設定欄寬"
);

fs.writeFileSync(componentsPath, components);

let scheduleCss = fs.readFileSync(scheduleCssPath, "utf8");
if (!scheduleCss.includes("Desktop schedule width contract")) {
  scheduleCss = `${scheduleCss.trimEnd()}\n\n/* Desktop schedule width contract: keep the page within the viewport and\n * leave eight-week horizontal movement inside the synchronized table scrollers. */\n@media (min-width: 769px) {\n  .calendar-card {\n    max-width: 100%;\n    overflow-x: clip;\n  }\n\n  .calendar-nav,\n  .table-sticky-header,\n  .table-wrap {\n    min-width: 0;\n    max-width: 100%;\n  }\n\n  .table-top-scrollbar {\n    width: calc(100% - var(--schedule-frozen-width));\n    max-width: calc(100% - var(--schedule-frozen-width));\n  }\n}\n`;
  console.log("修正：班表外層寬度契約");
}
fs.writeFileSync(scheduleCssPath, scheduleCss);

let webApi = fs.readFileSync(webApiPath, "utf8");
webApi = replaceOnce(
  webApi,
  "  async function deleteCatalogItem(category, id) {\n    ensureManager();\n    return requestFunction(\"catalog-admin\", {\n      action: \"delete\",\n      category: String(category || \"\"),\n      id: String(id || \"\")\n    });\n  }",
  "  async function deleteCatalogItem(category, itemId) {\n    ensureManager();\n    return requestFunction(\"catalog-admin\", {\n      action: \"delete\",\n      category: String(category || \"\"),\n      itemId: String(itemId || \"\")\n    });\n  }",
  "目錄刪除 API 使用後端要求的 itemId"
);
fs.writeFileSync(webApiPath, webApi);

let catalogRenderer = fs.readFileSync(catalogRendererPath, "utf8");
const deleteStart = catalogRenderer.indexOf("async function deleteListItem(category, id)");
if (deleteStart < 0) throw new Error("找不到 deleteListItem");
let deleteBlock = catalogRenderer.slice(deleteStart);
deleteBlock = replaceOnce(deleteBlock, "\n  closeModal();\n  try {", "\n  try {", "刪除成功前不關閉設定視窗");
deleteBlock = replaceOnce(
  deleteBlock,
  '    setSaveStatus(`${labelMap[category] || "項目"}刪除失敗：${error.message || error}`);\n    renderAll();\n    openListSettings(category);\n    return;',
  '    setSaveStatus(`${labelMap[category] || "項目"}刪除失敗：${error.message || error}`);\n    return;',
  "刪除失敗保留目前畫面與資料"
);
catalogRenderer = catalogRenderer.slice(0, deleteStart) + deleteBlock;
fs.writeFileSync(catalogRendererPath, catalogRenderer);

let spec = fs.readFileSync(specPath, "utf8");
if (!spec.includes("## 班表與設定頁寬度、設定刪除穩定性")) {
  spec = `${spec.trimEnd()}\n\n## 班表與設定頁寬度、設定刪除穩定性\n\n- 電腦版班表頁的外層卡片不得撐寬瀏覽器頁面；八週班表超出可視區時，只能由班表內部的同步水平捲動區處理。\n- 電腦版人員設定、班別設定、假別設定及加班設定列表，欄位必須依彈出視窗可用寬度分配，不得設定大於彈出視窗的固定最小寬度。\n- 設定列表的拖曳欄與操作欄使用共用 CSS 變數；同一頁不得再加入第二套覆蓋欄寬。\n- 班別、假別、加班刪除 API 的請求格式固定為 \`{ action: \"delete\", category, itemId }\`，前端只有在後端刪除成功後才能移除本機資料。\n- 刪除失敗時保留目前設定清單與資料，不得先關閉視窗或先移除畫面資料。\n`;
  console.log("更新：規格書");
}
fs.writeFileSync(specPath, spec);

fs.writeFileSync(testPath, `const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("電腦版設定列表應配合彈窗寬度，不使用第二套固定最小寬度", () => {
  const css = read("src/renderer/css/components.css");
  assert.equal(css.includes("min-width: 1040px"), false);
  assert.equal(css.includes("min-width: 880px"), false);
  assert.equal(css.includes("min-width: 1060px"), false);
  assert.match(css, /\\.member-settings-modal \\.member-table \\{[\\s\\S]*?width: 100%;[\\s\\S]*?min-width: 0;/);
  assert.match(css, /\\.catalog-settings-modal \\.settings-table \\{[\\s\\S]*?width: 100%;[\\s\\S]*?min-width: 0;/);
  assert.equal((css.match(/\\.catalog-settings-modal \\.settings-table-row-shift \\{/g) || []).length, 1);
  assert.equal(css.includes("--settings-drag-column-width: 30px"), true);
  assert.equal(css.includes("--settings-action-column-width: 72px"), true);
});

test("班表頁外層寬度固定在頁面內，水平移動留在表格捲動區", () => {
  const css = read("src/renderer/css/schedule.css");
  assert.equal(css.includes("Desktop schedule width contract"), true);
  assert.equal(css.includes("overflow-x: clip"), true);
  assert.equal(css.includes("width: calc(100% - var(--schedule-frozen-width))"), true);
});

test("班別假別加班刪除的前後端參數名稱一致", () => {
  const webApi = read("src/renderer/web-api.js");
  const backend = read("supabase/functions/catalog-admin/index.ts");
  const start = webApi.indexOf("async function deleteCatalogItem");
  const end = webApi.indexOf("async function resolveManagerMemberProfileId", start);
  const block = webApi.slice(start, end);
  assert.equal(block.includes('itemId: String(itemId || "")'), true);
  assert.equal(block.includes("id: String("), false);
  assert.equal(backend.includes("body?.itemId"), true);
});

test("設定刪除失敗時不得先關閉視窗或先移除本機資料", () => {
  const source = read("src/renderer/renderer-settings-catalog.js");
  const start = source.indexOf("async function deleteListItem");
  const block = source.slice(start);
  const requestPosition = block.indexOf("await window.schedulerApi.deleteCatalogItem");
  const statePosition = block.indexOf("state.shifts =", requestPosition);
  assert.ok(requestPosition >= 0);
  assert.ok(statePosition > requestPosition);
  assert.equal(block.slice(0, requestPosition).includes("closeModal()"), false);
  assert.equal(block.slice(requestPosition, statePosition).includes("openListSettings(category)"), false);
});
`);
console.log("新增：設定欄寬與刪除回歸測試");
console.log("設定欄寬與刪除流程已修正");
