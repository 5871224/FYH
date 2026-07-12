const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const rendererDir = path.join(root, "src", "renderer");
const rendererPath = path.join(rendererDir, "renderer.js");
const patchPath = path.join(rendererDir, "v2-cross-department-member-drag.js");
const buildPath = path.join(root, "scripts", "build-js.js");
const testPath = path.join(root, "tests", "renderer-phase7-cross-department-drag.test.js");

function replaceTopLevelFunction(source, name, replacement) {
  const startPattern = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`);
  const startMatch = startPattern.exec(source);
  if (!startMatch) throw new Error(`找不到函式：${name}`);
  const start = startMatch.index;
  const nextPattern = /\n(?:async\s+)?function\s+[A-Za-z0-9_$]+\s*\(/g;
  nextPattern.lastIndex = start + startMatch[0].length;
  const nextMatch = nextPattern.exec(source);
  if (!nextMatch) throw new Error(`找不到函式結束邊界：${name}`);
  return source.slice(0, start) + replacement.trimEnd() + "\n\n" + source.slice(nextMatch.index + 1);
}

let renderer = fs.readFileSync(rendererPath, "utf8");
const canonicalFunction = `async function reorderScheduleTableMember(draggedMemberId, targetMemberId, insertAfter = false) {
  const draggedMember = state.members.find((member) => member.id === draggedMemberId);
  const targetMember = state.members.find((member) => member.id === targetMemberId);
  if (!draggedMember || !targetMember || draggedMemberId === targetMemberId) {
    return false;
  }

  const targetDepartmentId = getMemberHomeDeptId(targetMember);
  if (!targetDepartmentId) {
    return false;
  }

  const remainingMembers = state.members.filter((member) => member.id !== draggedMemberId);
  const targetIndex = remainingMembers.findIndex((member) => member.id === targetMemberId);
  if (targetIndex < 0) {
    return false;
  }

  const movedMember = {
    ...draggedMember,
    deptId: targetDepartmentId
  };
  remainingMembers.splice(targetIndex + (insertAfter ? 1 : 0), 0, movedMember);
  state.members = remainingMembers;
  currentMember = resolveCurrentMember();
  clearScheduleRangeSelection();
  renderAll();
  await forceSave();
  return true;
}`;
renderer = replaceTopLevelFunction(renderer, "reorderScheduleTableMember", canonicalFunction);

const oldDragover = `    const tableMember = event.target.closest("[data-table-member-id]");
    if (tableMember && dragScheduleTableMemberId && canDragScheduleOrder) {
      const draggedMember = state.members.find((member) => member.id === dragScheduleTableMemberId);
      if (draggedMember && tableMember.dataset.tableMemberDepartmentId === getMemberHomeDeptId(draggedMember)) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        markScheduleTableOrderTarget(tableMember, event.clientY);
        return;
      }
    }`;
const newDragover = `    const tableMember = event.target.closest("[data-table-member-id]");
    if (tableMember && dragScheduleTableMemberId && canDragScheduleOrder && tableMember.dataset.tableMemberId !== dragScheduleTableMemberId) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      markScheduleTableOrderTarget(tableMember, event.clientY);
      return;
    }`;
if (!renderer.includes(oldDragover)) throw new Error("找不到跨單位拖曳目標限制區段");
renderer = renderer.replace(oldDragover, newDragover);
fs.writeFileSync(rendererPath, renderer);

if (!fs.existsSync(patchPath)) throw new Error("找不到待移除的跨單位拖曳補丁");
fs.unlinkSync(patchPath);
let build = fs.readFileSync(buildPath, "utf8");
build = build.replace(/^\s*"v2-cross-department-member-drag\.js",?\r?\n/m, "");
fs.writeFileSync(buildPath, build);

const testSource = `const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const rendererPath = path.join(root, "src", "renderer", "renderer.js");

function extractFunction(source, name) {
  const start = source.search(new RegExp("(?:async\\\\s+)?function\\\\s+" + name + "\\\\s*\\\\("));
  if (start < 0) throw new Error("找不到函式：" + name);
  const nextPattern = /\\n(?:async\\s+)?function\\s+[A-Za-z0-9_$]+\\s*\\(/g;
  nextPattern.lastIndex = start + 1;
  const next = nextPattern.exec(source);
  return source.slice(start, next ? next.index : source.length);
}

function evaluateReorder(members) {
  const renderer = fs.readFileSync(rendererPath, "utf8");
  const source = extractFunction(renderer, "reorderScheduleTableMember");
  const context = {
    state: { members: JSON.parse(JSON.stringify(members)) },
    currentMember: null,
    getMemberHomeDeptId: (member) => member.deptId || "",
    resolveCurrentMember: () => ({ id: "CURRENT" }),
    clearScheduleRangeSelection: () => {},
    renderAll: () => {},
    forceSave: async () => {}
  };
  const api = vm.runInNewContext(source + "\\n;({ reorderScheduleTableMember })", context);
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
  const renderer = fs.readFileSync(rendererPath, "utf8");
  const build = fs.readFileSync(path.join(root, "scripts", "build-js.js"), "utf8");
  assert.equal(fs.existsSync(path.join(root, "src", "renderer", "v2-cross-department-member-drag.js")), false);
  assert.equal(build.includes("v2-cross-department-member-drag.js"), false);
  assert.equal((renderer.match(/async function reorderScheduleTableMember\\b/g) || []).length, 1);
  assert.equal(renderer.includes("reorderScheduleTableMember = async function"), false);
  assert.equal(renderer.includes("tableMember.dataset.tableMemberId !== dragScheduleTableMemberId"), true);
  assert.equal(renderer.includes("tableMember.dataset.tableMemberDepartmentId === getMemberHomeDeptId(draggedMember)"), false);
});
`;
fs.writeFileSync(testPath, testSource);
console.log("cross-department member drag patch merged into canonical renderer");
