const fs = require("fs/promises");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const sourceDir = path.join(rootDir, "src", "renderer");
const outputDir = path.join(rootDir, "docs");
const sourceOnlyDirectories = new Set(["css"]);

async function listFiles(dir, prefix = "") {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) {
      if (!prefix && sourceOnlyDirectories.has(entry.name)) continue;
      files.push(...await listFiles(path.join(dir, entry.name), relative));
    } else if (entry.isFile()) {
      files.push(relative);
    }
  }
  return files;
}

function createVersionTag() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0")
  ].join("");
}

async function copyRendererFiles() {
  const files = await listFiles(sourceDir);
  await Promise.all(files.map(async (relative) => {
    const destination = path.join(outputDir, relative);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(path.join(sourceDir, relative), destination);
  }));
  return files;
}

async function rewriteIndexCacheBusters() {
  const version = createVersionTag();
  const indexPath = path.join(outputDir, "index.html");
  let html = await fs.readFile(indexPath, "utf8");
  html = html.replace(/(\.\/[A-Za-z0-9_./-]+\.(?:css|js))(?:\?v=[^"'\s>]+)?/g, `$1?v=${version}`);
  await fs.writeFile(indexPath, html, "utf8");
}

async function main() {
  await fs.access(path.join(sourceDir, "app.css"));
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });
  const files = await copyRendererFiles();
  await rewriteIndexCacheBusters();
  await fs.writeFile(path.join(outputDir, ".nojekyll"), "");
  await fs.writeFile(path.join(outputDir, "README.txt"), "Generated static deploy output. Do not edit files in docs directly.\n", "utf8");
  console.log(`static web published to ${outputDir} (${files.length} renderer files)`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
