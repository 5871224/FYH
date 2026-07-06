const fs = require("fs/promises");
const path = require("path");

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
  "app-config.js",
  "v2-account.js",
  "v2-api.js",
  "v2-attendance-admin.js",
  "v2-meal-export.js",
  "v2-meal.js",
  "v2-overtime-admin.js",
  "v2-overtime-employee.js",
  "v2-records.js"
];
const cacheBustedAssets = [
  "styles.css",
  "app-config.js",
  "browser-exporter.js",
  "rest-compliance.js",
  "web-api.js",
  "v2-account.js",
  "v2-api.js",
  "renderer.js",
  "v2-attendance-admin.js",
  "v2-meal-export.js",
  "v2-meal.js",
  "v2-overtime-admin.js",
  "v2-overtime-employee.js",
  "v2-records.js"
];

async function ensureDir(dirPath) {
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

async function main() {
  await ensureDir(outputDir);
  await Promise.all(files.map(copyFile));
  await rewriteIndexCacheBusters();
  await writeNoJekyll();
  await writeDeployReadme();
  console.log(`static web published to ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
