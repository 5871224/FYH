const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const { RENDERER_CORE_FILES, readRendererCore } = require("../scripts/renderer-core-source.js");
const moduleNames = ["renderer-schedule-toolbar.js", "renderer-schedule-groups.js", "renderer-schedule-cells.js", "renderer-schedule-table.js"];

function evaluate(files, expression, context) {
  const source = files.map((file) => fs.readFileSync(path.join(root, "src", "renderer", file), "utf8")).join("\n");
  return vm.runInNewContext(source + "\n;" + expression, context);
}

test("班表文字大小應依段落數與字數判定", () => {
  const api = evaluate(["renderer-schedule-cells.js"], "({ getScheduleSegmentSizeClass })", {});
  assert.equal(api.getScheduleSegmentSizeClass({ name: "早" }, 1), "seg-label-xlarge");
  assert.equal(api.getScheduleSegmentSizeClass({ name: "早班" }, 2), "seg-label-large");
  assert.equal(api.getScheduleSegmentSizeClass({ name: "早班組" }, 2), "seg-label-medium");
  assert.equal(api.getScheduleSegmentSizeClass({ name: "早班組別" }, 2), "");
});

test("八週統計應分開計算例假、休息日、休息日出勤與未排", () => {
  const dates = ["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04"];
  const slots = {
    "M_2026-07-01": { leave: "regular" },
    "M_2026-07-02": { leave: "rest" },
    "M_2026-07-03": { leave: "rest", shift: "A" }
  };
  const context = {
    getVisibleDates: () => dates,
    isMemberActiveOnDateString: () => true,
    getDisplayedSlot: (memberId, date) => slots[memberId + "_" + date] || null,
    getItem: (_category, id) => id === "regular" ? { code: "0036" } : id === "rest" ? { code: "0047" } : null
  };
  const api = evaluate(["renderer-schedule-groups.js"], "({ getMemberEightWeekStats })", context);
  assert.deepEqual(JSON.parse(JSON.stringify(api.getMemberEightWeekStats({ id: "M" }))), { regular: 1, rest: 1, restWork: 1, unassigned: 1 });
});

test("儲存格渲染應保留班別、假別與加班三段資訊", () => {
  const items = { shift: { A: { name: "早班", color: "#111111" } }, leave: { L: { name: "事假", color: "#222222", code: "0010" } }, overtime: { O: { name: "加班", color: "#333333" } } };
  const context = {
    state: { schedule: {} },
    getItem: (category, id) => items[category][id] || null,
    getItemTextColor: () => "#ffffff", textColor: () => "#ffffff", escapeHtml: String,
    getLocalizedName: (item, fallback = "") => String(item?.name || fallback || ""),
    shouldPromptLeaveDetail: () => false
  };
  const api = evaluate(["renderer-schedule-cells.js"], "({ renderCellInner })", context);
  const html = api.renderCellInner("K", "M", "2026-07-01", { shift: "A", leave: "L", overtime: "O", overtimeMeta: {} }, false);
  assert.equal((html.match(/class="seg"/g) || []).length, 3);
  assert.equal(html.includes("早班") && html.includes("事假") && html.includes("加班"), true);
});

test("例假排班只變更例假段落與班別檢視人員區塊", () => {
  const items = {
    shift: { A: { name: "早班", color: "#111111" } },
    leave: { R: { name: "例假", color: "#ff9bb0", code: "0036" } },
    overtime: {}
  };
  const slot = { shift: "A", leave: "R" };
  const context = {
    state: { schedule: {} },
    getItem: (category, id) => items[category][id] || null,
    getItemTextColor: () => "#ffffff",
    textColor: () => "#ffffff",
    escapeHtml: String,
    getLocalizedName: (item, fallback = "") => String(item?.name || fallback || ""),
    shouldPromptLeaveDetail: () => false,
    getDisplayedSlot: () => slot
  };
  const api = evaluate(["renderer-schedule-cells.js"], "({ renderCellInner, renderShiftViewCell })", context);
  const memberHtml = api.renderCellInner("K", "M", "2026-07-01", slot, false);
  assert.equal((memberHtml.match(/regular-holiday-work-seg/g) || []).length, 1);
  assert.equal(memberHtml.includes("regular-holiday-work-indicator") || memberHtml.includes("＋"), false);
  const shiftHtml = api.renderShiftViewCell([{ id: "M", name: "王小明" }], "2026-07-01");
  assert.equal(shiftHtml.includes("regular-holiday-work-member"), true);
  assert.equal(shiftHtml.includes("＋"), false);
});

test("需填時間或需填原因的假別應產生明細提示標記", () => {
  const leaves = {
    time: { name: "時數假", color: "#222222", requiresTime: true, requiresReason: false },
    reason: { name: "事假", color: "#333333", requiresTime: false, requiresReason: true },
    plain: { name: "例假", color: "#444444", requiresTime: false, requiresReason: false }
  };
  const context = {
    state: { schedule: {} },
    getItem: (category, id) => category === "leave" ? leaves[id] || null : null,
    getItemTextColor: () => "#ffffff", textColor: () => "#ffffff", escapeHtml: String,
    getLocalizedName: (item, fallback = "") => String(item?.name || fallback || ""),
    shouldPromptLeaveDetail: (leave) => Boolean(leave?.requiresTime || leave?.requiresReason)
  };
  const api = evaluate(["renderer-schedule-cells.js"], "({ renderCellInner })", context);

  ["time", "reason"].forEach((leaveId) => {
    const html = api.renderCellInner("K", "M", "2026-07-01", { leave: leaveId }, false);
    assert.equal(html.includes('data-hover-schedule-detail="M:2026-07-01:leave"'), true, leaveId);
  });
  assert.equal(api.renderCellInner("K", "M", "2026-07-01", { leave: "plain" }, false).includes("data-hover-schedule-detail"), false);
});

test("休假明細只保留右上關閉並將儲存放在標題列", () => {
  const source = fs.readFileSync(path.join(root, "src", "renderer", "renderer-schedule-assignment-modals.js"), "utf8");
  const start = source.indexOf("function openLeaveAssignmentModal");
  const end = source.indexOf("async function saveLeaveAssignmentFromModal", start);
  const leaveModal = source.slice(start, end);
  assert.match(leaveModal, /headerButtons:\s*`<button class="btn-primary"[^>]*data-save-leave-assignment="true">儲存<\/button>`/);
  assert.match(leaveModal, /hideFooterClose:\s*true/);
  assert.doesNotMatch(leaveModal, /footerButtons:/);
});

test("第五階段應移出班表渲染並維持建置順序", () => {
  const renderer = fs.readFileSync(path.join(root, "src", "renderer", "renderer.js"), "utf8");
  const build = fs.readFileSync(path.join(root, "scripts", "build-js.js"), "utf8");
  ["function renderToolbar() {", "function getVisibleTableGroups() {", "function renderCellInner", "function renderTable() {"].forEach((marker) => assert.equal(renderer.includes(marker), false, "renderer.js 仍包含：" + marker));
  moduleNames.forEach((name) => assert.equal(RENDERER_CORE_FILES.includes(name), true));
  const order = RENDERER_CORE_FILES.map((name) => build.indexOf("\"" + name + "\""));
  assert.equal(order.every((index) => index >= 0), true);
  assert.equal(order.every((index, position) => position === 0 || index > order[position - 1]), true);
  // 拆分後實際為 5,394 行；5,450 行門檻可防止班表渲染再次回流主檔。
  assert.equal(renderer.split(/\r?\n/).length < 5450, true);
  assert.equal(readRendererCore(root).includes("function renderTable()"), true);
});
