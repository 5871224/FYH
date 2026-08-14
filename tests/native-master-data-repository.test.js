const test = require("node:test");
const assert = require("node:assert/strict");
const { createDatabase } = require("../src/backend/db/database");
const { createNativeMasterDataRepository } = require("../src/backend/repositories/native-master-data-repository");

function createExecutor(mode) {
  const calls = [];
  const client = {
    async query(text, params = []) {
      const sql = String(text || "").trim();
      calls.push({ sql, params });
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) {
        return { rows: [], rowCount: 0 };
      }
      if (/select employee\.id, employee\.access_role_id, role\.permissions/.test(sql)) {
        return {
          rows: [{ id: "ACTOR-1", access_role_id: "ROLE-1", permissions: ["department_settings"] }],
          rowCount: 1
        };
      }
      if (/from public\.schedule_groups/.test(sql)) {
        return { rows: [{ id: "11111111-1111-4111-8111-111111111111" }], rowCount: 1 };
      }
      if (/from public\.access_role_groups/.test(sql)) {
        return mode === "groupDenied"
          ? { rows: [], rowCount: 0 }
          : { rows: [{ allowed: 1 }], rowCount: 1 };
      }
      if (/from public\.set_departments[\s\S]*for update/.test(sql)) {
        return {
          rows: [{
            id: "22222222-2222-4222-8222-222222222222",
            group_id: "11111111-1111-4111-8111-111111111111",
            deleted_at: null
          }],
          rowCount: 1
        };
      }
      if (/from public\.set_employee[\s\S]*home_department_id/.test(sql)) {
        return { rows: [], rowCount: 0 };
      }
      if (/from public\.set_shift[\s\S]*applicable_department_id/.test(sql)) {
        return { rows: [], rowCount: 0 };
      }
      if (/count\(\*\)::bigint as schedule_count/.test(sql)) {
        return { rows: [{ schedule_count: "0", unarchived_count: "0" }], rowCount: 1 };
      }
      if (/reference_count/.test(sql)) {
        return { rows: [{ reference_count: "0" }], rowCount: 1 };
      }
      if (/delete from public\.set_departments/.test(sql)) {
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    release() {
      calls.push({ sql: "RELEASE", params: [] });
    }
  };
  return {
    calls,
    executor: {
      async query() {
        throw new Error("master data mutations must use a transaction client");
      },
      async connect() {
        return client;
      }
    }
  };
}

const actorId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const groupId = "11111111-1111-4111-8111-111111111111";
const departmentId = "22222222-2222-4222-8222-222222222222";

test("單位寫入若角色不適用目標群組，寫入前整個交易 ROLLBACK", async () => {
  const { executor, calls } = createExecutor("groupDenied");
  const repository = createNativeMasterDataRepository(createDatabase(executor));

  await assert.rejects(
    repository.saveDepartment(actorId, {
      id: departmentId,
      groupId,
      name: "測試單位",
      startDate: null,
      endDate: null,
      hiddenFromSchedule: false,
      sortOrder: 0,
      address: null,
      latitude: null,
      longitude: null,
      publicIp: null,
      attendanceEnabled: false
    }),
    (error) => error?.code === "MASTER_DATA_GROUP_DENIED"
  );

  assert.equal(calls[0].sql, "BEGIN");
  assert.equal(calls.some((call) => /insert into public\.set_departments/.test(call.sql)), false);
  assert.equal(calls.some((call) => call.sql === "COMMIT"), false);
  assert.equal(calls.at(-2).sql, "ROLLBACK");
  assert.equal(calls.at(-1).sql, "RELEASE");
});

test("單位沒有任何歷史引用時走 hard delete 並 COMMIT", async () => {
  const { executor, calls } = createExecutor("hardDelete");
  const repository = createNativeMasterDataRepository(createDatabase(executor));

  const result = await repository.deleteDepartment(actorId, departmentId);
  assert.deepEqual(result, {
    ok: true,
    deleted: true,
    softDeleted: false,
    hardDeleted: true,
    id: departmentId
  });
  assert.equal(calls[0].sql, "BEGIN");
  assert.equal(calls.some((call) => /delete from public\.set_departments/.test(call.sql)), true);
  assert.equal(calls.at(-2).sql, "COMMIT");
  assert.equal(calls.at(-1).sql, "RELEASE");
});
