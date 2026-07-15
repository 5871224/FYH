const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

function replaceOnce(file, before, after) {
  const source = fs.readFileSync(file, "utf8");
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`找不到預期區塊：${file}`);
  fs.writeFileSync(file, source.replace(before, after), "utf8");
}

const mainPagesPath = "src/renderer/renderer-main-pages.js";
const mealPagePath = "src/renderer/renderer-meal-page.js";
const testPath = "tests/renderer-meal-consolidation.test.js";
const specPath = "規格書.md";

replaceOnce(
  mainPagesPath,
  `  const orders = status?.orders || [];
  const orderQuantityMap = new Map(orders.map((item) => [item.product_id, Number(item.quantity || 0)]));
  const orderNoteMap = new Map(orders.map((item) => [item.product_id, item.note || ""]));`,
  `  const orders = status?.orders || [];
  const pendingItems = Array.isArray(mealOrderState.pendingItems) ? mealOrderState.pendingItems : null;
  const orderQuantityMap = pendingItems
    ? new Map(pendingItems.map((item) => [item.productId, Number(item.quantity || 0)]))
    : new Map(orders.map((item) => [item.product_id, Number(item.quantity || 0)]));
  const orderNoteMap = pendingItems
    ? new Map(pendingItems.map((item) => [item.productId, item.note || ""]))
    : new Map(orders.map((item) => [item.product_id, item.note || ""]));`
);

replaceOnce(
  mealPagePath,
  `    mealOrderState = { ...mealOrderState, loading: true, error: "" };
    renderAll();`,
  `    // 儲存期間重新渲染時沿用本次輸入，避免成功提示出現前欄位跳回舊值。
    mealOrderState = { ...mealOrderState, loading: true, error: "", pendingItems: items };
    renderAll();`
);

replaceOnce(
  mealPagePath,
  `      mealOrderState = { loading: false, status, error: "" };`,
  `      mealOrderState = { loading: false, status, error: "", pendingItems: null };`
);

const testName = "儲存訂餐重新渲染時應保留剛輸入的數量與備註";
const testSource = fs.readFileSync(testPath, "utf8");
if (!testSource.includes(testName)) {
  fs.writeFileSync(testPath, `${testSource.trimEnd()}\n\ntest("${testName}", () => {\n  const mainPages = read("src/renderer/renderer-main-pages.js");\n  const mealPage = read("src/renderer/renderer-meal-page.js");\n  assert.match(mainPages, /Array\\.isArray\\(mealOrderState\\.pendingItems\\)/);\n  assert.match(mainPages, /pendingItems\\.map\\(\\(item\\) => \\[item\\.productId, Number\\(item\\.quantity \\|\\| 0\\)\\]\\)/);\n  assert.match(mainPages, /pendingItems\\.map\\(\\(item\\) => \\[item\\.productId, item\\.note \\|\\| ""\\]\\)/);\n  assert.match(mealPage, /pendingItems:\\s*items/);\n  assert.match(mealPage, /pendingItems:\\s*null/);\n});\n`, "utf8");
}

const specRule = "- 今日訂餐按下「儲存訂餐」後，儲存中與成功提示顯示期間必須保留本次輸入的數量及備註，不得先跳回未儲存前的值。";
const specSource = fs.readFileSync(specPath, "utf8");
if (!specSource.includes(specRule)) {
  fs.writeFileSync(specPath, `${specSource.trimEnd()}\n\n${specRule}\n`, "utf8");
}

const officialWorkflow = execFileSync("git", ["show", "origin/main:.github/workflows/deploy-pages.yml"], { encoding: "utf8" });
fs.writeFileSync(".github/workflows/deploy-pages.yml", officialWorkflow, "utf8");

const obsoleteWorkflow = ".github/workflows/preserve-meal-order-inputs.yml";
if (fs.existsSync(obsoleteWorkflow)) fs.rmSync(obsoleteWorkflow);

console.log("Meal order input preservation changes prepared.");
