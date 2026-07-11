const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const write = (relativePath, content) => fs.writeFileSync(path.join(root, relativePath), content, "utf8");

function removeDynamicModuleLoaders() {
  const relativePath = "src/renderer/v2-cross-department-member-drag.js";
  let text = read(relativePath);
  const pattern = /\n\s*const detailStyle = document\.createElement\("link"\);[\s\S]*?document\.head\.appendChild\(overtimeSuggestionScript\);\n/;
  if (!pattern.test(text)) throw new Error("找不到跨單位拖曳模組的動態載入區塊");
  text = text.replace(pattern, "\n");
  write(relativePath, text);
}

function mergeDepartmentSettingsCss() {
  const oldPath = path.join(root, "src", "renderer", "v2-department-settings-columns.css");
  const pagesPath = "src/renderer/css/pages.css";
  if (!fs.existsSync(oldPath)) return;
  const marker = "/* ===== 單位設定欄位配置（原 v2-department-settings-columns.css） ===== */";
  let pages = read(pagesPath).replace(/\s+$/, "");
  const legacy = fs.readFileSync(oldPath, "utf8").replace(/^\uFEFF/, "").trim();
  if (!pages.includes(marker)) pages += `\n\n${marker}\n${legacy}\n`;
  write(pagesPath, pages);
  fs.unlinkSync(oldPath);
}

function updateLegacyCssChecks() {
  for (const relativePath of ["scripts/check-expansion-acceptance.js", "scripts/check-settings-lists.js"]) {
    const text = read(relativePath);
    if (!text.includes("styles.css")) continue;
    write(relativePath, text.replaceAll("styles.css", "app.css"));
  }
}

removeDynamicModuleLoaders();
mergeDepartmentSettingsCss();
updateLegacyCssChecks();
console.log("JavaScript migration prerequisites completed");
