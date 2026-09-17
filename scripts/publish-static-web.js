const fs = require("fs/promises");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const sourceDir = path.join(rootDir, "src", "renderer");
const outputDir = path.join(rootDir, "docs");
const cnamePath = path.join(outputDir, "CNAME");
// CSS modules and individual JavaScript modules are development sources.
// Production publishes only app.css, app-config.js and the generated app.js.
const sourceOnlyDirectories = new Set(["css"]);
const publishedJavaScriptFiles = new Set(["app-config.js", "app.js"]);

async function readOptionalFile(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function listFiles(dir, prefix = "") {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) {
      if (!prefix && sourceOnlyDirectories.has(entry.name)) continue;
      files.push(...await listFiles(path.join(dir, entry.name), relative));
    } else if (entry.isFile()) {
      if (!prefix && entry.name.endsWith(".js") && !publishedJavaScriptFiles.has(entry.name)) continue;
      files.push(relative);
    }
  }
  return files;
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

async function main() {
  await fs.access(path.join(sourceDir, "app.css"));
  await fs.access(path.join(sourceDir, "app.js"));
  // GitHub Pages 管理的 CNAME 是部署中繼資料，不屬於 renderer 產生檔；重建 docs 時保留現有設定。
  const cname = await readOptionalFile(cnamePath);
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });
  const files = await copyRendererFiles();
  if (cname !== null) {
    await fs.writeFile(cnamePath, cname, "utf8");
  }
  await fs.writeFile(path.join(outputDir, ".nojekyll"), "");
  await fs.writeFile(path.join(outputDir, "README.txt"), "Generated static deploy output. Do not edit files in docs directly.\n", "utf8");
  console.log(`static web published to ${outputDir} (${files.length} renderer files)`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
