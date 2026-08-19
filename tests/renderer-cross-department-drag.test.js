const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { readRendererCore } = require("../scripts/renderer-core-source.js");

// 固定補丁整併前實際使用的跨單位與同單位人員拖曳排序行為。
const root = path.resolve(__dirname, "..");
const orderingPath = path.join(root, "src", "renderer", "renderer-schedule-ordering.js");

function extractFunction(source, name) {
  const start = source.search(new RegExp("(?:async\\s+)?function\\s+" + name + "\\s*\\("));
  if (start < 0) throw new Error("找不到函式：" + name);
  const nextPattern = /\n(?:async\s+)?function\s+[A-Za-z0-9_$]+\s*\(/g;
  nextPattern.lastIndex = start + 1;
  const next = nextPattern.exec(source);
  return source.slice(start, next ? next.index : source.length);
}

function evaluateReorder(members) {
  const ordering = fs.readFileSync(orderingPath, "utf8");
  const source = extractFunction(ordering, "reorderScheduleTableMember");
  const context = {
    state: { members: JSON.parse(JSON.stringify(members)) },
    currentMember: null,
    getMemberHomeDeptId: (member) => member.deptId || "",
    resolveCurrentMember: () => ({ id: "CURRENT" }),
    clearScheduleRangeSelection: () => {},
    renderAll: () => {},
    persistScheduleTableMemberDepartment: async () => true,
    persistScheduleTableOrder: async () => true
  };
  const api = vm.runInNewContext(source + "\n;({ reorderScheduleTableMember })", context);
  return { api, context };
}

test("班表人員可拖到不同單位並沿用目標人員位置", async () => {
  const { api, context } = evaluateReorder([
    { id: "A", name: "甲", deptId: "D1" },
    { id: "B", name: "乙", deptId: "D2" },
    { id: "C", name: "丙", deptId: "D2" }
  ]);
  assert.equal(await api.reorderScheduleTableMember("A", "B", true), true);
  assert.deepEqual(Array.from(context.state.members, (member) => member.id), ["B", "A", "C"]);
  assert.equal(context.state.members[1].deptId, "D2");
});

test("同單位人員排序仍應正常運作", async () => {
  const { api, context } = evaluateReorder([
    { id: "A", deptId: "D1" },
    { id: "B", deptId: "D1" },
    { id: "C", deptId: "D1" }
  ]);
  assert.equal(await api.reorderScheduleTableMember("C", "A", false), true);
  assert.deepEqual(Array.from(context.state.members, (member) => member.id), ["C", "A", "B"]);
});

test("跨單位拖曳應由正式函式提供而非後載入覆蓋", () => {
  const ordering = fs.readFileSync(orderingPath, "utf8");
  const rendererCore = readRendererCore(root);
  const build = fs.readFileSync(path.join(root, "scripts", "build-js.js"), "utf8");
  assert.equal(fs.existsSync(path.join(root, "src", "renderer", "v2-cross-department-member-drag.js")), false);
  assert.equal(build.includes("v2-cross-department-member-drag.js"), false);
  assert.equal((ordering.match(/async function reorderScheduleTableMember\b/g) || []).length, 1);
  assert.equal(ordering.includes("reorderScheduleTableMember = async function"), false);
  assert.equal(rendererCore.includes("tableMember.dataset.tableMemberId !== dragScheduleTableMemberId"), true);
  assert.equal(rendererCore.includes("tableMember.dataset.tableMemberDepartmentId === getMemberHomeDeptId(draggedMember)"), false);
});
