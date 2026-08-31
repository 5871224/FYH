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
console.log("temporary transformation script repaired");
