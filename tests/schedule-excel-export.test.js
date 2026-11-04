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
    assert.equal(sh.getCell(3,2).value,2);
    assert.equal(sh.getCell(3,3).value,"甲");
    assert.equal(sh.getCell(3,3).fill.fgColor.argb,"FFFDE5E8");
    assert.equal(sh.getCell(3,4).fill.fgColor.argb,"FFD7CBB9");
    assert.equal(sh.options.views[0].xSplit,2);
  }finally{close();}
});
