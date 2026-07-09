const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadPublicConfig() {
  const filePath = path.resolve(__dirname, "..", "src", "renderer", "app-config.js");
  const code = fs.readFileSync(filePath, "utf8");
  const sandbox = { window: {} };
  vm.runInNewContext(code, sandbox);
  return sandbox.window.SCHEDULER_CONFIG || {};
}

async function request(baseUrl, anonKey, pathname) {
  return fetch(`${baseUrl}${pathname}`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      Accept: "application/json"
    }
  });
}

async function assertNoAnonymousRows(baseUrl, anonKey, table) {
  const response = await request(baseUrl, anonKey, `/rest/v1/${table}?select=id&limit=1`);
  if (!response.ok) return;
  const rows = await response.json();
  if (Array.isArray(rows) && rows.length === 0) return;
  throw new Error(`匿名使用者仍可讀取 ${table}`);
}

async function main() {
  const config = loadPublicConfig();
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error("app-config.js 缺少 supabaseUrl 或 supabaseAnonKey");
  }
  const baseUrl = String(config.supabaseUrl).replace(/\/+$/, "");
  const settings = await request(baseUrl, config.supabaseAnonKey, "/auth/v1/settings");
  if (!settings.ok) throw new Error(await settings.text() || `HTTP ${settings.status}`);
  for (const table of [
    "set_employee",
    "set_departments",
    "set_shift",
    "set_leave",
    "set_overtime",
    "holidays",
    "schedule_entries",
    "scheduler_settings"
  ]) {
    await assertNoAnonymousRows(baseUrl, config.supabaseAnonKey, table);
  }
  console.log("supabase auth config and anonymous access checks ok");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
