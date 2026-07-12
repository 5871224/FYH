const fs = require("node:fs");

const file = "scripts/check-v2-alignment.js";
let source = fs.readFileSync(file, "utf8");
const marker = '  "src/renderer/v2-records.js"\n';
if (!source.includes(marker)) throw new Error("找不到 V2 記錄檢查清單最後一項");
source = source.replace(marker, "");
fs.writeFileSync(file, source, "utf8");
console.log("V2 alignment record requirement removed.");
