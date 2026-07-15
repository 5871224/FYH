const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const isWindows = process.platform === "win32";
const scriptName = isWindows ? "apply-migrations.ps1" : "apply-migrations.sh";
const scriptPath = path.join(rootDir, "infra", "self-host", scriptName);

if (!fs.existsSync(scriptPath)) {
  console.error(`找不到 ${scriptPath}`);
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("請先設定 DATABASE_URL");
  console.error("  Windows: $env:DATABASE_URL = 'postgresql://postgres:password@127.0.0.1:5432/postgres'");
  console.error("  Linux:   export DATABASE_URL=postgresql://postgres:password@127.0.0.1:5432/postgres");
  process.exit(1);
}

const result = isWindows
  ? spawnSync(
    "powershell",
    ["-ExecutionPolicy", "Bypass", "-File", scriptPath],
    { stdio: "inherit", cwd: rootDir, env: process.env }
  )
  : spawnSync("bash", [scriptPath], { stdio: "inherit", cwd: rootDir, env: process.env });

process.exit(result.status ?? 1);
