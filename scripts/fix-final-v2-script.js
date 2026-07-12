const fs = require("node:fs");

const file = "scripts/remove-final-v2-patches.js";
let source = fs.readFileSync(file, "utf8");
const tick = String.fromCharCode(96);
const oldText = "read(" + tick + "src/renderer/" + "$" + "{file}" + tick + ")";
const newText = 'read("src/renderer/" + file)';
if (!source.includes(oldText)) throw new Error("找不到測試字串修正位置");
source = source.replace(oldText, newText);
fs.writeFileSync(file, source, "utf8");
console.log("Final V2 migration test string fixed.");
