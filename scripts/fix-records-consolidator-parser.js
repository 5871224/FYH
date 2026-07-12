const fs = require("node:fs");

const file = "scripts/consolidate-records-admin.js";
let source = fs.readFileSync(file, "utf8");
const oldCode = `  const braceStart = source.indexOf("{", start);
  if (braceStart < 0) throw new Error(\`找不到函式起始大括號：\${marker}\`);`;
const newCode = `  const parenStart = source.indexOf("(", start);
  if (parenStart < 0) throw new Error(\`找不到函式參數：\${marker}\`);
  let parenDepth = 0;
  let parenEnd = -1;
  for (let index = parenStart; index < source.length; index += 1) {
    if (source[index] === "(") parenDepth += 1;
    if (source[index] === ")" && --parenDepth === 0) {
      parenEnd = index;
      break;
    }
  }
  const braceStart = source.indexOf("{", parenEnd);
  if (parenEnd < 0 || braceStart < 0) throw new Error(\`找不到函式本體：\${marker}\`);`;
if (!source.includes(oldCode)) throw new Error("找不到整併解析器修正位置");
fs.writeFileSync(file, source.replace(oldCode, newCode), "utf8");
console.log("Record consolidator parser fixed.");
