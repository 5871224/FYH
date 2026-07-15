const fs = require("fs/promises");
const path = require("path");
const { resolveConfig, writeAppConfig } = require("./generate-app-config");

const rootDir = path.resolve(__dirname, "..");
const sourceDir = path.join(rootDir, "src", "renderer");
const outputDir = path.join(rootDir, "docs");
const files = [
  "index.html",
  "styles.css",
  "renderer.js",
  "rest-compliance.js",
  "web-api.js",
  "browser-exporter.js",
  "app-config.js"
];
const cacheBustedAssets = [
  "styles.css",
  "app-config.js",
  "browser-exporter.js",
  "rest-compliance.js",
  "web-api.js",
  "renderer.js"
];

async function recreateDir(dirPath) {
  await fs.rm(dirPath, { recursive: true, force: true });
  await fs.mkdir(dirPath, { recursive: true });
}

async function copyFile(name) {
  await fs.copyFile(path.join(sourceDir, name), path.join(outputDir, name));
}

function createVersionTag() {
  const now = new Date();
  const parts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0")
  ];
  return parts.join("");
}

async function rewriteIndexCacheBusters() {
  const version = createVersionTag();
  const indexPath = path.join(outputDir, "index.html");
  let html = await fs.readFile(indexPath, "utf8");
  cacheBustedAssets.forEach((asset) => {
    const escapedAsset = asset.replace(/\./g, "\\.");
    const pattern = new RegExp(`\\.\\/${escapedAsset}(?:\\?v=[^"'\\s>]+)?`, "g");
    html = html.replace(pattern, `./${asset}?v=${version}`);
  });
  await fs.writeFile(indexPath, html, "utf8");
}

async function writeNoJekyll() {
  await fs.writeFile(path.join(outputDir, ".nojekyll"), "");
}

async function writeDeployReadme() {
  const content = [
    "Static deploy output for GitHub Pages or FTP.",
    "",
    "Upload all files in this folder to your web root."
  ].join("\n");
  await fs.writeFile(path.join(outputDir, "README.txt"), content, "utf8");
}

async function copyUserGuideTo(targetDir) {
  const source = path.join(rootDir, "src", "user-guide");
  const target = path.join(targetDir, "guide");
  try {
    await fs.access(source);
  } catch {
    return;
  }
  await fs.rm(target, { recursive: true, force: true });
  await fs.cp(source, target, { recursive: true });
}

async function copyUserGuide() {
  await copyUserGuideTo(outputDir);
  await copyUserGuideTo(path.join(rootDir, "src", "renderer"));
}

async function syncAppConfig() {
  const config = resolveConfig();
  writeAppConfig(path.join(sourceDir, "app-config.js"), config);
  writeAppConfig(path.join(outputDir, "app-config.js"), config);
}

async function main() {
  await recreateDir(outputDir);
  await syncAppConfig();
  await Promise.all(
    files.filter((name) => name !== "app-config.js").map(copyFile)
  );
  await rewriteIndexCacheBusters();
  await copyUserGuide();
  await writeNoJekyll();
  await writeDeployReadme();
  console.log(`static web published to ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
