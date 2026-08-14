const test = require("node:test");
const assert = require("node:assert/strict");
const { createDatabase } = require("../src/backend/db/database");
const { createNativeGroupRoleRepository } = require("../src/backend/repositories/native-group-role-repository");
const { normalizePermissions, normalizeRole } = require("../src/backend/services/native-group-role-service");

const ACTOR = "11111111-1111-4111-8111-111111111111";
const ACTOR_ROLE = "22222222-2222-4222-8222-222222222222";
const GROUP = "33333333-3333-4333-8333-333333333333";
const ROLE = "44444444-4444-4444-8444-444444444444";

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

function actorRow(permissions, groupIds = []) {
  return {
    id: ACTOR,
    access_role_id: ACTOR_ROLE,
    permissions,
    group_ids: groupIds
  };
}

test("新增群組與操作者角色 mapping 在同一 transaction COMMIT", async () => {
  const { executor, calls } = createExecutor(async (sql) => {
    if (sql.includes("group by employee.id")) {
      return { rows: [actorRow(["group_settings"], [])], rowCount: 1 };
    }
    if (sql.includes("insert into public.schedule_groups")) {
      return {
        rows: [{
          id: GROUP,
          code: "NEW",
          name: "新群組",
          meal_enabled: false,
          status: "active",
          sort_order: 0
        }],
        rowCount: 1
      };
    }
    if (sql.includes("insert into public.access_role_groups")) return { rows: [], rowCount: 1 };
    throw new Error(`unexpected SQL: ${sql}`);
  });
  const repository = createNativeGroupRoleRepository(createDatabase(executor));
  const result = await repository.saveGroup(ACTOR, {
    id: GROUP,
    suppliedId: false,
    code: "NEW",
    name: "新群組",
    mealEnabled: false,
    status: "active",
    sortOrder: 0
  });

  assert.equal(result.group.id, GROUP);
  assert.equal(calls.some((call) => /insert into public\.access_role_groups/.test(call.sql)), true);
  assert.equal(calls.at(-2).sql, "COMMIT");
  assert.equal(calls.at(-1).sql, "RELEASE");
});

test("刪除最後一個 permission_settings 角色必須 ROLLBACK", async () => {
  const { executor, calls } = createExecutor(async (sql) => {
    if (sql.includes("group by employee.id")) {
      return { rows: [actorRow(["permission_settings"], [GROUP])], rowCount: 1 };
    }
    if (sql.includes("select id, permissions") && sql.includes("from public.access_roles")) {
      return { rows: [{ id: ROLE, permissions: ["permission_settings"] }], rowCount: 1 };
    }
    if (sql.includes("select exists") && sql.includes("from public.set_employee")) {
      return { rows: [{ used: false }], rowCount: 1 };
    }
    if (sql.includes("select count(*)::integer as count") && sql.includes("from public.access_roles")) {
      return { rows: [{ count: 0 }], rowCount: 1 };
    }
    throw new Error(`unexpected SQL: ${sql}`);
  });
  const repository = createNativeGroupRoleRepository(createDatabase(executor));

  await assert.rejects(
    repository.deleteRole(ACTOR, ROLE),
    (error) => error?.code === "LAST_PERMISSION_ROLE"
  );
  assert.equal(calls.some((call) => call.sql === "COMMIT"), false);
  assert.equal(calls.at(-2).sql, "ROLLBACK");
  assert.equal(calls.at(-1).sql, "RELEASE");
});

test("角色正規化只保留正式權限，schedule_manage 自動包含 schedule_view", () => {
  assert.deepEqual(
    normalizePermissions(["schedule_manage", "unknown", "schedule_manage"]),
    ["schedule_manage", "schedule_view"]
  );
  const role = normalizeRole({
    name: "主管",
    permissions: ["schedule_manage"],
    groupIds: [GROUP]
  });
  assert.equal(role.permissions.includes("schedule_view"), true);
  assert.deepEqual(role.groupIds, [GROUP]);
});
