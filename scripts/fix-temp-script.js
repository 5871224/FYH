const fs = require("node:fs");
const path = require("node:path");
const target = path.join(__dirname, "tmp-vietnamese-settings-fix.js");
let source = fs.readFileSync(target, "utf8");
const replacements = [
  ["`missing localization token: ${token}`", "'missing localization token: ' + token"],
  ["`missing Vietnamese fixed label: ${token}`", "'missing Vietnamese fixed label: ' + token"],
  ["`missing canonical Vietnamese SQL token: ${token}`", "'missing canonical Vietnamese SQL token: ' + token"]
];
for (const [before, after] of replacements) {
  if (!source.includes(before)) throw new Error(`missing expected fragment: ${before}`);
  source = source.replace(before, after);
}
fs.writeFileSync(target, source, "utf8");
console.log("temporary transformation script quoting fixed");
