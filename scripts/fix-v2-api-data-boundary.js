const fs = require("node:fs");
const path = require("node:path");

const scriptPath = path.resolve(__dirname, "canonicalize-v2-api-data.js");
let source = fs.readFileSync(scriptPath, "utf8");
if (!source.includes('"getMealOrderStatus"')) {
  throw new Error("找不到待修正的 getMealOrderStatus 邊界");
}
source = source.replaceAll('"getMealOrderStatus"', '"getTodayMealOrder"');
fs.writeFileSync(scriptPath, source);
console.log("V2 overtime API boundary updated to getTodayMealOrder");
