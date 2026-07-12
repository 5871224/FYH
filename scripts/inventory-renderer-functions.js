const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const file = path.join(root, "src", "renderer", "renderer.js");
const source = fs.readFileSync(file, "utf8");
const lines = source.split("\n");
const functions = [];
for (let index = 0; index < lines.length; index += 1) {
  const match = lines[index].match(/^(async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/);
  if (match) functions.push({ line: index + 1, name: match[2], async: Boolean(match[1]) });
}
const output = { lineCount: lines.length, functionCount: functions.length, functions };
fs.writeFileSync(path.join(root, "renderer-function-inventory.json"), JSON.stringify(output, null, 2));
console.log(JSON.stringify(output, null, 2));
