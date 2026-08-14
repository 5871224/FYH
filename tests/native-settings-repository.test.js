const test = require("node:test");
const assert = require("node:assert/strict");
const { createDatabase } = require("../src/backend/db/database");
const { createNativeSettingsRepository } = require("../src/backend/repositories/native-settings-repository");

function createExecutor(options = {}) {
  const calls = [];
  let transactionStatement = 0;
  const client = {
    async query(text, params = []) {
      const sql = String(text || "").trim();
      calls.push({ sql, params });
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) {
        return { rows: [], rowCount: 0 };
      }
      transactionStatement += 1;
      if (transactionStatement === 1) {
        return {
          rows: [{ access_role_id: "ROLE-1", permissions: ["department_settings"] }],
          rowCount: 1
        };
      }
      const returned = options.partial ? 1 : Number(options.expectedRows || 2);
      return {
        rows: Array.from({ length: returned }, (_, index) => ({ id: `ID-${index + 1}` })),
        rowCount: returned
      };
    },
    release() {
      calls.push({ sql: "RELEASE", params: [] });
    }
  };
  const executor = {
    async query(text, params = []) {
      const sql = String(text || "").trim();
      calls.push({ sql, params });
      return { rows: [{ id: "default" }], rowCount: 1 };
    },
    async connect() {
      return client;
    }
  };
  return { executor, calls };
}

const ids = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222"
];

test("班表偏好設定以 Backend employeeId 驗證 schedule_manage 後 upsert", async () => {
  const { executor, calls } = createExecutor();
  const repository = createNativeSettingsRepository(createDatabase(executor));
  const result = await repository.saveSchedulerPreferences("ACTOR-1", "default", {
    currentYear: 2026,
    currentMonth: 7,
    tableView: "member"
  });

  assert.deepEqual(result, { ok: true, id: "default" });
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /'schedule_manage' = any/);
  assert.match(calls[0].sql, /employee\.id = \$1::uuid/);
  assert.match(calls[0].sql, /insert into public\.scheduler_settings/);
  assert.equal(calls[0].params[0], "ACTOR-1");
});

test("群組型設定排序全部可管理時 COMMIT", async () => {
  const { executor, calls } = createExecutor({ expectedRows: ids.length });
  const repository = createNativeSettingsRepository(createDatabase(executor));
  const result = await repository.reorderSettings("ACTOR-1", "department", ids);

  assert.deepEqual(result, { ok: true, category: "department", count: 2 });
  assert.equal(calls[0].sql, "BEGIN");
  assert.match(calls[1].sql, /select employee\.access_role_id, role\.permissions/);
  assert.equal(calls[1].params[0], "ACTOR-1");
  assert.match(calls[2].sql, /public\.access_role_groups/);
  assert.equal(calls.at(-2).sql, "COMMIT");
  assert.equal(calls.at(-1).sql, "RELEASE");
});

test("排序中有任一 ID 不在適用群組時整批 ROLLBACK", async () => {
  const { executor, calls } = createExecutor({ partial: true });
  const repository = createNativeSettingsRepository(createDatabase(executor));

  await assert.rejects(
    repository.reorderSettings("ACTOR-1", "department", ids),
    (error) => error?.code === "SETTINGS_REORDER_SCOPE_DENIED"
  );

  assert.equal(calls.some((call) => call.sql === "COMMIT"), false);
  assert.equal(calls.at(-2).sql, "ROLLBACK");
  assert.equal(calls.at(-1).sql, "RELEASE");
});
