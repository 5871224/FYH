const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "..", "src", "renderer", "renderer-schedule-ordering.js"),
  "utf8"
);

function createHarness() {
  const calls = {
    reorder: [],
    syncMember: []
  };
  const context = {
    state: {
      departments: [
        { id: "d1", name: "一部" },
        { id: "d2", name: "二部" }
      ],
      members: [
        { id: "m1", code: "001", name: "甲", deptId: "d1" },
        { id: "m2", code: "002", name: "乙", deptId: "d1" },
        { id: "m3", code: "003", name: "丙", deptId: "d2" }
      ]
    },
    currentMember: null,
    window: {
      scrollX: 0,
      scrollY: 0,
      scrollTo() {},
      schedulerApi: {
        async reorderSettings(category, ids) {
          calls.reorder.push({ category, ids: [...ids] });
          return { ok: true };
        },
        async syncMemberProfile(member, previousEmployeeCode) {
          calls.syncMember.push({ member: { ...member }, previousEmployeeCode });
          return { ok: true };
        }
      }
    },
    requestAnimationFrame(callback) {
      callback();
    },
    syncStickyHeaderScroll() {},
    renderAll() {},
    setSaveStatus() {},
    clearScheduleRangeSelection() {},
    resolveCurrentMember() {
      return null;
    },
    getMemberHomeDeptId(member) {
      return member?.deptId || "";
    },
    getVisibleTableGroups() {
      return context.state.departments.map((department) => ({ department }));
    }
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return { context, calls };
}

test("班表單位拖曳會儲存單位排序", async () => {
  const { context, calls } = createHarness();

  const changed = await context.reorderScheduleTableDepartment("d2", "d1");

  assert.equal(changed, true);
  assert.deepEqual(context.state.departments.map((item) => item.id), ["d2", "d1"]);
  assert.deepEqual(calls.reorder, [
    { category: "department", ids: ["d2", "d1"] }
  ]);
});

test("班表同單位人員拖曳只儲存人員排序", async () => {
  const { context, calls } = createHarness();

  const changed = await context.reorderScheduleTableMember("m2", "m1");

  assert.equal(changed, true);
  assert.deepEqual(context.state.members.map((item) => item.id), ["m2", "m1", "m3"]);
  assert.deepEqual(calls.syncMember, []);
  assert.deepEqual(calls.reorder, [
    { category: "member", ids: ["m2", "m1", "m3"] }
  ]);
});

test("班表跨單位拖曳會先儲存人員所屬單位，再儲存人員排序", async () => {
  const { context, calls } = createHarness();

  const changed = await context.reorderScheduleTableMember("m1", "m3");

  assert.equal(changed, true);
  assert.equal(calls.syncMember.length, 1);
  assert.equal(calls.syncMember[0].member.id, "m1");
  assert.equal(calls.syncMember[0].member.deptId, "d2");
  assert.equal(calls.syncMember[0].previousEmployeeCode, "001");
  assert.deepEqual(calls.reorder, [
    { category: "member", ids: ["m2", "m1", "m3"] }
  ]);
});
