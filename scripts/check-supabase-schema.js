const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { loadProjectEnv } = require("./load-env");

function loadPublicConfig() {
  const filePath = path.resolve(__dirname, "..", "src", "renderer", "app-config.js");
  const code = fs.readFileSync(filePath, "utf8");
  const sandbox = { window: {} };
  vm.runInNewContext(code, sandbox);
  return sandbox.window.SCHEDULER_CONFIG || {};
}

async function probeTable(config, tableName, select = "id") {
  const response = await fetch(
    `${String(config.supabaseUrl).replace(/\/+$/, "")}/rest/v1/${tableName}?select=${encodeURIComponent(select)}&limit=1`,
    {
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${config.supabaseAnonKey}`
      }
    }
  );
  const text = await response.text();
  let message = text;
  try {
    const parsed = JSON.parse(text);
    message = parsed.message || text;
  } catch (_error) {
    // keep raw text
  }
  return {
    table: tableName,
    ok: response.ok,
    status: response.status,
    message: String(message).slice(0, 160)
  };
}

async function probeRpc(config, functionName, payload = {}) {
  const response = await fetch(
    `${String(config.supabaseUrl).replace(/\/+$/, "")}/rest/v1/rpc/${functionName}`,
    {
      method: "POST",
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${config.supabaseAnonKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    }
  );
  const text = await response.text();
  let message = text;
  try {
    const parsed = JSON.parse(text);
    message = parsed.message || text;
  } catch (_error) {
    // keep raw text
  }
  return {
    table: `rpc/${functionName}`,
    ok: response.ok,
    status: response.status,
    message: String(message).slice(0, 160)
  };
}

async function main() {
  const config = loadPublicConfig();
  const env = loadProjectEnv();
  const apiKey = String(
    env.SUPABASE_SECRET_KEY
      || env.SUPABASE_SERVICE_ROLE_KEY
      || config.supabaseAnonKey
      || ""
  ).trim();
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error("app-config.js 缺少 supabaseUrl 或 supabaseAnonKey");
  }
  if (!apiKey) {
    throw new Error("缺少 Supabase API key");
  }

  const results = await Promise.all([
    probeTable({ ...config, supabaseAnonKey: apiKey }, "profiles", "id,employee_code"),
    probeRpc({ ...config, supabaseAnonKey: apiKey }, "login_email_by_employee_code", { p_employee_code: "__schema_check__" }),
    probeTable({ ...config, supabaseAnonKey: apiKey }, "schedule_months"),
    probeTable({ ...config, supabaseAnonKey: apiKey }, "schedule_entries", "id,work_date"),
    probeTable({ ...config, supabaseAnonKey: apiKey }, "schedule_entries", "schedule_month_id")
  ]);

  results.forEach((item) => {
    const label = item.ok ? "ok" : "missing";
    console.log(`${label.padEnd(8)} ${item.table.padEnd(18)} ${item.status} ${item.message}`);
  });

  const profilesMissing = results[0].ok === false;
  const loginRpcMissing = results[1].ok === false;
  const monthsMissing = results[2].ok === false;
  const monthIdMissing = results[4].ok === false;
  if (profilesMissing || loginRpcMissing) {
    console.error("");
    console.error("登入基礎 schema 不完整。請先設定 .env 的 DATABASE_URL，再執行：");
    console.error("  npm run web:repair-db");
    console.error("或到 Supabase SQL Editor 手動執行 supabase/020_repair_profiles_schema.sql");
    process.exitCode = 1;
    return;
  }
  if (monthsMissing || monthIdMissing) {
    console.error("");
    console.error("資料庫 schema 不完整。請到 Supabase SQL Editor 執行：");
    console.error("  supabase/019_repair_schedule_months.sql");
    console.error("若尚未套用，也請依序確認 015、016、017、018 是否已執行。");
    process.exitCode = 1;
    return;
  }

  console.log("supabase schema check ok");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
