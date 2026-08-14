const test = require("node:test");
const assert = require("node:assert/strict");
const { createDatabase } = require("../src/backend/db/database");
const { createNativeMemberRepository } = require("../src/backend/repositories/native-member-repository");

const ACTOR = "11111111-1111-4111-8111-111111111111";
const MEMBER = "22222222-2222-4222-8222-222222222222";
const OLD_GROUP = "33333333-3333-4333-8333-333333333333";
const NEW_GROUP = "44444444-4444-4444-8444-444444444444";
const ROLE = "55555555-5555-4555-8555-555555555555";

function createExecutor(handler) {
  const calls = [];
  const client = {
    async query(text, params = []) {
      const sql = String(text || "").trim();
      calls.push({ sql, params });
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [], rowCount: 0 };
      return handler(sql, params);
    },
    release() {
      calls.push({ sql: "RELEASE", params: [] });
    }
  };
  return {
    calls,
    executor: {
      query: (...args) => client.query(...args),
      connect: async () => client
    }
  };
}

function actorRow() {
  return {
    id: ACTOR,
    group_id: OLD_GROUP,
    permissions: ["member_settings"],
    group_ids: [OLD_GROUP, NEW_GROUP]
  };
}

test("跨群組仍有未封存班表時整批 ROLLBACK", async () => {
  const { executor, calls } = createExecutor(async (sql) => {
    if (sql.includes("group by employee.id")) return { rows: [actorRow()], rowCount: 1 };
    if (sql.includes("lower(btrim(employee.employee_code))")) {
      return {
        rows: [{
          id: MEMBER,
          employee_code: "A01",
          group_id: OLD_GROUP,
          deleted_at: null,
          role_permissions: []
        }],
        rowCount: 1
      };
    }
    if (sql.includes("from public.schedule_groups")) return { rows: [{ id: NEW_GROUP }], rowCount: 1 };
    if (sql.includes("from public.schedule_entries entry")) return { rows: [{ count: 2 }], rowCount: 1 };
    throw new Error(`unexpected SQL: ${sql}`);
  });
  const repository = createNativeMemberRepository(createDatabase(executor));

  await assert.rejects(
    repository.validateGroupChange(ACTOR, "A01", NEW_GROUP),
    (error) => error?.code === "MEMBER_HAS_UNARCHIVED_SCHEDULE"
  );
  assert.equal(calls.some((call) => call.sql === "COMMIT"), false);
  assert.equal(calls.at(-2).sql, "ROLLBACK");
  assert.equal(calls.at(-1).sql, "RELEASE");
});

test("新增人員在同一 transaction 寫入 set_employee 與 auth_accounts 後 COMMIT", async () => {
  const { executor, calls } = createExecutor(async (sql) => {
    if (sql.includes("group by employee.id")) return { rows: [actorRow()], rowCount: 1 };
    if (sql.includes("lower(btrim(employee.employee_code))")) return { rows: [], rowCount: 0 };
    if (sql.includes("from public.schedule_groups")) return { rows: [{ id: NEW_GROUP }], rowCount: 1 };
    if (sql.includes("from public.access_roles") && sql.includes("select id, code, name, permissions")) {
      return { rows: [{ id: ROLE, code: "USER", name: "一般", permissions: ["schedule_view"] }], rowCount: 1 };
    }
    if (sql.includes("from public.access_role_groups")) return { rows: [{ group_id: NEW_GROUP }], rowCount: 1 };
    if (sql.includes("insert into public.set_employee")) {
      return { rows: [{ id: MEMBER, employee_code: "A01" }], rowCount: 1 };
    }
    if (sql.includes("insert into public.auth_accounts")) return { rows: [], rowCount: 1 };
    throw new Error(`unexpected SQL: ${sql}`);
  });
  const repository = createNativeMemberRepository(createDatabase(executor));
  const result = await repository.saveMember(ACTOR, {
    id: MEMBER,
    employeeCode: "A01",
    fullName: "測試人員",
    groupId: NEW_GROUP,
    accessRoleId: ROLE,
    hireDate: null,
    leaveDate: null,
    payByDay: false,
    fixedRestWeekday: 0,
    homeDepartmentId: "",
    scheduleShiftIds: [],
    monthlyRestDays: 8
  }, "", "scrypt$v1$test$hash");

  assert.deepEqual(result, { ok: true, created: true, id: MEMBER, employeeCode: "A01" });
  assert.equal(calls.some((call) => /insert into public\.set_employee/.test(call.sql)), true);
  assert.equal(calls.some((call) => /insert into public\.auth_accounts/.test(call.sql)), true);
  assert.equal(calls.at(-2).sql, "COMMIT");
  assert.equal(calls.at(-1).sql, "RELEASE");
});
