const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const sourceDir = path.join(root, "src", "renderer");
const cssDir = path.join(sourceDir, "css");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function write(relativePath, content) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
}

function stripBom(text) {
  return text.replace(/^\uFEFF/, "");
}

function replaceSection(text, startMarker, endMarker, replacement) {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) {
    throw new Error(`找不到文件區段：${startMarker} → ${endMarker}`);
  }
  return `${text.slice(0, start)}${replacement.trimEnd()}\n\n${text.slice(end)}`;
}

function moveFile(oldRelativePath, newRelativePath) {
  const oldPath = path.join(root, oldRelativePath);
  const newPath = path.join(root, newRelativePath);
  if (!fs.existsSync(oldPath)) {
    if (fs.existsSync(newPath)) return;
    throw new Error(`找不到待移動檔案：${oldRelativePath}`);
  }
  fs.mkdirSync(path.dirname(newPath), { recursive: true });
  fs.renameSync(oldPath, newPath);
}

fs.mkdirSync(cssDir, { recursive: true });

moveFile("src/renderer/styles.css", "src/renderer/css/foundation.css");
moveFile("src/renderer/v2-schedule-nav.css", "src/renderer/css/schedule.css");
moveFile("src/renderer/ui-system.css", "src/renderer/css/components.css");
moveFile("src/renderer/mobile-page-layout.css", "src/renderer/css/responsive.css");

const clockRefinementPath = path.join(sourceDir, "v2-clock-page-refinement.css");
const authLayoutPath = path.join(sourceDir, "v2-auth-layout.css");
if (fs.existsSync(clockRefinementPath) || fs.existsSync(authLayoutPath)) {
  const clockCss = fs.existsSync(clockRefinementPath) ? stripBom(fs.readFileSync(clockRefinementPath, "utf8")).trim() : "";
  const authCss = fs.existsSync(authLayoutPath) ? stripBom(fs.readFileSync(authLayoutPath, "utf8")).trim() : "";
  const pagesCss = [
    "/* 頁面專屬樣式：僅放無法抽成共用元件的局部規則。 */",
    "",
    "/* 打卡頁 */",
    clockCss,
    "",
    "/* 登入頁 */",
    authCss,
    ""
  ].join("\n");
  write("src/renderer/css/pages.css", pagesCss);
  if (fs.existsSync(clockRefinementPath)) fs.unlinkSync(clockRefinementPath);
  if (fs.existsSync(authLayoutPath)) fs.unlinkSync(authLayoutPath);
}

const cssReadme = `# CSS 原始碼分工

本資料夾是前端 CSS 的唯一原始來源。瀏覽器不直接載入這些模組；
\`scripts/build-css.js\` 會依固定順序合併成 \`src/renderer/app.css\`，
\`npm run web:publish\` 再同步為 \`docs/app.css\`。

## 固定順序與責任

1. \`foundation.css\`：全域基礎、主要頁面結構及班表既有結構。共用按鈕、表單與卡片的新規則不得再加入此檔。
2. \`schedule.css\`：班表導覽、工具列、凍結欄及水平捲動框架的專屬規則。
3. \`components.css\`：設計變數、共用按鈕、表單、頁籤、卡片、彈窗與一般表格；同類共用元件以此檔為唯一正式規則。
4. \`responsive.css\`：跨頁面的手機與平板響應式規則，以及五個主要頁面的統一安全間距。
5. \`pages.css\`：登入、打卡等頁面無法共用的最終局部規則。

## 維護規則

- 不直接修改產生檔 \`src/renderer/app.css\` 或 \`docs/app.css\`。
- 不新增 \`fix.css\`、\`refinement.css\`、\`final.css\` 等補丁檔；規則應回到正確模組。
- 共用尺寸、圓角、配色優先使用 \`components.css\` 中的 CSS 變數。
- 修改後執行 \`npm run web:publish\`，並確認 \`npm run css:check\` 與 \`npm run v2:check\` 通過。
`;
write("src/renderer/css/README.md", cssReadme);

const buildCssScript = `const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "..");
const rendererDir = path.join(root, "src", "renderer");
const cssDir = path.join(rendererDir, "css");
const outputPath = path.join(rendererDir, "app.css");
const indexPath = path.join(rendererDir, "index.html");
const checkOnly = process.argv.includes("--check");

const modules = [
  ["foundation.css", "Foundation and structural layout"],
  ["schedule.css", "Schedule-specific layout"],
  ["components.css", "Shared design system and components"],
  ["responsive.css", "Cross-page responsive rules"],
  ["pages.css", "Final page-specific rules"]
];

function stripBom(text) {
  return text.replace(/^\\uFEFF/, "");
}

function buildBundle() {
  const sections = [
    "/* GENERATED FILE - DO NOT EDIT DIRECTLY.",
    " * Source: src/renderer/css/*.css",
    " * Build: npm run css:build",
    " */",
    ""
  ];
  for (const [fileName, label] of modules) {
    const filePath = path.join(cssDir, fileName);
    if (!fs.existsSync(filePath)) throw new Error(\`Missing CSS module: \\${fileName}\`);
    const content = stripBom(fs.readFileSync(filePath, "utf8")).trimEnd();
    if (/^\\s*@import\\b/m.test(content)) throw new Error(\`CSS module must not use @import: \\${fileName}\`);
    sections.push(\`/* ===== \\${label}: \\${fileName} ===== */\`, content, "");
  }
  return sections.join("\\n").replace(/\\n{4,}/g, "\\n\\n\\n").trimEnd() + "\\n";
}

function expectedIndex(bundle) {
  const hash = crypto.createHash("sha256").update(bundle).digest("hex").slice(0, 12);
  const html = fs.readFileSync(indexPath, "utf8");
  const next = html.replace(/(\\.\\/app\\.css)(?:\\?v=[^"'\\s>]+)?/g, \`$1?v=\\${hash}\`);
  if (!next.includes('./app.css?v=')) throw new Error("index.html does not load app.css");
  return { next, hash };
}

const bundle = buildBundle();
const { next: expectedHtml, hash } = expectedIndex(bundle);

if (checkOnly) {
  if (!fs.existsSync(outputPath)) throw new Error("src/renderer/app.css is missing");
  const currentBundle = fs.readFileSync(outputPath, "utf8");
  if (currentBundle !== bundle) throw new Error("app.css is not synchronized with CSS modules; run npm run css:build");
  const currentHtml = fs.readFileSync(indexPath, "utf8");
  if (currentHtml !== expectedHtml) throw new Error("index.html CSS cache version is not synchronized; run npm run css:build");
  console.log(\`CSS bundle check passed (\\${modules.length} modules, \\${hash})\`);
} else {
  fs.writeFileSync(outputPath, bundle, "utf8");
  fs.writeFileSync(indexPath, expectedHtml, "utf8");
  console.log(\`CSS bundle built: src/renderer/app.css (\\${modules.length} modules, \\${hash})\`);
}
`;
write("scripts/build-css.js", buildCssScript);

let sourceIndex = read("src/renderer/index.html");
const legacyCssNames = [
  "styles.css",
  "v2-schedule-nav.css",
  "ui-system.css",
  "mobile-page-layout.css",
  "v2-clock-page-refinement.css",
  "v2-auth-layout.css"
];
const indexLines = sourceIndex.split(/\r?\n/);
let insertAt = indexLines.findIndex((line) => legacyCssNames.some((name) => line.includes(name)));
if (insertAt < 0) insertAt = indexLines.findIndex((line) => line.includes("</head>"));
const filteredLines = indexLines.filter((line) => !legacyCssNames.some((name) => line.includes(name)) && !line.includes("./app.css"));
filteredLines.splice(insertAt, 0, '  <link rel="stylesheet" href="./app.css?v=css-bundle">');
write("src/renderer/index.html", filteredLines.join("\n"));

const packageJson = JSON.parse(read("package.json"));
packageJson.scripts = {
  "css:build": "node scripts/build-css.js",
  "css:check": "node scripts/build-css.js --check",
  "web": "node scripts/build-css.js && node src/web-server.js",
  "web:check": packageJson.scripts["web:check"],
  "web:publish": "node scripts/build-css.js && node scripts/publish-static-web.js",
  "v2:check": "node scripts/build-css.js --check && node scripts/check-v2-alignment.js && node scripts/check-v2-final.js"
};
write("package.json", JSON.stringify(packageJson, null, 2) + "\n");

const publishScript = `const fs = require("fs/promises");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const sourceDir = path.join(rootDir, "src", "renderer");
const outputDir = path.join(rootDir, "docs");

async function listFiles(dir, prefix = "") {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(path.join(dir, entry.name), relative));
    else if (entry.isFile()) files.push(relative);
  }
  return files;
}

function createVersionTag() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0")
  ].join("");
}

async function copyRendererFiles() {
  const files = await listFiles(sourceDir);
  await Promise.all(files.map(async (relative) => {
    const destination = path.join(outputDir, relative);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(path.join(sourceDir, relative), destination);
  }));
  return files;
}

async function rewriteIndexCacheBusters() {
  const version = createVersionTag();
  const indexPath = path.join(outputDir, "index.html");
  let html = await fs.readFile(indexPath, "utf8");
  html = html.replace(/(\\.\\/[A-Za-z0-9_./-]+\\.(?:css|js))(?:\\?v=[^"'\\s>]+)?/g, \`$1?v=\\${version}\`);
  await fs.writeFile(indexPath, html, "utf8");
}

async function main() {
  await fs.access(path.join(sourceDir, "app.css"));
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });
  const files = await copyRendererFiles();
  await rewriteIndexCacheBusters();
  await fs.writeFile(path.join(outputDir, ".nojekyll"), "");
  await fs.writeFile(path.join(outputDir, "README.txt"), "Generated static deploy output. Do not edit files in docs directly.\\n", "utf8");
  console.log(\`static web published to \\${outputDir} (\\${files.length} renderer files)\`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
`;
write("scripts/publish-static-web.js", publishScript);

let alignment = read("scripts/check-v2-alignment.js");
alignment = alignment.replace(
  'const sourceIndex = read("src/renderer/index.html");',
  'const sourceCss = read("src/renderer/app.css");\nconst docsCss = read("docs/app.css");\nassert(sourceCss === docsCss, "src/renderer/app.css and docs/app.css are not synchronized");\n["foundation.css", "schedule.css", "components.css", "responsive.css", "pages.css"].forEach((file) => assert(exists(`src/renderer/css/${file}`), `Missing CSS module: ${file}`));\n\nconst sourceIndex = read("src/renderer/index.html");'
);
alignment = alignment.replace(
  'assert(sourceIndex.includes("v2-api.js"), "Source index does not load v2-api.js");',
  'assert(sourceIndex.includes("app.css") && !sourceIndex.includes("styles.css") && !sourceIndex.includes("ui-system.css"), "Source index must load only bundled app.css");\nassert(docsIndex.includes("app.css") && !docsIndex.includes("styles.css") && !docsIndex.includes("ui-system.css"), "Published index must load only bundled app.css");\nassert(sourceIndex.includes("v2-api.js"), "Source index does not load v2-api.js");'
);
write("scripts/check-v2-alignment.js", alignment);

let finalCheck = read("scripts/check-v2-final.js");
finalCheck = finalCheck
  .replaceAll('src/renderer/ui-system.css', 'src/renderer/app.css')
  .replaceAll('docs/ui-system.css', 'docs/app.css');
write("scripts/check-v2-final.js", finalCheck);

let readme = read("README.md");
readme = replaceSection(readme, "## 專案結構", "## 本機執行與常用指令", `## 專案結構

- \`src/renderer/\`：前端原始碼與自動產生的 \`app.css\`。
- \`src/renderer/css/\`：模組化 CSS 唯一原始來源；分為基礎、班表、共用元件、響應式與頁面專屬樣式。
- \`docs/\`：\`npm run web:publish\` 產生的 GitHub Pages 正式發布內容，不直接手動修改。
- \`supabase/001_current_schema.sql\`：全新資料庫的基準結構。
- \`supabase/002_current_updates.sql\`：基準結構後的現行正式更新。
- \`supabase/functions/\`：Supabase Edge Functions 原始碼。
- \`scripts/\`：CSS 建置、檢查、同步與部署腳本。
- \`.github/workflows/\`：GitHub Pages 與自動化流程。
`);
readme = replaceSection(readme, "## 本機執行與常用指令", "## 前端發布", `## 本機執行與常用指令

需要 Node.js。可在儲存庫根目錄執行：

\`\`\`bash
npm run css:build
npm run css:check
npm run web
npm run web:check
npm run web:publish
npm run v2:check
\`\`\`

- \`npm run css:build\`：依固定模組順序產生單一 \`src/renderer/app.css\`。
- \`npm run css:check\`：確認 \`app.css\` 與 CSS 模組及快取版本一致。
- \`npm run web\`：先建立 CSS bundle，再啟動本機靜態預覽伺服器。
- \`npm run web:check\`：檢查公開 Supabase 設定。
- \`npm run web:publish\`：建立 CSS bundle、清理並重建 \`docs/\`，再更新靜態資源版本參數。
- \`npm run v2:check\`：檢查 CSS bundle、V2 結構與發布內容對齊。
`);
readme = replaceSection(readme, "## 前端發布", "## Supabase 資料庫建置", `## 前端發布

1. CSS 只修改 \`src/renderer/css/\` 中對應模組，不直接修改 \`app.css\` 或 \`docs/\`。
2. JavaScript、HTML 及其他前端來源只修改 \`src/renderer/\`。
3. 完成後執行：

\`\`\`bash
npm run web:publish
npm run v2:check
\`\`\`

4. 發布腳本會把 CSS 模組依固定順序合併成單一 \`app.css\`，清理舊的 \`docs/\` 後完整重建發布內容。
5. GitHub Pages 工作流程也會在上傳前執行 \`npm run web:publish\`，避免發布舊 bundle。
`);
write("README.md", readme);

let agents = read("AGENTS.md");
agents = agents.replace(
  "- 前端原始碼：`src/renderer/`",
  "- 前端原始碼：`src/renderer/`\n- CSS 模組原始碼：`src/renderer/css/`\n- CSS 產生檔：`src/renderer/app.css`、`docs/app.css`（不得直接修改）"
);
agents = agents.replace(
  "2. GitHub Pages 使用 `docs/`，不是 `src/renderer/`；前端來源與發布檔案必須保持同步。",
  "2. GitHub Pages 使用 `docs/`；`docs/` 必須由 `npm run web:publish` 清理重建，不得直接手動修改。\n3. CSS 只修改 `src/renderer/css/` 的正確模組；不得直接修改 `app.css`，也不得新增 fix、refinement、final 等補丁 CSS。\n4. 共用按鈕、表單、頁籤、卡片、彈窗與一般表格以 `css/components.css` 為唯一正式規則；頁面檔只保留無法共用的差異。"
);
agents = agents.replace("3. 若前端程式有修改", "5. 若前端程式有修改");
agents = agents.replace("4. 最終回覆必須說明", "6. 最終回覆必須說明");
agents = agents.replace(
  "- 前端修改後確認 `src/renderer/` 與 `docs/` 一致。",
  "- 前端修改後執行 `npm run web:publish`，確認 `src/renderer/app.css` 與 `docs/app.css` 一致，且入口只載入單一 `app.css`。"
);
write("AGENTS.md", agents);

let spec = read("規格書.md");
spec = replaceSection(spec, "## 6.2 CSS 架構與載入順序", "## 6.3 共用尺寸與間距", `## 6.2 CSS 架構與載入順序

前端採「原始碼模組化、發布檔單一化」：開發時依責任維護多個 CSS 模組，瀏覽器只載入由建置腳本產生的單一 \`app.css\`。

### 6.2.1 原始碼模組

正式 CSS 原始碼位於 \`src/renderer/css/\`，固定順序與責任如下：

1. **\`foundation.css\`**
   - 全域基礎、主要頁面結構及班表既有結構。
   - 不再新增共用按鈕、表單、卡片或一般表格規則。
2. **\`schedule.css\`**
   - 班表導覽、浮動工具列、凍結欄及水平捲動框架。
3. **\`components.css\`**
   - 共用設計變數、表單控制項、按鈕、頁籤、卡片、彈窗及一般資料表格。
   - 同類共用元件以此檔為唯一正式樣式來源。
4. **\`responsive.css\`**
   - 跨頁面的手機與平板響應式規則。
   - 五個主要頁面的統一安全間距及手機外層配置。
5. **\`pages.css\`**
   - 登入、打卡等無法抽成共用元件的頁面專屬最終規則。

不得新增 \`fix.css\`、\`refinement.css\`、\`final.css\` 等依靠載入順序修補前檔的零碎樣式；新規則必須回到責任正確的模組。

### 6.2.2 Bundle 與入口

1. \`scripts/build-css.js\` 依上述固定順序合併模組。
2. 產生檔為 \`src/renderer/app.css\`，發布後為 \`docs/app.css\`。
3. \`app.css\` 為自動產生檔，不得直接修改，也不得使用 \`@import\`。
4. \`index.html\` 只載入一個 CSS：\`app.css\`。
5. 建置時依 bundle 內容產生快取版本；發布時再更新正式靜態資源版本。
6. \`npm run css:check\` 必須能確認 bundle、模組及入口版本一致。

### 6.2.3 漸進式整理原則

本次先保持原有 CSS 宣告順序與最終視覺結果，再逐步把 \`foundation.css\` 中仍與共用元件重疊的舊宣告移至 \`components.css\`。後續整理每次都需以視覺回歸與既有驗收規格為準，不得一次大量刪除而改變正式介面。
`);
spec = replaceSection(spec, "### 5.8.3 發佈", "## 5.9 本版本不包含項目", `### 5.8.3 發佈

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
`);
spec = replaceSection(spec, "### 6.9.6 實作與發佈", "## 6.10 無障礙與實作規則", `### 6.9.6 實作與發佈

1. 跨頁面手機配置來源為 \`src/renderer/css/responsive.css\`。
2. 共用控制項與卡片樣式來源為 \`src/renderer/css/components.css\`。
3. 涉及入口或資源載入時更新 \`src/renderer/index.html\`，發布檔由 \`npm run web:publish\` 產生。
4. 修改 CSS 模組後重新產生 \`app.css\`，不得直接在 bundle 末端追加修補規則。
5. 發布時更新靜態資源版本參數，避免手機瀏覽器沿用舊快取。
`);
write("規格書.md", spec);

console.log("CSS architecture migration prepared");
