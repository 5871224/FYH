const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const rendererDir = path.join(root, "src", "renderer");

const modules = [
  "browser-exporter.js",
  "rest-compliance.js",
  "web-api.js",
  "v2-api.js",
  "v2-attendance-status.js",
  "v2-meal-api.js",
  "renderer.js",
  "v2-auto-fill-schedule.js",
  "v2-cross-department-member-drag.js",
  "v2-admin-data-fixes.js",
  "v2-member-order.js",
  "v2-settings-drag-handles.js",
  "v2-meal.js",
  "v2-meal-export.js",
  "v2-records.js",
  "v2-personal-record-layout.js",
  "v2-overtime-admin.js",
  "v2-live-report-filters.js",
  "v2-overtime-employee.js",
  "v2-clock-page-refinement.js",
  "v2-account.js",
  "v2-schedule-history-controls.js"
];

function file(relativePath) {
  return path.join(root, relativePath);
}

function read(relativePath) {
  return fs.readFileSync(file(relativePath), "utf8");
}

function write(relativePath, content) {
  fs.writeFileSync(file(relativePath), content, "utf8");
}

function replaceOnce(text, search, replacement, label) {
  if (!text.includes(search)) throw new Error(`找不到待更新內容：${label}`);
  return text.replace(search, replacement);
}

function removeDynamicLoaders() {
  let api = read("src/renderer/v2-api.js");
  const apiPattern = /\n\s*window\.addEventListener\("load", \(\) => \{[\s\S]*?\n\s*\}, \{ once: true \}\);\n(?=\}\)\(\);)/;
  if (!apiPattern.test(api)) throw new Error("找不到 v2-api.js 動態補載區塊");
  api = api.replace(apiPattern, "\n");
  write("src/renderer/v2-api.js", api);

  let account = read("src/renderer/v2-account.js");
  const accountPattern = /\n\s*if \(!document\.querySelector\('script\[data-v2-module="v2-records\.js"\]'\)\) \{[\s\S]*?\n\s*\}\n(?=\}\)\(\);)/;
  if (!accountPattern.test(account)) throw new Error("找不到 v2-account.js 動態補載區塊");
  account = account.replace(accountPattern, "\n");
  write("src/renderer/v2-account.js", account);
}

function rewriteIndex() {
  const indexPath = "src/renderer/index.html";
  const lines = read(indexPath).split(/\r?\n/);
  const output = [];
  const removed = [];
  let insertedApp = false;
  let foundConfig = false;

  for (const line of lines) {
    const match = line.match(/<script\s+[^>]*src=["']\.\/([^"'?]+\.js)(?:\?[^"']*)?["'][^>]*><\/script>/);
    if (!match) {
      output.push(line);
      continue;
    }

    const name = match[1];
    if (name === "app-config.js") {
      output.push(line);
      const indent = line.match(/^\s*/)?.[0] || "";
      output.push(`${indent}<script src="./app.js"></script>`);
      foundConfig = true;
      insertedApp = true;
      continue;
    }

    if (name === "app.js") continue;
    if (!modules.includes(name)) throw new Error(`index.html 有未納入 bundle 的本機 JavaScript：${name}`);
    removed.push(name);
  }

  if (!foundConfig || !insertedApp) throw new Error("index.html 缺少 app-config.js 或無法插入 app.js");
  const missing = modules.filter((name) => !removed.includes(name));
  if (missing.length) throw new Error(`index.html 未找到預期模組：${missing.join(", ")}`);
  write(indexPath, output.join("\n"));
}

function updatePackage() {
  const packagePath = "package.json";
  const pkg = JSON.parse(read(packagePath));
  pkg.scripts = {
    "css:build": "node scripts/build-css.js",
    "css:check": "node scripts/build-css.js --check",
    "js:build": "node scripts/build-js.js",
    "js:check": "node scripts/build-js.js --check && node --check src/renderer/app.js",
    "web": "node scripts/build-css.js && node scripts/build-js.js && node src/web-server.js",
    "web:check": "node scripts/check-public-supabase.js",
    "web:publish": "node scripts/build-css.js && node scripts/build-js.js && node scripts/publish-static-web.js",
    "v2:check": "node scripts/build-css.js --check && node scripts/build-js.js --check && node --check src/renderer/app.js && node scripts/check-v2-alignment.js && node scripts/check-v2-final.js"
  };
  write(packagePath, JSON.stringify(pkg, null, 2) + "\n");
}

function updatePublisher() {
  let text = read("scripts/publish-static-web.js");
  text = replaceOnce(
    text,
    '// CSS modules are development sources; production publishes only the generated app.css.\nconst sourceOnlyDirectories = new Set(["css"]);',
    '// CSS modules and individual JavaScript modules are development sources.\n// Production publishes only app.css, app-config.js and the generated app.js.\nconst sourceOnlyDirectories = new Set(["css"]);\nconst publishedJavaScriptFiles = new Set(["app-config.js", "app.js"]);',
    "發布來源說明"
  );
  text = replaceOnce(
    text,
    '    } else if (entry.isFile()) {\n      files.push(relative);\n    }',
    '    } else if (entry.isFile()) {\n      if (!prefix && entry.name.endsWith(".js") && !publishedJavaScriptFiles.has(entry.name)) continue;\n      files.push(relative);\n    }',
    "排除個別 JavaScript 原始檔"
  );
  text = replaceOnce(
    text,
    '  await fs.access(path.join(sourceDir, "app.css"));',
    '  await fs.access(path.join(sourceDir, "app.css"));\n  await fs.access(path.join(sourceDir, "app.js"));',
    "確認 app.js"
  );
  write("scripts/publish-static-web.js", text);
}

function updateAlignmentCheck() {
  let text = read("scripts/check-v2-alignment.js");
  text = replaceOnce(
    text,
    'const sourceApi = read("src/renderer/v2-api.js");\nconst publishedApi = read("docs/v2-api.js");\nassert(sourceApi === publishedApi, "src/renderer/v2-api.js and docs/v2-api.js are not synchronized");\nassert(sourceApi.includes("safeDepartmentColumns"), "Safe department projection is missing");\nassert(sourceApi.includes("runManagerSafeWrite"), "Manager-safe department write wrapper is missing");',
    'const sourceApi = read("src/renderer/v2-api.js");\nassert(sourceApi.includes("safeDepartmentColumns"), "Safe department projection is missing");\nassert(sourceApi.includes("runManagerSafeWrite"), "Manager-safe department write wrapper is missing");\nconst sourceJs = read("src/renderer/app.js");\nconst docsJs = read("docs/app.js");\nassert(sourceJs === docsJs, "src/renderer/app.js and docs/app.js are not synchronized");\nassert(sourceJs.includes("safeDepartmentColumns") && sourceJs.includes("runManagerSafeWrite"), "JavaScript bundle is missing V2 API protections");',
    "V2 API bundle 驗證"
  );
  text = replaceOnce(
    text,
    'assert(sourceIndex.includes("v2-api.js"), "Source index does not load v2-api.js");\nassert(docsIndex.includes("v2-api.js"), "Published index does not load v2-api.js");\nassert(sourceIndex.includes("v2-overtime-employee.js"), "Source index does not load the employee overtime module");\nassert(docsIndex.includes("v2-overtime-employee.js"), "Published index does not load the employee overtime module");\n\nconst docsRecords = read("docs/v2-records.js");\nconst docsAttendance = read("docs/v2-attendance-admin.js");\nassert(!docsRecords.includes("document.write"), "Published records loader may overwrite the page");\nassert(!docsAttendance.includes("document.write"), "Published attendance loader may overwrite the page");',
    'assert(sourceIndex.includes("app-config.js") && sourceIndex.includes("app.js") && !sourceIndex.includes("v2-api.js"), "Source index must load only app-config.js and bundled app.js");\nassert(docsIndex.includes("app-config.js") && docsIndex.includes("app.js") && !docsIndex.includes("v2-api.js"), "Published index must load only app-config.js and bundled app.js");\nassert(!sourceJs.includes("document.write"), "JavaScript bundle may overwrite the page");\nconst publishedJsFiles = fs.readdirSync(path.join(root, "docs")).filter((name) => name.endsWith(".js"));\nassert(publishedJsFiles.every((name) => name === "app-config.js" || name === "app.js"), `Unexpected JavaScript source modules in docs: ${publishedJsFiles.join(", ")}`);',
    "入口與發布 JavaScript 驗證"
  );
  write("scripts/check-v2-alignment.js", text);
}

function updateFinalCheck() {
  let text = read("scripts/check-v2-final.js");
  const lines = text.split(/\r?\n/);
  const output = [];
  let inRequired = false;
  let insertedBundleFiles = false;

  for (const line of lines) {
    if (line.startsWith("const required = [")) inRequired = true;
    if (inRequired && /"docs\/[^"\n]+\.js"/.test(line)) continue;
    output.push(line);
    if (inRequired && line.includes('"src/renderer/v2-api.js"') && !insertedBundleFiles) {
      output.push('  "src/renderer/app.js",');
      output.push('  "docs/app.js",');
      output.push('  "scripts/build-js.js",');
      insertedBundleFiles = true;
    }
    if (inRequired && line.trim() === "];" ) inRequired = false;
  }
  text = output.join("\n");

  const publishedVariables = [
    "publishedApi",
    "publishedRenderer",
    "publishedNoOvertimeSuggestion",
    "publishedOvertimeUi",
    "publishedMeal",
    "publishedMealApi",
    "publishedExport",
    "publishedRecords"
  ];
  for (const variable of publishedVariables) {
    text = text.replace(new RegExp(`\\nconst ${variable} = read\\(\"docs\\/[^\"]+\"\\);`, "g"), "");
    text = text.replace(new RegExp(`\\nassert\\([^\\n]*${variable}[^\\n]*\\);`, "g"), "");
  }

  text = replaceOnce(
    text,
    'const sourceApi = read("src/renderer/v2-api.js");',
    'const sourceApi = read("src/renderer/v2-api.js");\nconst sourceApp = read("src/renderer/app.js");\nconst publishedApp = read("docs/app.js");\nassert(sourceApp === publishedApp, "src/renderer/app.js 與 docs/app.js 不同步");',
    "正式檢查 app.js"
  );

  const indexStart = text.indexOf('const sourceIndex = read("src/renderer/index.html");');
  const consoleStart = text.indexOf('console.log(`V2 final checks passed', indexStart);
  if (indexStart < 0 || consoleStart < 0) throw new Error("找不到 V2 final 入口檢查區塊");
  const replacement = `const sourceIndex = read("src/renderer/index.html");
const publishedIndex = read("docs/index.html");
assert(sourceIndex.includes("app-config.js") && sourceIndex.includes("app.js") && !sourceIndex.includes("v2-api.js"), "來源頁必須只載入 app-config.js 與 app.js");
assert(publishedIndex.includes("app-config.js") && publishedIndex.includes("app.js") && !publishedIndex.includes("v2-api.js"), "發布頁必須只載入 app-config.js 與 app.js");
assert(sourceApp.includes("installV2ApiOverrides") && sourceApp.includes("installV2MealUi") && sourceApp.includes("installV2RecordsUi"), "JavaScript bundle 缺少必要 V2 模組");
const publishedJsFiles = fs.readdirSync(path.join(root, "docs")).filter((name) => name.endsWith(".js"));
assert(publishedJsFiles.every((name) => name === "app-config.js" || name === "app.js"), \`docs 含有不應發布的 JavaScript 原始模組：\${publishedJsFiles.join(", ")}\`);

`;
  text = text.slice(0, indexStart) + replacement + text.slice(consoleStart);
  write("scripts/check-v2-final.js", text);
}

function updateReadme() {
  let text = read("README.md");
  text = replaceOnce(
    text,
    '- `src/renderer/`：前端原始碼與自動產生的 `app.css`。\n- `src/renderer/css/`：模組化 CSS 唯一原始來源；分為基礎、班表、共用元件、響應式與頁面專屬樣式。',
    '- `src/renderer/`：HTML、部署設定、前端 JavaScript 模組，以及自動產生的 `app.css`、`app.js`。\n- `src/renderer/css/`：模組化 CSS 唯一原始來源；分為基礎、班表、共用元件、響應式與頁面專屬樣式。\n- `scripts/build-js.js`：依固定順序把現行 JavaScript 模組合併成單一 `app.js`；第一階段保留既有全域行為。',
    "README 專案結構"
  );
  text = replaceOnce(
    text,
    'npm run css:build\nnpm run css:check\nnpm run web',
    'npm run css:build\nnpm run css:check\nnpm run js:build\nnpm run js:check\nnpm run web',
    "README 指令列表"
  );
  text = replaceOnce(
    text,
    '- `npm run css:check`：確認 `app.css` 與 CSS 模組及快取版本一致。\n- `npm run web`：先建立 CSS bundle，再啟動本機靜態預覽伺服器。\n- `npm run web:check`：檢查公開 Supabase 設定。\n- `npm run web:publish`：建立 CSS bundle、清理並重建 `docs/`，再更新靜態資源版本參數。\n- `npm run v2:check`：檢查 CSS bundle、V2 結構與發布內容對齊。',
    '- `npm run css:check`：確認 `app.css` 與 CSS 模組及快取版本一致。\n- `npm run js:build`：依固定清單與既有載入順序產生單一 `src/renderer/app.js`。\n- `npm run js:check`：確認 `app.js`、來源模組、入口版本及 JavaScript 語法一致。\n- `npm run web`：先建立 CSS 與 JavaScript bundle，再啟動本機靜態預覽伺服器。\n- `npm run web:check`：檢查公開 Supabase 設定。\n- `npm run web:publish`：建立兩種 bundle、清理並重建 `docs/`，再更新靜態資源版本參數。\n- `npm run v2:check`：檢查 CSS、JavaScript bundle、V2 結構與發布內容對齊。',
    "README 指令說明"
  );
  text = replaceOnce(
    text,
    '1. CSS 只修改 `src/renderer/css/` 中對應模組，不直接修改 `app.css` 或 `docs/`。\n2. JavaScript、HTML 及其他前端來源只修改 `src/renderer/`。',
    '1. CSS 只修改 `src/renderer/css/` 中對應模組，不直接修改 `app.css` 或 `docs/`。\n2. JavaScript 修改現有責任模組，不直接修改 `app.js`；不得新增依靠後載入覆寫前檔的 `fix`、`refinement` 或新版本補丁檔。\n3. `app-config.js` 是部署環境設定，維持獨立載入；其他正式前端程式由 `app.js` 提供。\n4. HTML 及其他前端來源只修改 `src/renderer/`。',
    "README 前端來源規則"
  );
  text = text.replace('3. 完成後執行：', '5. 完成後執行：');
  text = replaceOnce(
    text,
    '4. 發布腳本會把 CSS 模組依固定順序合併成單一 `app.css`，清理舊的 `docs/` 後完整重建發布內容。\n5. GitHub Pages 工作流程也會在上傳前執行 `npm run web:publish`，避免發布舊 bundle。',
    '6. 發布腳本會依固定順序產生單一 `app.css` 與 `app.js`，清理舊的 `docs/` 後完整重建發布內容。\n7. `docs/` 只發布 `app-config.js` 與 `app.js`，不發布個別 JavaScript 原始模組。\n8. GitHub Pages 工作流程也會在上傳前執行 `npm run web:publish`，避免發布舊 bundle。',
    "README 發布說明"
  );
  text = replaceOnce(
    text,
    'node --check src/renderer/renderer.js\nnode --check src/renderer/web-api.js\nnode --check src/renderer/v2-auto-fill-schedule.js',
    'npm run css:check\nnpm run js:check\nnode --check src/renderer/renderer.js\nnode --check src/renderer/web-api.js\nnode --check src/renderer/v2-auto-fill-schedule.js',
    "README 驗證指令"
  );
  write("README.md", text);
}

function updateAgents() {
  let text = read("AGENTS.md");
  text = replaceOnce(
    text,
    '- CSS 產生檔：`src/renderer/app.css`、`docs/app.css`（不得直接修改）\n- GitHub Pages 發布檔案：`docs/`',
    '- CSS 產生檔：`src/renderer/app.css`、`docs/app.css`（不得直接修改）\n- JavaScript 模組：`src/renderer/*.js`；正式順序以 `scripts/build-js.js` 為準\n- JavaScript 產生檔：`src/renderer/app.js`、`docs/app.js`（不得直接修改）\n- GitHub Pages 發布檔案：`docs/`',
    "AGENTS 主要目錄"
  );
  text = replaceOnce(
    text,
    '4. 共用按鈕、表單、頁籤、卡片、彈窗與一般表格以 `css/components.css` 為唯一正式規則；頁面檔只保留無法共用的差異。\n5. 若前端程式有修改，且使用者未明確要求不要提交，應提交並推送至 `main`。\n6. 最終回覆必須說明：',
    '4. 共用按鈕、表單、頁籤、卡片、彈窗與一般表格以 `css/components.css` 為唯一正式規則；頁面檔只保留無法共用的差異。\n5. JavaScript 不得直接修改 `app.js`；修改現有模組後由 `npm run js:build` 產生 bundle。\n6. 不得新增動態補載本機 JavaScript、重複載入同一模組，或新增 `fix`、`refinement`、`v3` 等靠載入順序覆寫既有函式的補丁檔。\n7. 第一階段仍保留既有全域相依性；調整 `scripts/build-js.js` 的模組順序前，必須確認所有前置依賴並執行完整驗證。\n8. 若前端程式有修改，且使用者未明確要求不要提交，應提交並推送至 `main`。\n9. 最終回覆必須說明：',
    "AGENTS JavaScript 規則"
  );
  text = replaceOnce(
    text,
    '- 前端修改後執行 `npm run web:publish`，確認 `src/renderer/app.css` 與 `docs/app.css` 一致，且入口只載入單一 `app.css`。',
    '- 前端修改後執行 `npm run web:publish`，確認 `app.css`、`app.js` 與 `docs/` 一致；入口只載入單一 `app.css`，本機 JavaScript 只載入 `app-config.js` 與單一 `app.js`。\n- JavaScript 修改後至少執行 `npm run js:check`；功能模組仍需保留在 `scripts/build-js.js` 的固定順序清單中。',
    "AGENTS 驗證原則"
  );
  write("AGENTS.md", text);
}

function updateSpec() {
  let text = read("規格書.md");
  const oldPublish = `### 5.8.3 發佈

1. 前端原始碼位於 \`src/renderer/\`，CSS 唯一原始碼位於 \`src/renderer/css/\`。
2. \`src/renderer/app.css\` 與 \`docs/\` 均為建置／發布產物，不直接手動修改。
3. 修改前端後執行 \`npm run web:publish\`，由腳本建立 CSS bundle、清理並重建 \`docs/\`。
4. CSS 或 JavaScript 內容變更時更新靜態資源版本，避免瀏覽器使用舊快取。
5. Edge Function 修改後部署到同一個 Supabase 專案。
6. 資料庫結構修改使用現行正式 SQL，執行順序依 README 與第五章規格。
7. GitHub Pages 由 \`.github/workflows/deploy-pages.yml\` 自動部署。
8. Pages 工作流程使用 \`ubuntu-latest\`，並在上傳 artifact 前設定 Node.js、執行 \`npm run web:publish\` 與必要檢查。
9. Pages Action 使用 \`actions/checkout@v5\`、\`actions/setup-node@v4\`、\`actions/configure-pages@v5\`、\`actions/upload-pages-artifact@v5\`、\`actions/deploy-pages@v5\`。
10. 發佈前必須確認入口只載入單一 \`app.css\`，且 JavaScript 語法、CSS bundle、V2 對齊及主要驗收案例通過。
`;
  const newPublish = `### 5.8.3 發佈

1. 前端原始碼位於 \`src/renderer/\`，CSS 唯一原始碼位於 \`src/renderer/css/\`。
2. \`src/renderer/app.css\`、\`src/renderer/app.js\` 與 \`docs/\` 均為建置／發布產物，不直接手動修改。
3. 修改前端後執行 \`npm run web:publish\`，由腳本建立 CSS 與 JavaScript bundle、清理並重建 \`docs/\`。
4. CSS 或 JavaScript 內容變更時更新靜態資源版本，避免瀏覽器使用舊快取。
5. Edge Function 修改後部署到同一個 Supabase 專案。
6. 資料庫結構修改使用現行正式 SQL，執行順序依 README 與第五章規格。
7. GitHub Pages 由 \`.github/workflows/deploy-pages.yml\` 自動部署。
8. Pages 工作流程使用 \`ubuntu-latest\`，並在上傳 artifact 前設定 Node.js、執行 \`npm run web:publish\` 與必要檢查。
9. Pages Action 使用 \`actions/checkout@v5\`、\`actions/setup-node@v4\`、\`actions/configure-pages@v5\`、\`actions/upload-pages-artifact@v5\`、\`actions/deploy-pages@v5\`。
10. 發佈前必須確認入口只載入單一 \`app.css\`，本機 JavaScript 只載入 \`app-config.js\` 與單一 \`app.js\`，且語法、bundle、V2 對齊及主要驗收案例通過。

### 5.8.4 JavaScript 架構與漸進式整理

1. 前端採「原始碼分檔、正式發布單一化」。既有功能模組維持獨立原始檔，\`scripts/build-js.js\` 依固定順序產生 \`src/renderer/app.js\`，發布後為 \`docs/app.js\`。
2. \`app-config.js\` 保存公開部署設定，必須在 \`app.js\` 前獨立載入；除外部 ExcelJS 外，入口不得再直接載入其他本機 JavaScript。
3. \`app.js\` 為自動產生檔，不得直接修改。\`docs/\` 不發布個別 JavaScript 原始模組。
4. 禁止在執行期間以 \`document.createElement("script")\` 補載本機功能檔，也禁止依靠不同快取版本或載入時機重複載入模組。
5. 第一階段為相容性 bundle：保留既有全域函式、全域狀態與原始載入順序，不在同一次異動全面改寫成 ES Modules。
6. 後續應逐步把共用 API 呼叫、日期格式、驗證、狀態管理與各功能頁拆成明確責任模組，並消除後載入檔案覆寫前一版本函式的做法。
7. 不得新增 \`fix\`、\`refinement\`、\`final\`、\`v3\` 等補丁型 JavaScript；需求應修改責任正確的現有模組，或建立具明確功能名稱的新模組並加入固定建置清單。
8. 每次修改模組順序、移除覆寫或轉換為 ES Modules 時，必須分階段執行並通過 \`npm run js:check\`、\`npm run web:publish\`、\`npm run v2:check\` 與相關功能驗收。
`;
  text = replaceOnce(text, oldPublish, newPublish, "規格書 JavaScript 架構");
  write("規格書.md", text);
}

removeDynamicLoaders();
rewriteIndex();
updatePackage();
updatePublisher();
updateAlignmentCheck();
updateFinalCheck();
updateReadme();
updateAgents();
updateSpec();
console.log("JavaScript architecture migration completed");
