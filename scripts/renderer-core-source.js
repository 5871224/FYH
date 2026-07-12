const fs = require("node:fs");
const path = require("node:path");

const RENDERER_CORE_FILES = [
  "renderer-foundation.js",
  "renderer-settings-navigation.js",
  "renderer-schedule-layout.js",
  "renderer-date-utils.js",
  "renderer-ui-helpers.js",
  "renderer-visibility.js",
  "renderer-state-normalization.js",
  "renderer.js"
];

function readRendererCore(rootDir) {
  return RENDERER_CORE_FILES
    .map((file) => fs.readFileSync(path.join(rootDir, "src", "renderer", file), "utf8"))
    .join("\n");
}

module.exports = { RENDERER_CORE_FILES, readRendererCore };
