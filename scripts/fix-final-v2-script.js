const fs = require("node:fs");

const file = "scripts/remove-final-v2-patches.js";
let source = fs.readFileSync(file, "utf8");
const tick = String.fromCharCode(96);
const oldText = "read(" + tick + "src/renderer/" + "$" + "{file}" + tick + ")";
const newText = 'read("src/renderer/" + file)';
if (!source.includes(oldText)) throw new Error("找不到測試字串修正位置");
source = source.replace(oldText, newText);

const oldMustReplace = `function mustReplace(source, from, to, label) {
  if (!source.includes(from)) throw new Error(\`找不到替換位置：\${label}\`);
  return source.replace(from, to);
}`;
const newMustReplace = `function mustReplace(source, from, to, label) {
  if (source.includes(from)) return source.replace(from, to);
  const fallbacks = {
    "人員表頭拖曳欄": [
      /<div class="member-table-row member-table-head">\\s*<div>工號<\\/div>/,
      '<div class="member-table-row member-table-head">\\n              \${renderSettingsOrderDragColumn(true)}\\n              <div>工號</div>'
    ],
    "人員列拖曳把手": [
      /<div class="member-table-row sortable-settings-item" draggable="true"([^>]*data-member-settings-row="[^"]+"[^>]*)>\\s*<div class="member-table-code">/,
      '<div class="member-table-row sortable-settings-item"$1>\\n                 \${renderSettingsOrderDragColumn()}\\n                 <div class="member-table-code">'
    ],
    "目錄表頭拖曳欄": [
      /<div class="settings-table-row settings-table-head settings-table-row-\\$\\{category\\}">\\s*<div>預覽<\\/div>/,
      '<div class="settings-table-row settings-table-head settings-table-row-\${category}">\\n                 \${renderSettingsOrderDragColumn(true)}\\n                 <div>預覽</div>'
    ],
    "目錄列拖曳把手": [
      /<div class="settings-table-row settings-table-row-\\$\\{category\\} sortable-settings-item" draggable="true"([^>]*data-sort-item="\\$\\{item\\.id\\}"[^>]*)>\\s*<div class="settings-table-color">/,
      '<div class="settings-table-row settings-table-row-\${category} sortable-settings-item"$1>\\n                   \${renderSettingsOrderDragColumn()}\\n                   <div class="settings-table-color">'
    ],
    "單位表頭拖曳欄": [
      /<div class="department-settings-row department-settings-head">\\s*<div>單位<\\/div>/,
      '<div class="department-settings-row department-settings-head">\\n             \${renderSettingsOrderDragColumn(true)}\\n             <div>單位</div>'
    ],
    "單位列拖曳把手": [
      /<div class="department-settings-row sortable-settings-item" draggable="true"([^>]*data-drop-department="[^"]+"[^>]*)>\\s*<div class="department-settings-title">/,
      '<div class="department-settings-row sortable-settings-item"$1>\\n         \${renderSettingsOrderDragColumn()}\\n         <div class="department-settings-title">'
    ]
  };
  const fallback = fallbacks[label];
  if (fallback) {
    const next = source.replace(fallback[0], fallback[1]);
    if (next !== source) return next;
  }
  throw new Error("找不到替換位置：" + label);
}`;
if (!source.includes(oldMustReplace)) throw new Error("找不到 mustReplace 修正位置");
source = source.replace(oldMustReplace, newMustReplace);

fs.writeFileSync(file, source, "utf8");
console.log("Final V2 migration patterns fixed.");
