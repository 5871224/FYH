from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, got {count}: {old[:120]!r}")
    file_path.write_text(text.replace(old, new, 1), encoding="utf-8")


# 編輯簽到紀錄：上下班地點只顯示該人員所屬群組的單位，
# 不再插入空白的「管理員補登」或其他群組的歷史地點。
replace_once(
    "src/renderer/renderer-records-actions.js",
    '''function attendanceReviewLocationOptions(row, location) {
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
''',
    '''function attendanceReviewLocationOptions(row, location) {
  const review = ensureAttendanceReviewState();
  const groupId = String(row?.groupId || "").trim();
  const currentId = String(location?.departmentId || "").trim();
  return (review.departments || [])
    .filter((department) => groupId && String(department.group_id || department.groupId || "").trim() === groupId)
    .map((department) => ({ id: String(department.id || "").trim(), name: String(department.name || "").trim() }))
    .filter((department) => department.id)
    .map((department) => `<option value="${escapeHtml(department.id)}" ${department.id === currentId ? "selected" : ""}>${escapeHtml(department.name || department.id)}</option>`)
    .join("");
}
''',
)


# 審核頁資料來源要提供群組內所有未刪除單位，而不是只提供「開放打卡」單位。
replace_once(
    "supabase/functions/attendance-review-groups/index.ts",
    '''    departments: (departmentResult.data || [])
      .filter((department: any) => department.attendance_enabled === true)
      .map((department: any) => ({ id: department.id, name: department.name || "", group_id: department.group_id })),
''',
    '''    departments: (departmentResult.data || [])
      .map((department: any) => ({ id: department.id, name: department.name || "", group_id: department.group_id })),
''',
)


# 管理員編輯簽到紀錄時，群組內任何未刪除單位都可選；
# attendance_enabled 只控制一般打卡，不限制管理員修正紀錄。
replace_once(
    "supabase/functions/attendance-review-groups/index.ts",
    '''async function resolveAdminClockLocation(ctx: any, target: any, departmentIdValue: unknown, oldLocation: any, clockAt: string | null) {
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
''',
    '''async function resolveAdminClockLocation(ctx: any, target: any, departmentIdValue: unknown, oldLocation: any, clockAt: string | null) {
  if (!clockAt) return null;
  const departmentId = String(departmentIdValue || "").trim();
  if (!departmentId) return oldLocation || { name: "管理員補登", source: "管理員補登" };
  if (String(oldLocation?.departmentId || "") === departmentId) return oldLocation;
  const result = await ctx.supabaseAdmin.from("set_departments")
    .select("id,name,address,group_id,deleted_at")
    .eq("id", departmentId).is("deleted_at", null).maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new Error("找不到指定的打卡地點");
  if (String(result.data.group_id || "") !== String(target.group_id || "")) throw new Error("打卡地點不屬於該人員群組");
  return {
    departmentId: result.data.id,
    name: result.data.name || "",
    address: result.data.address || "",
    source: "管理員修改",
    accuracy: null,
    distance: null
  };
}
''',
)


# 更新正式測試契約：管理員編輯可選群組內所有未刪除單位，前端不得出現「管理員補登」。
replace_once(
    "tests/attendance-review-location-history.test.js",
    '''  assert.match(page, /departments: result\\.departments \\|\\| \\[\\]/);
  assert.match(edge, /attendance_enabled/);
  assert.match(edge, /打卡地點不屬於該人員群組/);
  assert.match(edge, /此單位目前未開放打卡/);
''',
    '''  assert.match(page, /departments: result\\.departments \\|\\| \\[\\]/);
  assert.match(actions, /\\.filter\\(\\(department\\) => groupId &&/);
  assert.doesNotMatch(actions, /departments\\.unshift/);
  assert.doesNotMatch(actions, /管理員補登/);
  assert.match(edge, /打卡地點不屬於該人員群組/);
  assert.doesNotMatch(edge, /\\.filter\\(\\(department: any\\) => department\\.attendance_enabled === true\\)/);
  assert.doesNotMatch(edge, /此單位目前未開放打卡/);
''',
)


# Focused regression guards for this request.
frontend = Path("src/renderer/renderer-records-actions.js").read_text(encoding="utf-8")
function_text = frontend.split("function attendanceReviewLocationOptions", 1)[1].split("\n}\n", 1)[0]
if "管理員補登" in function_text or "departments.unshift" in function_text:
    raise SystemExit("attendance location options still contain legacy admin/current-location fallback")
if ".filter((department) => groupId &&" not in function_text:
    raise SystemExit("attendance location options are not strictly scoped to the employee group")

backend = Path("supabase/functions/attendance-review-groups/index.ts").read_text(encoding="utf-8")
if '''departments: (departmentResult.data || [])\n      .filter((department: any) => department.attendance_enabled === true)''' in backend:
    raise SystemExit("attendance review department list still filters by attendance_enabled")
resolve_text = backend.split("async function resolveAdminClockLocation", 1)[1].split("\n}\n\nasync function reviewSave", 1)[0]
if "attendance_enabled !== true" in resolve_text:
    raise SystemExit("admin location editing still rejects non-clock-enabled departments")
