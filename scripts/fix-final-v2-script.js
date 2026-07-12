const fs = require("node:fs");

const file = "scripts/remove-final-v2-patches.js";
let source = fs.readFileSync(file, "utf8");
const oldText = '.map((file) => read(`src/renderer/${file}`)).join("\\n")';
const newText = '.map((file) => read("src/renderer/" + file)).join("\\n")';
if (!source.includes(oldText)) throw new Error("找不到測試字串修正位置");
source = source.replace(oldText, newText);
fs.writeFileSync(file, source, "utf8");
console.log("Final V2 migration test string fixed.");
