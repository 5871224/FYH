const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createNativeArchive } = require("../src/backend/native-archive");
const { ROUTES } = require("../src/backend/api-contract");

const source = fs.readFileSync(path.join(__dirname, "../src/backend/native-archive.js"), "utf8");

test("Native 封存是單一薄模組且不含 Supabase transport", () => {
  for (const marker of ["auth.uid()", "/rest/v1/", "/auth/v1/", "/functions/v1/", "access_token", "refresh_token", "apikey"]) {
    assert.equal(source.includes(marker), false, `不應包含 ${marker}`);
  }
  for (const key of ["scheduleArchives", "scheduleArchiveCreate", "scheduleArchiveEntries", "scheduleArchiveUnarchive"]) {
    assert.ok(ROUTES[key]);
  }
});

test("封存建立使用單一 PostgreSQL transaction", async () => {
  let transactionCount = 0;
  let oneIndex = 0;
  const oneRows = [
    { id: "00000000-0000-4000-8000-000000000001", full_name: "測試" },
    { id: "00000000-0000-4000-8000-000000000002", code: "T", name: "測試群組" },
    null,
    { id: "00000000-0000-4000-8000-000000000003" },
    { entry_count: 2, member_count: 1 }
  ];
  const tx = {
    one: async () => oneRows[oneIndex++] || null,
    query: async () => ({ rows: [], rowCount: 1 })
  };
  const database = {
    one: async () => null,
    query: async () => ({ rows: [], rowCount: 0 }),
    transaction: async (callback) => {
      transactionCount += 1;
      return callback(tx);
    }
  };

  const archive = createNativeArchive(database);
  const result = await archive.archive(
    "00000000-0000-4000-8000-000000000001",
    "00000000-0000-4000-8000-000000000002",
    "2026-08-01",
    "2026-08-01"
  );

  assert.equal(transactionCount, 1);
  assert.deepEqual(result, {
    ok: true,
    archiveId: "00000000-0000-4000-8000-000000000003",
    entryCount: 2,
    memberCount: 1
  });
});
