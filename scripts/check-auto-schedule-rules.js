const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const renderer = fs.readFileSync(path.join(rootDir, "src", "renderer", "renderer.js"), "utf8");

function holidayTarget(activeDays) {
  return Math.round((activeDays / 56) * 16);
}

function memberCanScheduleShift(scheduleShiftIds, shiftId) {
  return scheduleShiftIds.includes(shiftId);
}

function memberShiftPriority(scheduleShiftIds, shiftId) {
  const index = scheduleShiftIds.indexOf(shiftId);
  return index === -1 ? Infinity : index;
}

function assignmentCost({ payByDay, restCount, restTarget, hasRestThisWeek, scheduleShiftIds }, shiftId) {
  const shiftPriority = memberShiftPriority(scheduleShiftIds, shiftId);
  if (!Number.isFinite(shiftPriority)) {
    return Infinity;
  }
  const mustWork = !payByDay && (restCount >= restTarget || hasRestThisWeek);
  if (mustWork) {
    return shiftPriority;
  }
  if (!payByDay) {
    return 1000 + shiftPriority;
  }
  return 2000 + shiftPriority;
}

function findMinimumCostFlowAssignments(options) {
  const FIRST_COVERAGE_COST = 0;
  const EXTRA_COVERAGE_COST = 1000000;
  const members = [];
  const memberIndexById = new Map();
  options.forEach((option) => {
    option.candidates.forEach((member) => {
      if (!memberIndexById.has(member.id)) {
        memberIndexById.set(member.id, members.length);
        members.push(member);
      }
    });
  });
  const shiftSlots = [];
  options.forEach((option) => {
    for (let index = 0; index < option.remaining; index += 1) {
      shiftSlots.push({
        ...option,
        slotCost: option.assignedCount === 0 && index === 0 ? FIRST_COVERAGE_COST : EXTRA_COVERAGE_COST
      });
    }
  });
  const source = 0;
  const shiftStart = 1;
  const memberStart = shiftStart + shiftSlots.length;
  const sink = memberStart + members.length;
  const graph = Array.from({ length: sink + 1 }, () => []);
  const assignmentEdges = [];
  const addEdge = (from, to, capacity, cost = 0) => {
    const forward = { to, rev: graph[to].length, capacity, cost };
    const backward = { to: from, rev: graph[from].length, capacity: 0, cost: -cost };
    graph[from].push(forward);
    graph[to].push(backward);
    return forward;
  };
  shiftSlots.forEach((option, optionIndex) => {
    const shiftNode = shiftStart + optionIndex;
    addEdge(source, shiftNode, 1, option.slotCost);
    option.candidates.forEach((member) => {
      const memberNode = memberStart + memberIndexById.get(member.id);
      const edge = addEdge(shiftNode, memberNode, 1, Number(member.cost) || 0);
      assignmentEdges.push({ edge, shift: option.shift, member });
    });
  });
  members.forEach((member, memberIndex) => {
    addEdge(memberStart + memberIndex, sink, 1);
  });
  const findShortestPath = () => {
    const distances = Array(graph.length).fill(Infinity);
    const inQueue = Array(graph.length).fill(false);
    const previous = Array(graph.length).fill(null);
    distances[source] = 0;
    const queue = [source];
    inQueue[source] = true;
    while (queue.length) {
      const node = queue.shift();
      inQueue[node] = false;
      graph[node].forEach((edge, edgeIndex) => {
        const nextCost = distances[node] + edge.cost;
        if (edge.capacity > 0 && nextCost < distances[edge.to]) {
          distances[edge.to] = nextCost;
          previous[edge.to] = { node, edgeIndex };
          if (!inQueue[edge.to]) {
            inQueue[edge.to] = true;
            queue.push(edge.to);
          }
        }
      });
    }
    return distances[sink] < Infinity ? previous : null;
  };
  // ponytail: mirrors renderer.js daily min-cost flow without browser state.
  while (true) {
    const previous = findShortestPath();
    if (!previous) {
      break;
    }
    let cursor = sink;
    while (cursor !== source) {
      const step = previous[cursor];
      const edge = graph[step.node][step.edgeIndex];
      edge.capacity -= 1;
      graph[edge.to][edge.rev].capacity += 1;
      cursor = step.node;
    }
  }
  return assignmentEdges
    .filter(({ edge }) => edge.capacity === 0)
    .map(({ shift, member }) => ({ shift, member: member.id }));
}

function chooseDailyAssignments(rawOptions) {
  const options = rawOptions
    .map((option) => ({
      ...option,
      candidates: option.candidates.map((candidate) => ({ ...candidate }))
    }))
    .sort((a, b) => (
      a.candidates.length - b.candidates.length
      || b.remaining - a.remaining
      || a.shift.localeCompare(b.shift)
    ));
  return findMinimumCostFlowAssignments(options);
}

assert.equal(holidayTarget(56), 16);
assert.equal(holidayTarget(28), 8);
assert.equal(Math.max(0, holidayTarget(56) - 8), 8);
assert.equal(Math.max(0, holidayTarget(28) - 4), 4);
assert.equal(memberCanScheduleShift(["s2"], "s2"), true);
assert.equal(memberCanScheduleShift(["s3"], "s2"), false);
assert.equal(assignmentCost({ payByDay: false, restCount: 8, restTarget: 8, hasRestThisWeek: false, scheduleShiftIds: ["late", "early"] }, "late"), 0);
assert.equal(assignmentCost({ payByDay: false, restCount: 3, restTarget: 8, hasRestThisWeek: false, scheduleShiftIds: ["late", "early"] }, "early"), 1001);
assert.equal(assignmentCost({ payByDay: true, restCount: 0, restTarget: 0, hasRestThisWeek: false, scheduleShiftIds: ["late", "early"] }, "late"), 2000);
assert.equal(assignmentCost({ payByDay: true, restCount: 0, restTarget: 0, hasRestThisWeek: false, scheduleShiftIds: ["late"] }, "early"), Infinity);
assert.deepEqual(chooseDailyAssignments([
  { shift: "critical", remaining: 1, candidates: [{ id: "only" }] },
  { shift: "open", remaining: 1, candidates: [{ id: "only" }, { id: "flex" }] }
]), [
  { shift: "critical", member: "only" },
  { shift: "open", member: "flex" }
]);
assert.deepEqual(chooseDailyAssignments([
  { shift: "first", remaining: 1, candidates: [{ id: "a" }] },
  { shift: "second", remaining: 1, candidates: [{ id: "a" }, { id: "b" }] }
]), [
  { shift: "first", member: "a" },
  { shift: "second", member: "b" }
]);
assert.deepEqual(chooseDailyAssignments([
  { shift: "need_two", assignedCount: 0, remaining: 2, candidates: [{ id: "a" }, { id: "b" }] },
  { shift: "open", assignedCount: 0, remaining: 1, candidates: [{ id: "a" }, { id: "b" }] }
]), [
  { shift: "need_two", member: "a" },
  { shift: "open", member: "b" }
]);
assert.deepEqual(chooseDailyAssignments([
  { shift: "need_two", assignedCount: 0, remaining: 2, candidates: [{ id: "a" }, { id: "b" }] },
  { shift: "open", assignedCount: 0, remaining: 1, candidates: [{ id: "a" }, { id: "b" }, { id: "c" }] }
]), [
  { shift: "need_two", member: "a" },
  { shift: "need_two", member: "b" },
  { shift: "open", member: "c" }
]);
assert.deepEqual(chooseDailyAssignments([
  { shift: "covered_extra", assignedCount: 1, remaining: 1, candidates: [{ id: "a" }] },
  { shift: "uncovered", assignedCount: 0, remaining: 1, candidates: [{ id: "a" }] }
]), [
  { shift: "uncovered", member: "a" }
]);
assert.deepEqual(chooseDailyAssignments([
  { shift: "unit", assignedCount: 0, remaining: 1, candidates: [{ id: "higher", cost: 10 }, { id: "lower", cost: 1 }] }
]), [
  { shift: "unit", member: "lower" }
]);
assert.deepEqual(chooseDailyAssignments([
  { shift: "impossible", remaining: 1, candidates: [] },
  { shift: "fillable", remaining: 1, candidates: [{ id: "home_member" }] }
]), [
  { shift: "fillable", member: "home_member" }
]);

assert(!renderer.includes("function canAssignShiftWithinDemand"), "renderer should not block over-demand shift assignments");
assert(!renderer.includes("getShiftDemandLimitMessage"), "manual over-demand shift writes should not be blocked");
assert(renderer.includes("function buildAutoSchedulePreview(dates = getVisibleDates())"), "auto schedule preview should accept an explicit date range");
assert(renderer.includes('title: "自動排班期間"'), "auto schedule should ask for a period before previewing");
assert(renderer.includes("const dates = enumerateDateRange(startDate, endDate);"), "auto schedule period modal should build a date range from user input");
assert(renderer.includes("autoSchedulePreview = buildAutoSchedulePreview(dates);"), "auto schedule preview should use the confirmed period");
assert(renderer.includes("function getMissingAutoScheduleLeaveLabels()"), "auto schedule should check required leave settings before previewing");
assert(renderer.includes("自動排班需要先在假別設定新增"), "auto schedule should show a clear prompt when required leave settings are missing");
assert(renderer.includes("memberCanScheduleShift(member, shift.id)"), "auto schedule candidates should use member shift eligibility");
assert(renderer.includes("const mustWork = !member.payByDay && (restCount >= restTarget || hasRestThisWeek);"), "auto schedule should prioritize monthly members who must work");
assert(!renderer.includes("homeDeptMatch"), "auto schedule should not prioritize a member's own department");

console.log("auto schedule rules check ok");
