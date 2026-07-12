const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (file, content) => {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content.replace(/\r\n/g, "\n"), "utf8");
};

function mustReplace(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`找不到 ${label}`);
  return source.replace(search, replacement);
}

function mustReplaceRegex(source, pattern, replacement, label) {
  if (!pattern.test(source)) throw new Error(`找不到 ${label}`);
  pattern.lastIndex = 0;
  return source.replace(pattern, replacement);
}

const dragScrollModule = `/* 拖曳後保留視窗與設定清單捲動位置。 */

let dragScrollSnapshot = null;
let dragScrollRestoreUntil = 0;

const DRAG_SCROLL_SELECTORS = [
  ".department-settings-modal [data-sort-item]",
  ".catalog-settings-modal [data-sort-item]",
  "[data-meal-product-row]",
  "[data-table-member-id]",
  "[data-table-department-id]"
].join(",");

function getDragScrollKey(element, index) {
  if (!(element instanceof HTMLElement)) return \`scroll-\${index}\`;
  const classKey = Array.from(element.classList).filter((name) => /scroll|body|wrap/.test(name)).join(".");
  return classKey ? \`.\${classKey}\` : \`scroll-\${index}\`;
}

function collectDragScrollableElements() {
  const modal = document.querySelector("#modalRoot .modal-overlay");
  const scope = modal || document;
  return Array.from(scope.querySelectorAll(".modal-body, .settings-table-scroll, .member-table-scroll, .department-settings-table-wrap, .settings-table-wrap, .member-table-wrap, .table-wrap"))
    .filter((element) => element instanceof HTMLElement)
    .filter((element) => element.scrollHeight > element.clientHeight + 1 || element.scrollWidth > element.clientWidth + 1);
}

function captureDragScrollPosition() {
  const elements = collectDragScrollableElements();
  dragScrollSnapshot = {
    windowX: window.scrollX,
    windowY: window.scrollY,
    entries: elements.map((element, index) => ({
      key: getDragScrollKey(element, index),
      top: element.scrollTop,
      left: element.scrollLeft
    }))
  };
  dragScrollRestoreUntil = Date.now() + 1500;
}

function findDragScrollableElement(key, index) {
  if (key.startsWith(".")) {
    const selector = key.split(".").filter(Boolean).map((part) => \`.\${CSS.escape(part)}\`).join("");
    const found = document.querySelector(\`#modalRoot \${selector}, \${selector}\`);
    if (found instanceof HTMLElement) return found;
  }
  return collectDragScrollableElements()[index] || null;
}

function restoreDragScrollPosition() {
  if (!dragScrollSnapshot || Date.now() > dragScrollRestoreUntil) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.scrollTo(dragScrollSnapshot.windowX, dragScrollSnapshot.windowY);
      dragScrollSnapshot.entries.forEach((entry, index) => {
        const element = findDragScrollableElement(entry.key, index);
        if (element) {
          element.scrollTop = entry.top;
          element.scrollLeft = entry.left;
        }
      });
    });
  });
}

function bindDragScrollPreservation() {
  document.addEventListener("dragstart", (event) => {
    const target = event.target instanceof Element ? event.target.closest(DRAG_SCROLL_SELECTORS) : null;
    if (target) captureDragScrollPosition();
  }, true);

  document.addEventListener("drop", () => {
    if (!dragScrollSnapshot) return;
    dragScrollRestoreUntil = Date.now() + 1500;
    restoreDragScrollPosition();
    setTimeout(restoreDragScrollPosition, 0);
    setTimeout(restoreDragScrollPosition, 80);
    setTimeout(restoreDragScrollPosition, 220);
  }, true);

  const modalRoot = document.getElementById("modalRoot");
  if (modalRoot) {
    new MutationObserver(() => restoreDragScrollPosition()).observe(modalRoot, { childList: true, subtree: true });
  }
}
`;

const mealExportModule = `/* 訂餐報表 Excel 匯出。 */

function downloadMealExportBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function compactMealExportDate(value) {
  return String(value || "").replace(/[^0-9]/g, "").slice(0, 8);
}

function buildMealExportEmployeeRows(report, details) {
  const companySubsidy = Number(report.companySubsidy || 55);
  const employees = new Map();

  details.forEach((row) => {
    const key = String(row.employeeId || row.employeeCode || row.employeeName || "");
    if (!key) return;
    const current = employees.get(key) || {
      employeeName: row.employeeName || "",
      employeeCode: row.employeeCode || "",
      dates: new Set(),
      amount: 0
    };
    const quantity = Number(row.quantity || 0);
    const amount = Number(row.amount ?? (quantity * Number(row.unitPrice || 0))) || 0;
    if (quantity > 0 && row.date) current.dates.add(row.date);
    current.amount += amount;
    if (!current.employeeName && row.employeeName) current.employeeName = row.employeeName;
    if (!current.employeeCode && row.employeeCode) current.employeeCode = row.employeeCode;
    employees.set(key, current);
  });

  return [...employees.values()]
    .map((row) => {
      const mealDays = row.dates.size;
      return {
        employeeName: row.employeeName,
        employeeCode: row.employeeCode,
        lunchAmount: row.amount - mealDays * companySubsidy,
        lunchCount: mealDays
      };
    })
    .sort((a, b) => (
      String(a.employeeName).localeCompare(String(b.employeeName), "zh-Hant")
      || String(a.employeeCode).localeCompare(String(b.employeeCode))
    ));
}

function styleMealExportSheet(sheet) {
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 10 }
  };
  sheet.columns = [18, 16, 14, 14, 14, 14, 14, 14, 14, 14].map((width) => ({ width }));
  sheet.getColumn(2).numFmt = "@";
  sheet.getColumn(10).numFmt = "@";
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
}

async function exportMealReportWorkbook(report = {}) {
  const details = Array.isArray(report.exportDetails)
    ? report.exportDetails
    : Array.isArray(report.details)
      ? report.details
      : [];
  if (!details.length) return { canceled: true, empty: true };

  const rows = buildMealExportEmployeeRows(report, details);
  if (!rows.length) return { canceled: true, empty: true };

  const reportDate = compactMealExportDate(report.toDate);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "福圓號";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("訂餐統計");
  sheet.addRow([
    "員工姓名",
    "員工編號",
    "早餐金額",
    "午餐金額",
    "晚餐金額",
    "早餐份數",
    "午餐份數",
    "晚餐份數",
    "總計",
    "日期"
  ]);
  rows.forEach((row) => {
    sheet.addRow([
      row.employeeName,
      row.employeeCode,
      "",
      row.lunchAmount,
      "",
      "",
      row.lunchCount,
      "",
      "",
      reportDate
    ]);
  });
  styleMealExportSheet(sheet);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  const fileName = \`訂餐統計_\${compactMealExportDate(report.fromDate)}-\${reportDate}.xlsx\`;
  downloadMealExportBlob(blob, fileName);
  return { canceled: false, filePath: fileName };
}
`;

write("src/renderer/renderer-drag-scroll-preserve.js", dragScrollModule);
write("src/renderer/renderer-meal-export.js", mealExportModule);

for (const manifestPath of ["scripts/build-js.js", "scripts/renderer-core-source.js"]) {
  let manifest = read(manifestPath);
  manifest = mustReplace(
    manifest,
    '  "renderer-export-actions.js",\n  "renderer-period-exports.js",',
    '  "renderer-export-actions.js",\n  "renderer-meal-export.js",\n  "renderer-period-exports.js",',
    `${manifestPath} 訂餐匯出模組位置`
  );
  manifest = mustReplace(
    manifest,
    '  "renderer-events-drag.js",\n  "renderer-events.js",',
    '  "renderer-events-drag.js",\n  "renderer-drag-scroll-preserve.js",\n  "renderer-events.js",',
    `${manifestPath} 拖曳捲動模組位置`
  );
  for (const legacy of ["v2-drag-scroll-preserve.js", "v2-settings-drag-handles.js", "v2-meal-export.js", "v2-account.js"]) {
    manifest = manifest.replace(`  "${legacy}",\n`, "");
  }
  write(manifestPath, manifest);
}

let ordering = read("src/renderer/renderer-settings-ordering.js");
ordering = `function renderSettingsOrderDragColumn(withHandle = false) {
  return \`<div class="settings-order-drag-col">\${withHandle ? '<span class="settings-order-drag-handle" draggable="true" title="拖曳排序" aria-label="拖曳排序">≡</span>' : ""}</div>\`;
}

${ordering}`;
write("src/renderer/renderer-settings-ordering.js", ordering);

let catalog = read("src/renderer/renderer-settings-catalog.js");
catalog = mustReplace(
  catalog,
  '              <div class="settings-table-row settings-table-head settings-table-row-${category}">\n                <div>預覽</div>',
  '              <div class="settings-table-row settings-table-head settings-table-row-${category}">\n                ${renderSettingsOrderDragColumn()}\n                <div>預覽</div>',
  "班別假別加班設定表頭拖曳欄"
);
catalog = mustReplace(
  catalog,
  '                <div class="settings-table-row settings-table-row-${category} sortable-settings-item" draggable="true" data-sort-category="${category}" data-sort-item="${item.id}">\n                  <div class="settings-table-color">',
  '                <div class="settings-table-row settings-table-row-${category} sortable-settings-item" data-sort-category="${category}" data-sort-item="${item.id}">\n                  ${renderSettingsOrderDragColumn(true)}\n                  <div class="settings-table-color">',
  "班別假別加班設定列拖曳把手"
);
write("src/renderer/renderer-settings-catalog.js", catalog);

let member = read("src/renderer/renderer-settings-member.js");
member = mustReplace(
  member,
  '            <div class="member-table-row member-table-head">\n              <div>工號</div>',
  '            <div class="member-table-row member-table-head">\n              ${renderSettingsOrderDragColumn()}\n              <div>工號</div>',
  "人員設定表頭拖曳欄"
);
member = mustReplace(
  member,
  '              <div class="member-table-row sortable-settings-item" draggable="true" data-sort-category="member" data-sort-item="${escapeHtml(member.id)}" data-member-settings-row="${escapeHtml(member.id)}">\n                <div class="member-table-code">',
  '              <div class="member-table-row sortable-settings-item" data-sort-category="member" data-sort-item="${escapeHtml(member.id)}" data-member-settings-row="${escapeHtml(member.id)}">\n                ${renderSettingsOrderDragColumn(true)}\n                <div class="member-table-code">',
  "人員設定列拖曳把手"
);
member = mustReplaceRegex(
  member,
  /async function deleteMember\(memberId\) \{[\s\S]*?\n\}\n\nasync function resetMemberPasswordFromModal/,
  `async function deleteMember(memberId) {
  const member = state.members.find((item) => item.id === memberId);
  if (!member) return;
  if (!canEditMemberAccount(member)) {
    showInfoMessage("沒有權限刪除此帳號");
    return;
  }

  const selfDelete = member.code === currentProfile?.employee_code;
  const confirmed = await confirmAction(selfDelete
    ? "確定要刪除自己的帳號嗎？刪除後會立即登出。"
    : "確定要刪除這位人員嗎？");
  if (!confirmed) return;

  let currentPassword = "";
  if (selfDelete) {
    currentPassword = window.prompt("請輸入目前密碼以確認刪除帳號：") || "";
    if (!currentPassword) {
      showInfoMessage("未輸入目前密碼，已取消刪除");
      return;
    }
  }

  const returnTo = captureSettingsReturnContext({ category: "member-settings" });
  let result;
  try {
    result = await window.schedulerApi.deleteMemberProfile(member.code, currentPassword);
    if (!result?.deleted) throw new Error("找不到這位人員，請重新整理後再試");
  } catch (error) {
    showInfoMessage(\`刪除人員失敗：\${error.message || error}\`);
    return;
  }

  if (selfDelete) {
    await window.schedulerApi.signOut();
    window.location.reload();
    return;
  }

  state.members = state.members.filter((item) => item.id !== memberId);
  state.members = state.members.map((item) => ({
    ...item,
    proxyMemberId: item.proxyMemberId === memberId ? "" : item.proxyMemberId
  }));
  renderAll();
  await reopenSettingsModalPreservingScroll(returnTo);
  showInfoMessage(result?.softDeleted ? "人員已停用，歷史紀錄已保留" : "人員已刪除");
}

async function resetMemberPasswordFromModal`,
  "正式人員刪除流程"
);
write("src/renderer/renderer-settings-member.js", member);

let department = read("src/renderer/renderer-settings-department.js");
department = mustReplace(
  department,
  '      <div class="department-settings-row sortable-settings-item" draggable="true" data-sort-category="department" data-sort-item="${escapeHtml(department.id)}" data-drop-department="${escapeHtml(department.id)}">\n        <div class="department-settings-title">',
  '      <div class="department-settings-row sortable-settings-item" data-sort-category="department" data-sort-item="${escapeHtml(department.id)}" data-drop-department="${escapeHtml(department.id)}">\n        ${renderSettingsOrderDragColumn(true)}\n        <div class="department-settings-title">',
  "單位設定列拖曳把手"
);
department = mustReplace(
  department,
  '          <div class="department-settings-row department-settings-head">\n            <div>單位</div>',
  '          <div class="department-settings-row department-settings-head">\n            ${renderSettingsOrderDragColumn()}\n            <div>單位</div>',
  "單位設定表頭拖曳欄"
);
write("src/renderer/renderer-settings-department.js", department);

let dragEvents = read("src/renderer/renderer-events-drag.js");
dragEvents = mustReplace(
  dragEvents,
  `    const sortItem = event.target.closest("[data-sort-item]");
    if (sortItem) {
      dragSortItemId = sortItem.dataset.sortItem || "";`,
  `    const sortItem = event.target.closest("[data-sort-item]");
    if (sortItem) {
      if (!event.target.closest(".settings-order-drag-handle")) {
        event.preventDefault();
        return;
      }
      dragSortItemId = sortItem.dataset.sortItem || "";`,
  "設定列限制由拖曳把手啟動"
);
write("src/renderer/renderer-events-drag.js", dragEvents);

let events = read("src/renderer/renderer-events.js");
events = mustReplace(
  events,
  "  bindDragAndDropEvents();\n  bindCoreMenuDismissEvent();",
  "  bindDragAndDropEvents();\n  bindDragScrollPreservation();\n  bindCoreMenuDismissEvent();",
  "拖曳捲動事件註冊"
);
write("src/renderer/renderer-events.js", events);

let webApi = read("src/renderer/web-api.js");
webApi = mustReplaceRegex(
  webApi,
  /  async function deleteMemberProfile\(employeeCode\) \{[\s\S]*?\n  \}/,
  `  async function deleteMemberProfile(employeeCode, currentPassword = "") {
    ensureSignedIn();
    return requestFunction("member-delete-v2", {
      employeeCode: String(employeeCode || "").trim(),
      currentPassword: String(currentPassword || "")
    });
  }`,
  "正式人員刪除 API"
);
webApi = mustReplaceRegex(
  webApi,
  /  async function exportMealReport\(report\) \{[\s\S]*?\n  \}\n\n  async function exportMembers/,
  `  async function exportMealReport(report) {
    return exportMealReportWorkbook(report);
  }

  async function exportMembers`,
  "正式訂餐報表匯出 API"
);
write("src/renderer/web-api.js", webApi);

let finalCheck = read("scripts/check-v2-final.js");
finalCheck = finalCheck
  .replace('  "src/renderer/v2-account.js",\n', '  "src/renderer/renderer-settings-member.js",\n')
  .replace('  "src/renderer/v2-meal-export.js",\n', '  "src/renderer/renderer-meal-export.js",\n')
  .replace('const sourceExport = read("src/renderer/v2-meal-export.js");', 'const sourceExport = read("src/renderer/renderer-meal-export.js");');
finalCheck = mustReplace(
  finalCheck,
  'required.forEach((file) => assert(exists(file), `缺少 V2 檔案：${file}`));',
  'required.forEach((file) => assert(exists(file), `缺少 V2 檔案：${file}`));\nassert(!fs.readdirSync(path.join(root, "src", "renderer")).some((file) => /^v2-.*\\.js$/.test(file)), "前端仍保留 v2 補丁模組");',
  "V2 final 無補丁檔檢查"
);
write("scripts/check-v2-final.js", finalCheck);

let alignment = read("scripts/check-v2-alignment.js");
alignment = alignment.replace('  "src/renderer/v2-account.js",\n', '  "src/renderer/renderer-settings-member.js",\n');
alignment = mustReplace(
  alignment,
  'requiredFiles.forEach((file) => assert(exists(file), `Missing V2 file: ${file}`));',
  'requiredFiles.forEach((file) => assert(exists(file), `Missing V2 file: ${file}`));\nassert(!fs.readdirSync(path.join(root, "src", "renderer")).some((file) => /^v2-.*\\.js$/.test(file)), "Front-end still contains late-loaded v2 patch modules");',
  "V2 alignment 無補丁檔檢查"
);
write("scripts/check-v2-alignment.js", alignment);

for (const testName of fs.readdirSync(path.join(root, "tests")).filter((name) => name.endsWith(".test.js"))) {
  const file = path.join("tests", testName);
  let source = read(file);
  source = source
    .replaceAll("src/renderer/v2-meal-export.js", "src/renderer/renderer-meal-export.js")
    .replaceAll("src/renderer/v2-account.js", "src/renderer/renderer-settings-member.js");
  write(file, source);
}

const testSource = `const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const legacyFiles = [
  "v2-drag-scroll-preserve.js",
  "v2-settings-drag-handles.js",
  "v2-meal-export.js",
  "v2-account.js"
];

test("前端不再保留 v2 補丁模組", () => {
  legacyFiles.forEach((file) => assert.equal(fs.existsSync(path.join(root, "src", "renderer", file)), false, file));
  const build = read("scripts/build-js.js");
  legacyFiles.forEach((file) => assert.doesNotMatch(build, new RegExp(file.replaceAll(".", "\\\\."))));
});

test("設定排序把手由正式畫面直接產生", () => {
  const sources = [
    "src/renderer/renderer-settings-ordering.js",
    "src/renderer/renderer-settings-catalog.js",
    "src/renderer/renderer-settings-department.js",
    "src/renderer/renderer-settings-member.js",
    "src/renderer/renderer-events-drag.js"
  ].map(read).join("\\n");
  assert.match(sources, /function renderSettingsOrderDragColumn/);
  assert.match(sources, /settings-order-drag-handle/);
  assert.match(sources, /event\\.target\\.closest\\("\\.settings-order-drag-handle"\\)/);
  assert.doesNotMatch(sources, /installV2SettingsDragHandles/);
});

test("訂餐匯出與帳號刪除使用正式模組", () => {
  const exportSource = read("src/renderer/renderer-meal-export.js");
  const webApi = read("src/renderer/web-api.js");
  const memberSource = read("src/renderer/renderer-settings-member.js");
  assert.match(exportSource, /async function exportMealReportWorkbook/);
  assert.match(webApi, /return exportMealReportWorkbook\\(report\\)/);
  assert.match(webApi, /async function deleteMemberProfile\\(employeeCode, currentPassword = ""\\)/);
  assert.match(webApi, /currentPassword: String\\(currentPassword/);
  assert.match(memberSource, /window\\.schedulerApi\\.deleteMemberProfile\\(member\\.code, currentPassword\\)/);
});

test("拖曳捲動保留由正式事件總控註冊", () => {
  assert.match(read("src/renderer/renderer-drag-scroll-preserve.js"), /function bindDragScrollPreservation/);
  assert.match(read("src/renderer/renderer-events.js"), /bindDragScrollPreservation\\(\\)/);
});
`;
write("tests/renderer-remaining-v2-consolidation.test.js", testSource);

const specPath = "規格書.md";
let spec = read(specPath);
if (!spec.includes("前端舊版補丁模組整併規則")) {
  spec += `\n\n## 前端舊版補丁模組整併規則\n\n- 前端來源檔不得再使用 \`v2-*.js\` 後載入補丁覆蓋正式函式。\n- 設定排序把手須由正式畫面直接輸出，不得以 MutationObserver 追加欄位。\n- 訂餐報表匯出、人員刪除與拖曳捲動保留均由正式模組提供，且由正式事件或 API 入口呼叫。\n- 同一功能只能有一個正式實作來源；不得以後載入賦值覆蓋同名函式。\n`;
}
write(specPath, spec);

for (const legacy of ["v2-drag-scroll-preserve.js", "v2-settings-drag-handles.js", "v2-meal-export.js", "v2-account.js"]) {
  const file = path.join(root, "src", "renderer", legacy);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

console.log("Remaining v2 renderer modules consolidated.");
