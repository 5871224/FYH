const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const rendererDir = path.join(root, "src", "renderer");
const rendererPath = path.join(rendererDir, "renderer.js");
const patchPath = path.join(rendererDir, "v2-auto-fill-schedule.js");
const buildPath = path.join(root, "scripts", "build-js.js");
const corePath = path.join(root, "scripts", "renderer-core-source.js");

let renderer = fs.readFileSync(rendererPath, "utf8");
const bindMarker = "  bindScheduleHistoryControls();";
if (!renderer.includes(bindMarker)) throw new Error("找不到正式事件綁定位置");
renderer = renderer.replace(bindMarker, `${bindMarker}\n  bindAutoFillScheduleControls();`);
fs.writeFileSync(rendererPath, renderer);

function updateManifest(filePath) {
  let source = fs.readFileSync(filePath, "utf8");
  source = source.replace(/^\s*"v2-auto-fill-schedule\.js",?\r?\n/m, "");
  if (source.includes('"renderer-auto-fill-schedule.js"')) {
    fs.writeFileSync(filePath, source);
    return;
  }
  const marker = '  "renderer-auto-schedule.js",';
  if (!source.includes(marker)) throw new Error(`清單找不到自動排班模組：${filePath}`);
  source = source.replace(marker, `  "renderer-auto-fill-schedule.js",\n${marker}`);
  fs.writeFileSync(filePath, source);
}
updateManifest(buildPath);
updateManifest(corePath);

if (!fs.existsSync(patchPath)) throw new Error("找不到待移除的自動補班覆蓋檔");
fs.unlinkSync(patchPath);
console.log("auto-fill schedule patch merged into canonical modules");
