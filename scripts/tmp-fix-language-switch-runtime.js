const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const configPath = path.join(root, 'src/renderer/app-config.js');
const testPath = path.join(root, 'tests/vietnamese-localization.test.js');

let config = fs.readFileSync(configPath, 'utf8');
const anchor = '  function entityTranslationMap() {';
if (!config.includes(anchor)) throw new Error('app-config entityTranslationMap anchor not found');
if (!config.includes('function installApiIntegration()')) {
  const restored = `  function upsertCachedLabel(category, id, nameVi) {\n    if (!id) return;\n    const rows = labels[category] || [];\n    const index = rows.findIndex((row) => row.id === id);\n    const next = { id, nameVi: String(nameVi || \"\").trim() };\n    if (index >= 0) rows[index] = next;\n    else rows.push(next);\n  }\n\n  async function saveLabel(entity, category, id, value) {\n    const normalizedId = String(id || \"\").trim();\n    if (!normalizedId || typeof window.schedulerApi?.saveVietnameseLabel !== \"function\") return;\n    await window.schedulerApi.saveVietnameseLabel(entity, normalizedId, String(value || \"\").trim());\n    upsertCachedLabel(category, normalizedId, value);\n    mergeGlobalLabels();\n  }\n\n  function installApiIntegration() {\n    // Vietnamese data access is part of the formal schedulerApi provider.\n    // Entity save paths explicitly persist their localized field; no runtime method override is used here.\n  }\n\n`;
  config = config.replace(anchor, restored + anchor);
}
fs.writeFileSync(configPath, config, 'utf8');

let test = fs.readFileSync(testPath, 'utf8');
const marker = '  assert.ok(config.includes("window.schedulerApi.getVietnameseLabels()"));\n';
if (!test.includes(marker)) throw new Error('Vietnamese localization test marker not found');
if (!test.includes('missing installApiIntegration runtime definition')) {
  test = test.replace(marker, marker + '  assert.ok(config.includes("function installApiIntegration()"), "missing installApiIntegration runtime definition");\n  assert.ok(config.includes("async function saveLabel("), "missing saveLabel runtime definition");\n');
}
fs.writeFileSync(testPath, test, 'utf8');

console.log('Language switch runtime functions restored.');
