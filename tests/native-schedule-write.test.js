const test = require("node:test");
const assert = require("node:assert/strict");
const { createDatabase } = require("../src/backend/db/database");
const { createNativeScheduleRepository } = require("../src/backend/repositories/native-schedule-repository");

function createTransactionalExecutor(options = {}) {
  const calls = [];
  let statementIndex = 0;
  const client = {
    async query(text, params = []) {
      const sql = String(text || "").trim();
      calls.push({ sql, params });
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) {
        return { rows: [], rowCount: 0 };
      }
      statementIndex += 1;
      if (statementIndex === 1) {
        return { rows: [{ access_role_id: "ROLE-1" }], rowCount: 1 };
      }
      if (statementIndex === 2) {
        return {
          rows: [{ has_blank_entry: false, has_forbidden_entry: false }],
          rowCount: 1
        };
      }
      if (options.failWrite) {
        throw new Error("simulated write failure");
      }
      return {
        rows: [{ id: "SAVED-1", member_id: "MEMBER-1", work_date: "2026-08-14" }],
        rowCount: 1
      };
    },
    release() {
      calls.push({ sql: "RELEASE", params: [] });
    }
  };
  const executor = {
    async query() {
      throw new Error("saveEntries should use a transaction client");
    },
    async connect() {
      return client;
    }
  };
  return { executor, calls };
}

const entries = [{
  member_id: "MEMBER-1",
  work_date: "2026-08-14",
  shift_type_id: "SHIFT-1"
}];

test("Native 班表批次寫入成功時在同一交易 COMMIT", async () => {
  const { executor, calls } = createTransactionalExecutor();
  const repository = createNativeScheduleRepository(createDatabase(executor));
  const rows = await repository.saveEntries("ACTOR-1", entries);

  assert.deepEqual(rows, [{ id: "SAVED-1", member_id: "MEMBER-1", work_date: "2026-08-14" }]);
  assert.equal(calls[0].sql, "BEGIN");
  assert.equal(calls.at(-2).sql, "COMMIT");
  assert.equal(calls.at(-1).sql, "RELEASE");
  assert.equal(calls.some((call) => call.sql === "ROLLBACK"), false);
  assert.match(calls[1].sql, /schedule_manage/);
  assert.match(calls[2].sql, /schedule_archives/);
  assert.match(calls[3].sql, /on conflict\(member_id, work_date\) do update/);
});

test("Native 班表批次任一寫入失敗時整個交易 ROLLBACK", async () => {
  const { executor, calls } = createTransactionalExecutor({ failWrite: true });
  const repository = createNativeScheduleRepository(createDatabase(executor));

  await assert.rejects(
    repository.saveEntries("ACTOR-1", entries),
    /simulated write failure/
  );

  assert.equal(calls[0].sql, "BEGIN");
  assert.equal(calls.some((call) => call.sql === "COMMIT"), false);
  assert.equal(calls.at(-2).sql, "ROLLBACK");
  assert.equal(calls.at(-1).sql, "RELEASE");
});
