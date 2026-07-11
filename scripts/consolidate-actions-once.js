const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (file, content) => fs.writeFileSync(path.join(root, file), content, "utf8");

function replaceOnce(source, oldText, newText, label) {
  if (!source.includes(oldText)) throw new Error(`找不到替換位置：${label}`);
  return source.replace(oldText, newText);
}

const workflow = `name: Validate and Deploy Pages

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: validate-deploy-\${{ github.workflow }}-\${{ github.ref }}
  cancel-in-progress: \${{ github.event_name == 'pull_request' }}

jobs:
  validate:
    name: Validate
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Checkout
        uses: actions/checkout@v5

      - name: Setup Node.js
        uses: actions/setup-node@v5
        with:
          node-version: "22"

      - name: Build static web
        run: npm run web:publish

      - name: Run complete checks
        run: npm run ci:check

      - name: Upload Pages artifact
        if: github.ref == 'refs/heads/main' && github.event_name != 'pull_request'
        uses: actions/upload-pages-artifact@v5
        with:
          path: ./docs

  deploy:
    name: Deploy GitHub Pages
    if: github.ref == 'refs/heads/main' && github.event_name != 'pull_request'
    needs: validate
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Configure GitHub Pages
        uses: actions/configure-pages@v5

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v5
`;
write(".github/workflows/deploy-pages.yml", workflow);

for (const oldWorkflow of [
  ".github/workflows/v2-alignment.yml",
  ".github/workflows/v2-final-check.yml"
]) {
  const target = path.join(root, oldWorkflow);
  if (fs.existsSync(target)) fs.rmSync(target);
}

const packagePath = "package.json";
const packageJson = JSON.parse(read(packagePath));
packageJson.scripts["ci:check"] = "npm run web:check && node scripts/check-normalized-storage.js && node scripts/check-expansion-acceptance.js && node scripts/check-settings-lists.js && npm run v2:check";
write(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

const readmePath = "README.md";
let readme = read(readmePath);
readme = replaceOnce(
  readme,
  "npm run v2:check\n```",
  "npm run v2:check\nnpm run ci:check\n```",
  "README 指令清單"
);
readme = replaceOnce(
  readme,
  "- `npm run v2:check`：檢查 CSS、JavaScript bundle、V2 結構與發布內容對齊。",
  "- `npm run v2:check`：檢查 CSS、JavaScript bundle、V2 結構與發布內容對齊。\n- `npm run ci:check`：執行 GitHub Actions 與本機共用的完整公開設定、資料結構、設定清單及 V2 驗證。",
  "README ci:check 說明"
);
readme = replaceOnce(
  readme,
  "8. GitHub Pages 工作流程也會在上傳前執行 `npm run web:publish`，避免發布舊 bundle。",
  "8. GitHub Actions 正式流程只使用 `.github/workflows/deploy-pages.yml`。\n9. Pull Request 只執行建置與完整驗證，不部署正式網站。\n10. 推送至 `main` 或由 `main` 手動執行時，先完成同一流程的 `validate` 工作；全部成功後，`deploy` 工作才上傳並發布 GitHub Pages。不得另建重複執行 V2 檢查或 Pages 部署的獨立 workflow。",
  "README Actions 規則"
);
write(readmePath, readme);

const agentsPath = "AGENTS.md";
let agents = read(agentsPath);
agents = replaceOnce(
  agents,
  "8. 若前端程式有修改，且使用者未明確要求不要提交，應提交並推送至 `main`。\n9. 最終回覆必須說明：",
  "8. 若前端程式有修改，且使用者未明確要求不要提交，應提交並推送至 `main`。\n9. GitHub Actions 正式流程只保留 `.github/workflows/deploy-pages.yml`；Pull Request 只驗證，`main` 必須在同一 workflow 的 `validate` 成功後才執行 `deploy`。不得新增重複執行 V2 檢查或 Pages 部署的獨立 workflow。\n10. 最終回覆必須說明：",
  "AGENTS Actions 規則"
);
agents = replaceOnce(
  agents,
  "- 發布前除功能正確外，需考慮第 8.7 節效能容量、第 9.6 節備份復原及第 9.7 節回滾。",
  "- GitHub Actions 修改後執行 `npm run ci:check`，並確認部署工作明確依賴驗證工作。\n- 發布前除功能正確外，需考慮第 8.7 節效能容量、第 9.6 節備份復原及第 9.7 節回滾。",
  "AGENTS 驗證規則"
);
write(agentsPath, agents);

const specPath = "規格書.md";
let spec = read(specPath);
spec = replaceOnce(
  spec,
  "8. 每次高風險發布在 PR 或發布紀錄中寫明：變更內容、資料庫順序、驗證結果、回滾方法及負責人。",
  "8. 每次高風險發布在 PR 或發布紀錄中寫明：變更內容、資料庫順序、驗證結果、回滾方法及負責人。\n9. GitHub Actions 使用單一『驗證後部署』流程：Pull Request 只建置與驗證；推送至 `main` 時，只有同一 workflow 的完整驗證成功後才能部署 GitHub Pages。\n10. 不得另建同時監聽 `main` 且重複執行相同 V2 檢查或 Pages 部署的 workflow；新增檢查應整合至共用 `ci:check` 或單一流程的 `validate` 工作。",
  "規格書發布與回滾"
);
write(specPath, spec);

const checkPath = "scripts/check-v2-final.js";
let check = read(checkPath);
const insertionMarker = "required.forEach((file) => assert(exists(file), `缺少 V2 檔案：${file}`));\n";
const workflowChecks = `required.forEach((file) => assert(exists(file), \`缺少 V2 檔案：\${file}\`));

const actionsWorkflow = read(".github/workflows/deploy-pages.yml");
const projectPackage = JSON.parse(read("package.json"));
assert(actionsWorkflow.includes("name: Validate and Deploy Pages"), "GitHub Actions 尚未使用單一驗證後部署流程");
assert(actionsWorkflow.includes("pull_request:") && actionsWorkflow.includes("push:"), "單一 workflow 缺少 Pull Request 或 main push 觸發");
assert(actionsWorkflow.includes("needs: validate"), "Pages 部署未明確依賴完整驗證");
assert(actionsWorkflow.includes("npm run ci:check"), "單一 workflow 未使用共用完整檢查指令");
assert(actionsWorkflow.includes("actions/upload-pages-artifact@v5") && actionsWorkflow.includes("actions/deploy-pages@v5"), "Pages artifact 或部署工作缺失");
assert(!exists(".github/workflows/v2-alignment.yml") && !exists(".github/workflows/v2-final-check.yml"), "仍保留重複的獨立 V2 workflow");
assert(String(projectPackage.scripts?.["ci:check"] || "").includes("npm run v2:check"), "ci:check 未包含完整 V2 驗證");
`;
if (!check.includes("const actionsWorkflow = read(")) {
  if (!check.includes(insertionMarker)) throw new Error("找不到 V2 final workflow 檢查插入位置");
  check = check.replace(insertionMarker, workflowChecks);
}
write(checkPath, check);

console.log("GitHub Actions consolidation prepared");
