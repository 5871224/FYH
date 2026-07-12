const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const rendererDir = path.join(root, "src", "renderer");
const rendererPath = path.join(rendererDir, "renderer.js");
const buildPath = path.join(root, "scripts", "build-js.js");
const coreSourcePath = path.join(root, "scripts", "renderer-core-source.js");
const testPath = path.join(root, "tests", "renderer-phase4-auto-schedule.test.js");

const moduleGroups = [
  {
    file: "renderer-auto-schedule-compliance.js",
    functions: [
      "getLeaveByCode",
      "isRestLeaveId",
      "isRegularRestLeaveId",
      "getWeekBucketIndex",
      "getMemberAutoRestTarget",
      "countMemberActiveDays",
      "countMemberLeaveByPredicate",
      "memberHasRestInWeek",
      "countMemberRestInWeek",
      "canAutoPlaceDailyRest",
      "placeDailySurplusRestDays"
    ]
  },
  {
    file: "renderer-auto-schedule-demand.js",
    functions: [
      "getWorkScheduleSlot",
      "countAssignedShiftMembers",
      "ensureWorkScheduleSlot",
      "hasAnyLeaveOnDate",
      "hasAnyShiftOnDate",
      "getVisibleAutoScheduleShifts",
      "getActiveMembersForDate",
      "markAutoLeave",
      "getDailyShiftNeedOptions",
      "getShiftDepartmentIds",
      "getShiftDemandForDate",
      "getOperatingShiftDepartmentIds",
      "isShiftOperatingOnDate",
      "shiftHasVisibleDepartment",
      "getRemainingDailyShiftDemand",
      "getRemainingDailyShiftDemandDetails"
    ]
  },
  {
    file: "renderer-auto-schedule-assignment.js",
    functions: [
      "getDailyAssignmentCost",
      "findMinimumCostFlowAssignments",
      "findBestDailyShiftAssignments"
    ]
  },
  {
    file: "renderer-auto-schedule.js",
    functions: [
      "buildAutoSchedulePreview",
      "getMissingAutoScheduleLeaveLabels",
      "previewAutoSchedule",
      "generateAutoSchedulePreviewFromModal",
      "applyAutoSchedulePreview",
      "cancelAutoSchedulePreview"
    ]
  }
];

function findFunctionRange(source, name) {
  const pattern = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`);
  const match = pattern.exec(source);
  if (!match) {
    throw new Error(`找不到函式：${name}`);
  }
  const start = match.index;
  let openBrace = -1;
  let mode = "code";
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (mode === "line-comment") {
      if (char === "\n") mode = "code";
      continue;
    }
    if (mode === "block-comment") {
      if (char === "*" && next === "/") {
        mode = "code";
        index += 1;
      }
      continue;
    }
    if (mode === "single" || mode === "double" || mode === "template") {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if ((mode === "single" && char === "'") || (mode === "double" && char === '"') || (mode === "template" && char === "`")) {
        mode = "code";
      }
      continue;
    }
    if (char === "/" && next === "/") {
      mode = "line-comment";
      index += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      mode = "block-comment";
      index += 1;
      continue;
    }
    if (char === "'") {
      mode = "single";
      continue;
    }
    if (char === '"') {
      mode = "double";
      continue;
    }
    if (char === "`") {
      mode = "template";
      continue;
    }
    if (char === "{") {
      openBrace = index;
      break;
    }
  }
  if (openBrace < 0) {
    throw new Error(`找不到函式起始大括號：${name}`);
  }

  let depth = 0;
  mode = "code";
  escaped = false;
  for (let index = openBrace; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (mode === "line-comment") {
      if (char === "\n") mode = "code";
      continue;
    }
    if (mode === "block-comment") {
      if (char === "*" && next === "/") {
        mode = "code";
        index += 1;
      }
      continue;
    }
    if (mode === "single" || mode === "double" || mode === "template") {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if ((mode === "single" && char === "'") || (mode === "double" && char === '"') || (mode === "template" && char === "`")) {
        mode = "code";
      }
      continue;
    }
    if (char === "/" && next === "/") {
      mode = "line-comment";
      index += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      mode = "block-comment";
      index += 1;
      continue;
    }
    if (char === "'") {
      mode = "single";
      continue;
    }
    if (char === '"') {
      mode = "double";
      continue;
    }
    if (char === "`") {
      mode = "template";
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        let end = index + 1;
        while (source[end] === "\r" || source[end] === "\n") end += 1;
        return { start, end, text: source.slice(start, index + 1).trimEnd() };
      }
    }
  }
  throw new Error(`函式大括號不完整：${name}`);
}

function insertBeforeRenderer(source, fileNames) {
  const marker = '  "renderer.js",';
  if (!source.includes(marker)) throw new Error("建置清單找不到 renderer.js");
  const lines = fileNames.map((file) => `  "${file}",`).join("\n");
  return source.replace(marker, `${lines}\n${marker}`);
}

let renderer = fs.readFileSync(rendererPath, "utf8");
const extracted = new Map();
const ranges = [];

for (const group of moduleGroups) {
  const parts = [];
  for (const name of group.functions) {
    const range = findFunctionRange(renderer, name);
    ranges.push(range);
    parts.push(range.text);
  }
  extracted.set(group.file, `${parts.join("\n\n")}\n`);
}

ranges.sort((left, right) => right.start - left.start);
for (const range of ranges) {
  renderer = `${renderer.slice(0, range.start)}${renderer.slice(range.end)}`;
}
renderer = renderer.replace(/\n{3,}/g, "\n\n");
fs.writeFileSync(rendererPath, renderer.trimEnd() + "\n");

for (const [file, content] of extracted) {
  fs.writeFileSync(path.join(rendererDir, file), content);
}

const newModules = moduleGroups.map((group) => group.file);
const buildSource = fs.readFileSync(buildPath, "utf8");
fs.writeFileSync(buildPath, insertBeforeRenderer(buildSource, newModules));
const coreSource = fs.readFileSync(coreSourcePath, "utf8");
fs.writeFileSync(coreSourcePath, insertBeforeRenderer(coreSource, newModules));

const testSource = `const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const { RENDERER_CORE_FILES, readRendererCore } = require("../scripts/renderer-core-source.js");
const moduleNames = [
  "renderer-auto-schedule-compliance.js",
  "renderer-auto-schedule-demand.js",
  "renderer-auto-schedule-assignment.js",
  "renderer-auto-schedule.js"
];

function evaluateAutoSchedule(exportExpression, context = {}) {
  const source = moduleNames
    .map((file) => fs.readFileSync(path.join(root, "src", "renderer", file), "utf8"))
    .join("\\n");
  return vm.runInNewContext(\`${'${source}'}\\n;${'${exportExpression}'}\`, context);
}

function makeContext() {
  const leaveMap = new Map([
    ["regular", { id: "regular", code: "0036", name: "例假" }],
    ["rest", { id: "rest", code: "0047", name: "休息日" }]
  ]);
  return {
    state: { members: [], shifts: [], departments: [], leaves: Array.from(leaveMap.values()), schedule: {} },
    getItem: (_category, id) => leaveMap.get(id) || null,
    getScheduleKeyForDateString: (memberId, dateString) => \`${'${memberId}'}_${'${dateString}'}\`,
    isMemberActiveOnDateString: (member, dateString) => (!member.hireDate || dateString >= member.hireDate) && (!member.leaveDate || dateString <= member.leaveDate),
    diffDays: (start, end) => Math.floor((new Date(end) - new Date(start)) / 86400000),
    getMemberShiftPriority: (member, shiftId) => member.scheduleShiftIds.indexOf(shiftId),
    isDepartmentVisibleInSchedule: () => true,
    isDepartmentOperatingOnDate: () => true,
    isDepartmentVisibleInScheduleRange: () => true,
    getItemTextColor: () => "#000000",
    normalizeRestWeekday: (value) => Number(value) || 0,
    toDateObject: (value) => new Date(value),
    deepClone: (value) => JSON.parse(JSON.stringify(value)),
    getVisibleDates: () => [],
    getTodayDateString: () => "2026-07-12",
    promptManagerAccess: () => true,
    getVisibleDateRange: () => ({ startDate: "2026-07-01", endDate: "2026-07-31" }),
    openEntityListModal: () => {},
    escapeHtml: (value) => String(value),
    enumerateDateRange: () => [],
    isValidDateRange: () => true,
    reportValidationError: () => {},
    closeModal: () => {},
    renderAll: () => {},
    showInfoMessage: () => {},
    confirmAction: async () => true,
    parseScheduleKeyParts: () => null,
    rememberScheduleUndoSnapshot: () => {},
    pruneEmptySchedule: () => {},
    persistScheduleCells: async () => {},
    modalContext: {},
    autoSchedulePreview: null,
    document: { getElementById: () => null }
  };
}

test("八週休假目標應扣除既有例假", () => {
  const context = makeContext();
  const api = evaluateAutoSchedule("({ getMemberAutoRestTarget })", context);
  const dates = Array.from({ length: 56 }, (_, index) => {
    const date = new Date(2026, 0, 1 + index);
    return \`${'${date.getFullYear()}'}-${'${String(date.getMonth() + 1).padStart(2, "0")}'}-${'${String(date.getDate()).padStart(2, "0")}'}\`;
  });
  const schedule = {};
  dates.slice(0, 8).forEach((date) => { schedule[\`member_${'${date}'}\`] = { leave: "regular" }; });
  const target = api.getMemberAutoRestTarget({ id: "member", scheduleShiftIds: [] }, schedule, dates);
  assert.deepEqual(JSON.parse(JSON.stringify(target)), { activeDays: 56, fixedRegularCount: 8, totalHolidayTarget: 16, restTarget: 8 });
});

test("班別需求應依營運狀態及需求人數計算", () => {
  const context = makeContext();
  const api = evaluateAutoSchedule("({ getShiftDemandForDate, getRemainingDailyShiftDemand })", context);
  context.state.shifts = [{ id: "A", name: "早班", requiredStaffCount: 2, applicableDeptId: "D" }];
  context.state.departments = [{ id: "D" }];
  context.state.members = [{ id: "M1", scheduleShiftIds: ["A"] }];
  assert.equal(api.getShiftDemandForDate(context.state.shifts[0], "2026-07-12"), 2);
  assert.equal(api.getRemainingDailyShiftDemand({ M1_2026-07-12: { shift: "A" } }, "2026-07-12"), 1);
});

test("最小成本分配應優先符合人員班別順位", () => {
  const context = makeContext();
  const api = evaluateAutoSchedule("({ findMinimumCostFlowAssignments })", context);
  const shiftA = { id: "A", name: "早班" };
  const shiftB = { id: "B", name: "晚班" };
  const memberA = { id: "M1", name: "甲", payByDay: false, scheduleShiftIds: ["A", "B"] };
  const memberB = { id: "M2", name: "乙", payByDay: false, scheduleShiftIds: ["B", "A"] };
  const assignments = api.findMinimumCostFlowAssignments({}, [
    { shift: shiftA, assignedCount: 0, remaining: 1, candidates: [memberA, memberB] },
    { shift: shiftB, assignedCount: 0, remaining: 1, candidates: [memberA, memberB] }
  ], "2026-07-12", ["2026-07-12"]);
  const pairs = assignments.map(({ shift, member }) => \`${'${shift.id}'}:${'${member.id}'}\`).sort();
  assert.deepEqual(Array.from(pairs), ["A:M1", "B:M2"]);
});

test("第四階段應移出自動排班並維持建置順序", () => {
  const renderer = fs.readFileSync(path.join(root, "src", "renderer", "renderer.js"), "utf8");
  const build = fs.readFileSync(path.join(root, "scripts", "build-js.js"), "utf8");
  const movedMarkers = [
    "function getLeaveByCode(code) {",
    "function findMinimumCostFlowAssignments(scheduleMap, options, dateString, dates) {",
    "function buildAutoSchedulePreview(dates = getVisibleDates()) {",
    "async function applyAutoSchedulePreview() {"
  ];
  movedMarkers.forEach((marker) => assert.equal(renderer.includes(marker), false, \`renderer.js 仍包含：${'${marker}'}\`));
  moduleNames.forEach((name) => assert.equal(RENDERER_CORE_FILES.includes(name), true));
  const order = RENDERER_CORE_FILES.map((name) => build.indexOf(\`"${'${name}'}"\`));
  assert.equal(order.every((index) => index >= 0), true);
  assert.equal(order.every((index, position) => position === 0 || index > order[position - 1]), true);
  assert.equal(renderer.split(/\\r?\\n/).length < 5850, true);
  assert.equal(readRendererCore(root).includes("function buildAutoSchedulePreview"), true);
});
`;
fs.writeFileSync(testPath, testSource);

console.log(`renderer phase 4 refactor prepared: ${ranges.length} functions moved`);
