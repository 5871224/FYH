from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, got {count}: {old[:120]!r}")
    file_path.write_text(text.replace(old, new, 1), encoding="utf-8")


# Review table styling and action-state colors.
replace_once(
    "src/renderer/css/pages.css",
    ".attendance-review-table {\n  table-layout: fixed;\n  min-width: 1000px;\n}",
    ".attendance-review-table {\n  table-layout: fixed;\n  min-width: 1000px;\n}\n\n.attendance-review-table thead th {\n  text-align: center;\n}",
)
replace_once(
    "src/renderer/css/pages.css",
    ".attendance-review-status.is-unreviewed,\n.attendance-review-toggle.is-unreviewed {\n  background: #fff4d6;\n  color: #8a5a00;\n  border: 1px solid #efc66a;\n}\n\n.attendance-review-status.is-reviewed,\n.attendance-review-toggle.is-reviewed {\n  background: #e8f7ef;\n  color: #176b45;\n  border: 1px solid #8bc9aa;\n}\n\n.attendance-review-toggle {\n  padding: 0;\n  border-radius: 999px;\n  font-weight: 800;\n  cursor: pointer;\n}",
    ".attendance-review-status.is-unreviewed {\n  background: #fff4d6;\n  color: #8a5a00;\n  border: 1px solid #efc66a;\n}\n\n.attendance-review-status.is-reviewed {\n  background: #e8f7ef;\n  color: #176b45;\n  border: 1px solid #8bc9aa;\n}\n\n.attendance-review-toggle {\n  padding: 0;\n  border-radius: 999px;\n  font-weight: 800;\n  cursor: pointer;\n}\n\n.attendance-review-toggle.is-set-reviewed {\n  background: #e8f7ef;\n  color: #176b45;\n  border: 1px solid #8bc9aa;\n}\n\n.attendance-review-toggle.is-set-unreviewed {\n  background: #f2f3f5;\n  color: #73777f;\n  border: 1px solid #c7c9ce;\n}",
)

# Distinct review action icons: green check to approve, gray warning to return.
replace_once(
    "src/renderer/renderer-records-views.js",
    "function renderAttendanceReviewPagination(review) {",
    """function renderAttendanceReviewToggleIcon(reviewed) {
  return reviewed
    ? '<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 9v4m0 4h.01\"></path><path d=\"M10.3 4.7 3.9 16a2 2 0 0 0 1.7 3h12.8a2 2 0 0 0 1.7-3L13.7 4.7a2 2 0 0 0-3.4 0Z\"></path></svg>'
    : '<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M5 12l4 4L19 6\"></path></svg>';
}

function renderAttendanceReviewPagination(review) {""",
)
replace_once(
    "src/renderer/renderer-records-views.js",
    '<button class="settings-icon-btn attendance-review-action-btn attendance-review-toggle ${row.reviewed ? "is-reviewed" : "is-unreviewed"}" type="button" data-toggle-attendance-review="${escapeHtml(token)}" data-reviewed="${row.reviewed ? "true" : "false"}" aria-label="${row.reviewed ? "取消審核" : "審核"}" title="${row.reviewed ? "取消審核" : "審核"}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4h6l1 2h3v15H5V6h3l1-2z"></path><path d="m9 13 2 2 4-5"></path></svg></button>',
    '<button class="settings-icon-btn attendance-review-action-btn attendance-review-toggle ${row.reviewed ? "is-set-unreviewed" : "is-set-reviewed"}" type="button" data-toggle-attendance-review="${escapeHtml(token)}" data-reviewed="${row.reviewed ? "true" : "false"}" aria-label="${row.reviewed ? "設為未審" : "設為已審"}" title="${row.reviewed ? "設為未審" : "設為已審"}">${renderAttendanceReviewToggleIcon(row.reviewed)}</button>',
)

# Keep available attendance departments in review state.
replace_once(
    "src/renderer/renderer-foundation.js",
    "      rows: [],\n      members: [],\n      issueTypes: [],",
    "      rows: [],\n      members: [],\n      departments: [],\n      issueTypes: [],",
)
replace_once(
    "src/renderer/renderer-records-page.js",
    "    rows: current.rows || [],\n    members: current.members || [],\n    issueTypes: current.issueTypes || [],",
    "    rows: current.rows || [],\n    members: current.members || [],\n    departments: current.departments || [],\n    issueTypes: current.issueTypes || [],",
)
replace_once(
    "src/renderer/renderer-records-page.js",
    "        rows: result.rows || [],\n        members: result.members || [],\n        issueTypes: result.issueTypes || [],",
    "        rows: result.rows || [],\n        members: result.members || [],\n        departments: result.departments || [],\n        issueTypes: result.issueTypes || [],",
)

# Add location editing and readable audit history.
replace_once(
    "src/renderer/renderer-records-actions.js",
    "function openAttendanceReviewEditModal(token) {",
    """function attendanceReviewLocationOptions(row, location) {
  const review = ensureAttendanceReviewState();
  const groupId = String(row?.groupId || "");
  const currentId = String(location?.departmentId || "");
  const currentName = String(location?.name || "");
  const departments = (review.departments || [])
    .filter((department) => !groupId || String(department.group_id || department.groupId || "") === groupId)
    .map((department) => ({ id: String(department.id || ""), name: String(department.name || "") }))
    .filter((department) => department.id);
  if (currentId && !departments.some((department) => department.id === currentId)) {
    departments.unshift({ id: currentId, name: currentName || "目前打卡地點" });
  }
  const emptyLabel = currentName && !currentId ? `保留目前地點（${currentName}）` : "管理員補登";
  return `<option value="" ${!currentId ? "selected" : ""}>${escapeHtml(emptyLabel)}</option>${departments
    .map((department) => `<option value="${escapeHtml(department.id)}" ${department.id === currentId ? "selected" : ""}>${escapeHtml(department.name || department.id)}</option>`)
    .join("")}`;
}

function openAttendanceReviewEditModal(token) {""",
)
replace_once(
    "src/renderer/renderer-records-actions.js",
    '      <div class="form-row"><label>上班時間</label><input id="reviewClockInTime" type="time" value="${escapeHtml(timeValueFromIso(row.clock_in_at))}"></div>\n      <div class="form-row"><label>下班時間</label><input id="reviewClockOutTime" type="time" value="${escapeHtml(timeValueFromIso(row.clock_out_at))}"></div>\n      <div class="form-row"><label>上班時數</label>',
    '      <div class="form-row"><label>上班時間</label><input id="reviewClockInTime" type="time" value="${escapeHtml(timeValueFromIso(row.clock_in_at))}"></div>\n      <div class="form-row"><label>下班時間</label><input id="reviewClockOutTime" type="time" value="${escapeHtml(timeValueFromIso(row.clock_out_at))}"></div>\n      <div class="form-row"><label>上班地點</label><select id="reviewClockInLocation">${attendanceReviewLocationOptions(row, row.clock_in_location)}</select></div>\n      <div class="form-row"><label>下班地點</label><select id="reviewClockOutLocation">${attendanceReviewLocationOptions(row, row.clock_out_location)}</select></div>\n      <div class="form-row"><label>上班時數</label>',
)
replace_once(
    "src/renderer/renderer-records-actions.js",
    '      clockInTime: document.getElementById("reviewClockInTime")?.value || "",\n      clockOutTime: document.getElementById("reviewClockOutTime")?.value || "",\n      regularHours:',
    '      clockInTime: document.getElementById("reviewClockInTime")?.value || "",\n      clockOutTime: document.getElementById("reviewClockOutTime")?.value || "",\n      clockInLocationDepartmentId: document.getElementById("reviewClockInLocation")?.value || "",\n      clockOutLocationDepartmentId: document.getElementById("reviewClockOutLocation")?.value || "",\n      regularHours:',
)
replace_once(
    "src/renderer/renderer-records-actions.js",
    "async function openAttendanceHistoryModal(recordId) {",
    """function attendanceHistoryActionLabel(value) {
  const labels = {
    clock_in: "上班打卡",
    clock_out: "下班打卡",
    employee_regularHours: "修改上班時數",
    employee_overtimeHours: "修改加班時數",
    employee_note: "修改備註",
    admin_edit: "主管修正",
    reviewed: "設為已審",
    returned: "設為未審",
    unreviewed: "設為未審"
  };
  return labels[String(value || "")] || String(value || "異動紀錄");
}

function attendanceHistoryLocationLabel(location) {
  if (!location || typeof location !== "object") return "未指定";
  return String(location.name || location.departmentId || "未指定");
}

function attendanceHistoryChangeSummary(log = {}) {
  const before = log.before_data && typeof log.before_data === "object" ? log.before_data : {};
  const after = log.after_data && typeof log.after_data === "object" ? log.after_data : {};
  const parts = [];
  if (String(before.clock_in_at || "") !== String(after.clock_in_at || "")) {
    parts.push(`上班 ${before.clock_in_at ? formatClockTime(before.clock_in_at) : "未填"} → ${after.clock_in_at ? formatClockTime(after.clock_in_at) : "未填"}`);
  }
  if (String(before.clock_out_at || "") !== String(after.clock_out_at || "")) {
    parts.push(`下班 ${before.clock_out_at ? formatClockTime(before.clock_out_at) : "未填"} → ${after.clock_out_at ? formatClockTime(after.clock_out_at) : "未填"}`);
  }
  if (attendanceHistoryLocationLabel(before.clock_in_location) !== attendanceHistoryLocationLabel(after.clock_in_location)) {
    parts.push(`上班地點 ${attendanceHistoryLocationLabel(before.clock_in_location)} → ${attendanceHistoryLocationLabel(after.clock_in_location)}`);
  }
  if (attendanceHistoryLocationLabel(before.clock_out_location) !== attendanceHistoryLocationLabel(after.clock_out_location)) {
    parts.push(`下班地點 ${attendanceHistoryLocationLabel(before.clock_out_location)} → ${attendanceHistoryLocationLabel(after.clock_out_location)}`);
  }
  if (before.regular_minutes !== after.regular_minutes) {
    parts.push(`上班時數 ${before.regular_minutes == null ? "未填" : Number(before.regular_minutes) / 60} → ${after.regular_minutes == null ? "未填" : Number(after.regular_minutes) / 60}`);
  }
  if (before.overtime_minutes !== after.overtime_minutes) {
    parts.push(`加班時數 ${before.overtime_minutes == null ? "未填" : Number(before.overtime_minutes) / 60} → ${after.overtime_minutes == null ? "未填" : Number(after.overtime_minutes) / 60}`);
  }
  if (String(before.note || "") !== String(after.note || "")) parts.push("備註已修改");
  return parts.join("；") || "-";
}

async function openAttendanceHistoryModal(recordId) {""",
)
replace_once(
    "src/renderer/renderer-records-actions.js",
    'body: `<div class="records-table-wrap"><table class="records-table"><thead><tr><th>時間</th><th>操作</th><th>原因</th><th>操作人</th></tr></thead><tbody>${(result.logs || []).map((log) => `<tr><td>${formatRecordDateTime(log.created_at)}</td><td>${escapeHtml(log.action || "")}</td><td>${escapeHtml(log.reason || "")}</td><td>${escapeHtml(log.operator_name || "")}</td></tr>`).join("") || \'<tr><td colspan="4">沒有歷程</td></tr>\'}</tbody></table></div>`',
    'body: `<div class="records-table-wrap"><table class="records-table"><thead><tr><th>時間</th><th>操作</th><th>變更內容</th><th>原因</th><th>操作人</th></tr></thead><tbody>${(result.logs || []).map((log) => `<tr><td>${formatRecordDateTime(log.created_at)}</td><td>${escapeHtml(attendanceHistoryActionLabel(log.action))}</td><td>${escapeHtml(attendanceHistoryChangeSummary(log))}</td><td>${escapeHtml(log.reason || "")}</td><td>${escapeHtml(log.operator_name || "")}</td></tr>`).join("") || \'<tr><td colspan="5">沒有歷程</td></tr>\'}</tbody></table></div>`',
)

# Backend returns same-group attendance-enabled departments and validates edits.
replace_once(
    "supabase/functions/attendance-review-groups/index.ts",
    '  if (!groupIds.length) return { ok: true, members: [], issueTypes: ISSUE_TYPES, rows: [], total: 0, page, pageSize: PAGE_SIZE };',
    '  if (!groupIds.length) return { ok: true, members: [], departments: [], issueTypes: ISSUE_TYPES, rows: [], total: 0, page, pageSize: PAGE_SIZE };',
)
replace_once(
    "supabase/functions/attendance-review-groups/index.ts",
    '    ctx.supabaseAdmin.from("set_departments").select("id,name,group_id").in("group_id", groupIds)',
    '    ctx.supabaseAdmin.from("set_departments").select("id,name,address,group_id,attendance_enabled,deleted_at").in("group_id", groupIds).is("deleted_at", null)',
)
replace_once(
    "supabase/functions/attendance-review-groups/index.ts",
    '    members: members.map((member: any) => ({ id: member.id, employee_code: member.employee_code, full_name: member.full_name, group_id: member.group_id })),\n    issueTypes: ISSUE_TYPES,',
    '    members: members.map((member: any) => ({ id: member.id, employee_code: member.employee_code, full_name: member.full_name, group_id: member.group_id })),\n    departments: (departmentResult.data || [])\n      .filter((department: any) => department.attendance_enabled === true)\n      .map((department: any) => ({ id: department.id, name: department.name || "", group_id: department.group_id })),\n    issueTypes: ISSUE_TYPES,',
)
replace_once(
    "supabase/functions/attendance-review-groups/index.ts",
    "async function reviewSave(ctx: any, body: any, actor: any) {",
    """async function resolveAdminClockLocation(ctx: any, target: any, departmentIdValue: unknown, oldLocation: any, clockAt: string | null) {
  if (!clockAt) return null;
  const departmentId = String(departmentIdValue || "").trim();
  if (!departmentId) return oldLocation || { name: "管理員補登", source: "管理員補登" };
  if (String(oldLocation?.departmentId || "") === departmentId) return oldLocation;
  const result = await ctx.supabaseAdmin.from("set_departments")
    .select("id,name,address,group_id,attendance_enabled,deleted_at")
    .eq("id", departmentId).is("deleted_at", null).maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new Error("找不到指定的打卡地點");
  if (String(result.data.group_id || "") !== String(target.group_id || "")) throw new Error("打卡地點不屬於該人員群組");
  if (result.data.attendance_enabled !== true) throw new Error("此單位目前未開放打卡");
  return {
    departmentId: result.data.id,
    name: result.data.name || "",
    address: result.data.address || "",
    source: "管理員修改",
    accuracy: null,
    distance: null
  };
}

async function reviewSave(ctx: any, body: any, actor: any) {""",
)
replace_once(
    "supabase/functions/attendance-review-groups/index.ts",
    '  await ensureTargetAllowed(ctx, actor, userId);\n  const old = await getOrCreateDay(ctx, userId, workDate);',
    '  const target = await ensureTargetAllowed(ctx, actor, userId);\n  const old = await getOrCreateDay(ctx, userId, workDate);',
)
replace_once(
    "supabase/functions/attendance-review-groups/index.ts",
    '  update.clock_in_location = clockInAt ? (old.clock_in_location || { name: "管理員補登", source: "管理員補登" }) : null;\n  update.clock_out_location = clockOutAt ? (old.clock_out_location || { name: "管理員補登", source: "管理員補登" }) : null;',
    '  [update.clock_in_location, update.clock_out_location] = await Promise.all([\n    resolveAdminClockLocation(ctx, target, body?.clockInLocationDepartmentId, old.clock_in_location, clockInAt),\n    resolveAdminClockLocation(ctx, target, body?.clockOutLocationDepartmentId, old.clock_out_location, clockOutAt)\n  ]);',
)

# Cross-module regression coverage.
Path("tests/attendance-review-location-history.test.js").write_text(
    '''const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("簽到審核操作圖示與表頭狀態清楚", () => {
  const view = read("src/renderer/renderer-records-views.js");
  const css = read("src/renderer/css/pages.css");
  assert.match(view, /M5 12l4 4L19 6/);
  assert.match(view, /M12 9v4m0 4h\\.01/);
  assert.match(view, /is-set-reviewed/);
  assert.match(view, /is-set-unreviewed/);
  assert.match(css, /\\.attendance-review-table thead th \\{\\s*text-align: center;/);
});

test("簽到審核編輯上下班地點會完整傳到後端並受群組權限驗證", () => {
  const actions = read("src/renderer/renderer-records-actions.js");
  const page = read("src/renderer/renderer-records-page.js");
  const edge = read("supabase/functions/attendance-review-groups/index.ts");
  assert.match(actions, /reviewClockInLocation/);
  assert.match(actions, /reviewClockOutLocation/);
  assert.match(actions, /clockInLocationDepartmentId/);
  assert.match(actions, /clockOutLocationDepartmentId/);
  assert.match(page, /departments: result\\.departments \\|\\| \\[\\]/);
  assert.match(edge, /attendance_enabled/);
  assert.match(edge, /打卡地點不屬於該人員群組/);
  assert.match(edge, /此單位目前未開放打卡/);
  assert.match(edge, /resolveAdminClockLocation\\(ctx, target, body\\?\\.clockInLocationDepartmentId/);
  assert.match(edge, /resolveAdminClockLocation\\(ctx, target, body\\?\\.clockOutLocationDepartmentId/);
});

test("簽到修改歷程使用中文操作名稱並顯示時間與地點前後值", () => {
  const actions = read("src/renderer/renderer-records-actions.js");
  assert.match(actions, /admin_edit: "主管修正"/);
  assert.match(actions, /reviewed: "設為已審"/);
  assert.match(actions, /returned: "設為未審"/);
  assert.match(actions, /上班地點/);
  assert.match(actions, /下班地點/);
  assert.match(actions, /變更內容/);
});
''',
    encoding="utf-8",
)
