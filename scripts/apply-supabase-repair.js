const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const { loadProjectEnv, requireEnv } = require("./load-env");

const REPAIR_FILES = [
  "020_repair_profiles_schema.sql",
  "019_repair_schedule_months.sql"
];

async function applySqlFile(client, fileName) {
  const filePath = path.resolve(__dirname, "..", "supabase", fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`找不到 ${filePath}`);
  }
  const sql = fs.readFileSync(filePath, "utf8");
  console.log(`==> ${fileName}`);
  await client.query(sql);
}

async function main() {
  const env = loadProjectEnv();
  requireEnv(env, ["DATABASE_URL"]);
  const client = new Client({
    connectionString: env.DATABASE_URL,
    ssl: env.DATABASE_URL.includes("localhost") || env.DATABASE_URL.includes("127.0.0.1")
      ? false
      : { rejectUnauthorized: false }
  });
  await client.connect();
  try {
    for (const fileName of REPAIR_FILES) {
      await applySqlFile(client, fileName);
    }
    console.log("Supabase repair complete.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  console.error("");
  console.error("請到 Supabase Dashboard → Project Settings → Database 複製 Connection string，");
  console.error("加入 .env 的 DATABASE_URL 後再執行：npm run web:repair-db");
  process.exitCode = 1;
});
