const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = [
  "renderer-date-utils.js",
  "renderer-state-normalization.js",
  "renderer-groups-permissions-archive.js",
  "renderer-export-actions.js",
  "renderer-auto-fill-schedule.js",
  "renderer-page-data.js"
].map((name) => fs.readFileSync(path.join(__dirname, "../src/renderer", name), "utf8")).join("\n");
const firstPeriod = "2026-10-01";

function createHarness(groupId = "store") {
  const calls = [];
  const saves = [];
  const messages = [];
  let nextResponseGate;
  const context = vm.createContext({
    state: null,
    deepClone: (value) => JSON.parse(JSON.stringify(value)),
    localStorage: { setItem() {}, getItem() { return ""; } },
    document: { getElementById() { return null; } },
    clearScheduleRangeSelection() {},
    syncScheduleHistoryButtons() {},
    resolveCurrentMember() { return null; },
    renderAll() {},
    async forceSave() { saves.push(context.state.scheduleStartDate); return true; },
    setSaveStatus(message) { messages.push(message); },
    showInfoMessage(message) { messages.push(message); },
    window: { schedulerApi: { async loadScheduleEntries({ startDate, endDate, members }) {
      calls.push({ startDate, endDate, members: members.map(({ id }) => id) });
      const schedule = Object.fromEntries(members.map(({ id }) => [
        context.getScheduleKeyForDateString(id, startDate), { shift: `${id}-shift` }
      ]));
      const gate = nextResponseGate;
      nextResponseGate = null;
      if (gate) await gate;
      return { schedule };
    } } }
  });
  vm.runInContext(source, context);

  function reset(nextGroupId = groupId) {
    context.groups = ["store", "factory"].map((id) => ({ id, status: "active" }));
    context.initial = {
      departments: context.groups.map(({ id }) => ({ id: `${id}-dept`, groupId: id })),
      members: context.groups.map(({ id }) => ({ id, groupId: id })),
      shifts: context.groups.map(({ id }) => ({ id: `${id}-shift`, groupId: id })),
      leaves: [], overtime: [],
      scheduleStartDate: firstPeriod,
      scheduleLoadedRanges: [{ startDate: firstPeriod, endDate: "2026-11-25" }],
      schedule: Object.fromEntries(context.groups.map(({ id }) => [
        context.getScheduleKeyForDateString(id, firstPeriod),
        { shift: `${id}-shift`, leave: null, overtime: null, leaveMeta: null, overtimeMeta: null }
      ])),
      rules: { eightWeekStartDate: firstPeriod }
    };
    context.nextGroupId = nextGroupId;
    vm.runInContext(`
      groupFeatureState.bundle = { groups, actor: { groupPermissions: {
        store: ["schedule_view", "schedule_manage"], factory: ["schedule_view", "schedule_manage"]
      } } };
      groupFeatureState.currentGroupId = nextGroupId;
      snapshotCanonicalState(initial);
      state = applyCurrentGroupScope(initial);
    `, context);
  }

  reset();
  return {
    context, calls, saves, messages, reset,
    shift(memberId, date = context.state.scheduleStartDate) {
      return context.state.schedule[context.getScheduleKeyForDateString(memberId, date)]?.shift;
    },
    deferNextResponse() {
      let release;
      let reject;
      nextResponseGate = new Promise((resolve, rejectResponse) => { release = resolve; reject = rejectResponse; });
      release.reject = reject;
      return release;
    }
  };
}

test("門市載入下一個八週後切工廠，仍顯示工廠班別", async () => {
  const { context, shift } = createHarness();
  await context.changeSchedulePeriodWeeks(8);
  assert.equal(shift("store"), "store-shift");
  await context.switchScheduleGroup("factory");
  assert.equal(shift("factory"), "factory-shift");
  assert.equal(shift("store"), undefined);
});

test("跨群組後工廠再往下一個八週並返回，已看過的班別仍保留", async () => {
  const { context, shift } = createHarness();
  await context.changeSchedulePeriodWeeks(8);
  await context.switchScheduleGroup("factory");
  const returnDate = context.state.scheduleStartDate;
  await context.changeSchedulePeriodWeeks(8);
  assert.equal(shift("factory"), "factory-shift");
  await context.changeSchedulePeriodWeeks(-8);
  assert.equal(context.state.scheduleStartDate, returnDate);
  assert.equal(shift("factory"), "factory-shift");
});

test("只看工廠時切下八週再回上八週，保留原班別並沿用已讀期間", async () => {
  const { context, calls, shift } = createHarness("factory");
  await context.changeSchedulePeriodWeeks(8);
  assert.equal(shift("factory"), "factory-shift");
  await context.changeSchedulePeriodWeeks(-8);
  assert.equal(context.state.scheduleStartDate, firstPeriod);
  assert.equal(shift("factory"), "factory-shift");
  assert.equal(calls.length, 1);
});

test("工廠班表讀取途中切門市，晚到資料仍保留各群組的班別", async () => {
  const { context, shift, deferNextResponse } = createHarness("factory");
  const release = deferNextResponse();
  const pending = context.changeSchedulePeriodWeeks(8);
  await context.switchScheduleGroup("store");
  release();
  await pending;
  assert.equal(shift("store"), "store-shift");
  await context.switchScheduleGroup("factory");
  assert.equal(shift("factory"), "factory-shift");
});

test("登出並重新初始化後，舊讀取不得污染新班表或已讀期間", async () => {
  const { context, reset, deferNextResponse } = createHarness("factory");
  const release = deferNextResponse();
  context.state.scheduleStartDate = context.addDaysToDateString(firstPeriod, 56);
  const staleRange = context.getVisibleDateRange();
  const pending = context.ensureVisibleScheduleLoaded();
  context.clearScheduleApplicationState();
  reset("store");
  const expectedSchedule = JSON.stringify(context.state.schedule);
  const expectedRanges = JSON.stringify(context.state.scheduleLoadedRanges);
  const expectedCatalog = vm.runInContext("JSON.stringify(groupFeatureState.catalog.schedule)", context);
  release();
  await pending;
  assert.equal(JSON.stringify(context.state.scheduleLoadedRanges), expectedRanges);
  assert.equal(JSON.stringify(context.state.schedule), expectedSchedule);
  assert.equal(vm.runInContext("JSON.stringify(groupFeatureState.catalog.schedule)", context), expectedCatalog);
  assert.equal(context.isScheduleRangeLoaded(staleRange), false);
});

test("自動補班讀過的期間切到另一群組後，仍能顯示該群組的班別", async () => {
  const { context, shift } = createHarness();
  const startDate = context.addDaysToDateString(firstPeriod, 56);
  await context.ensureAutoFillScheduleRangeLoaded(startDate, context.addDaysToDateString(startDate, 55));
  await context.changeSchedulePeriodWeeks(8);
  assert.equal(shift("store"), "store-shift");
  await context.switchScheduleGroup("factory");
  assert.equal(shift("factory"), "factory-shift");
});

test("八週切換尚未完成就重新初始化，舊操作不得儲存新狀態", async () => {
  const { context, saves, reset, deferNextResponse } = createHarness();
  const release = deferNextResponse();
  const pending = context.changeSchedulePeriodWeeks(8);
  context.clearScheduleApplicationState();
  reset("factory");
  release();
  await pending;
  assert.equal(context.state.scheduleStartDate, firstPeriod);
  assert.equal(saves.length, 0);
});

test("相同期間重疊讀取時，晚到回應不得覆蓋先到後編輯的班別", async () => {
  const { context, calls, shift, deferNextResponse } = createHarness();
  context.state.scheduleStartDate = context.addDaysToDateString(firstPeriod, 56);
  const release = deferNextResponse();
  const pending = context.ensureVisibleScheduleLoaded();
  await context.ensureVisibleScheduleLoaded();
  assert.equal(calls.length, 2);
  context.state.shifts.push({ id: "edited-shift", groupId: "store" });
  const key = context.getScheduleKeyForDateString("store", context.state.scheduleStartDate);
  context.state.schedule[key].shift = "edited-shift";
  release();
  await pending;
  assert.equal(shift("store"), "edited-shift");
});

test("八週讀取失敗時保留原班表與日期，顯示錯誤且不記錄失敗期間", async () => {
  const { context, saves, messages, shift } = createHarness();
  const failedStart = context.addDaysToDateString(firstPeriod, 56);
  const failedRange = { startDate: failedStart, endDate: context.addDaysToDateString(failedStart, 55) };
  context.window.schedulerApi.loadScheduleEntries = async () => { throw new Error("network unavailable"); };
  await assert.doesNotReject(context.changeSchedulePeriodWeeks(8));
  assert.equal(context.state.scheduleStartDate, firstPeriod);
  assert.equal(shift("store"), "store-shift");
  assert.equal(context.isScheduleRangeLoaded(failedRange), false);
  assert.ok(messages.some((message) => message.includes("network unavailable")));
  assert.equal(saves.length, 0);
});

test("載入新期間及切換群組後，舊期間的本機修改仍保留", async () => {
  const { context, shift } = createHarness();
  context.state.shifts.push({ id: "edited-shift", groupId: "store" });
  context.state.schedule.store_2026_9_1.shift = "edited-shift";
  await context.changeSchedulePeriodWeeks(8);
  await context.switchScheduleGroup("factory");
  await context.switchScheduleGroup("store");
  await context.changeSchedulePeriodWeeks(-8);
  assert.equal(shift("store"), "edited-shift");
});

test("同日期的舊導覽失敗，不得回滾後來重新開啟的導覽", async () => {
  const { context, shift, deferNextResponse } = createHarness();
  const nextStart = context.addDaysToDateString(firstPeriod, 56);
  const firstResponse = deferNextResponse();
  const firstNavigation = context.changeSchedulePeriodWeeks(8);
  await context.changeSchedulePeriodWeeks(-8);
  const latestResponse = deferNextResponse();
  const latestNavigation = context.changeSchedulePeriodWeeks(8);
  firstResponse.reject(new Error("old request failed"));
  await firstNavigation;
  assert.equal(context.state.scheduleStartDate, nextStart);
  latestResponse();
  await latestNavigation;
  assert.equal(context.state.scheduleStartDate, nextStart);
  assert.equal(shift("store"), "store-shift");
});

test("連續兩個新期間讀取都失敗時，回到最後成功顯示的期間", async () => {
  const { context, shift, saves, deferNextResponse } = createHarness();
  const firstResponse = deferNextResponse();
  const firstNavigation = context.changeSchedulePeriodWeeks(8);
  const latestResponse = deferNextResponse();
  const latestNavigation = context.changeSchedulePeriodWeeks(8);
  firstResponse.reject(new Error("first period failed"));
  await firstNavigation;
  latestResponse.reject(new Error("second period failed"));
  await latestNavigation;
  assert.equal(context.state.scheduleStartDate, firstPeriod);
  assert.equal(shift("store"), "store-shift");
  assert.equal(saves.length, 0);
});
