const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const renderer = path.join(root, "src", "renderer");
const files = fs.readdirSync(renderer).filter((name) => name.endsWith(".js") && name !== "app.js");
const forbidden = [
  "supabaseUrl",
  "supabaseAnonKey",
  "/auth/v1/",
  "/rest/v1/",
  "/functions/v1/",
  "access_token",
  "refresh_token",
  "@local.invalid",
  "apikey:"
];

for (const name of files) {
  const source = fs.readFileSync(path.join(renderer, name), "utf8");
  for (const marker of forbidden) {
    if (source.includes(marker)) throw new Error(`${name} 不可包含 Supabase browser transport: ${marker}`);
  }
}

const provider = fs.readFileSync(path.join(renderer, "web-api.js"), "utf8");
if (!provider.includes("/api/v1/")) throw new Error("web-api.js 必須使用 FYH /api/v1");
if (!provider.includes('credentials: "include"')) throw new Error("web-api.js 必須使用 HttpOnly session cookie");

const config = fs.readFileSync(path.join(renderer, "app-config.js"), "utf8");
if (!config.includes("apiBaseUrl")) throw new Error("app-config.js 缺少 apiBaseUrl");

console.log("browser FYH backend boundary ok");
