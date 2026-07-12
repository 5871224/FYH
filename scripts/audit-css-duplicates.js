const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const cssDir = path.join(root, "src", "renderer", "css");
const files = ["foundation.css", "schedule.css", "components.css", "responsive.css", "pages.css"];

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "");
}

function findClosingBrace(source, openIndex) {
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}" && --depth === 0) return index;
  }
  throw new Error(`找不到 CSS 區塊結尾：${openIndex}`);
}

function normalizeSelector(selector) {
  return selector.replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ").trim();
}

function normalizeDeclarations(body) {
  return body
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.replace(/\s*:\s*/, ": ").replace(/\s+/g, " "))
    .join("; ");
}

function parseDeclarations(body) {
  const entries = [];
  body.split(";").forEach((part) => {
    const colon = part.indexOf(":");
    if (colon <= 0) return;
    const property = part.slice(0, colon).trim();
    const value = part.slice(colon + 1).trim().replace(/\s+/g, " ");
    if (property && value) entries.push({ property, value });
  });
  return entries;
}

function lineNumber(source, index) {
  return source.slice(0, index).split("\n").length;
}

function parseRules(source, fileName, context = [], offset = 0, rules = []) {
  let cursor = 0;
  while (cursor < source.length) {
    while (cursor < source.length && /\s/.test(source[cursor])) cursor += 1;
    if (cursor >= source.length) break;
    const open = source.indexOf("{", cursor);
    if (open < 0) break;
    const header = source.slice(cursor, open).trim();
    const close = findClosingBrace(source, open);
    const body = source.slice(open + 1, close);
    if (header.startsWith("@media") || header.startsWith("@supports") || header.startsWith("@layer") || header.startsWith("@container")) {
      parseRules(body, fileName, [...context, header.replace(/\s+/g, " ")], offset + open + 1, rules);
    } else if (!header.startsWith("@keyframes") && !header.startsWith("@font-face") && !header.startsWith("@page")) {
      const selector = normalizeSelector(header);
      if (selector) {
        rules.push({
          file: fileName,
          line: lineNumber(source, cursor),
          absoluteOffset: offset + cursor,
          context: context.join(" > ") || "root",
          selector,
          declarations: normalizeDeclarations(body),
          properties: parseDeclarations(body)
        });
      }
    }
    cursor = close + 1;
  }
  return rules;
}

const rules = [];
for (const file of files) {
  const source = stripComments(fs.readFileSync(path.join(cssDir, file), "utf8"));
  parseRules(source, file, [], 0, rules);
}

const byKey = new Map();
for (const rule of rules) {
  const key = `${rule.context}|||${rule.selector}`;
  if (!byKey.has(key)) byKey.set(key, []);
  byKey.get(key).push(rule);
}

const duplicateGroups = [...byKey.values()].filter((group) => group.length > 1);
const exactGroups = duplicateGroups.filter((group) => new Set(group.map((rule) => rule.declarations)).size === 1);
const overrideGroups = duplicateGroups.filter((group) => new Set(group.map((rule) => rule.declarations)).size > 1);

const duplicateProperties = [];
for (const rule of rules) {
  const byProperty = new Map();
  rule.properties.forEach((entry) => {
    if (!byProperty.has(entry.property)) byProperty.set(entry.property, []);
    byProperty.get(entry.property).push(entry.value);
  });
  for (const [property, values] of byProperty) {
    if (values.length > 1) duplicateProperties.push({ ...rule, property, values });
  }
}

function location(rule) {
  return `${rule.file}:${rule.line}`;
}

const lines = [
  "# CSS 重複與覆蓋稽核",
  "",
  `- CSS 規則總數：${rules.length}`,
  `- 同一情境重複選擇器：${duplicateGroups.length} 組`,
  `- 完全相同可安全合併：${exactGroups.length} 組`,
  `- 宣告不同、需人工判斷：${overrideGroups.length} 組`,
  `- 同一規則內重複屬性：${duplicateProperties.length} 筆`,
  "",
  "## 完全相同的重複規則",
  ""
];
if (!exactGroups.length) lines.push("無。", "");
for (const group of exactGroups) {
  lines.push(`### \`${group[0].selector}\` — ${group[0].context}`);
  lines.push(`位置：${group.map(location).join("、")}`);
  lines.push("```css", group[0].declarations, "```", "");
}

lines.push("## 同選擇器但宣告不同", "");
if (!overrideGroups.length) lines.push("無。", "");
for (const group of overrideGroups) {
  lines.push(`### \`${group[0].selector}\` — ${group[0].context}`);
  for (const rule of group) {
    lines.push(`- **${location(rule)}**：\`${rule.declarations}\``);
  }
  lines.push("");
}

lines.push("## 同一規則內重複屬性", "");
if (!duplicateProperties.length) lines.push("無。", "");
for (const item of duplicateProperties) {
  lines.push(`- **${location(item)}** \`${item.selector}\`：\`${item.property}\` → ${item.values.map((value) => `\`${value}\``).join("、")}`);
}

const reportPath = path.join(root, "css-duplicate-report.md");
fs.writeFileSync(reportPath, `${lines.join("\n")}\n`, "utf8");
console.log(`CSS audit completed: ${rules.length} rules, ${exactGroups.length} exact groups, ${overrideGroups.length} override groups.`);
