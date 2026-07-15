const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(file, "utf8");
const write = (file, content) => fs.writeFileSync(file, content, "utf8");

function replaceOnce(file, before, after) {
  const source = read(file);
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`找不到預期區塊：${file}`);
  write(file, source.replace(before, after));
}

const mainPages = "src/renderer/renderer-main-pages.js";
replaceOnce(
  mainPages,
  `    \${attendanceState.saving ? '<p class="clock-loading">處理中，請稍候...</p>' : attendanceState.loading ? '<p class="clock-loading">讀取資料中...</p>' : ""}`,
  `    \${attendanceState.loading && !attendanceState.saving ? '<p class="clock-loading">讀取資料中...</p>' : ""}`
);
replaceOnce(
  mainPages,
  `  const products = status?.products || [];\n  const orders = status?.orders || [];`,
  `  const products = status?.products || [];\n  const showEmptyProducts = Boolean(status) && !mealOrderState.loading && products.length === 0;\n  const orders = status?.orders || [];`
);
replaceOnce(
  mainPages,
  `    \${isManager() && mealPageTab === "settings" ? renderMealSettingsSection() : isManager() && mealPageTab === "stats" ? renderMealReportSection() : \`\n    \${mealOrderState.error`,
  `    \${isManager() && mealPageTab === "settings" ? renderMealSettingsSection() : isManager() && mealPageTab === "stats" ? renderMealReportSection() : \`\n    <section class="records-section meal-order-section">\n      <h2>今日訂餐</h2>\n      \${mealOrderState.error`
);
replaceOnce(
  mainPages,
  `    \` : '<div class="empty-state">目前沒有可訂購的商品</div>'}\n    \${mealOrderState.loading ? '<p class="clock-loading">處理中，請稍候...</p>' : ""}\n    \`}`,
  `    \` : showEmptyProducts ? '<div class="empty-state">目前沒有可訂購的商品</div>' : ""}\n    </section>\n    \`}`
);

const recordsViews = "src/renderer/renderer-records-views.js";
replaceOnce(
  recordsViews,
  `      <div class="meal-stats-grid"><div><strong>\${Number(report.totals?.quantity || 0)}</strong><span>總數量</span></div><div><strong>$\${Number(report.totals?.amount || 0).toFixed(0)}</strong><span>總金額</span></div></div>`,
  `      <div class="meal-stats-grid"><div><span>總數量</span><strong>\${Number(report.totals?.quantity || 0)}</strong></div><div><span>總金額</span><strong>$ \${Number(report.totals?.amount || 0).toFixed(0)}</strong></div></div>`
);

const foundation = "src/renderer/css/foundation.css";
replaceOnce(
  foundation,
  `.app-shell {\n  display: flex;\n  flex-direction: column;`,
  `.app-shell {\n  display: flex;\n  flex-direction: column;\n  justify-content: flex-start;`
);
for (const view of ["home", "clock", "meal", "records"]) {
  replaceOnce(
    foundation,
    `body.is-${view}-view .app-shell {\n  justify-content: center;`,
    `body.is-${view}-view .app-shell {\n  justify-content: flex-start;`
  );
}
replaceOnce(
  foundation,
  `.meal-stats-grid {\n  display: grid;\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n  gap: 10px;\n}\n\n.meal-stats-grid > div {\n  padding: 14px;\n  border-radius: 18px;\n  background: #fff;\n  border: 1px solid rgba(166, 143, 111, 0.18);\n}\n\n.meal-stats-grid strong,\n.meal-stats-grid span {\n  display: block;\n}\n\n.meal-stats-grid span {\n  margin-top: 6px;\n  color: var(--muted);\n}`,
  `.meal-stats-grid {\n  display: grid;\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n  gap: 10px;\n  margin-bottom: 16px;\n}\n\n.meal-stats-grid > div {\n  display: flex;\n  align-items: baseline;\n  gap: 10px;\n  min-width: 0;\n  padding: 14px;\n  border-radius: 18px;\n  background: #fff;\n  border: 1px solid rgba(166, 143, 111, 0.18);\n  white-space: nowrap;\n}\n\n.meal-stats-grid strong,\n.meal-stats-grid span {\n  display: inline;\n}\n\n.meal-stats-grid span {\n  margin: 0;\n  color: var(--muted);\n}`
);

const mealTest = "tests/renderer-meal-consolidation.test.js";
const mealTestSource = read(mealTest);
if (!mealTestSource.includes("今日訂餐完成讀取後才顯示空商品提示")) {
  write(mealTest, `${mealTestSource.trimEnd()}\n\ntest("今日訂餐完成讀取後才顯示空商品提示，且不顯示處理中文字", () => {\n  const mainPages = read("src/renderer/renderer-main-pages.js");\n  assert.match(mainPages, /const showEmptyProducts = Boolean\\(status\\) && !mealOrderState\\.loading && products\\.length === 0;/);\n  assert.match(mainPages, /<section class="records-section meal-order-section">/);\n  assert.match(mainPages, /showEmptyProducts \\? '<div class="empty-state">目前沒有可訂購的商品<\\/div>' : ""/);\n  assert.doesNotMatch(mainPages, /處理中，請稍候/);\n});\n`, "utf8");
}

const cssTest = "tests/css-consolidation.test.js";
const cssTestSource = read(cssTest);
if (!cssTestSource.includes("電腦版主要頁面靠上且訂餐統計總計維持單行")) {
  write(cssTest, `${cssTestSource.trimEnd()}\n\ntest("電腦版主要頁面靠上且訂餐統計總計維持單行", () => {\n  const foundation = read("src/renderer/css/foundation.css");\n  const recordsView = read("src/renderer/renderer-records-views.js");\n  assert.match(foundation, /\\.app-shell \\{[^}]*justify-content:\\s*flex-start;/s);\n  for (const view of ["home", "clock", "meal", "records"]) {\n    assert.match(foundation, new RegExp(`body\\.is-${view}-view \\.app-shell \\{[^}]*justify-content:\\s*flex-start;`, "s"));\n  }\n  assert.doesNotMatch(foundation, /body\\.is-(?:home|clock|meal|records)-view \\.app-shell \\{[^}]*justify-content:\\s*center;/s);\n  assert.match(foundation, /\\.meal-stats-grid \\{[^}]*margin-bottom:\\s*16px;/s);\n  assert.match(foundation, /\\.meal-stats-grid > div \\{[^}]*display:\\s*flex;[^}]*white-space:\\s*nowrap;/s);\n  assert.match(foundation, /\\.meal-stats-grid strong,[\\s\\S]*\\.meal-stats-grid span \\{[^}]*display:\\s*inline;/s);\n  assert.match(recordsView, /<span>總數量<\\/span><strong>\\$\\{Number\\(report\\.totals\\?\\.quantity/);\n  assert.match(recordsView, /<span>總金額<\\/span><strong>\\$ \\$\\{Number\\(report\\.totals\\?\\.amount/);\n});\n`, "utf8");
}

const spec = "規格書.md";
replaceOnce(
  spec,
  `14. 歷史訂單保存下訂時商品名稱、單價、員工與單位快照。`,
  `14. 歷史訂單保存下訂時商品名稱、單價、員工與單位快照。\n15. 今日訂餐內容使用與訂餐設定相同的單一內容區，標題、訊息、商品表格及儲存列都放在該內容區內。\n16. 今日訂餐資料尚未讀取完成時，不得暫時顯示「目前沒有可訂購的商品」；只有後端成功回傳且商品清單確定為空時才顯示。\n17. 今日訂餐載入與儲存期間不顯示「處理中，請稍候」文字。`
);
replaceOnce(
  spec,
  `4. 頁面顯示期間總數量與期間總金額。`,
  `4. 頁面顯示期間總數量與期間總金額；兩個區塊都使用「標題＋數值」單行排列，例如「總數量  4」與「總金額  $ 430」，不得將標題與數值上下換行，並與下方表格保留適當間距。`
);
replaceOnce(
  spec,
  `## 6.3 共用尺寸與間距`,
  `## 6.3 共用尺寸與間距\n\n- 電腦版所有主要頁面的外層內容一律由可視區上方開始排列，不使用垂直置中；手機版維持既有靠上規則。`
);

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}
const remainingProcessingText = walk("src/renderer")
  .filter((file) => file.endsWith(".js"))
  .filter((file) => read(file).includes("處理中，請稍候"));
if (remainingProcessingText.length) {
  throw new Error(`仍有處理中文字：${remainingProcessingText.join(", ")}`);
}

console.log("Meal page polish prepared.");
