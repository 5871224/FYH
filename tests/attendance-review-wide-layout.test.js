const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("簽到審核使用寬版容器、整齊篩選列與完整操作欄", () => {
  const foundation = read("src/renderer/css/foundation.css");
  const pages = read("src/renderer/css/pages.css");
  const spec = read("規格書.md");

  assert.match(foundation, /\.records-card \{[\s\S]*width: min\(1280px, 100%\)/);
  assert.match(foundation, /body\.is-records-view \.app-shell \{[\s\S]*padding-right: 12px;[\s\S]*padding-left: 12px/);
  assert.match(pages, /\.attendance-review-filters \{[\s\S]*grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(pages, /\.attendance-review-actions \{[\s\S]*justify-content: flex-end/);
  assert.match(pages, /\.attendance-review-operation-col \{[\s\S]*width: 112px;[\s\S]*white-space: nowrap/);
  assert.match(pages, /\.attendance-review-row-actions \{[\s\S]*flex-wrap: nowrap/);
  assert.match(pages, /\.attendance-review-action-btn \{[\s\S]*flex: 0 0 30px/);
  assert.match(spec, /功能按鈕另列靠右排列/);
  assert.match(spec, /三個 SVG 圖示固定同一列顯示/);
});
