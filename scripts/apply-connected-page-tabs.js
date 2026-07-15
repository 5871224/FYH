const fs = require("node:fs");

const read = (file) => fs.readFileSync(file, "utf8");
const write = (file, content) => fs.writeFileSync(file, content, "utf8");

function replaceOnce(file, before, after) {
  const source = read(file);
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`找不到預期區塊：${file}`);
  write(file, source.replace(before, after));
}

replaceOnce(
  "src/renderer/css/foundation.css",
  `  margin: 10px 0 16px;\n  overflow-x: auto;`,
  `  margin: 10px 0 0;\n  overflow-x: auto;`
);

replaceOnce(
  "src/renderer/css/foundation.css",
  `  margin: 12px 0;\n  overflow-x: auto;`,
  `  margin: 12px 0 0;\n  overflow-x: auto;`
);

replaceOnce(
  "src/renderer/css/components.css",
  `.meal-tabs .page-tab-btn:focus-visible,\n.record-tabs .page-tab-btn:focus-visible {\n  z-index: 2;\n  outline: none;\n  box-shadow: var(--ui-focus-ring);\n}\n\n.records-section > h2 {`,
  `.meal-tabs .page-tab-btn:focus-visible,\n.record-tabs .page-tab-btn:focus-visible {\n  z-index: 2;\n  outline: none;\n  box-shadow: var(--ui-focus-ring);\n}\n\nbody.is-records-view .record-tabs ~ .records-section,\nbody.is-meal-view .meal-tabs ~ .records-section {\n  margin-top: 0;\n  border-top: 0;\n  border-top-left-radius: 0;\n  border-top-right-radius: 0;\n}\n\n.records-section > h2 {`
);

replaceOnce(
  "tests/css-consolidation.test.js",
  `  assert.match(responsive, /\\.meal-tabs,[\\s\\S]*\\.record-tabs \\{[^}]*scroll-snap-type:\\s*x proximity;/s);\n  assert.match(mealPage, /class="meal-tabs" role="tablist" aria-label="訂餐頁分頁"/);`,
  `  assert.match(responsive, /\\.meal-tabs,[\\s\\S]*\\.record-tabs \\{[^}]*scroll-snap-type:\\s*x proximity;/s);\n  assert.match(foundation, /\\.meal-tabs \\{[^}]*margin:\\s*10px 0 0;/s);\n  assert.match(foundation, /\\.record-tabs \\{[^}]*margin:\\s*12px 0 0;/s);\n  assert.match(components, /body\\.is-records-view \\.record-tabs ~ \\.records-section,[\\s\\S]*body\\.is-meal-view \\.meal-tabs ~ \\.records-section \\{[^}]*margin-top:\\s*0;[^}]*border-top:\\s*0;[^}]*border-top-left-radius:\\s*0;[^}]*border-top-right-radius:\\s*0;/s);\n  assert.match(mealPage, /class="meal-tabs" role="tablist" aria-label="訂餐頁分頁"/);`
);

replaceOnce(
  "規格書.md",
  `7. 頁籤容器使用 \`role="tablist"\`，各籤頁使用 \`role="tab"\` 與正確的 \`aria-selected\` 狀態。`,
  `7. 頁籤容器使用 \`role="tablist"\`，各籤頁使用 \`role="tab"\` 與正確的 \`aria-selected\` 狀態。\n8. 頁籤列與下方內容區必須緊密相接，不保留垂直空白；內容區移除上邊框及左上、右上圓角，只保留下方圓角，由頁籤本身呈現上方圓角。`
);

console.log("Connected page tabs prepared.");
