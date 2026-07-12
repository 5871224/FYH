const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const componentsPath = path.join(root, "src", "renderer", "css", "components.css");
const scheduleCssPath = path.join(root, "src", "renderer", "css", "schedule.css");
const webApiPath = path.join(root, "src", "renderer", "web-api.js");
const catalogRendererPath = path.join(root, "src", "renderer", "renderer-settings-catalog.js");
const specPath = path.join(root, "規格書.md");
const testPath = path.join(root, "tests", "settings-width-and-catalog-delete.test.js");

function replaceRequired(source, oldValue, newValue, label) {
  if (!source.includes(oldValue)) {
    throw new Error(`找不到待修正內容：${label}`);
  }
  return source.replace(oldValue, newValue);
}

let components = fs.readFileSync(componentsPath, "utf8");

components = replaceRequired(
  components,
` .member-settings-modal .member-table-row {
   grid-template-columns: 30px 104px minmax(86px, .9fr) minmax(170px, 1.45fr) 64px 108px 84px 78px 76px;
 }`.trimStart(),
` .catalog-settings-modal,
 .member-settings-modal {
   --settings-drag-column-width: 30px;
   --settings-action-column-width: 72px;
 }

 .member-settings-modal .member-table-row {
   grid-template-columns: var(--settings-drag-column-width) 90px minmax(70px, .85fr) minmax(140px, 1.45fr) 56px 96px 72px 68px var(--settings-action-column-width);
 }`.trimStart(),
  "人員設定欄寬"
);

components = components.replace(
/\.catalog-settings-modal \.settings-table-row-shift \{\n\s*grid-template-columns:[^}]+\}\n\n\.catalog-settings-modal \.settings-table-row-leave,\n\.catalog-settings-modal \.settings-table-row-overtime \{\n\s*grid-template-columns:[^}]+\}\n\n/,
""
);

components = replaceRequired(
  components,
` .member-settings-modal .member-table {
   width: max-content;
   min-width: 100%;
 }`.trimStart(),
` .member-settings-modal .member-table {
   width: 100%;
   min-width: 0;
 }`.trimStart(),
  "人員表格寬度模式"
);

components = replaceRequired(
  components,
` .catalog-settings-modal .settings-table,
 .department-settings-modal .department-settings-table {
   width: max-content;
   min-width: 100%;
 }`.trimStart(),
` .catalog-settings-modal .settings-table {
   width: 100%;
   min-width: 0;
 }

 .department-settings-modal .department-settings-table {
   width: max-content;
   min-width: 100%;
 }`.trimStart(),
  "設定表格寬度模式"
);

components = replaceRequired(
  components,
` .catalog-settings-modal .settings-table-row-shift {
   min-width: 1040px;
   grid-template-columns: 30px 120px 120px 90px minmax(300px, 1fr) 130px 90px 76px;
 }

 .catalog-settings-modal .settings-table-row-leave {
   min-width: 880px;
   grid-template-columns: 30px 130px 100px 150px 100px 100px 90px 76px;
 }

 .catalog-settings-modal .settings-table-row-overtime {
   min-width: 1060px;
   grid-template-columns: 30px 130px 150px 160px 160px 160px 90px 76px;
 }`.trimStart(),
` .catalog-settings-modal .settings-table-row-shift {
   grid-template-columns: var(--settings-drag-column-width) minmax(72px, .55fr) minmax(88px, .65fr) 64px minmax(0, 2.7fr) 92px 68px var(--settings-action-column-width);
 }

 .catalog-settings-modal .settings-table-row-leave {
   grid-template-columns: var(--settings-drag-column-width) minmax(78px, .8fr) 72px minmax(90px, 1fr) 72px 72px 64px var(--settings-action-column-width);
 }

 .catalog-settings-modal .settings-table-row-overtime {
   grid-template-columns: var(--settings-drag-column-width) minmax(78px, .8fr) minmax(88px, .9fr) minmax(112px, 1.15fr) minmax(100px, 1fr) minmax(100px, 1fr) 64px var(--settings-action-column-width);
 }

 .catalog-settings-modal .settings-table-row > *,
 .member-settings-modal .member-table-row > * {
   min-width: 0;
 }`.trimStart(),
  "班別假別加班固定最小寬度"
);

components = replaceRequired(
  components,
` @media (max-width: 900px) {
   .member-settings-modal .member-table-row {
     grid-template-columns: 30px 92px minmax(72px, .85fr) minmax(150px, 1.25fr) 54px 92px 72px 68px 70px;
   }
 }`.trimStart(),
` @media (max-width: 900px) {
   .member-settings-modal .member-table-row {
     grid-template-columns: var(--settings-drag-column-width) 82px minmax(64px, .8fr) minmax(126px, 1.25fr) 50px 82px 66px 62px var(--settings-action-column-width);
   }
 }`.trimStart(),
  "中等寬度人員欄位"
);

fs.writeFileSync(componentsPath, components);

let scheduleCss = fs.readFileSync(scheduleCssPath, "utf8");
const scheduleContract = `

/* Desktop width contract: the page itself never becomes wider than the viewport;
 * the eight-week schedule keeps its horizontal movement inside the synchronized table scrollers. */
@media (min-width: 769px) {
  .calendar-card {
    max-width: 100%;
    overflow-x: clip;
  }

  .calendar-nav,
  .table-sticky-header,
  .table-wrap {
    min-width: 0;
    max-width: 100%;
  }

  .table-top-scrollbar {
    width: calc(100% - var(--schedule-frozen-width));
    max-width: calc(100% - var(--schedule-frozen-width));
  }
}
`;
if (!scheduleCss.includes("Desktop width contract")) {
  scheduleCss = scheduleCss.trimEnd() + scheduleContract;
}
fs.writeFileSync(scheduleCssPath, scheduleCss);

let webApi = fs.readFileSync(webApiPath, "utf8");
webApi = replaceRequired(
  webApi,
`  async function deleteCatalogItem(category, id) {
    ensureManager();
    return requestFunction("catalog-admin", {
      action: "delete",
      category: String(category || ""),
      id: String(id || "")
    });
  }`,
`  async function deleteCatalogItem(category, itemId) {
    ensureManager();
    return requestFunction("catalog-admin", {
      action: "delete",
      category: String(category || ""),
      itemId: String(itemId || "")
    });
  }`,
  "設定刪除 API 參數"
);
fs.writeFileSync(webApiPath, webApi);

let catalogRenderer = fs.readFileSync(catalogRendererPath, "utf8");
catalogRenderer = replaceRequired(
  catalogRenderer,
`  closeModal();
  try {
    await window.schedulerApi.deleteCatalogItem(category, id);
  } catch (error) {
    setSaveStatus(\`${"${labelMap[category] || \"項目\"}"}刪除失敗：${"${error.message || error}"}\`);
    renderAll();
    openListSettings(category);
    return;
  }`,
`  try {
    await window.schedulerApi.deleteCatalogItem(category, id);
  } catch (error) {
    setSaveStatus(\`${"${labelMap[category] || \"項目\"}"}刪除失敗：${"${error.message || error}"}\`);
    return;
  }`,
  "刪除失敗保留目前設定清單"
);
fs.writeFileSync(catalogRendererPath, catalogRenderer);

let spec = fs.readFileSync(specPath, "utf8");
const specSection = `

## 班表與設定頁寬度、設定刪除穩定性

- 電腦版班表頁的外層卡片不得撐寬瀏覽器頁面；八週班表超出可視區時，只能由班表內部的同步水平捲動區處理。
- 電腦版人員設定、班別設定、假別設定及加班設定列表，欄位必須依視窗可用寬度分配，不得設定大於彈出視窗的固定最小寬度。
- 設定列表的拖曳欄與操作欄使用共用 CSS 變數；同一頁不得同時存在兩套互相覆蓋的欄寬規則。
- 班別、假別、加班刪除 API 的請求格式固定為 \`{ action: "delete", category, itemId }\`，前端只有在後端刪除成功後才能移除本機資料。
- 刪除失敗時保留目前設定清單與資料，不得先關閉視窗或先移除畫面資料。
`;
if (!spec.includes("## 班表與設定頁寬度、設定刪除穩定性")) {
  spec = spec.trimEnd() + specSection + "\n";
}
fs.writeFileSync(specPath, spec);

fs.writeFileSync(testPath, `const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("電腦版設定列表應配合視窗寬度而非強制水平捲動", () => {
  const css = read("src/renderer/css/components.css");
  assert.equal(css.includes("min-width: 1040px"), false);
  assert.equal(css.includes("min-width: 880px"), false);
  assert.equal(css.includes("min-width: 1060px"), false);
  assert.match(css, /\\.member-settings-modal \\.member-table \\{[\\s\\S]*?width: 100%;[\\s\\S]*?min-width: 0;/);
  assert.match(css, /\\.catalog-settings-modal \\.settings-table \\{[\\s\\S]*?width: 100%;[\\s\\S]*?min-width: 0;/);
  assert.equal((css.match(/\\.catalog-settings-modal \\.settings-table-row-shift \\{/g) || []).length, 1);
  assert.equal(css.includes("--settings-drag-column-width"), true);
  assert.equal(css.includes("--settings-action-column-width"), true);
});

test("班表外層寬度應固定在頁面內，水平移動留在表格捲動區", () => {
  const css = read("src/renderer/css/schedule.css");
  assert.equal(css.includes(".calendar-card"), true);
  assert.equal(css.includes("overflow-x: clip"), true);
  assert.equal(css.includes("width: calc(100% - var(--schedule-frozen-width))"), true);
});

test("班別假別加班刪除前後端參數名稱必須一致", () => {
  const webApi = read("src/renderer/web-api.js");
  const backend = read("supabase/functions/catalog-admin/index.ts");
  const start = webApi.indexOf("async function deleteCatalogItem");
  const end = webApi.indexOf("async function resolveManagerMemberProfileId", start);
  const block = webApi.slice(start, end);
  assert.equal(block.includes("itemId: String(itemId || \"\")"), true);
  assert.equal(block.includes("id: String("), false);
  assert.equal(backend.includes("body?.itemId"), true);
});

test("設定刪除失敗時不得先關閉或移除畫面資料", () => {
  const source = read("src/renderer/renderer-settings-catalog.js");
  const start = source.indexOf("async function deleteListItem");
  const block = source.slice(start);
  const requestPosition = block.indexOf("await window.schedulerApi.deleteCatalogItem");
  const closePosition = block.indexOf("closeModal()");
  assert.ok(requestPosition >= 0);
  assert.equal(closePosition >= 0 && closePosition < requestPosition, false);
  assert.ok(block.indexOf("state.shifts =", requestPosition) > requestPosition);
});
`);

console.log("設定欄寬與刪除流程已修正");
