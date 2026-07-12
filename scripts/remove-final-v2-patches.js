const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8").replace(/^\uFEFF/, "");
const write = (file, content) => fs.writeFileSync(path.join(root, file), `${content.trimEnd()}\n`, "utf8");

function mustReplace(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`找不到替換位置：${label}`);
  return source.replace(from, to);
}

function extractFunction(source, marker) {
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`找不到函式：${marker}`);
  const parenStart = source.indexOf("(", start);
  let parenDepth = 0;
  let parenEnd = -1;
  for (let index = parenStart; index < source.length; index += 1) {
    if (source[index] === "(") parenDepth += 1;
    if (source[index] === ")" && --parenDepth === 0) {
      parenEnd = index;
      break;
    }
  }
  const braceStart = source.indexOf("{", parenEnd);
  if (parenStart < 0 || parenEnd < 0 || braceStart < 0) throw new Error(`找不到函式本體：${marker}`);
  let depth = 0;
  let mode = "code";
  let escaped = false;
  for (let index = braceStart; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (mode === "line") { if (char === "\n") mode = "code"; continue; }
    if (mode === "block") { if (char === "*" && next === "/") { mode = "code"; index += 1; } continue; }
    if (["single", "double", "template"].includes(mode)) {
      if (escaped) { escaped = false; continue; }
      if (char === "\\") { escaped = true; continue; }
      if ((mode === "single" && char === "'") || (mode === "double" && char === '"') || (mode === "template" && char === "`")) mode = "code";
      continue;
    }
    if (char === "/" && next === "/") { mode = "line"; index += 1; continue; }
    if (char === "/" && next === "*") { mode = "block"; index += 1; continue; }
    if (char === "'") { mode = "single"; continue; }
    if (char === '"') { mode = "double"; continue; }
    if (char === "`") { mode = "template"; continue; }
    if (char === "{") depth += 1;
    if (char === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`函式未完整結束：${marker}`);
}

function replaceFunction(source, marker, replacement) {
  const block = extractFunction(source, marker);
  return mustReplace(source, block, replacement, marker);
}

// 1. 帳號刪除：保留目前實際使用的自刪密碼確認與軟刪除提示。
let webApi = read("src/renderer/web-api.js");
webApi = replaceFunction(webApi, "async function deleteMemberProfile", `async function deleteMemberProfile(employeeCode, currentPassword = "") {
    ensureManager();
    return requestFunction("member-delete-v2", {
      employeeCode: String(employeeCode || "").trim(),
      currentPassword: String(currentPassword || "")
    });
  }`);

const mealHelpers = `function compactMealExportDate(value) {
    return String(value || "").replace(/[^0-9]/g, "").slice(0, 8);
  }

  function buildMealEmployeeRows(report, details) {
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
    return [...employees.values()].map((row) => {
      const mealDays = row.dates.size;
      return {
        employeeName: row.employeeName,
        employeeCode: row.employeeCode,
        lunchAmount: row.amount - mealDays * companySubsidy,
        lunchCount: mealDays
      };
    }).sort((a, b) => (
      String(a.employeeName).localeCompare(String(b.employeeName), "zh-Hant")
      || String(a.employeeCode).localeCompare(String(b.employeeCode))
    ));
  }

  function styleMealExportSheet(sheet) {
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 10 } };
    sheet.columns = Array.from({ length: 10 }, (_, index) => ({ width: index === 0 ? 18 : index === 1 ? 16 : 14 }));
    sheet.getColumn(2).numFmt = "@";
    sheet.getColumn(10).numFmt = "@";
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    });
  }`;
const oldMealExport = extractFunction(webApi, "async function exportMealReport");
const newMealExport = `${mealHelpers}

  async function exportMealReport(report = {}) {
    const details = Array.isArray(report.exportDetails)
      ? report.exportDetails
      : Array.isArray(report.details)
        ? report.details
        : [];
    if (!details.length) return { canceled: true, empty: true };
    const rows = buildMealEmployeeRows(report, details);
    if (!rows.length) return { canceled: true, empty: true };
    const reportDate = compactMealExportDate(report.toDate);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "福圓號";
    workbook.created = new Date();
    const sheet = workbook.addWorksheet("訂餐統計");
    sheet.addRow(["員工姓名", "員工編號", "早餐金額", "午餐金額", "晚餐金額", "早餐份數", "午餐份數", "晚餐份數", "總計", "日期"]);
    rows.forEach((row) => {
      sheet.addRow([row.employeeName, row.employeeCode, "", row.lunchAmount, "", "", row.lunchCount, "", "", reportDate]);
    });
    styleMealExportSheet(sheet);
    const blob = await exporter.workbookToBlob(workbook);
    const fileName = \`訂餐統計_\${compactMealExportDate(report.fromDate)}-\${reportDate}.xlsx\`;
    downloadBlob(blob, fileName);
    return { canceled: false, filePath: fileName };
  }`;
webApi = mustReplace(webApi, oldMealExport, newMealExport, "正式訂餐匯出");
write("src/renderer/web-api.js", webApi);

let members = read("src/renderer/renderer-settings-member.js");
const oldDeleteMember = extractFunction(members, "async function deleteMember");
const newDeleteMember = `async function deleteMember(memberId) {
  const member = state.members.find((item) => item.id === memberId);
  if (!member) return;
  if (!canEditMemberAccount(member)) {
    showInfoMessage("沒有權限刪除此帳號");
    return;
  }
  const returnTo = captureSettingsReturnContext({ category: "member-settings" });
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
}`;
members = mustReplace(members, oldDeleteMember, newDeleteMember, "正式刪除人員");
write("src/renderer/renderer-settings-member.js", members);

// 2. 設定拖曳把手直接由正式畫面產生。
let ordering = read("src/renderer/renderer-settings-ordering.js");
ordering = `function renderSettingsOrderDragColumn(isHeader = false) {
  return \`<div class="settings-order-drag-col">\${isHeader ? "" : '<span class="settings-order-drag-handle" draggable="true" title="拖曳排序" aria-label="拖曳排序">≡</span>'}</div>\`;
}

${ordering}`;
write("src/renderer/renderer-settings-ordering.js", ordering);

members = read("src/renderer/renderer-settings-member.js");
members = mustReplace(members,
  '<div class="member-table-row member-table-head">\n              <div>工號</div>',
  '<div class="member-table-row member-table-head">\n              ${renderSettingsOrderDragColumn(true)}\n              <div>工號</div>',
  "人員表頭拖曳欄"
);
members = mustReplace(members,
  '<div class="member-table-row sortable-settings-item" draggable="true" data-sort-category="member" data-sort-item="${escapeHtml(member.id)}" data-member-settings-row="${escapeHtml(member.id)}">\n                 <div class="member-table-code">',
  '<div class="member-table-row sortable-settings-item" data-sort-category="member" data-sort-item="${escapeHtml(member.id)}" data-member-settings-row="${escapeHtml(member.id)}">\n                 ${renderSettingsOrderDragColumn()}\n                 <div class="member-table-code">',
  "人員列拖曳把手"
);
write("src/renderer/renderer-settings-member.js", members);

let catalog = read("src/renderer/renderer-settings-catalog.js");
catalog = mustReplace(catalog,
  '<div class="settings-table-row settings-table-head settings-table-row-${category}">\n                 <div>預覽</div>',
  '<div class="settings-table-row settings-table-head settings-table-row-${category}">\n                 ${renderSettingsOrderDragColumn(true)}\n                 <div>預覽</div>',
  "目錄表頭拖曳欄"
);
catalog = mustReplace(catalog,
  '<div class="settings-table-row settings-table-row-${category} sortable-settings-item" draggable="true" data-sort-category="${category}" data-sort-item="${item.id}">\n                   <div class="settings-table-color">',
  '<div class="settings-table-row settings-table-row-${category} sortable-settings-item" data-sort-category="${category}" data-sort-item="${item.id}">\n                   ${renderSettingsOrderDragColumn()}\n                   <div class="settings-table-color">',
  "目錄列拖曳把手"
);
write("src/renderer/renderer-settings-catalog.js", catalog);

let departments = read("src/renderer/renderer-settings-department.js");
departments = mustReplace(departments,
  '<div class="department-settings-row sortable-settings-item" draggable="true" data-sort-category="department" data-sort-item="${escapeHtml(department.id)}" data-drop-department="${escapeHtml(department.id)}">\n         <div class="department-settings-title">',
  '<div class="department-settings-row sortable-settings-item" data-sort-category="department" data-sort-item="${escapeHtml(department.id)}" data-drop-department="${escapeHtml(department.id)}">\n         ${renderSettingsOrderDragColumn()}\n         <div class="department-settings-title">',
  "單位列拖曳把手"
);
departments = mustReplace(departments,
  '<div class="department-settings-row department-settings-head">\n             <div>單位</div>',
  '<div class="department-settings-row department-settings-head">\n             ${renderSettingsOrderDragColumn(true)}\n             <div>單位</div>',
  "單位表頭拖曳欄"
);
write("src/renderer/renderer-settings-department.js", departments);

let dragEvents = read("src/renderer/renderer-events-drag.js");
dragEvents = mustReplace(dragEvents,
  `    const sortItem = event.target.closest("[data-sort-item]");\n    if (sortItem) {\n      dragSortItemId = sortItem.dataset.sortItem || "";`,
  `    const sortItem = event.target.closest("[data-sort-item]");\n    if (sortItem) {\n      if (!event.target.closest(".settings-order-drag-handle")) {\n        event.preventDefault();\n        return;\n      }\n      dragSortItemId = sortItem.dataset.sortItem || "";`,
  "設定拖曳只允許把手"
);
write("src/renderer/renderer-events-drag.js", dragEvents);

// 3. 捲動保存改為正式、顯式註冊模組。
const dragScrollModule = `/* 拖曳排序期間保存視窗與表格捲動位置。 */
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
  dragScrollSnapshot = {
    windowX: window.scrollX,
    windowY: window.scrollY,
    entries: collectDragScrollableElements().map((element, index) => ({
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
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.scrollTo(dragScrollSnapshot.windowX, dragScrollSnapshot.windowY);
    dragScrollSnapshot.entries.forEach((entry, index) => {
      const element = findDragScrollableElement(entry.key, index);
      if (element) {
        element.scrollTop = entry.top;
        element.scrollLeft = entry.left;
      }
    });
  }));
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
  if (modalRoot) new MutationObserver(restoreDragScrollPosition).observe(modalRoot, { childList: true, subtree: true });
}`;
write("src/renderer/renderer-drag-scroll-preserve.js", dragScrollModule);

let events = read("src/renderer/renderer-events.js");
events = mustReplace(events, "  bindDragAndDropEvents();\n", "  bindDragAndDropEvents();\n  bindDragScrollPreservation();\n", "拖曳捲動事件註冊");
write("src/renderer/renderer-events.js", events);

// 4. 清理建置清單與舊檢查。
let build = read("scripts/build-js.js");
for (const file of ["v2-drag-scroll-preserve.js", "v2-settings-drag-handles.js", "v2-meal-export.js", "v2-account.js"]) {
  build = build.replace(`  "${file}",\n`, "");
}
build = mustReplace(build, '  "renderer-events-drag.js",\n', '  "renderer-events-drag.js",\n  "renderer-drag-scroll-preserve.js",\n', "拖曳捲動正式模組建置順序");
write("scripts/build-js.js", build);

let core = read("scripts/renderer-core-source.js");
core = mustReplace(core, '  "renderer-events-drag.js",\n', '  "renderer-events-drag.js",\n  "renderer-drag-scroll-preserve.js",\n', "拖曳捲動正式模組來源順序");
write("scripts/renderer-core-source.js", core);

let alignment = read("scripts/check-v2-alignment.js");
alignment = alignment.replace('  "src/renderer/v2-account.js",\n', "");
const alignmentAnchor = 'assert(!exists("src/renderer/v2-meal.js"), "Meal UI still depends on a late-loaded patch module");';
alignment = mustReplace(alignment, alignmentAnchor, `${alignmentAnchor}\n["v2-account.js", "v2-meal-export.js", "v2-settings-drag-handles.js", "v2-drag-scroll-preserve.js"].forEach((file) => assert(!exists(\`src/renderer/\${file}\`), \`Legacy renderer patch remains: \${file}\`));`, "禁止最後 V2 補丁");
write("scripts/check-v2-alignment.js", alignment);

let finalCheck = read("scripts/check-v2-final.js");
finalCheck = finalCheck.replace('  "src/renderer/v2-account.js",\n', "");
finalCheck = finalCheck.replace('  "src/renderer/v2-meal-export.js",\n', "");
finalCheck = finalCheck.replace('const sourceExport = read("src/renderer/v2-meal-export.js");', 'const sourceExport = read("src/renderer/web-api.js");');
const finalAnchor = '["v2-records.js", "v2-personal-record-layout.js", "v2-overtime-admin.js", "v2-attendance-admin.js", "v2-live-report-filters.js"].forEach((file) => assert(!exists(`src/renderer/${file}`), `記錄管理仍依賴後載入補丁：${file}`));';
finalCheck = mustReplace(finalCheck, finalAnchor, `${finalAnchor}\n["v2-account.js", "v2-meal-export.js", "v2-settings-drag-handles.js", "v2-drag-scroll-preserve.js"].forEach((file) => assert(!exists(\`src/renderer/\${file}\`), \`仍存在後載入補丁：\${file}\`));`, "V2 final 禁止最後補丁");
write("scripts/check-v2-final.js", finalCheck);

for (const file of ["src/renderer/v2-account.js", "src/renderer/v2-meal-export.js", "src/renderer/v2-settings-drag-handles.js", "src/renderer/v2-drag-scroll-preserve.js"]) {
  fs.rmSync(path.join(root, file));
}

const tests = `const fs = require("node:fs");\nconst path = require("node:path");\nconst test = require("node:test");\nconst assert = require("node:assert/strict");\n\nconst root = path.resolve(__dirname, "..");\nconst read = (file) => fs.readFileSync(path.join(root, file), "utf8");\n\ntest("renderer 不再含任何 v2 JavaScript 補丁", () => {\n  const files = fs.readdirSync(path.join(root, "src/renderer")).filter((file) => /^v2-.*\\.js$/.test(file));\n  assert.deepEqual(files, []);\n});\n\ntest("帳號刪除由正式 API 與人員模組提供", () => {\n  const api = read("src/renderer/web-api.js");\n  const members = read("src/renderer/renderer-settings-member.js");\n  assert.match(api, /async function deleteMemberProfile\\(employeeCode, currentPassword = ""\\)/);\n  assert.match(api, /currentPassword: String\\(currentPassword/);\n  assert.match(members, /請輸入目前密碼以確認刪除帳號/);\n  assert.match(members, /softDeleted/);\n  assert.doesNotMatch(members, /deleteMember\\s*=\\s*async function/);\n});\n\ntest("訂餐 Excel 由正式 web-api 唯一提供", () => {\n  const api = read("src/renderer/web-api.js");\n  assert.equal((api.match(/async function exportMealReport\\s*\\(/g) || []).length, 1);\n  assert.match(api, /row.amount - mealDays \* companySubsidy/);\n  assert.match(api, /員工姓名.*員工編號.*早餐金額.*午餐金額/s);\n  assert.doesNotMatch(api, /首次下訂時間|最後修改時間|員工工號/);\n});\n\ntest("設定拖曳把手直接由正式畫面產生", () => {\n  const source = ["renderer-settings-ordering.js", "renderer-settings-member.js", "renderer-settings-catalog.js", "renderer-settings-department.js", "renderer-events-drag.js"].map((file) => read(`src/renderer/${file}`)).join("\\n");\n  assert.match(source, /function renderSettingsOrderDragColumn/);\n  assert.match(source, /settings-order-drag-handle/);\n  assert.match(source, /!event.target.closest\\("\\.settings-order-drag-handle"\\)/);\n  assert.doesNotMatch(source, /installV2SettingsDragHandles/);\n});\n\ntest("拖曳捲動保存由正式事件總控註冊", () => {\n  const moduleSource = read("src/renderer/renderer-drag-scroll-preserve.js");\n  const events = read("src/renderer/renderer-events.js");\n  assert.match(moduleSource, /function bindDragScrollPreservation/);\n  assert.match(moduleSource, /restoreDragScrollPosition/);\n  assert.match(events, /bindDragScrollPreservation\\(\\)/);\n});\n`;
write("tests/renderer-final-v2-consolidation.test.js", tests);

let spec = read("規格書.md");
if (!spec.includes("### 前端不得保留 V2 後載入補丁")) {
  spec += `\n\n### 前端不得保留 V2 後載入補丁\n\n- ` + "`src/renderer`" + ` 不得再保留 ` + "`v2-*.js`" + ` 後載入補丁。\n- 帳號刪除、訂餐 Excel、設定拖曳把手與拖曳捲動保存均由正式模組提供。\n- 設定頁拖曳欄位必須在 HTML 產生時直接輸出，不得依賴 MutationObserver 補入欄位。\n`;
}
write("規格書.md", spec);

console.log("Final V2 patches consolidated.");
