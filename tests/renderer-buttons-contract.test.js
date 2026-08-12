const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const rendererDir = path.join(root, "src", "renderer");
const { RENDERER_CORE_FILES } = require("../scripts/renderer-core-source.js");

const runtimeFiles = [
  "browser-exporter.js",
  "rest-compliance.js",
  "web-api.js",
  ...RENDERER_CORE_FILES
];
const sources = new Map(runtimeFiles.map((file) => [
  file,
  fs.readFileSync(path.join(rendererDir, file), "utf8")
]));
const indexSource = fs.readFileSync(path.join(rendererDir, "index.html"), "utf8");
const runtimeSource = [...sources.values()].join("\n");

function lineOf(source, offset) {
  return source.slice(0, offset).split(/\r?\n/).length;
}

function camelCaseDataName(name) {
  return String(name).replace(/-([a-z0-9])/g, (_, char) => char.toUpperCase());
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractButtons(file, source) {
  const buttons = [];
  const regex = /<button\b([^>]*)>/gi;
  let match;
  while ((match = regex.exec(source))) {
    const attrs = match[1] || "";
    const id = attrs.match(/\bid\s*=\s*["']([^"'${}]+)["']/i)?.[1] || "";
    const type = attrs.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase() || "";
    const dataAttributes = [...attrs.matchAll(/\bdata-([a-z0-9-]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/gi)]
      .map((item) => item[1].toLowerCase());
    const ariaLabel = attrs.match(/\baria-label\s*=\s*["']([^"']+)["']/i)?.[1] || "";
    const title = attrs.match(/\btitle\s*=\s*["']([^"']+)["']/i)?.[1] || "";
    const dynamicAttrs = /\$\{\s*attrs\s*\}/.test(attrs);
    buttons.push({
      file,
      line: lineOf(source, match.index),
      openingTag: match[0].replace(/\s+/g, " ").trim(),
      id,
      type,
      dataAttributes,
      dynamicAttrs,
      label: ariaLabel || title || id || dataAttributes.map((name) => `data-${name}`).join(", ") || (dynamicAttrs ? "共用操作按鈕" : "未命名按鈕")
    });
  }
  return buttons;
}

const buttons = [
  ...extractButtons("index.html", indexSource),
  ...runtimeFiles.flatMap((file) => extractButtons(file, sources.get(file)))
];

function dataAttributeHasConsumer(name) {
  const camel = camelCaseDataName(name);
  const kebab = escapeRegex(name);
  const camelEscaped = escapeRegex(camel);
  const patterns = [
    new RegExp(`\\.dataset\\.${camelEscaped}\\b`),
    new RegExp(`\\.dataset\\[["']${camelEscaped}["']\\]`),
    new RegExp(`getAttribute\\(["']data-${kebab}["']\\)`),
    new RegExp(`\\[data-${kebab}(?:[\\]=~^$*|\\s])`)
  ];
  return [...sources.values()].some((source) => patterns.some((pattern) => pattern.test(source)));
}

function idHasClickConsumer(id) {
  if (!id) return false;
  const escaped = escapeRegex(id);
  const directPatterns = [
    new RegExp(`bindClick\\(["']${escaped}["']\\s*,`),
    new RegExp(`getElementById\\(["']${escaped}["']\\)\\?*\\.addEventListener\\(["']click["']`),
    new RegExp(`querySelector\\(["']#${escaped}["']\\)\\?*\\.addEventListener\\(["']click["']`)
  ];
  if ([...sources.values()].some((source) => directPatterns.some((pattern) => pattern.test(source)))) return true;

  // 允許先由 helper 取得按鈕集合，再統一綁 click 的正式模式，例如 undo/redo。
  return [...sources.values()].some((source) => {
    const mentionsId = source.includes(`"${id}"`) || source.includes(`'${id}'`);
    return mentionsId && /addEventListener\(\s*["']click["']/.test(source);
  });
}

function hasInlineClick(button) {
  return /\bonclick\s*=/.test(button.openingTag);
}

function hasButtonConsumer(button) {
  if (button.dynamicAttrs) return true;
  if (hasInlineClick(button)) return true;
  if (button.dataAttributes.some(dataAttributeHasConsumer)) return true;
  if (idHasClickConsumer(button.id)) return true;
  if (button.type === "submit") {
    return [...sources.values()].some((source) => /addEventListener\(\s*["']submit["']/.test(source));
  }
  return false;
}

function extractActionHelperContracts() {
  const contracts = [];
  for (const [file, source] of sources) {
    let offset = 0;
    while ((offset = source.indexOf("renderActionIconButton(", offset)) !== -1) {
      const windowText = source.slice(offset, offset + 420);
      // 函式本身的宣告不是呼叫端。
      if (!source.slice(Math.max(0, offset - 20), offset).includes("function ")) {
        const dataAttributes = [...windowText.matchAll(/\bdata-([a-z0-9-]+)/gi)].map((item) => item[1].toLowerCase());
        contracts.push({ file, line: lineOf(source, offset), dataAttributes });
      }
      offset += "renderActionIconButton(".length;
    }
  }
  return contracts;
}

function declaredCallableNames() {
  const names = new Set();
  for (const match of runtimeSource.matchAll(/\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)) names.add(match[1]);
  for (const match of runtimeSource.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/g)) names.add(match[1]);
  return names;
}

const declaredCallables = declaredCallableNames();

function collectDirectActionCalls() {
  const actionFiles = [...sources.entries()].filter(([file]) => (
    file.startsWith("renderer-events-")
    || file === "renderer-records-events.js"
  ));
  const calls = [];
  for (const [file, source] of actionFiles) {
    for (const pattern of [
      /\bawait[ \t]+([A-Za-z_$][\w$]*)[ \t]*\(/g,
      /\bvoid[ \t]+([A-Za-z_$][\w$]*)[ \t]*\(/g,
      /\bbindClick\(\s*["'][^"']+["']\s*,\s*([A-Za-z_$][\w$]*)\s*\)/g
    ]) {
      for (const match of source.matchAll(pattern)) {
        calls.push({ name: match[1], file, line: lineOf(source, match.index) });
      }
    }
  }
  return calls.filter((call, index, list) => list.findIndex((item) => item.name === call.name && item.file === call.file && item.line === call.line) === index);
}

function getSchedulerApiExports() {
  const webApi = sources.get("web-api.js");
  const block = webApi.match(/window\.schedulerApi\s*=\s*\{([\s\S]*?)\n\s*\};/);
  assert.ok(block, "找不到 window.schedulerApi 公開 API 區塊");
  const names = new Set();
  for (const match of block[1].matchAll(/^\s*([A-Za-z_$][\w$]*)\s*(?::|,)/gm)) names.add(match[1]);
  return names;
}

const schedulerApiExports = getSchedulerApiExports();
const schedulerApiCalls = [...runtimeSource.matchAll(/window\.schedulerApi\.([A-Za-z_$][\w$]*)\s*\(/g)]
  .map((match) => match[1])
  .filter((name, index, list) => list.indexOf(name) === index)
  .sort();

test("按鈕掃描器必須涵蓋正式 renderer 的大量按鈕", () => {
  assert.ok(buttons.length >= 60, `目前只掃描到 ${buttons.length} 個按鈕，可能漏掉 renderer 模板`);
});

for (const button of buttons) {
  test(`按鈕契約 ${button.file}:${button.line} ${button.label}`, () => {
    assert.ok(
      button.id || button.dataAttributes.length || button.dynamicAttrs || hasInlineClick(button) || button.type === "submit",
      `${button.file}:${button.line} 按鈕沒有 id、data-*、動態 attrs、onclick 或 submit 契約：${button.openingTag}`
    );
    assert.ok(
      hasButtonConsumer(button),
      `${button.file}:${button.line} 找不到 click/submit 消費端：${button.openingTag}`
    );
  });
}

test("共用操作按鈕的每個呼叫端都必須提供可消費的 data-* 契約", () => {
  const contracts = extractActionHelperContracts();
  assert.ok(contracts.length >= 10, "共用操作按鈕呼叫端掃描數量異常");
  const invalid = contracts.filter((contract) => (
    !contract.dataAttributes.length || !contract.dataAttributes.some(dataAttributeHasConsumer)
  ));
  assert.deepEqual(invalid, [], `共用操作按鈕缺少事件契約：${invalid.map((item) => `${item.file}:${item.line}`).join(", ")}`);
});

test("按鈕事件中的直接函式呼叫不可指向不存在的函式", () => {
  const unresolved = collectDirectActionCalls().filter(({ name }) => !declaredCallables.has(name));
  assert.deepEqual(unresolved, [], `找不到事件呼叫函式：${unresolved.map((item) => `${item.name} (${item.file}:${item.line})`).join(", ")}`);
});

test("renderer 使用的 schedulerApi 方法都必須由 web-api 公開", () => {
  const missing = schedulerApiCalls.filter((name) => !schedulerApiExports.has(name));
  assert.deepEqual(missing, [], `schedulerApi 未公開：${missing.join(", ")}`);
});
