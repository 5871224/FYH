const fs = require("node:fs");

const read = (file) => fs.readFileSync(file, "utf8");
const write = (file, content) => fs.writeFileSync(file, content, "utf8");

function replaceOnce(file, before, after) {
  const source = read(file);
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`找不到預期區塊：${file}`);
  write(file, source.replace(before, after));
}

function replaceSection(file, startMarker, endMarker, replacement) {
  const source = read(file);
  if (source.includes(replacement.trim())) return;
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`找不到預期區段：${file}`);
  write(file, `${source.slice(0, start)}${replacement.trimEnd()}\n\n${source.slice(end)}`);
}

replaceOnce(
  "src/renderer/renderer-main-pages.js",
  `      <div class="meal-tabs">
        <button class="ghost-btn compact-btn \${mealPageTab === "order" ? "active" : ""}" type="button" data-meal-tab="order">今日訂餐</button>
        <button class="ghost-btn compact-btn \${mealPageTab === "stats" ? "active" : ""}" type="button" data-meal-tab="stats">訂餐統計</button>
        <button class="ghost-btn compact-btn \${mealPageTab === "settings" ? "active" : ""}" type="button" data-meal-tab="settings">訂餐設定</button>
      </div>`,
  `      <div class="meal-tabs" role="tablist" aria-label="訂餐頁分頁">
        <button class="ghost-btn page-tab-btn \${mealPageTab === "order" ? "active" : ""}" type="button" role="tab" aria-selected="\${mealPageTab === "order" ? "true" : "false"}" data-meal-tab="order">今日訂餐</button>
        <button class="ghost-btn page-tab-btn \${mealPageTab === "stats" ? "active" : ""}" type="button" role="tab" aria-selected="\${mealPageTab === "stats" ? "true" : "false"}" data-meal-tab="stats">訂餐統計</button>
        <button class="ghost-btn page-tab-btn \${mealPageTab === "settings" ? "active" : ""}" type="button" role="tab" aria-selected="\${mealPageTab === "settings" ? "true" : "false"}" data-meal-tab="settings">訂餐設定</button>
      </div>`
);

replaceOnce(
  "src/renderer/renderer-records-views.js",
  `    return \`<div class="record-tabs">\${tabs.map(([id, label]) => \`<button class="ghost-btn compact-btn \${recordsState.activeTab === id ? "active" : ""}" type="button" data-records-tab="\${id}">\${label}</button>\`).join("")}</div>\`;`,
  `    return \`<div class="record-tabs" role="tablist" aria-label="記錄頁分頁">\${tabs.map(([id, label]) => \`<button class="ghost-btn page-tab-btn \${recordsState.activeTab === id ? "active" : ""}" type="button" role="tab" aria-selected="\${recordsState.activeTab === id ? "true" : "false"}" data-records-tab="\${id}">\${label}</button>\`).join("")}</div>\`;`
);

replaceOnce(
  "src/renderer/css/foundation.css",
  `.meal-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 10px 0 16px;
}

.meal-tabs .active {
  background: #8b6f47;
  color: #fff;
}`,
  `.meal-tabs {
  display: flex;
  flex-wrap: nowrap;
  align-items: flex-end;
  gap: 4px;
  margin: 10px 0 16px;
  overflow-x: auto;
  overflow-y: hidden;
  overscroll-behavior-inline: contain;
}`
);

replaceOnce(
  "src/renderer/css/foundation.css",
  `.record-tabs,
.records-filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin: 12px 0;
}

.record-tabs .active {
  background: #8b6f47;
  color: #fff;
}`,
  `.record-tabs {
  display: flex;
  flex-wrap: nowrap;
  align-items: flex-end;
  gap: 4px;
  margin: 12px 0;
  overflow-x: auto;
  overflow-y: hidden;
  overscroll-behavior-inline: contain;
}

.records-filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin: 12px 0;
}`
);

replaceSection(
  "src/renderer/css/components.css",
  "/* Tabs share the same active and hover treatment. */",
  "/* Page cards and sections use a consistent radius scale. */",
  `/* Meal and record pages use a Chrome-inspired tab strip in the existing warm palette. */
.meal-tabs,
.record-tabs {
  position: relative;
  isolation: isolate;
  padding: 6px 8px 0;
  border: 1px solid rgba(156, 107, 47, 0.18);
  border-radius: 16px 16px 0 0;
  background: linear-gradient(180deg, rgba(239, 226, 200, 0.78), rgba(255, 255, 255, 0.46));
  box-shadow: inset 0 -1px 0 var(--ui-border);
  scrollbar-width: thin;
  scrollbar-color: rgba(156, 107, 47, 0.35) transparent;
}

.meal-tabs .page-tab-btn,
.record-tabs .page-tab-btn {
  flex: 0 0 auto;
  min-height: var(--ui-control-height);
  margin: 0 0 -1px;
  padding: 0 18px;
  border: 1px solid transparent;
  border-bottom-color: var(--ui-border);
  border-radius: 14px 14px 0 0 !important;
  background: rgba(255, 253, 248, 0.38);
  color: var(--ui-muted);
  box-shadow: none;
  font-size: 15px;
  font-weight: 800;
  transform: none;
}

.meal-tabs .page-tab-btn:not(:disabled):hover,
.record-tabs .page-tab-btn:not(:disabled):hover {
  background: var(--ui-surface-hover);
  color: var(--ui-text);
  box-shadow: none;
  transform: none;
}

.meal-tabs .page-tab-btn.active,
.record-tabs .page-tab-btn.active {
  z-index: 1;
  border-color: var(--ui-border);
  border-bottom-color: var(--ui-surface);
  background: var(--ui-surface);
  color: var(--ui-accent-strong);
  box-shadow: inset 0 3px 0 rgba(156, 107, 47, 0.58), 0 -3px 10px rgba(72, 52, 31, 0.08);
}

.meal-tabs .page-tab-btn:focus-visible,
.record-tabs .page-tab-btn:focus-visible {
  z-index: 2;
  outline: none;
  box-shadow: var(--ui-focus-ring);
}

.records-section > h2 {
  margin-bottom: 12px;
  font-size: 18px;
  line-height: 1.3;
}

.settings-view-option.active {
  background: var(--ui-accent);
  color: #fff;
  border-color: var(--ui-accent);
}`
);

replaceOnce(
  "src/renderer/css/responsive.css",
  `  /* 今天日期沿用全裝置共用的微亮藍色提示，避免手機版另行覆蓋。 */`,
  `  /* 訂餐與記錄頁籤在手機維持單列，超出寬度時於籤頁列內水平滑動。 */
  .meal-tabs,
  .record-tabs {
    padding-inline: 4px;
    scroll-snap-type: x proximity;
  }

  .meal-tabs .page-tab-btn,
  .record-tabs .page-tab-btn {
    min-height: 42px;
    padding-inline: 16px;
    scroll-snap-align: start;
  }

  /* 今天日期沿用全裝置共用的微亮藍色提示，避免手機版另行覆蓋。 */`
);

const testPath = "tests/css-consolidation.test.js";
const testName = "訂餐與記錄頁使用 Chrome 式共用籤頁";
let tests = read(testPath);
if (!tests.includes(testName)) {
  tests = `${tests.trimEnd()}\n\ntest("${testName}", () => {\n  const foundation = read("src/renderer/css/foundation.css");\n  const components = read("src/renderer/css/components.css");\n  const responsive = read("src/renderer/css/responsive.css");\n  const mealPage = read("src/renderer/renderer-main-pages.js");\n  const recordsView = read("src/renderer/renderer-records-views.js");\n  assert.match(foundation, /\\.meal-tabs \\{[^}]*flex-wrap:\\s*nowrap;[^}]*overflow-x:\\s*auto;/s);\n  assert.match(foundation, /\\.record-tabs \\{[^}]*flex-wrap:\\s*nowrap;[^}]*overflow-x:\\s*auto;/s);\n  assert.match(components, /\\.meal-tabs \\.page-tab-btn,[\\s\\S]*border-radius:\\s*14px 14px 0 0 !important;/);\n  assert.match(components, /\\.meal-tabs \\.page-tab-btn\\.active,[\\s\\S]*border-bottom-color:\\s*var\\(--ui-surface\\);[\\s\\S]*color:\\s*var\\(--ui-accent-strong\\);/);\n  assert.match(responsive, /\\.meal-tabs,[\\s\\S]*\\.record-tabs \\{[^}]*scroll-snap-type:\\s*x proximity;/s);\n  assert.match(mealPage, /class="meal-tabs" role="tablist" aria-label="訂餐頁分頁"/);\n  assert.match(mealPage, /class="ghost-btn page-tab-btn/);\n  assert.match(recordsView, /class="record-tabs" role="tablist" aria-label="記錄頁分頁"/);\n  assert.match(recordsView, /role="tab" aria-selected=/);\n});\n`;
  write(testPath, tests);
}

replaceOnce(
  "規格書.md",
  `1. 訂餐與紀錄頁使用相同頁籤結構。
2. 選取頁籤使用主操作色背景與白色文字。
3. 訂餐與紀錄頁的膠囊頁籤文字統一為 15px、粗體 800。
4. 手機版頁籤外距與內距使用 4px 至 8px 的緊密規格。
5. 頁籤切換不得改變整列高度。`,
  `1. 訂餐與紀錄頁使用相同的瀏覽器籤頁式結構，視覺參考 Chrome 上方籤頁，但配色、邊框、陰影與字體沿用本系統暖色風格。
2. 頁籤列使用淡暖色底與底部分隔線；籤頁為上方圓角、下方直角，呈現可切換子頁面的層次，不再使用膠囊外觀。
3. 選取頁籤使用內容表面色、主色文字及頂部細主色提示，並以底邊與籤頁列銜接；未選取頁籤使用較淡文字與半透明背景。
4. 訂餐與紀錄頁籤文字統一為 15px、粗體 800，按鈕高度不得因切換而改變。
5. 頁籤列固定單行顯示，不得將籤頁壓縮或自動換行；寬度不足時僅在籤頁列內水平滑動。
6. 手機版籤頁觸控高度不得低於 42px，並支援橫向滑動與捲動定位。
7. 籤頁容器使用 \`role="tablist"\`，各籤頁使用 \`role="tab"\` 與正確的 \`aria-selected\` 狀態。`
);

console.log("Browser-style page tabs prepared.");
