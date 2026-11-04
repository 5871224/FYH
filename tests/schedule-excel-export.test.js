const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
class FakeCell {}
class FakeRow {
  constructor() { this.cells = new Map(); }
  getCell(i) { if (!this.cells.has(i)) this.cells.set(i, new FakeCell()); return this.cells.get(i); }
  eachCell(fn) { for (const [i, cell] of this.cells) fn(cell, i); }
}
class FakeSheet {
  constructor(name, options) { this.name = name; this.options = options; this.rows = new Map(); this.columns = new Map(); this.properties = {}; this.merges = []; }
  getRow(i) { if (!this.rows.has(i)) this.rows.set(i, new FakeRow()); return this.rows.get(i); }
  getCell(r, c) { return this.getRow(r).getCell(c); }
  getColumn(i) { if (!this.columns.has(i)) this.columns.set(i, {}); return this.columns.get(i); }
  mergeCells(...args) { this.merges.push(args); }
}
class FakeWorkbook {
  constructor() { this.worksheets = []; }
  addWorksheet(name, options) { const sheet = new FakeSheet(name, options); this.worksheets.push(sheet); return sheet; }
}
function openExporter() {
  const previous = global.window;
  const modulePath = path.resolve(__dirname, "../src/renderer/browser-exporter.js");
  global.window = { ExcelJS: { Workbook: FakeWorkbook } };
  delete require.cache[modulePath]; require(modulePath);
  return { api: global.window.schedulerBrowserExporter, close() {
    delete require.cache[modulePath];
    if (previous === undefined) delete global.window; else global.window = previous;
  } };
}
test("匯出班表選項緊接列印班表，且由 export 控制", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../src/renderer/renderer-groups-permissions-archive.js"), "utf8");
  const a = source.indexOf("function getFunctionMenuSections() {");
  const b = source.indexOf("\nfunction hasFunctionMenuAccess()", a);
  assert.ok(a >= 0 && b > a);
  const get = new Function("hasCommonPermission", "hasGroupPermission", "groupFeatureState", source.slice(a, b) + "\nreturn getFunctionMenuSections();");
  const items = get(key => key === "export", () => false, {currentGroupId:"g"}).find(s => s.id === "export").items;
  assert.deepEqual(items.slice(0,2).map(i => i.label), ["列印班表","匯出班表"]);
  assert.equal(get(() => false, () => true, {currentGroupId:"g"}).some(s => s.id === "export"), false);
});
test("人員檢視可匯出八週、統計欄、多色子列及凍結欄", async () => {
  const {api,close} = openExporter();
  try {
    const wb=await api.createScheduleWorkbook({
      year:2026,month:9,dates:["2026-10-01","2026-10-02"],view:"member",tableStatsVisible:true,
      groups:[{department:{name:"門市"},members:[{id:"A",name:"甲",hireDate:"2026-10-02"}]}],
      statsByMember:{A:{rest:1,restWork:2,regular:3,unassigned:0}},
      state:{shifts:[{id:"s",name:"早班",color:"#378ADD"}],leaves:[{id:"l",name:"特休",color:"#EF9F27"}],overtime:[],schedule:{A_2026_9_2:{shift:"s",leave:"l"}}},
      weekStart:0,monthStartDay:1
    });
    const sheet=wb.worksheets[0];
    assert.equal(sheet.getCell(1,1).value,"2026-10-01 ～ 2026-10-02");
    assert.equal(sheet.getCell(2,4).value,"10/1\n四");
    assert.equal(sheet.getCell(2,5).value,"10/2\n五");
    assert.deepEqual(sheet.options.views,[{state:"frozen",xSplit:3,ySplit:2}]);
    assert.match(sheet.getCell(3,3).value,/灰休:2/);
    assert.equal(sheet.getCell(3,4).fill.fgColor.argb,"FFD7CBB9");
    assert.equal(sheet.getCell(3,5).value,"早班");
    assert.equal(sheet.getCell(3,5).fill.fgColor.argb,"FF378ADD");
    assert.equal(sheet.getCell(4,5).value,"特休");
    assert.equal(sheet.getCell(4,5).fill.fgColor.argb,"FFEF9F27");
  } finally {close();}
});
test("班別檢視輸出需求人數與缺人底色",async()=>{
  const {api,close}=openExporter();
  try{
    const wb=await api.createScheduleWorkbook({
      year:2026,month:9,dates:["2026-10-01","2026-10-02"],view:"shift",
      state:{shifts:[],leaves:[],overtime:[],schedule:{}},
      shiftRows:[{shift:{name:"早班",requiredStaffCount:2},days:[
        {names:["甲"],isOperating:true,isShortage:true},
        {names:[],isOperating:false,isShortage:false}
      ]}]
    });
    const sh=wb.worksheets[0];
    assert.equal(sh.getCell(2,2).value,"需求人數");
    assert.equal(sh.getCell(2,3).value,"10/1\n四");
    assert.equal(sh.getCell(2,4).value,"10/2\n五");
    assert.equal(sh.getCell(3,2).value,2);
    assert.equal(sh.getCell(3,3).value,"甲");
    assert.equal(sh.getCell(3,3).fill.fgColor.argb,"FFFDE5E8");
    assert.equal(sh.getCell(3,4).fill.fgColor.argb,"FFD7CBB9");
    assert.equal(sh.options.views[0].xSplit,2);
  }finally{close();}
});

test("休息日同時排班別時僅「休」改灰字，其餘狀況保留設定文字顏色", async () => {
  const { api, close } = openExporter();
  try {
    const shifts = [{ id: "s", name: "早班", color: "#378ADD", textColor: "#FFFFFF" }];
    const leaves = [
      { id: "rest", code: "0047", name: "休", color: "#FCE8C7", textColor: "#FFFFFF" },
      { id: "regular", code: "0036", name: "例", color: "#FFCC88", textColor: "#123456" },
      { id: "annual", code: "0010", name: "特休", color: "#FFEEDD", textColor: "#654321" }
    ];
    const examples = [
      { leave: "rest", shift: "s", expected: "FF707070", row: 4 },
      { leave: "rest", shift: null, expected: "FFFFFFFF", row: 3 },
      { leave: "regular", shift: "s", expected: "FF123456", row: 4 },
      { leave: "annual", shift: "s", expected: "FF654321", row: 4 }
    ];
    for (const example of examples) {
      const slot = { leave: example.leave };
      if (example.shift) slot.shift = example.shift;
      const workbook = await api.createScheduleWorkbook({
        year: 2026, month: 9, dates: ["2026-10-02"], view: "member",
        state: {
          shifts, leaves, overtime: [],
          schedule: { A_2026_9_2: slot }
        },
        groups: [{ department: { name: "門市" }, members: [{ id: "A", name: "甲" }] }]
      });
      const sheet = workbook.worksheets[0];
      const leaveCell = sheet.getCell(example.row, 3);
      const leave = leaves.find(item => item.id === example.leave);
      assert.equal(leaveCell.value, leave.name, example.leave + " 名稱");
      assert.equal(leaveCell.font.color.argb, example.expected, example.leave + " 字色");
      assert.equal(leaveCell.fill.fgColor.argb, "FF" + leave.color.slice(1), example.leave + " 底色");
      if (example.shift) {
        assert.equal(sheet.getCell(3, 3).value, "早班");
        assert.equal(sheet.getCell(3, 3).font.color.argb, "FFFFFFFF", "班別字色不應受影響");
      }
    }
  } finally {
    close();
  }
});

test("匯出班表重用日期區間，跨月載入未顯示日期且保護未公開資料", async () => {
  const vm = require("node:vm");
  const src = fs.readFileSync(path.resolve(__dirname, "../src/renderer/renderer-export-actions.js"), "utf8");
  const evalSource = [
    src.slice(src.indexOf("let scheduleExcelExportRunning = false;"), src.indexOf("function getSettingsExportPayload()")),
    src.slice(src.indexOf("function parseExportDate("), src.indexOf("function getCurrentGroupExportMembers()")),
    src.slice(src.indexOf("function openExportPeriodDialog("))
  ].join("\n");
  const result = { errors: [] };
  const groupId = "g";
  const member = { id: "A", deptId: "d", groupId, name: "甲" };
  const state = {
    tableView: "member", tableStatsVisible: true, tableDeptScopeFilter: "all",
    departments: [{ id: "d", groupId, name: "門市" }, { id: "hidden", groupId, hiddenFromSchedule: true }],
    members: [member], shifts: [{ id: "s", name: "早班" }],
    leaves: [{ id: "r", code: "0047", name: "休" }], overtime: [], holidays: [], schedule: {}
  };
  const pickerValues = { exportPeriodStart: "2026-10-31", exportPeriodEnd: "2026-11-02" };
  const button = { textContent: "匯出班表", disabled: false };
  const ctx = {
    state, groupFeatureState: { currentGroupId: groupId },
    document: { getElementById: id => ({ value: pickerValues[id] }), querySelector: () => button },
    requireCommonUiPermission: () => true, requireCurrentGroupUiPermission: () => true,
    hasGroupPermission: () => true, getVisibleDateRange: () => ({ startDate: "2026-10-01", endDate: "2026-10-28" }),
    openDateRangeActionModal: modal => result.modal = modal,
    reportValidationError: msg => result.errors.push(msg), showInfoMessage: msg => result.errors.push(msg),
    setSaveStatus: () => {}, closeModal: () => result.closed = true,
    ensureVisibleScheduleLoaded: async range => {
      result.loadedRange = range;
      state.schedule = { A_2026_10_1: { shift: "s", leave: "r" }, A_2026_10_2: { shift: "s" } };
    },
    enumerateDateRange: (start, end) => {
      const dates = [];
      for (const d = new Date(start + "T12:00:00"); d <= new Date(end + "T12:00:00"); d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().slice(0, 10));
      }
      return dates;
    },
    getCurrentGroupExportMembers: () => [member],
    doesDateRangeOverlapRange: (a,b,start,end) => (!a || a <= end) && (!b || b >= start),
    isDepartmentVisibleInSchedule: dept => !dept.hiddenFromSchedule,
    getMemberHomeDeptId: m => m.deptId, getLocalizedName: item => item.name,
    isMemberActiveOnDateString: () => true, isScheduleDatePublished: date => date <= "2026-11-01",
    getScheduleKeyForDateString: (id, date) => {
      const d = new Date(date + "T12:00:00");
      return id + "_" + d.getFullYear() + "_" + d.getMonth() + "_" + d.getDate();
    },
    getDisplayedSlot: (id, date) => {
      const d = new Date(date + "T12:00:00");
      return state.schedule[id + "_" + d.getFullYear() + "_" + d.getMonth() + "_" + d.getDate()] || null;
    },
    getItem: (type,id) => (type === "leave" ? state.leaves : state.shifts).find(x=>x.id === id),
    getConfiguredWeekStart: () => 0, getConfiguredMonthStartDay: () => 1,
    window: { schedulerBrowserExporter: { createScheduleWorkbook: async payload => { result.payload = payload; return {}; } } },
    downloadScheduleWorkbook: async (_, filename) => result.filename = filename
  };
  vm.runInNewContext(evalSource,ctx);
  vm.runInNewContext('openExportPeriodDialog("schedule")',ctx);
  assert.equal(result.modal.title,"匯出班表期間");
  assert.equal(result.modal.startDate,"2026-10-01");
  assert.match(result.modal.actionButton,/data-run-period-export="schedule"/);
  await vm.runInNewContext('runPeriodExport("schedule")',ctx);
  assert.deepEqual(JSON.parse(JSON.stringify(result.loadedRange)),{startDate:"2026-10-31",endDate:"2026-11-02"});
  assert.deepEqual(Array.from(result.payload.dates),["2026-10-31","2026-11-01","2026-11-02"]);
  assert.equal(result.payload.groups.length,1);
  assert.equal(result.payload.state.schedule.A_2026_10_1.shift,"s");
  assert.equal(result.payload.state.schedule.A_2026_10_2,undefined);
  assert.equal(result.payload.statsByMember.A.restWork,1);
  assert.equal(result.payload.statsByMember.A.unassigned,1);
  assert.equal(result.filename,"匯出班表_20261031-20261102.xlsx");
  assert.equal(result.closed,true);
  assert.equal(button.disabled,false);
  assert.deepEqual(result.errors,[]);
});


test("跨月及跨年度匯出班表的日期表頭都包含月日與星期", async () => {
  const { api, close } = openExporter();
  try {
    const wb = await api.createScheduleWorkbook({
      year: 2026, month: 11, dates: ["2026-12-31", "2027-01-01"], view: "member",
      groups: [{ department: { name: "門市" }, members: [{ id: "A", name: "甲" }] }],
      state: { shifts: [], leaves: [], overtime: [], schedule: {} }
    });
    const sheet = wb.worksheets[0];
    assert.equal(sheet.getCell(2, 3).value, "12/31\n四");
    assert.equal(sheet.getCell(2, 4).value, "1/1\n五");
  } finally {
    close();
  }
});
