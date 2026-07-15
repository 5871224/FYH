const fs = require("node:fs");

const read = (file) => fs.readFileSync(file, "utf8");
const write = (file, content) => fs.writeFileSync(file, content, "utf8");

function replacePattern(file, pattern, replacement, label) {
  const source = read(file);
  if (!pattern.test(source)) throw new Error(`找不到 ${label}：${file}`);
  write(file, source.replace(pattern, replacement));
  console.log(`已修改：${label}`);
}

const foundationPath = "src/renderer/css/foundation.css";
let foundation = read(foundationPath);
if (!/\.meal-tabs\s*\{[^}]*margin:\s*10px 0 0;/s.test(foundation)) {
  replacePattern(
    foundationPath,
    /(\.meal-tabs\s*\{[^}]*?margin:\s*)10px 0 16px;/s,
    "$110px 0 0;",
    "訂餐頁籤下方間距"
  );
}
foundation = read(foundationPath);
if (!/\.record-tabs\s*\{[^}]*margin:\s*12px 0 0;/s.test(foundation)) {
  replacePattern(
    foundationPath,
    /(\.record-tabs\s*\{[^}]*?margin:\s*)12px 0;/s,
    "$112px 0 0;",
    "記錄頁籤下方間距"
  );
}

const componentsPath = "src/renderer/css/components.css";
let components = read(componentsPath);
const connectedPanelRule = `body.is-records-view .record-tabs ~ .records-section,
body.is-meal-view .meal-tabs ~ .records-section {
  margin-top: 0;
  border-top: 0;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
}

`;
if (!components.includes("body.is-records-view .record-tabs ~ .records-section")) {
  const marker = ".records-section > h2 {";
  if (!components.includes(marker)) throw new Error(`找不到內容區標記：${componentsPath}`);
  components = components.replace(marker, connectedPanelRule + marker);
  write(componentsPath, components);
  console.log("已加入：頁籤與內容區連接規則");
}

const testPath = "tests/css-consolidation.test.js";
let tests = read(testPath);
if (!tests.includes("border-top-left-radius:\\s*0")) {
  const marker = `  assert.match(responsive, /\\.meal-tabs,[\\s\\S]*\\.record-tabs \\{[^}]*scroll-snap-type:\\s*x proximity;/s);`;
  if (!tests.includes(marker)) throw new Error(`找不到頁籤測試標記：${testPath}`);
  const assertions = `${marker}
  assert.match(foundation, /\\.meal-tabs \\{[^}]*margin:\\s*10px 0 0;/s);
  assert.match(foundation, /\\.record-tabs \\{[^}]*margin:\\s*12px 0 0;/s);
  assert.match(components, /body\\.is-records-view \\.record-tabs ~ \\.records-section,[\\s\\S]*body\\.is-meal-view \\.meal-tabs ~ \\.records-section \\{[^}]*margin-top:\\s*0;[^}]*border-top:\\s*0;[^}]*border-top-left-radius:\\s*0;[^}]*border-top-right-radius:\\s*0;/s);`;
  tests = tests.replace(marker, assertions);
  write(testPath, tests);
  console.log("已加入：頁籤內容區連接回歸測試");
}

const specPath = "規格書.md";
let spec = read(specPath);
const specRule = "8. 頁籤列與下方內容區必須緊密相接，不保留垂直空白；內容區移除上邊框及左上、右上圓角，只保留下方圓角，由頁籤本身呈現上方圓角。";
if (!spec.includes(specRule)) {
  const marker = '7. 頁籤容器使用 `role="tablist"`，各籤頁使用 `role="tab"` 與正確的 `aria-selected` 狀態。';
  if (!spec.includes(marker)) throw new Error(`找不到頁籤規格標記：${specPath}`);
  spec = spec.replace(marker, `${marker}\n${specRule}`);
  write(specPath, spec);
  console.log("已更新：正式頁籤規格");
}

console.log("Connected page tabs prepared.");
