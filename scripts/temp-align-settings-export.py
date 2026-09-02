from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"pattern not found: {path}: {old[:120]}")
    p.write_text(text.replace(old, new, 1), encoding="utf-8")


p = Path("src/renderer/index.html")
text = p.read_text(encoding="utf-8")
text = text.replace('class="ghost-btn ops-btn manager-action" id="weekStartSettingsButton"', 'class="ghost-btn ops-btn" id="weekStartSettingsButton"')
for button_id in ["exportScheduleButton", "exportSapButton", "exportLeaveButton", "exportOvertimeButton"]:
    text = text.replace(f'class="ghost-btn ops-btn manager-action" id="{button_id}"', f'class="ghost-btn ops-btn" id="{button_id}"')
text = text.replace('id="exportOvertimeButton" type="button" hidden>', 'id="exportOvertimeButton" type="button">')
p.write_text(text, encoding="utf-8")

replace_once(
    "src/renderer/renderer-auth-context.js",
    '    "overtimeSettingsButton",\n    "weekStartSettingsButton"\n',
    '    "overtimeSettingsButton"\n'
)

p = Path("src/renderer/renderer-groups-permissions-archive.js")
text = p.read_text(encoding="utf-8")
old = '''    const visible = action === "group-settings" || action === "permission-settings"
      ? hasCommonPermission("settings")
      : action === "schedule-conditions"
        ? canEditSchedule()
        : hasGroupPermission(groupFeatureState.currentGroupId, "schedule_view");'''
new = '''    const visible = action === "group-settings" || action === "permission-settings" || action === "schedule-archive"
      ? hasCommonPermission("settings")
      : action === "schedule-conditions"
        ? canEditSchedule()
        : false;'''
if old not in text:
    raise SystemExit("function menu visibility pattern not found")
text = text.replace(old, new, 1)
replace_old = 'async function openScheduleArchive() {\n  if (!hasGroupPermission(groupFeatureState.currentGroupId, "schedule_view")) return;'
replace_new = 'async function openScheduleArchive() {\n  if (!hasCommonPermission("settings") || !hasGroupPermission(groupFeatureState.currentGroupId, "schedule_view")) return;'
if replace_old not in text:
    raise SystemExit("schedule archive guard pattern not found")
text = text.replace(replace_old, replace_new, 1)
text = text.replace(
    '    weekStartSettingsButton: hasGroupPermission(groupId, "schedule_manage"),',
    '    weekStartSettingsButton: hasCommonPermission("settings"),',
    1
)
text = text.replace(
    '    autoScheduleCancelButton: hasGroupPermission(groupId, "schedule_manage"),\n    exportSapButton: hasCommonPermission("export"),',
    '    autoScheduleCancelButton: hasGroupPermission(groupId, "schedule_manage"),\n    exportScheduleButton: hasCommonPermission("export"),\n    exportSapButton: hasCommonPermission("export"),',
    1
)
p.write_text(text, encoding="utf-8")

replace_once(
    "src/renderer/renderer-events-toolbar.js",
    '  bindClick("tableNextWeekButton", () => scrollScheduleByWeeks(1));\n  bindClick("exportSapButton", () => {',
    '  bindClick("tableNextWeekButton", () => scrollScheduleByWeeks(1));\n  bindClick("exportScheduleButton", () => {\n    closeCoreActionsMenu();\n    openExportPeriodDialog("workday");\n  });\n  bindClick("exportSapButton", () => {'
)

p = Path("src/renderer/renderer-export-actions.js")
text = p.read_text(encoding="utf-8")
marker = "function openExportPeriodDialog(type) {"
if marker not in text:
    raise SystemExit("export dialog marker not found")
helper = r'''function getCurrentGroupExportMembers() {
  const groupId = String(groupFeatureState?.currentGroupId || state?.currentGroupId || "");
  return (state.members || []).filter((member) => !groupId || member.groupId === groupId);
}

function filterExportRowsToCurrentGroup(rows) {
  const memberIds = new Set(getCurrentGroupExportMembers().map((member) => String(member.id || "")).filter(Boolean));
  return (Array.isArray(rows) ? rows : []).filter((row) => memberIds.has(String(row?.member_id || row?.memberId || "")));
}

function isRestLeaveForWorkdayExport(leave) {
  const code = String(leave?.code || "").trim();
  const name = String(leave?.name || "").trim();
  return ["0036", "0047"].includes(code) || ["休息日", "休假", "例假"].includes(name);
}

async function buildWorkdayExportRows(startDate, endDate) {
  const members = getCurrentGroupExportMembers();
  const loaded = await window.schedulerApi.loadScheduleEntries({ startDate, endDate, members });
  const schedule = loaded?.schedule || {};
  const shifts = new Map((state.shifts || []).map((item) => [item.id, item]));
  const departments = new Map((state.departments || []).map((item) => [item.id, item]));
  const leaves = new Map((state.leaves || []).map((item) => [item.id, item]));
  const rows = [];
  const start = parseExportDate(startDate);
  const end = parseExportDate(endDate);

  for (const member of members) {
    for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
      const date = formatExportDate(cursor);
      const key = `${member.id}_${cursor.getFullYear()}_${cursor.getMonth()}_${cursor.getDate()}`;
      const slot = schedule[key];
      if (!slot?.shift) continue;
      const shift = shifts.get(slot.shift);
      if (!shift) continue;
      const department = departments.get(shift.applicableDeptId || member.deptId || "");
      const leave = slot.leave ? leaves.get(slot.leave) : null;
      rows.push({
        values: [department?.name || "", member.name || "", member.code || "", date.replaceAll("-", "")],
        date,
        departmentName: department?.name || "",
        memberName: member.name || "",
        highlight: Boolean(slot.leave && isRestLeaveForWorkdayExport(leave))
      });
    }
  }

  rows.sort((a, b) => a.date.localeCompare(b.date)
    || a.departmentName.localeCompare(b.departmentName, "zh-Hant")
    || a.memberName.localeCompare(b.memberName, "zh-Hant"));
  return rows;
}

async function runWorkdayExport(startDate, endDate) {
  if (!hasCommonPermission("export")) {
    showInfoMessage("沒有匯出權限");
    return;
  }
  // Canonical export RPC performs the server-side export permission check.
  await window.schedulerApi.loadScheduleExportRows(startDate, endDate);
  const rows = await buildWorkdayExportRows(startDate, endDate);
  if (!rows.length) {
    showInfoMessage("目前沒有可匯出的上班日資料");
    closeModal();
    setSaveStatus("");
    return;
  }

  const exporter = window.schedulerBrowserExporter;
  await exporter.ensureExcelJS();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("匯出上班日", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.addRow(["上班地點(單位)", "姓名", "工號", "日期(YYYYMMDD)"]);
  rows.forEach((item) => {
    const row = sheet.addRow(item.values);
    if (item.highlight) {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } };
      });
    }
  });
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3EBD8" } };
  sheet.columns = [{ width: 20 }, { width: 16 }, { width: 16 }, { width: 18 }];
  sheet.getColumn(3).numFmt = "@";
  sheet.getColumn(4).numFmt = "@";
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 4 } };
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = {
        top: { style: "thin", color: { argb: "FFD8D2C7" } },
        left: { style: "thin", color: { argb: "FFD8D2C7" } },
        bottom: { style: "thin", color: { argb: "FFD8D2C7" } },
        right: { style: "thin", color: { argb: "FFD8D2C7" } }
      };
    });
  });
  const blob = await exporter.workbookToBlob(workbook);
  const fileName = `匯出上班日_${startDate.replaceAll("-", "")}-${endDate.replaceAll("-", "")}.xlsx`;
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  closeModal();
  setSaveStatus("");
}

'''
text = text.replace(marker, helper + marker, 1)
text = text.replace(
    '  const labels = {\n    sap: { title: "匯出休例假期間", action: "匯出休例假" },',
    '  const labels = {\n    workday: { title: "匯出上班日期間", action: "匯出上班日" },\n    sap: { title: "匯出休例假期間", action: "匯出休例假" },',
    1
)
text = text.replace(
    '  const method = type === "sap" ? "exportSapCsv" : type === "leave" ? "exportLeave" : "exportOvertime";',
    '''  if (type === "workday") {
    try {
      setSaveStatus("正在準備匯出資料...", true);
      await runWorkdayExport(startDate, endDate);
    } catch (error) {
      setSaveStatus(`匯出失敗：${error.message || error}`);
    }
    return;
  }
  const method = type === "sap" ? "exportSapCsv" : type === "leave" ? "exportLeave" : "exportOvertime";''',
    1
)
text = text.replace(
    '    const exportRows = await window.schedulerApi.loadScheduleExportRows(startDate, endDate);',
    '    const exportRows = filterExportRowsToCurrentGroup(await window.schedulerApi.loadScheduleExportRows(startDate, endDate));',
    1
)
p.write_text(text, encoding="utf-8")

Path("tests/function-menu-permission-mapping.test.js").write_text(r'''const fs = require("node:fs");
const test = require("node:test");
const assert = require("node:assert/strict");

const groups = fs.readFileSync("src/renderer/renderer-groups-permissions-archive.js", "utf8");
const auth = fs.readFileSync("src/renderer/renderer-auth-context.js", "utf8");
const toolbar = fs.readFileSync("src/renderer/renderer-events-toolbar.js", "utf8");
const exportsSource = fs.readFileSync("src/renderer/renderer-export-actions.js", "utf8");
const html = fs.readFileSync("src/renderer/index.html", "utf8");

test("設定選單只由 settings 共用權限開啟", () => {
  assert.ok(groups.includes('action === "group-settings" || action === "permission-settings" || action === "schedule-archive"'));
  assert.ok(groups.includes('? hasCommonPermission("settings")'));
  assert.ok(groups.includes('weekStartSettingsButton: hasCommonPermission("settings")'));
  assert.ok(groups.includes('if (!hasCommonPermission("settings") || !hasGroupPermission(groupFeatureState.currentGroupId, "schedule_view")) return;'));
  assert.ok(!auth.match(/const managerOnlyIds = \[[\s\S]*?\];/)?.[0].includes("weekStartSettingsButton"));
});

test("匯出選單四個功能全部直接對應 export 共用權限", () => {
  ["exportScheduleButton", "exportSapButton", "exportLeaveButton", "exportOvertimeButton"].forEach((id) => {
    assert.ok(groups.includes(`${id}: hasCommonPermission("export")`), `${id} 未綁定 export 權限`);
    assert.ok(!html.includes(`manager-action" id="${id}`), `${id} 仍使用 generic manager-action`);
  });
  assert.ok(!html.includes('id="exportOvertimeButton" type="button" hidden'));
});

test("匯出上班日正式綁定期間匯出並限制目前群組", () => {
  assert.ok(toolbar.includes('bindClick("exportScheduleButton"'));
  assert.ok(toolbar.includes('openExportPeriodDialog("workday")'));
  assert.ok(exportsSource.includes('workday: { title: "匯出上班日期間", action: "匯出上班日" }'));
  assert.ok(exportsSource.includes('await window.schedulerApi.loadScheduleExportRows(startDate, endDate);'));
  assert.ok(exportsSource.includes("function filterExportRowsToCurrentGroup(rows)"));
  assert.ok(exportsSource.includes('filterExportRowsToCurrentGroup(await window.schedulerApi.loadScheduleExportRows(startDate, endDate))'));
  assert.ok(exportsSource.includes("const members = getCurrentGroupExportMembers();"));
});
''', encoding="utf-8")
