const fs = require("fs");
const path = require("path");

function loadEnvFile(filePath) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    return {};
  }
  const values = {};
  const lines = fs.readFileSync(resolved, "utf8").split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }
    const separator = trimmed.indexOf("=");
    if (separator <= 0) {
      return;
    }
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  });
  return values;
}

function loadProjectEnv(rootDir = path.resolve(__dirname, "..")) {
  const fileValues = loadEnvFile(path.join(rootDir, ".env"));
  return {
    ...fileValues,
    ...process.env
  };
}

function requireEnv(env, keys) {
  const missing = keys.filter((key) => !String(env[key] || "").trim());
  if (missing.length) {
    throw new Error(`缺少環境變數：${missing.join(", ")}`);
  }
}

module.exports = {
  loadEnvFile,
  loadProjectEnv,
  requireEnv
};
