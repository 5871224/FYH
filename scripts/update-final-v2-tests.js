const fs = require("node:fs");

function updateFile(file, transform) {
  const source = fs.readFileSync(file, "utf8");
  const next = transform(source);
  if (next === source) throw new Error(`測試未更新：${file}`);
  fs.writeFileSync(file, next, "utf8");
}

updateFile("tests/member-order-and-department-width.test.js", (source) => {
  const oldBlock = `test("人員設定應由第一欄拖曳把手啟動排序", () => {
  const source = read("src/renderer/v2-settings-drag-handles.js");
  assert.equal(source.includes(".member-settings-modal .member-table-head"), true);
  assert.equal(source.includes('data-sort-category="member"'), true);
  assert.equal(source.includes(".member-settings-modal [data-sort-item]"), true);
  assert.equal(source.includes("row.removeAttribute(\"draggable\")"), true);
  assert.equal(source.includes("settings-order-drag-handle"), true);
});`;
  const newBlock = `test("人員設定應直接由正式模組輸出第一欄拖曳把手", () => {
  const ordering = read("src/renderer/renderer-settings-ordering.js");
  const member = read("src/renderer/renderer-settings-member.js");
  const dragEvents = read("src/renderer/renderer-events-drag.js");
  assert.equal(fs.existsSync(path.join(root, "src/renderer/v2-settings-drag-handles.js")), false);
  assert.match(ordering, /function renderSettingsOrderDragColumn/);
  assert.match(member, /renderSettingsOrderDragColumn\(true\)/);
  assert.match(member, /renderSettingsOrderDragColumn\(\)/);
  assert.match(member, /data-sort-category="member"/);
  assert.doesNotMatch(member, /sortable-settings-item" draggable="true"/);
  assert.match(dragEvents, /!event\.target\.closest\("\.settings-order-drag-handle"\)/);
});`;
  if (!source.includes(oldBlock)) throw new Error("找不到舊人員拖曳把手測試");
  return source.replace(oldBlock, newBlock);
});

updateFile("tests/renderer-phase7-department-patch.test.js", (source) => {
  let next = source.replace(
    'test("單位設定最終畫面應直接由正式模組提供六欄", async () => {',
    'test("單位設定最終畫面應直接由正式模組提供七欄", async () => {'
  );
  const anchor = '    renderActionIconButton: (kind) => kind,\n';
  if (!next.includes(anchor)) throw new Error("找不到單位設定測試 context");
  next = next.replace(anchor, `${anchor}    renderSettingsOrderDragColumn: (isHeader = false) => \`<div class="settings-order-drag-col">\${isHeader ? "" : '<span class="settings-order-drag-handle" draggable="true">≡</span>'}</div>\`,\n`);
  next = next.replace(
    '  assert.equal(modalConfig.body.includes("開始日期<br>結束日期"), true);',
    '  assert.equal(modalConfig.body.includes("settings-order-drag-col"), true);\n  assert.equal(modalConfig.body.includes("開始日期<br>結束日期"), true);'
  );
  return next;
});

updateFile("tests/renderer-phase7-member-order.test.js", (source) => {
  const anchor = '    renderActionIconButton: (kind) => kind\n';
  if (!source.includes(anchor)) throw new Error("找不到人員設定測試 context");
  let next = source.replace(anchor, `    renderActionIconButton: (kind) => kind,\n    renderSettingsOrderDragColumn: (isHeader = false) => \`<div class="settings-order-drag-col">\${isHeader ? "" : '<span class="settings-order-drag-handle" draggable="true">≡</span>'}</div>\`\n`);
  next = next.replace(
    '  assert.equal(html.includes(\'draggable="true"\'), true);',
    '  assert.equal(html.includes(\'class="settings-order-drag-handle" draggable="true"\'), true);\n  assert.equal(html.includes(\'sortable-settings-item" draggable="true"\'), false);'
  );
  return next;
});

updateFile("tests/renderer-records-admin-consolidation.test.js", (source) => {
  const oldLine = '  assert.match(read("src/renderer/web-api.js"), /report\\?\\.exportDetails/);';
  const newLine = '  assert.equal(read("src/renderer/web-api.js").includes("report.exportDetails"), true);';
  if (!source.includes(oldLine)) throw new Error("找不到訂餐匯出明細測試");
  return source.replace(oldLine, newLine);
});

updateFile("tests/renderer-final-v2-consolidation.test.js", (source) => {
  const oldLine = '  assert.match(api, /row.amount - mealDays * companySubsidy/);';
  const newLine = '  assert.equal(api.includes("row.amount - mealDays * companySubsidy"), true);';
  if (!source.includes(oldLine)) throw new Error("找不到訂餐補助公式測試");
  return source.replace(oldLine, newLine);
});

console.log("Final V2 regression tests updated.");
