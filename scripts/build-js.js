const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "..");
const rendererDir = path.join(root, "src", "renderer");
const outputPath = path.join(rendererDir, "app.js");
const indexPath = path.join(rendererDir, "index.html");
const checkOnly = process.argv.includes("--check");

// 第一階段先保留既有執行順序與全域相依性；後續再逐步轉為 ES Modules。
const modules = [
  "browser-exporter.js",
  "rest-compliance.js",
  "web-api.js",
  "renderer-foundation.js",
  "renderer-settings-navigation.js",
  "renderer-schedule-layout.js",
  "renderer-date-utils.js",
  "renderer-ui-helpers.js",
  "renderer-visibility.js",
  "renderer-state-normalization.js",
  "renderer-schedule-interaction.js",
  "renderer-auto-schedule-compliance.js",
  "renderer-auto-schedule-demand.js",
  "renderer-auto-schedule-assignment.js",
  "renderer-auto-fill-schedule.js",
  "renderer-auto-schedule.js",
  "renderer-schedule-toolbar.js",
  "renderer-schedule-groups.js",
  "renderer-schedule-cells.js",
  "renderer-schedule-table.js",
  "renderer-settings-catalog.js",
  "renderer-settings-department.js",
  "renderer-settings-ordering.js",
  "renderer-settings-member.js",
  "renderer-overtime-employee.js",
  "renderer-request-helpers.js",
  "renderer-auth-context.js",
  "renderer-schedule-tooltip.js",
  "renderer-main-pages.js",
  "renderer-records-views.js",
  "renderer-modal-navigation.js",
  "renderer-schedule-ordering.js",
  "renderer-schedule-keyboard.js",
  "renderer-export-availability.js",
  "renderer-attendance-page.js",
  "renderer-meal-page.js",
  "renderer-records-page.js",
  "renderer-runtime-helpers.js",
  "renderer-records-actions.js",
  "renderer-app-shell.js",
  "renderer-persistence.js",
  "renderer-schedule-selection-actions.js",
  "renderer-schedule-assignment-modals.js",
  "renderer-schedule-compliance-settings.js",
  "renderer-auth-actions.js",
  "renderer-export-actions.js",
  "renderer-events-toolbar.js",
  "renderer-events-session.js",
  "renderer-events-click.js",
  "renderer-events-form.js",
  "renderer-events-tooltip.js",
  "renderer-events-drag.js",
  "renderer-events.js",
  "renderer.js",
  "v2-drag-scroll-preserve.js",
  "v2-settings-drag-handles.js",
  "v2-meal.js",
  "v2-meal-export.js",
  "v2-records.js",
  "v2-personal-record-layout.js",
  "v2-overtime-admin.js",
  "v2-attendance-admin.js",
  "v2-live-report-filters.js",
  "v2-account.js",
];

function stripBom(text) {
  return text.replace(/^\uFEFF/, "");
}

function validateManifest() {
  const sourceModules = fs.readdirSync(rendererDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
    .map((entry) => entry.name)
    .filter((name) => name !== "app-config.js" && name !== "app.js")
    .sort();
  const listed = new Set(modules);
  const unlisted = sourceModules.filter((name) => !listed.has(name));
  const missing = modules.filter((name) => !sourceModules.includes(name));
  if (unlisted.length) throw new Error(`Unlisted JavaScript source modules: ${unlisted.join(", ")}`);
  if (missing.length) throw new Error(`Missing JavaScript source modules: ${missing.join(", ")}`);
}

function readModule(fileName) {
  const filePath = path.join(rendererDir, fileName);
  if (!fs.existsSync(filePath)) throw new Error(`Missing JavaScript module: ${fileName}`);
  const content = stripBom(fs.readFileSync(filePath, "utf8")).trimEnd();
  const hasDynamicLoader = /document\.createElement\(["']script["']\)/.test(content)
    || /data-v2-module/.test(content)
    || /\.src\s*=\s*["'`]\.\/[^"'`]+\.js/.test(content);
  if (hasDynamicLoader) {
    throw new Error(`JavaScript module must not dynamically load another local module: ${fileName}`);
  }
  return content;
}

function buildBundle() {
  validateManifest();
  const sections = [
    "/* GENERATED FILE - DO NOT EDIT DIRECTLY.",
    " * Source order: scripts/build-js.js",
    " * Build: npm run js:build",
    " * This transitional bundle preserves the legacy global execution order.",
    " */",
    ""
  ];

  for (const fileName of modules) {
    sections.push(`/* ===== ${fileName} ===== */`, readModule(fileName), ";", "");
  }

  return sections.join("\n").replace(/\n{4,}/g, "\n\n\n").trimEnd() + "\n";
}

function expectedIndex(bundle) {
  const hash = crypto.createHash("sha256").update(bundle).digest("hex").slice(0, 12);
  const html = fs.readFileSync(indexPath, "utf8");
  const next = html.replace(/(\.\/app\.js)(?:\?v=[^"'\s>]+)?/g, `$1?v=${hash}`);
  if (!next.includes("./app.js?v=")) throw new Error("index.html does not load app.js");

  const localScripts = [...next.matchAll(/<script\s+[^>]*src=["'](\.\/[^"']+\.js)(?:\?[^"']*)?["'][^>]*><\/script>/g)]
    .map((match) => match[1]);
  const unexpected = localScripts.filter((src) => src !== "./app-config.js" && src !== "./app.js");
  if (unexpected.length) {
    throw new Error(`index.html must load only app-config.js and app.js: ${unexpected.join(", ")}`);
  }
  if (!localScripts.includes("./app-config.js")) throw new Error("index.html does not load app-config.js");

  return { next, hash };
}

const bundle = buildBundle();
const { next: expectedHtml, hash } = expectedIndex(bundle);

if (checkOnly) {
  if (!fs.existsSync(outputPath)) throw new Error("src/renderer/app.js is missing");
  const currentBundle = fs.readFileSync(outputPath, "utf8");
  if (currentBundle !== bundle) throw new Error("app.js is not synchronized with JavaScript modules; run npm run js:build");
  const currentHtml = fs.readFileSync(indexPath, "utf8");
  if (currentHtml !== expectedHtml) throw new Error("index.html JavaScript cache version is not synchronized; run npm run js:build");
  console.log(`JavaScript bundle check passed (${modules.length} modules, ${hash})`);
} else {
  fs.writeFileSync(outputPath, bundle, "utf8");
  fs.writeFileSync(indexPath, expectedHtml, "utf8");
  console.log(`JavaScript bundle built: src/renderer/app.js (${modules.length} modules, ${hash})`);
}
