const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const workflowsDir = path.join(root, ".github", "workflows");
const workflowPath = path.join(workflowsDir, "deploy-pages.yml");

function read(file) {
  return fs.readFileSync(file, "utf8").replace(/\r\n?/g, "\n");
}

test("儲存庫只保留單一正式 GitHub Actions workflow", () => {
  const workflowFiles = fs.readdirSync(workflowsDir)
    .filter((name) => /\.ya?ml$/i.test(name))
    .sort();

  assert.deepEqual(workflowFiles, ["deploy-pages.yml"]);
  assert.equal(fs.existsSync(path.join(workflowsDir, "canonicalize-v2-api-data.yml")), false);
});

test("正式 workflow 只驗證，不重複部署 GitHub Pages", () => {
  const workflow = read(workflowPath);

  assert.match(workflow, /^name: Validate Web App/m);
  assert.match(workflow, /^run-name: .*PR #\{0\} 驗證.*main 驗證/m);
  assert.match(workflow, /^  push:\n    branches:\n      - main/m);
  assert.match(workflow, /^  pull_request:\n    branches:\n      - main/m);
  assert.match(workflow, /^  cancel-in-progress: true/m);

  const requiredCommands = [
    "npm run web:publish",
    "npm test",
    "npm run web:check",
    "node scripts/check-normalized-storage.js",
    "node scripts/check-expansion-acceptance.js",
    "node scripts/check-settings-lists.js",
    "npm run renderer:check",
    "npm run css:architecture",
    "npm run js:architecture"
  ];
  requiredCommands.forEach((command) => assert.equal(workflow.includes(command), true));

  assert.equal(workflow.includes("actions/upload-pages-artifact"), false);
  assert.equal(workflow.includes("actions/deploy-pages"), false);
  assert.equal(workflow.includes("actions/configure-pages"), false);
  assert.equal(workflow.includes("pages: write"), false);
  assert.equal(workflow.includes("id-token: write"), false);
});

test("純文件變更只跑輕量守門測試，其他異動跑完整驗證", () => {
  const workflow = read(workflowPath);

  assert.match(workflow, /- name: Determine change scope\n\s+id: changes/);
  assert.match(workflow, /if \[\[ "\$file" != \*\.md \]\]/);
  assert.match(
    workflow,
    /- name: Run documentation guards\n\s+if: steps\.changes\.outputs\.docs_only == 'true'/
  );
  assert.match(
    workflow,
    /node --test tests\/canonical-schema\.test\.js tests\/github-actions-hygiene\.test\.js/
  );

  const fullValidationSteps = [
    "Build static web",
    "Check reproducible static publish",
    "Run unit tests",
    "Check public Supabase settings",
    "Check normalized storage",
    "Check expansion acceptance",
    "Check settings lists",
    "Check renderer bundles",
    "Check CSS architecture",
    "Check JavaScript architecture"
  ];

  fullValidationSteps.forEach((stepName) => {
    const pattern = new RegExp(
      `- name: ${stepName}\\n\\s+if: steps\\.changes\\.outputs\\.docs_only != 'true'`
    );
    assert.match(workflow, pattern);
  });

  assert.equal(workflow.includes("- name: Check workflow hygiene"), false);
});

test("正式 workflow 不得自動修改或推送 PR 分支", () => {
  const workflow = read(workflowPath);

  assert.equal(/\bgit\s+push\b/.test(workflow), false);
  assert.equal(/\bgit\s+commit\b/.test(workflow), false);
  assert.equal(workflow.includes("contents: write"), false);
});
