const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("正式前端只由 app-config.js 與 app.js 啟動，不保留後載入覆寫模組", () => {
  const rendererDir = path.join(root, "src", "renderer");
  const files = fs.readdirSync(rendererDir);
  const html = read("src/renderer/index.html");
  const config = read("src/renderer/app-config.js");

  assert.deepEqual(files.filter((name) => name.endsWith(".mjs")), []);
  assert.equal(files.includes("groups.css"), false);
  assert.doesNotMatch(config, /document\.write|\.mjs/);
  assert.doesNotMatch(html, /toolbarChipInteractionScript|toolbarChipInteractionStyles|\.mjs/);
  const localScripts = [...html.matchAll(/<script\s+[^>]*src=["'](\.\/[^"']+\.js)(?:\?[^"']*)?["'][^>]*><\/script>/g)].map((match) => match[1]);
  assert.deepEqual(localScripts, ["./app-config.js", "./app.js"]);
});

test("正式 renderer 不使用後載入函式覆寫來替換核心 render 函式", () => {
  const source = fs.readdirSync(path.join(root, "src", "renderer"))
    .filter((name) => name.endsWith(".js") && name !== "app.js")
    .map((name) => read(`src/renderer/${name}`))
    .join("\n");
  assert.doesNotMatch(source, /^\s*(?:renderToolbar|renderTable|getVisibleTableGroups)\s*=\s*function\b/m);
});
