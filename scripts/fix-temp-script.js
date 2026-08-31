const fs = require("node:fs");
const path = require("node:path");
const target = path.join(__dirname, "tmp-vietnamese-settings-fix.js");
let source = fs.readFileSync(target, "utf8");
const replacements = [
  ["`missing localization token: ${token}`", "'missing localization token: ' + token"],
  ["`missing Vietnamese fixed label: ${token}`", "'missing Vietnamese fixed label: ' + token"],
  ["`missing canonical Vietnamese SQL token: ${token}`", "'missing canonical Vietnamese SQL token: ' + token"],
  [
    "  const second = first < 0 ? -1 : source.indexOf(before, first + before.length);\n  if (first < 0 || second >= 0) {\n    throw new Error(`${relative}: ${label || \"replacement\"} expected exactly once`);\n  }",
    "  if (first < 0) {\n    throw new Error(`${relative}: ${label || \"replacement\"} expected at least once`);\n  }"
  ]
];
for (const [before, after] of replacements) {
  if (!source.includes(before)) throw new Error(`missing expected fragment: ${before}`);
  source = source.replace(before, after);
}
fs.writeFileSync(target, source, "utf8");

const appConfigPath = path.join(__dirname, "..", "src", "renderer", "app-config.js");
let appConfig = fs.readFileSync(appConfigPath, "utf8");
const batchReviewTranslation = '    "批次審核": "Duyệt hàng loạt",\n';
if (!appConfig.includes(batchReviewTranslation)) {
  const anchor = '    "簽到簿": "Sổ chấm công",\n';
  if (!appConfig.includes(anchor)) throw new Error("missing attendance translation anchor");
  appConfig = appConfig.replace(anchor, anchor + batchReviewTranslation);
  fs.writeFileSync(appConfigPath, appConfig, "utf8");
}

const departmentTestPath = path.join(__dirname, "..", "tests", "schedule-member-edit-and-department-group.test.js");
let departmentTest = fs.readFileSync(departmentTestPath, "utf8");
const oldExpectation = 'assert.match(source, /const payload = \\{[^\\n]+name, groupId, startDate/);';
const newExpectation = 'assert.match(source, /const payload = \\{[^\\n]+name, nameVi, groupId, startDate/);';
if (departmentTest.includes(oldExpectation)) {
  departmentTest = departmentTest.replace(oldExpectation, newExpectation);
  fs.writeFileSync(departmentTestPath, departmentTest, "utf8");
} else if (!departmentTest.includes(newExpectation)) {
  throw new Error("missing department payload expectation");
}

console.log("temporary transformation prerequisites repaired");
