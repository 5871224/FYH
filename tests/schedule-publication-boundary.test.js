const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.resolve(__dirname,"../src/renderer");
test("前後四週的交界為第 29 天",()=>{
const c=vm.createContext({state:{rules:{weekStart:0}},Date});
vm.runInContext(fs.readFileSync(path.join(root,"renderer-date-utils.js"),"utf8"),c);
assert.equal(c.getFourWeekBoundaryClassForIndex(27),"");
assert.equal(c.getFourWeekBoundaryClassForIndex(28),"four-week-boundary-start");
assert.equal(c.getFourWeekBoundaryClassForIndex(29),"");
});
test("公開日期包含當日，班表管理權限不受限制",()=>{
const c=vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root,"renderer-groups-permissions-archive.js"),"utf8"),c);
vm.runInContext(`groupFeatureState.currentGroupId="g1";groupFeatureState.bundle={actor:{groupPermissions:{g1:["schedule_view"]}},groups:[{id:"g1",publishedUntil:"2026-10-31"}]};`,c);
assert.equal(c.isScheduleDatePublished("2026-10-31"),true);
assert.equal(c.isScheduleDatePublished("2026-11-01"),false);
vm.runInContext('groupFeatureState.bundle.actor.groupPermissions.g1.push("schedule_manage")',c);
assert.equal(c.isScheduleDatePublished("2026-11-01"),true);
});
