const fs = require("node:fs");

const file = "scripts/consolidate-css-rules.js";
const lines = fs.readFileSync(file, "utf8").split("\n");
const index = lines.findIndex((line) => line.includes("foundation.match(new RegExp(selector.replace"));
if (index < 0) throw new Error("找不到 CSS 測試模板修正位置");
lines[index] = '    assert.equal(foundation.split(selector).length - 1, 1, selector + " 應由 foundation 提供");';
fs.writeFileSync(file, lines.join("\n"), "utf8");
console.log("CSS consolidation test template fixed.");
