const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { stripTypeScriptTypes } = require("node:module");
const runtime = require("../supabase/functions/_shared/runtime.ts");
const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const groupId = "11111111-1111-4111-8111-111111111111";
const date = "2026-10-01";
const members = ["visible", "hidden", null].map((department, index) => ({
  id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  employee_code: `A${index + 1}`, full_name: `人員${index + 1}`, group_id: groupId,
  home_department_id: department, deleted_at: null
}));
const departments = [
  { id: "visible", group_id: groupId, hidden_from_schedule: false },
  { id: "hidden", group_id: groupId, hidden_from_schedule: true }
];

function database() {
  const tables = {
    set_employee: members, set_departments: departments,
    schedule_groups: [{ id: groupId, name: "群組" }],
    access_role_group_permissions: [{ group_id: groupId, permissions: ["attendance_review"] }],
    attendance_days: members.map((member) => ({ id: member.id, user_id: member.id, work_date: date, overtime_minutes: 60, reviewed_at: `${date}T12:00:00Z` })),
    schedule_entries: members.map((member) => ({ member_id: member.id, work_date: date, group_id: groupId, support_department_id: member.home_department_id === "hidden" ? "visible" : "hidden" })),
    scheduler_settings: [{}], meal_settings: [{}], meal_orders: []
  };
  return {
    rpc: async () => ({ data: true, error: null }),
    from(table) {
      let data = (tables[table] || []).map((row) => ({ ...row }));
      const query = {
        select(columns) {
          if (table === "set_employee" && columns.includes("home_department:")) {
            data = data.map((row) => ({ ...row, home_department: departments.find((department) => department.id === row.home_department_id) || null }));
          }
          return query;
        },
        eq(column, value) { data = data.filter((row) => row[column] === value); return query; },
        in(column, values) { data = data.filter((row) => values.includes(row[column])); return query; },
        is(column, value) { data = data.filter((row) => (row[column] ?? null) === value); return query; },
        not(column, _operator, value) { data = data.filter((row) => (row[column] ?? null) !== value); return query; },
        gte(column, value) { data = data.filter((row) => row[column] >= value); return query; },
        lte(column, value) { data = data.filter((row) => row[column] <= value); return query; },
        contains() { return query; }, order() { return query; },
        range(from, to) { data = data.slice(from, to + 1); return query; },
        single() { return Promise.resolve({ data: data[0] || null, error: null }); },
        maybeSingle() { return query.single(); },
        then(resolve) { return Promise.resolve({ data, error: null }).then(resolve); }
      };
      return query;
    }
  };
}

function loadEdge(name) {
  const source = read(`supabase/functions/${name}/index.ts`)
    .replace(/^import .* from "npm:.*";\r?\n/m, "")
    .replace(/^import \{ (.*) \} from "\.\.\/_shared\/runtime\.ts";/m,
      (_, names) => `const { ${names.replace(/(\w+) as (\w+)/g, "$1: $2")} } = runtime;`)
    .replace("export default", "const edge =");
  return new Function("withSupabase", "runtime", stripTypeScriptTypes(source) + "\n;return edge;")((_, handler) => handler, runtime).fetch;
}

async function request(name, body, actor = members[0]) {
  const response = await loadEdge(name)(new Request("https://example.test", {
    method: "POST", body: JSON.stringify({ fromDate: date, toDate: date, ...body })
  }), { userClaims: { sub: actor.id }, supabaseAdmin: database() });
  assert.equal(response.status, 200, await response.clone().text());
  return response.json();
}

test("個人記錄排除不顯示單位，保留一般及未設定單位人員", async () => {
  for (const [index, member] of members.entries()) {
    const result = await request("attendance-ledger", { action: "personal_list" }, member);
    assert.equal(result.records.length, index === 1 ? 0 : 1);
    assert.equal(result.total, index === 1 ? 0 : 1);
  }
});

test("簽到審核清單、選項與完整讀取排除不顯示單位，判定不受支援單位影響", async () => {
  for (const action of ["review_list", "export_list"]) {
    const result = await request("attendance-review-groups", { action, status: "all", issueType: "__all__" });
    assert.deepEqual(result.rows.map((row) => row.user_id), [members[0].id, members[2].id]);
    assert.equal(result.total, 2);
    assert.deepEqual(result.members.map((member) => member.id), [members[0].id, members[2].id]);
  }
  const result = await request("attendance-ledger-export", {});
  assert.deepEqual(result.rows.map((row) => row.employee_code), ["A1", "A3"]);
});

test("班表四種匯出排除不顯示所屬單位，仍保留在隱藏單位上班的一般人員", async () => {
  const state = {
    members: members.map((member) => ({ id: member.id, code: member.employee_code, name: member.full_name, groupId, deptId: member.home_department_id })),
    departments: departments.map((department) => ({ id: department.id, hiddenFromSchedule: department.hidden_from_schedule })),
    shifts: [{ id: "shift", applicableDeptId: "hidden" }], leaves: []
  };
  const actions = vm.runInNewContext(read("src/renderer/renderer-export-actions.js") + "\n;({ buildWorkdayExportRows, filterExportRowsToCurrentGroup })", {
    state, groupFeatureState: { currentGroupId: groupId },
    window: { schedulerApi: { loadScheduleEntries: async () => ({ schedule: Object.fromEntries(members.map((member) => [`${member.id}_2026_9_1`, { shift: "shift" }])) }) } }
  });
  const workdays = await actions.buildWorkdayExportRows(date, date);
  assert.deepEqual(Array.from(workdays, (row) => row.values[2]), ["A1", "A3"]);

  const context = { window: {} };
  vm.runInNewContext(read("src/renderer/browser-exporter.js"), context);
  for (const method of ["getSapLeaveExportRows", "getLeaveExportRows", "getOvertimeExportRows"]) {
    const exportRows = actions.filterExportRowsToCurrentGroup(members.map((member) => ({
      member_id: member.id, employee_code: member.employee_code, home_department_id: member.home_department_id,
      work_date: date, leave_type_id: "leave", leave_code: method === "getSapLeaveExportRows" ? "0036" : "0010",
      overtime_type_id: "overtime", overtime_start_time: "18:00", overtime_end_time: "19:00"
    })));
    const rows = context.window.schedulerBrowserExporter[method]({ state, exportRows });
    assert.equal(rows.length, 2);
    assert.deepEqual(Array.from(rows, (row) => row[method === "getSapLeaveExportRows" ? 1 : 0]), ["A1", "A3"]);
  }
});
