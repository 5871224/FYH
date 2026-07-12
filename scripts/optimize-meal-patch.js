const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (file, content) => fs.writeFileSync(path.join(root, file), content, "utf8");

function mustReplace(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`找不到替換位置：${label}`);
  return source.replace(from, to);
}

function extractFunction(source, marker) {
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`找不到函式：${marker}`);
  const braceStart = source.indexOf("{", start);
  if (braceStart < 0) throw new Error(`找不到函式起始大括號：${marker}`);
  let depth = 0;
  let state = "code";
  let escaped = false;
  for (let index = braceStart; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (state === "lineComment") {
      if (char === "\n") state = "code";
      continue;
    }
    if (state === "blockComment") {
      if (char === "*" && next === "/") {
        state = "code";
        index += 1;
      }
      continue;
    }
    if (state === "single" || state === "double" || state === "template") {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if ((state === "single" && char === "'") || (state === "double" && char === '"') || (state === "template" && char === "`")) {
        state = "code";
      }
      continue;
    }
    if (char === "/" && next === "/") {
      state = "lineComment";
      index += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      state = "blockComment";
      index += 1;
      continue;
    }
    if (char === "'") {
      state = "single";
      continue;
    }
    if (char === '"') {
      state = "double";
      continue;
    }
    if (char === "`") {
      state = "template";
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`函式未完整結束：${marker}`);
}

function replaceFunctionToEnd(file, marker, replacement) {
  const source = read(file);
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`找不到 ${file} 的 ${marker}`);
  write(file, `${source.slice(0, start).trimEnd()}\n\n${replacement.trim()}\n`);
}

const patchPath = "src/renderer/v2-meal.js";
const patch = read(patchPath);
const mealPagePath = "src/renderer/renderer-meal-page.js";
const mainPagesPath = "src/renderer/renderer-main-pages.js";
const recordsViewsPath = "src/renderer/renderer-records-views.js";
const recordsActionsPath = "src/renderer/renderer-records-actions.js";
const formEventsPath = "src/renderer/renderer-events-form.js";
const clickEventsPath = "src/renderer/renderer-events-click.js";
const dragEventsPath = "src/renderer/renderer-events-drag.js";

const helpers = [
  extractFunction(patch, "function isMealQuantityInput(target)"),
  extractFunction(patch, "function isCompanySubsidyInput(target)"),
  extractFunction(patch, "function rejectInput(input, event, message)"),
  extractFunction(patch, "function rejectQuantityInput(input, event)"),
  extractFunction(patch, "function validateItems(items)").replace("function validateItems", "function validateMealOrderItems"),
  extractFunction(patch, "function applyLimits()").replace("function applyLimits", "function applyMealInputLimits")
].join("\n\n");

let mealPage = read(mealPagePath);
mealPage = mustReplace(
  mealPage,
  " */\n\nasync function loadTodayMealOrder()",
  ` */\n\nconst MEAL_QUANTITY_ERROR = "訂餐數量只能輸入 0 或正整數";\nconst MEAL_SUBSIDY_ERROR = "公司補助只能輸入正整數";\n\n${helpers.replaceAll("quantityError", "MEAL_QUANTITY_ERROR").replaceAll("subsidyError", "MEAL_SUBSIDY_ERROR")}\n\nasync function loadTodayMealOrder()`,
  "訂餐正式工具"
);
let saveMealOrder = extractFunction(patch, "async function saveV2MealOrder()")
  .replace("async function saveV2MealOrder", "async function saveTodayMealOrder")
  .replace("validateItems(items)", "validateMealOrderItems(items)");
replaceFunctionToEnd(mealPagePath, "async function saveTodayMealOrder()", saveMealOrder);
mealPage = read(mealPagePath);
if (!mealPage.includes("function validateMealOrderItems")) {
  throw new Error("訂餐工具未寫入正式模組");
}

let mainPages = read(mainPagesPath);
const mainPagesEnd = mainPages.lastIndexOf("\n}");
if (mainPagesEnd < 0 || !mainPages.slice(mainPages.lastIndexOf("function renderMealPage()"), mainPagesEnd).includes("mealCard.innerHTML")) {
  throw new Error("找不到 renderMealPage 結尾");
}
mainPages = `${mainPages.slice(0, mainPagesEnd)}\n  applyMealInputLimits();${mainPages.slice(mainPagesEnd)}`;
write(mainPagesPath, mainPages);

const renderMealSettings = extractFunction(patch, "function renderV2MealSettingsSection()")
  .replace("function renderV2MealSettingsSection", "function renderMealSettingsSection");
replaceFunctionToEnd(recordsViewsPath, "function renderMealSettingsSection()", renderMealSettings);

const deleteMealProduct = extractFunction(patch, "async function deleteMealProduct(button)");
const saveMealSettings = extractFunction(patch, "async function saveV2MealSettingsFromPage()")
  .replace("async function saveV2MealSettingsFromPage", "async function saveMealSettingsFromPage")
  .replaceAll("subsidyError", "MEAL_SUBSIDY_ERROR");
replaceFunctionToEnd(
  recordsActionsPath,
  "async function saveMealSettingsFromPage()",
  `${deleteMealProduct}\n\n${saveMealSettings}`
);

let formEvents = read(formEventsPath);
formEvents = mustReplace(
  formEvents,
  `    if (target.dataset.mealProductId) {\n      target.value = String(Math.max(0, Math.floor(Number(target.value || 0) || 0)));\n      updateMealOrderLiveSummary();\n      return;\n    }`,
  `    if (isMealQuantityInput(target)) {\n      const raw = target.value.trim();\n      if (raw !== "" && !/^\\d+$/.test(raw)) {\n        target.value = target.dataset.lastValidMealQuantity || "0";\n        rejectQuantityInput(target, event);\n        return;\n      }\n      target.setCustomValidity("");\n      target.dataset.lastValidMealQuantity = raw || "0";\n      updateMealOrderLiveSummary();\n      return;\n    }\n    if (isCompanySubsidyInput(target)) {\n      const raw = target.value.trim();\n      if (raw !== "" && !/^[1-9]\\d*$/.test(raw)) {\n        target.value = target.dataset.lastValidCompanySubsidy || "55";\n        rejectInput(target, event, MEAL_SUBSIDY_ERROR);\n        return;\n      }\n      target.setCustomValidity("");\n      if (raw) target.dataset.lastValidCompanySubsidy = raw;\n      return;\n    }`,
  "訂餐輸入事件"
);
const extraFormEvents = `\n\n  document.addEventListener("keydown", (event) => {\n    const input = event.target;\n    if (isMealQuantityInput(input) && ["-", "+", ".", ",", "e", "E"].includes(event.key)) {\n      rejectQuantityInput(input, event);\n    }\n    if (isCompanySubsidyInput(input) && ["-", "+", ".", ",", "e", "E"].includes(event.key)) {\n      rejectInput(input, event, MEAL_SUBSIDY_ERROR);\n    }\n  }, true);\n\n  document.addEventListener("beforeinput", (event) => {\n    const input = event.target;\n    if (!(input instanceof HTMLInputElement) || !String(event.inputType || "").startsWith("insert")) return;\n    if (event.inputType === "insertFromPaste") return;\n    const start = Number.isInteger(input.selectionStart) ? input.selectionStart : input.value.length;\n    const end = Number.isInteger(input.selectionEnd) ? input.selectionEnd : start;\n    const nextValue = \`\${input.value.slice(0, start)}\${event.data || ""}\${input.value.slice(end)}\`;\n    if (isMealQuantityInput(input) && !/^\\d*$/.test(nextValue)) rejectQuantityInput(input, event);\n    if (isCompanySubsidyInput(input) && !/^(?:|[1-9]\\d*)$/.test(nextValue)) rejectInput(input, event, MEAL_SUBSIDY_ERROR);\n  }, true);\n\n  document.addEventListener("paste", (event) => {\n    const input = event.target;\n    if (!(input instanceof HTMLInputElement)) return;\n    const pasted = event.clipboardData?.getData("text")?.trim() || "";\n    if (isMealQuantityInput(input) && !/^\\d+$/.test(pasted)) rejectQuantityInput(input, event);\n    if (isCompanySubsidyInput(input) && !/^[1-9]\\d*$/.test(pasted)) rejectInput(input, event, MEAL_SUBSIDY_ERROR);\n  }, true);`;
const formEnd = formEvents.lastIndexOf("\n}");
if (formEnd < 0) throw new Error("找不到表單事件模組結尾");
formEvents = `${formEvents.slice(0, formEnd)}${extraFormEvents}${formEvents.slice(formEnd)}`;
write(formEventsPath, formEvents);

let clickEvents = read(clickEventsPath);
clickEvents = mustReplace(
  clickEvents,
  `    if (target.dataset.addMealProduct) {\n      recordsState.mealAdmin.products = [...recordsState.mealAdmin.products, { id: "", name: "", price: 0, is_active: true }];\n      renderAll();\n      return;\n    }`,
  `    if (target.dataset.addMealProduct) {\n      recordsState.mealAdmin.products = [...recordsState.mealAdmin.products, { id: "", name: "", price: 0, is_active: true }];\n      renderAll();\n      return;\n    }\n    if (target.dataset.deleteMealProduct !== undefined) {\n      await deleteMealProduct(target);\n      return;\n    }`,
  "訂餐品項刪除事件"
);
write(clickEventsPath, clickEvents);

let dragEvents = read(dragEventsPath);
dragEvents = mustReplace(
  dragEvents,
  `    const mealProductRow = event.target.closest("[data-meal-product-row]");\n    if (mealProductRow) {\n      dragMealProductIndex = mealProductRow.dataset.mealProductRow || "";\n      event.dataTransfer.effectAllowed = "move";\n      event.dataTransfer.setData("text/plain", dragMealProductIndex);\n      return;\n    }`,
  `    const mealProductRow = event.target.closest("[data-meal-product-row]");\n    if (mealProductRow) {\n      if (!event.target.closest(".meal-drag-handle")) {\n        event.preventDefault();\n        return;\n      }\n      dragMealProductIndex = mealProductRow.dataset.mealProductRow || "";\n      event.dataTransfer.effectAllowed = "move";\n      event.dataTransfer.setData("text/plain", dragMealProductIndex);\n      return;\n    }`,
  "訂餐拖曳把手"
);
write(dragEventsPath, dragEvents);

let buildJs = read("scripts/build-js.js");
buildJs = mustReplace(buildJs, '  "v2-meal.js",\n', "", "建置清單移除 v2-meal");
write("scripts/build-js.js", buildJs);

let v2Check = read("scripts/check-v2-final.js");
v2Check = mustReplace(v2Check, '  "src/renderer/v2-meal.js",\n', "", "V2 必要檔移除 v2-meal");
v2Check = mustReplace(
  v2Check,
  'const sourceMeal = read("src/renderer/v2-meal.js");',
  `const sourceMeal = [\n  "src/renderer/renderer-main-pages.js",\n  "src/renderer/renderer-meal-page.js",\n  "src/renderer/renderer-records-views.js",\n  "src/renderer/renderer-records-actions.js",\n  "src/renderer/renderer-events-form.js",\n  "src/renderer/renderer-events-click.js",\n  "src/renderer/renderer-events-drag.js"\n].map(read).join("\\n");\nassert(!exists("src/renderer/v2-meal.js"), "訂餐仍依賴後載入補丁模組");`,
  "V2 訂餐來源"
);
write("scripts/check-v2-final.js", v2Check);

fs.rmSync(path.join(root, patchPath));

const testContent = `const fs = require("node:fs");\nconst path = require("node:path");\nconst test = require("node:test");\nconst assert = require("node:assert/strict");\n\nconst root = path.resolve(__dirname, "..");\nconst read = (file) => fs.readFileSync(path.join(root, file), "utf8");\nconst mealSources = [\n  "src/renderer/renderer-main-pages.js",\n  "src/renderer/renderer-meal-page.js",\n  "src/renderer/renderer-records-views.js",\n  "src/renderer/renderer-records-actions.js",\n  "src/renderer/renderer-events-form.js",\n  "src/renderer/renderer-events-click.js",\n  "src/renderer/renderer-events-drag.js"\n].map(read).join("\\n");\n\ntest("訂餐功能不再依賴 v2 補丁檔", () => {\n  assert.equal(fs.existsSync(path.join(root, "src/renderer/v2-meal.js")), false);\n  assert.doesNotMatch(read("scripts/build-js.js"), /v2-meal\\.js/);\n});\n\ntest("訂餐正式函式各只有一份宣告且沒有後載入覆蓋", () => {\n  for (const name of ["renderMealPage", "renderMealSettingsSection", "saveMealSettingsFromPage", "saveTodayMealOrder"]) {\n    const declarations = mealSources.match(new RegExp(\`(?:async\\\\s+)?function\\\\s+\${name}\\\\s*\\\\(\`, "g")) || [];\n    assert.equal(declarations.length, 1, \`\${name} 應只有一份正式實作\`);\n    assert.doesNotMatch(mealSources, new RegExp(\`\${name}\\\\s*=\\\\s*(?:async\\\\s+)?function\`));\n  }\n});\n\ntest("訂餐驗證、刪除與拖曳把手均由正式模組提供", () => {\n  assert.match(mealSources, /addEventListener\\("beforeinput"/);\n  assert.match(mealSources, /addEventListener\\("paste"/);\n  assert.match(mealSources, /lastValidMealQuantity/);\n  assert.match(mealSources, /data-meal-company-subsidy/);\n  assert.match(mealSources, /data-delete-meal-product/);\n  assert.match(mealSources, /async function deleteMealProduct/);\n  assert.match(mealSources, /closest\\("\\.meal-drag-handle"\\)/);\n});\n`;
write("tests/renderer-meal-consolidation.test.js", testContent);

const specPath = "規格書.md";
let spec = read(specPath);
const specBlock = `\n\n### 前端正式模組單一來源規則\n\n- 已拆分完成的功能不得再以後載入檔案重新指定既有函式。\n- 訂餐畫面、輸入驗證、儲存、品項刪除與拖曳排序均由正式 renderer 模組提供。\n- 同一功能只能保留一份正式函式實作；歷史補丁檔應在行為測試通過後移除。\n`;
if (!spec.includes("### 前端正式模組單一來源規則")) spec += specBlock;
write(specPath, spec);

console.log("Meal patch consolidation prepared.");
