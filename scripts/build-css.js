const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "..");
const rendererDir = path.join(root, "src", "renderer");
const cssDir = path.join(rendererDir, "css");
const outputPath = path.join(rendererDir, "app.css");
const indexPath = path.join(rendererDir, "index.html");
const checkOnly = process.argv.includes("--check");

const modules = [
  ["foundation.css", "Foundation and structural layout"],
  ["schedule.css", "Schedule-specific layout"],
  ["components.css", "Shared design system and components"],
  ["responsive.css", "Cross-page responsive rules"],
  ["pages.css", "Final page-specific rules"]
];

function normalizeText(text) {
  return text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
}

function buildBundle() {
  const sections = [
    "/* GENERATED FILE - DO NOT EDIT DIRECTLY.",
    " * Source: src/renderer/css/*.css",
    " * Build: npm run css:build",
    " */",
    ""
  ];
  for (const [fileName, label] of modules) {
    const filePath = path.join(cssDir, fileName);
    if (!fs.existsSync(filePath)) throw new Error(`Missing CSS module: ${fileName}`);
    const content = normalizeText(fs.readFileSync(filePath, "utf8")).trimEnd();
    if (/^\s*@import\b/m.test(content)) throw new Error(`CSS module must not use @import: ${fileName}`);
    sections.push(`/* ===== ${label}: ${fileName} ===== */`, content, "");
  }
  return sections.join("\n").replace(/\n{4,}/g, "\n\n\n").trimEnd() + "\n";
}

function expectedIndex(bundle) {
  const hash = crypto.createHash("sha256").update(bundle).digest("hex").slice(0, 12);
  const html = normalizeText(fs.readFileSync(indexPath, "utf8"));
  const next = html.replace(/(\.\/app\.css)(?:\?v=[^"'\s>]+)?/g, `$1?v=${hash}`);
  if (!next.includes('./app.css?v=')) throw new Error("index.html does not load app.css");
  return { next, hash };
}

const bundle = buildBundle();
const { next: expectedHtml, hash } = expectedIndex(bundle);

if (checkOnly) {
  if (!fs.existsSync(outputPath)) throw new Error("src/renderer/app.css is missing");
  const currentBundle = fs.readFileSync(outputPath, "utf8");
  if (currentBundle !== bundle) throw new Error("app.css is not synchronized with CSS modules; run npm run css:build");
  const currentHtml = fs.readFileSync(indexPath, "utf8");
  if (currentHtml !== expectedHtml) throw new Error("index.html CSS cache version is not synchronized; run npm run css:build");
  console.log(`CSS bundle check passed (${modules.length} modules, ${hash})`);
} else {
  fs.writeFileSync(outputPath, bundle, "utf8");
  fs.writeFileSync(indexPath, expectedHtml, "utf8");
  console.log(`CSS bundle built: src/renderer/app.css (${modules.length} modules, ${hash})`);
}
