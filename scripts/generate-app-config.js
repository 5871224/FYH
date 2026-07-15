const fs = require("fs");
const path = require("path");
const { loadProjectEnv, requireEnv } = require("./load-env");

const rootDir = path.resolve(__dirname, "..");
const fallbackConfigPath = path.join(rootDir, "src", "renderer", "app-config.js");

function readFallbackConfig() {
  if (!fs.existsSync(fallbackConfigPath)) {
    return {};
  }
  const code = fs.readFileSync(fallbackConfigPath, "utf8");
  const match = code.match(/window\.SCHEDULER_CONFIG\s*=\s*(\{[\s\S]*?\});/);
  if (!match) {
    return {};
  }
  try {
    // eslint-disable-next-line no-new-func
    return Function(`return (${match[1]});`)();
  } catch {
    return {};
  }
}

function resolveConfig(env = loadProjectEnv()) {
  const fallback = readFallbackConfig();
  const supabaseUrl = String(
    env.SUPABASE_URL
    || env.SUPABASE_API_PUBLIC_URL
    || fallback.supabaseUrl
    || ""
  ).replace(/\/+$/, "");
  const supabaseAnonKey = String(
    env.SUPABASE_PUBLISHABLE_KEY
    || env.SUPABASE_ANON_KEY
    || fallback.supabaseAnonKey
    || ""
  );
  const documentId = String(
    env.SUPABASE_DOCUMENT_ID
    || fallback.documentId
    || "default"
  );
  return {
    supabaseUrl,
    supabaseAnonKey,
    documentId,
    publicSiteOrigin: String(env.PUBLIC_SITE_ORIGIN || "").replace(/\/+$/, "")
  };
}

function renderAppConfig(config) {
  requireEnv(
    { SUPABASE_URL: config.supabaseUrl, SUPABASE_PUBLISHABLE_KEY: config.supabaseAnonKey },
    ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"]
  );
  return [
    "window.SCHEDULER_CONFIG = {",
    `  supabaseUrl: ${JSON.stringify(config.supabaseUrl)},`,
    `  supabaseAnonKey: ${JSON.stringify(config.supabaseAnonKey)},`,
    `  documentId: ${JSON.stringify(config.documentId)}`,
    "};",
    ""
  ].join("\n");
}

function writeAppConfig(targetPath, config) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, renderAppConfig(config), "utf8");
}

function main() {
  const target = process.argv[2]
    ? path.resolve(process.argv[2])
    : fallbackConfigPath;
  const config = resolveConfig();
  writeAppConfig(target, config);
  console.log(`app-config written to ${target}`);
  if (config.publicSiteOrigin) {
    console.log(`public site origin: ${config.publicSiteOrigin}`);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  resolveConfig,
  renderAppConfig,
  writeAppConfig
};
