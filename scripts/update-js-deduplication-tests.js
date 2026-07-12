const fs = require("node:fs");

function updateEventOwnershipTest() {
  const file = "tests/renderer-final-decomposition.test.js";
  let source = fs.readFileSync(file, "utf8");

  const formImport = 'const formEvents = read("src/renderer/renderer-events-form.js");';
  if (!source.includes(formImport)) throw new Error("找不到表單事件測試來源");
  source = source.replace(formImport, `${formImport}\nconst recordsEvents = read("src/renderer/renderer-records-events.js");`);

  const oldBlock = `  ["memberSettingsFilterField", "mealReportFilter", "toggleOvertimePanel", "leaveAssignmentAllDay"].forEach((marker) => {
    assert.equal(formEvents.includes(marker), true, "缺少表單入口：" + marker);
  });`;
  const newBlock = `  ["memberSettingsFilterField", "toggleOvertimePanel", "leaveAssignmentAllDay"].forEach((marker) => {
    assert.equal(formEvents.includes(marker), true, "缺少表單入口：" + marker);
  });
  ["mealReportFilter", "overtimeReviewFilter", "attendanceFilter"].forEach((marker) => {
    assert.equal(recordsEvents.includes(marker), true, "缺少記錄篩選入口：" + marker);
  });`;
  if (!source.includes(oldBlock)) throw new Error("找不到舊記錄篩選事件斷言");
  source = source.replace(oldBlock, newBlock);
  fs.writeFileSync(file, source, "utf8");
}

function updateAutoFillSharedHelperTest() {
  const file = "tests/renderer-phase7-auto-fill-schedule.test.js";
  let source = fs.readFileSync(file, "utf8");

  const pathAnchor = 'const autoSchedulePath = path.join(root, "src", "renderer", "renderer-auto-schedule.js");';
  if (!source.includes(pathAnchor)) throw new Error("找不到自動補班測試路徑");
  source = source.replace(pathAnchor, `${pathAnchor}\nconst scheduleInteractionPath = path.join(root, "src", "renderer", "renderer-schedule-interaction.js");`);

  const oldHelper = `function evaluateAutoFill(context, expression) {
  const source = fs.readFileSync(autoFillPath, "utf8");
  return vm.runInNewContext(source + "\\n;" + expression, context);
}`;
  const newHelper = `function extractNamedFunction(source, name) {
  const marker = "async function " + name + "(";
  const start = source.indexOf(marker);
  if (start < 0) throw new Error("找不到共用函式：" + name);
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error("共用函式未完整結束：" + name);
}

function evaluateAutoFill(context, expression) {
  const autoFillSource = fs.readFileSync(autoFillPath, "utf8");
  const interactionSource = fs.readFileSync(scheduleInteractionPath, "utf8");
  const sharedHelper = extractNamedFunction(interactionSource, "applySchedulePreviewSlots");
  return vm.runInNewContext(sharedHelper + "\\n" + autoFillSource + "\\n;" + expression, context);
}`;
  if (!source.includes(oldHelper)) throw new Error("找不到自動補班測試載入函式");
  source = source.replace(oldHelper, newHelper);
  fs.writeFileSync(file, source, "utf8");
}

updateEventOwnershipTest();
updateAutoFillSharedHelperTest();
console.log("JavaScript deduplication tests updated.");
