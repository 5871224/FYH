const fs = require("node:fs");
const path = require("node:path");

const checkPaths = [
  path.resolve(__dirname, "check-v2-final.js"),
  path.resolve(__dirname, "check-v2-alignment.js")
];

for (const checkPath of checkPaths) {
  let source = fs.readFileSync(checkPath, "utf8");
  source = source.replaceAll(
    "src/renderer/v2-overtime-employee.js",
    "src/renderer/renderer-overtime-employee.js"
  );
  if (checkPath.endsWith("check-v2-final.js")) {
    const oldCheck = 'assert(sourceApi.includes("installTabletSessionPolicy"), "平板登入 Session 規則未同步修正");';
    const newCheck = 'assert(sourceApi.includes("installTabletSessionCompatibility") && sourceApi.includes("sessionStorage"), "平板登入 Session 相容層缺少分頁儲存規則");';
    if (!source.includes(oldCheck)) {
      throw new Error("找不到待更新的平板 Session 檢查");
    }
    source = source.replace(oldCheck, newCheck);
  }
  fs.writeFileSync(checkPath, source);
}
console.log("tablet session and canonical overtime module checks updated");
