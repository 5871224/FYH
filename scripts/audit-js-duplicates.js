const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const rendererDir = path.join(root, "src", "renderer");
const files = fs.readdirSync(rendererDir)
  .filter((name) => name.endsWith(".js"))
  .filter((name) => !["app.js", "app-config.js"].includes(name))
  .sort();

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function lineNumber(source, index) {
  return source.slice(0, index).split("\n").length;
}

function findMatching(source, startIndex, openChar, closeChar) {
  let depth = 0;
  let mode = "code";
  let escaped = false;
  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (mode === "line") {
      if (char === "\n") mode = "code";
      continue;
    }
    if (mode === "block") {
      if (char === "*" && next === "/") {
        mode = "code";
        index += 1;
      }
      continue;
    }
    if (["single", "double", "template"].includes(mode)) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if ((mode === "single" && char === "'") || (mode === "double" && char === '"') || (mode === "template" && char === "`")) {
        mode = "code";
      }
      continue;
    }
    if (char === "/" && next === "/") {
      mode = "line";
      index += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      mode = "block";
      index += 1;
      continue;
    }
    if (char === "'") {
      mode = "single";
      continue;
    }
    if (char === '"') {
      mode = "double";
      continue;
    }
    if (char === "`") {
      mode = "template";
      continue;
    }
    if (char === openChar) depth += 1;
    if (char === closeChar && --depth === 0) return index;
  }
  return -1;
}

function extractFunctions(source, file) {
  const functions = [];
  const pattern = /\b(async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g;
  let match;
  while ((match = pattern.exec(source))) {
    const start = match.index;
    const parenStart = source.indexOf("(", start);
    const parenEnd = findMatching(source, parenStart, "(", ")");
    if (parenEnd < 0) continue;
    const braceStart = source.indexOf("{", parenEnd);
    if (braceStart < 0) continue;
    const braceEnd = findMatching(source, braceStart, "{", "}");
    if (braceEnd < 0) continue;
    const full = source.slice(start, braceEnd + 1);
    const body = source.slice(braceStart + 1, braceEnd);
    functions.push({
      file,
      name: match[2],
      line: lineNumber(source, start),
      async: Boolean(match[1]),
      params: source.slice(parenStart + 1, parenEnd).replace(/\s+/g, " ").trim(),
      body,
      full,
      normalizedBody: stripComments(body).replace(/\s+/g, " ").trim()
    });
    pattern.lastIndex = braceEnd + 1;
  }
  return functions;
}

function normalizeWindow(lines) {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ");
}

const sources = new Map(files.map((file) => [file, fs.readFileSync(path.join(rendererDir, file), "utf8")]));
const functions = files.flatMap((file) => extractFunctions(sources.get(file), file));

const duplicateNames = [...functions.reduce((map, fn) => {
  if (!map.has(fn.name)) map.set(fn.name, []);
  map.get(fn.name).push(fn);
  return map;
}, new Map()).values()].filter((group) => group.length > 1);

const exactBodies = [...functions.reduce((map, fn) => {
  if (fn.normalizedBody.length < 80) return map;
  if (!map.has(fn.normalizedBody)) map.set(fn.normalizedBody, []);
  map.get(fn.normalizedBody).push(fn);
  return map;
}, new Map()).values()].filter((group) => group.length > 1);

const blockSize = 6;
const blockMap = new Map();
for (const file of files) {
  const rawLines = stripComments(sources.get(file)).split("\n");
  for (let index = 0; index <= rawLines.length - blockSize; index += 1) {
    const text = normalizeWindow(rawLines.slice(index, index + blockSize));
    if (text.length < 140) continue;
    if (/^[{});,\s]+$/.test(text)) continue;
    if (!blockMap.has(text)) blockMap.set(text, []);
    blockMap.get(text).push({ file, line: index + 1 });
  }
}
const repeatedBlocks = [...blockMap.entries()]
  .map(([text, locations]) => ({ text, locations }))
  .filter((item) => new Set(item.locations.map((location) => location.file)).size > 1)
  .sort((a, b) => b.text.length - a.text.length)
  .slice(0, 40);

const legacyMarkers = [];
const legacyPattern = /\b(v2|legacy|deprecated|compat(?:ibility)?|patch|oldVersion|old[A-Z]\w*)\b|補丁|舊版|相容層/gi;
for (const file of files) {
  sources.get(file).split("\n").forEach((line, index) => {
    if (legacyPattern.test(line)) {
      legacyMarkers.push({ file, line: index + 1, text: line.trim() });
    }
    legacyPattern.lastIndex = 0;
  });
}

const assignmentOverrides = [];
const assignmentPattern = /^\s*([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function\b/gm;
for (const file of files) {
  const source = sources.get(file);
  let match;
  while ((match = assignmentPattern.exec(source))) {
    assignmentOverrides.push({ file, line: lineNumber(source, match.index), name: match[1] });
  }
}

function location(item) {
  return `${item.file}:${item.line}`;
}

const report = [
  "# JavaScript 重複程式與舊相容層稽核",
  "",
  `- 掃描模組：${files.length} 個`,
  `- 命名函式：${functions.length} 個`,
  `- 同名函式群組：${duplicateNames.length} 組`,
  `- 完全相同函式內容：${exactBodies.length} 組`,
  `- 跨檔重複六行區塊：${repeatedBlocks.length} 組（最多列出 40 組）`,
  `- 函式覆蓋式指定：${assignmentOverrides.length} 筆`,
  `- 舊版／補丁標記：${legacyMarkers.length} 筆`,
  "",
  "## 同名函式",
  ""
];
if (!duplicateNames.length) report.push("無。", "");
for (const group of duplicateNames) {
  report.push(`### \`${group[0].name}\``);
  report.push(group.map((fn) => `- ${location(fn)} — \`${fn.params}\``).join("\n"), "");
}

report.push("## 完全相同函式內容", "");
if (!exactBodies.length) report.push("無。", "");
for (const group of exactBodies) {
  report.push(`### ${group.map((fn) => `\`${fn.name}\`（${location(fn)}）`).join("、")}`);
  report.push("```js", group[0].body.trim().slice(0, 1200), "```", "");
}

report.push("## 跨檔重複程式區塊", "");
if (!repeatedBlocks.length) report.push("無。", "");
for (const item of repeatedBlocks) {
  report.push(`### ${item.locations.map(location).join("、")}`);
  report.push("```js", item.text.slice(0, 1400), "```", "");
}

report.push("## 覆蓋式函式指定", "");
if (!assignmentOverrides.length) report.push("無。", "");
for (const item of assignmentOverrides) report.push(`- ${location(item)}：\`${item.name} = function\``);
report.push("");

report.push("## 舊版、補丁或相容層標記", "");
if (!legacyMarkers.length) report.push("無。", "");
for (const item of legacyMarkers) report.push(`- ${location(item)}：\`${item.text.replace(/`/g, "\\`")}\``);
report.push("");

const checkOnly = process.argv.includes("--check");
if (!checkOnly) {
  fs.writeFileSync(path.join(root, "js-duplicate-report.md"), `${report.join("\n")}\n`, "utf8");
}
console.log(`JavaScript audit completed: ${functions.length} functions, ${duplicateNames.length} duplicate names, ${exactBodies.length} exact bodies.`);

const forbiddenUiMarkers = [];
for (const file of files) {
  sources.get(file).split("\n").forEach((line, index) => {
    if (/data-v2-|(?:^|[.\s"'])v2-[a-z]/i.test(line)) forbiddenUiMarkers.push({ file, line: index + 1, text: line.trim() });
  });
}
if (checkOnly) {
  if (assignmentOverrides.length) {
    console.error(`Found ${assignmentOverrides.length} function override assignment(s).`);
    process.exitCode = 1;
  }
  if (forbiddenUiMarkers.length) {
    console.error(`Found ${forbiddenUiMarkers.length} deprecated v2 UI marker(s).`);
    process.exitCode = 1;
  }
}
