from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8-sig")


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding="utf-8")


def replace_once(content: str, old: str, new: str, label: str) -> str:
    if old not in content:
        if new in content:
            return content
        raise RuntimeError(f"找不到 {label}")
    return content.replace(old, new, 1)


# web-api: common state never preloads manager-only personnel fields.
web_path = "src/renderer/web-api.js"
web = read(web_path)
old_block = '''  async function loadState() {
    const auth = Boolean(currentSession?.access_token);
    try {
      const managerAccess = hasManagerAccess(currentProfile?.role);
      const [
        settingsRows,
        departmentRows,
        scheduleProfileRows,
        adminProfileRows,
        shiftRows,
        leaveRows,
        overtimeRows,
        holidayRows
      ] = await Promise.all([
        restSelect("scheduler_settings", { select: "*", filters: { id: `eq.${documentId}` }, limit: "1", auth }),
        getDepartmentDirectoryRows(),
        getScheduleDirectoryRows(),
        managerAccess ? getEmployeeAdminDirectoryRows() : Promise.resolve([]),
        restSelect("set_shift", { select: "*", order: "sort_order.asc,name.asc", auth }),
        restSelect("set_leave", { select: "*", order: "sort_order.asc,code.asc", auth }),
        restSelect("set_overtime", { select: "*", order: "sort_order.asc,name.asc", auth }),
        restSelect("holidays", { select: "*", order: "sort_order.asc,holiday_date.asc", auth })
      ]);

      const adminProfilesById = new Map((adminProfileRows || []).map((row) => [row.id, row]));
      const profileRows = (scheduleProfileRows || []).map((row) => ({
        ...(adminProfilesById.get(row.id) || {}),
        ...row
      }));
      const settings = settingsRows?.[0] || {};'''
new_block = '''  function mapMemberDirectoryRows(profileRows = []) {
    return (profileRows || []).map((row) => {
      const fallbackDeptId = row.home_department_id || "";
      const scheduleShiftIds = normalizeTextArray(row.schedule_shift_ids)
        .filter((value, index, list) => value && list.indexOf(value) === index);
      return {
        id: row.id,
        code: row.employee_code || "",
        name: row.full_name || "",
        deptId: fallbackDeptId,
        scheduleShiftIds,
        positionId: "",
        proxyMemberId: "",
        hireDate: row.hire_date || "",
        leaveDate: row.leave_date || "",
        payByDay: Boolean(row.pay_by_day),
        fixedRestWeekday: clampInteger(row.fixed_rest_weekday, 0, 6, 0),
        monthlyRestDays: Math.max(0, Number(row.monthly_rest_days) || 0),
        role: normalizeRole(row.role)
      };
    });
  }

  async function loadEmployeeAdminDirectory() {
    ensureManager();
    return mapMemberDirectoryRows(await getEmployeeAdminDirectoryRows());
  }

  async function loadState() {
    const auth = Boolean(currentSession?.access_token);
    try {
      const [
        settingsRows,
        departmentRows,
        profileRows,
        shiftRows,
        leaveRows,
        overtimeRows,
        holidayRows
      ] = await Promise.all([
        restSelect("scheduler_settings", { select: "*", filters: { id: `eq.${documentId}` }, limit: "1", auth }),
        getDepartmentDirectoryRows(),
        getScheduleDirectoryRows(),
        restSelect("set_shift", { select: "*", order: "sort_order.asc,name.asc", auth }),
        restSelect("set_leave", { select: "*", order: "sort_order.asc,code.asc", auth }),
        restSelect("set_overtime", { select: "*", order: "sort_order.asc,name.asc", auth }),
        restSelect("holidays", { select: "*", order: "sort_order.asc,holiday_date.asc", auth })
      ]);

      const settings = settingsRows?.[0] || {};'''
web = replace_once(web, old_block, new_block, "loadState 管理名錄預載")
old_inline_map = '''      const members = (profileRows || []).map((row) => {
        const fallbackDeptId = row.home_department_id || "";
        const scheduleShiftIds = normalizeTextArray(row.schedule_shift_ids)
          .filter((value, index, list) => value && list.indexOf(value) === index);
        return {
          id: row.id,
          code: row.employee_code || "",
          name: row.full_name || "",
          deptId: fallbackDeptId,
          scheduleShiftIds,
          positionId: "",
          proxyMemberId: "",
          hireDate: row.hire_date || "",
          leaveDate: row.leave_date || "",
          payByDay: Boolean(row.pay_by_day),
          fixedRestWeekday: clampInteger(row.fixed_rest_weekday, 0, 6, 0),
          monthlyRestDays: Math.max(0, Number(row.monthly_rest_days) || 0),
          role: normalizeRole(row.role)
        };
      });'''
web = replace_once(web, old_inline_map, "      const members = mapMemberDirectoryRows(profileRows);", "loadState 人員 mapping")
web = replace_once(web, "    loadState,\n    loadScheduleEntries,", "    loadState,\n    loadEmployeeAdminDirectory,\n    loadScheduleEntries,", "schedulerApi 管理名錄匯出")
write(web_path, web)

# renderer: enrich state only when entering a manager workflow.
renderer_path = "src/renderer/renderer.js"
renderer = read(renderer_path)
renderer = replace_once(
    renderer,
    "let currentMember = null;\nlet attendanceState = {",
    "let currentMember = null;\nlet managerDirectoryLoaded = false;\nlet managerDirectoryLoading = null;\nlet attendanceState = {",
    "管理名錄載入狀態",
)
insert_after = '''function canEditSchedule() {
  return isManager();
}
'''
ensure_function = '''function canEditSchedule() {
  return isManager();
}

async function ensureManagerDirectoryLoaded() {
  if (!isManager() || managerDirectoryLoaded) {
    return;
  }
  if (!managerDirectoryLoading) {
    managerDirectoryLoading = window.schedulerApi.loadEmployeeAdminDirectory()
      .then((adminMembers) => {
        const adminById = new Map((adminMembers || []).map((member) => [member.id, member]));
        state.members = state.members.map((member) => {
          const adminMember = adminById.get(member.id);
          return adminMember ? { ...member, ...adminMember, id: member.id } : member;
        });
        managerDirectoryLoaded = true;
        currentMember = resolveCurrentMember();
      })
      .finally(() => {
        managerDirectoryLoading = null;
      });
  }
  await managerDirectoryLoading;
}
'''
renderer = replace_once(renderer, insert_after, ensure_function, "主管名錄延遲載入函式")
renderer = replace_once(
    renderer,
    '''function openDepartmentSettings() {
  departmentSettingsView = "department";''',
    '''async function openDepartmentSettings() {
  try {
    await ensureManagerDirectoryLoaded();
  } catch (error) {
    showInfoMessage(`讀取管理資料失敗：${error.message || error}`);
    return;
  }
  departmentSettingsView = "department";''',
    "單位設定載入管理名錄",
)
renderer = replace_once(
    renderer,
    '''function openMemberSettings() {
  modalContext = { category: "member-settings" };''',
    '''async function openMemberSettings() {
  try {
    await ensureManagerDirectoryLoaded();
  } catch (error) {
    showInfoMessage(`讀取管理資料失敗：${error.message || error}`);
    return;
  }
  modalContext = { category: "member-settings" };''',
    "人員設定載入管理名錄",
)
renderer = replace_once(
    renderer,
    '''      if (target.dataset.homeAction === "schedule") {
        appView = "schedule";
        renderAll();
        return;
      }''',
    '''      if (target.dataset.homeAction === "schedule") {
        try {
          await ensureManagerDirectoryLoaded();
        } catch (error) {
          showInfoMessage(`讀取班表管理資料失敗：${error.message || error}`);
          return;
        }
        appView = "schedule";
        renderAll();
        return;
      }''',
    "班表頁進入點",
)
renderer = renderer.replace("      openDepartmentSettings();\n      return;", "      await openDepartmentSettings();\n      return;", 1)
renderer = renderer.replace("      openMemberSettings();\n      return;", "      await openMemberSettings();\n      return;", 1)
# Reset lazy state on session expiry, sign-out paths, and a fresh app bootstrap.
renderer = replace_once(
    renderer,
    '''    currentProfile = null;
    currentMember = null;
    attendanceState = { loading: false, saving: false, record: null, serverDate: "", error: "" };''',
    '''    currentProfile = null;
    currentMember = null;
    managerDirectoryLoaded = false;
    managerDirectoryLoading = null;
    attendanceState = { loading: false, saving: false, record: null, serverDate: "", error: "" };''',
    "Session 逾時重設管理名錄",
)
renderer = replace_once(
    renderer,
    '''async function loadApp() {
  bindEvents();''',
    '''async function loadApp() {
  managerDirectoryLoaded = false;
  managerDirectoryLoading = null;
  bindEvents();''',
    "應用程式啟動重設管理名錄",
)
write(renderer_path, renderer)

# Documentation: make the lazy loading rule explicit.
spec_path = "規格書.md"
spec = read(spec_path)
spec = replace_once(
    spec,
    "6. 前端不得以攔截 `fetch`、刪除 JSON 欄位或依載入順序覆寫函式作為主要權限邊界；資料介面本身必須只回傳該用途需要的欄位。",
    "6. 前端不得以攔截 `fetch`、刪除 JSON 欄位或依載入順序覆寫函式作為主要權限邊界；資料介面本身必須只回傳該用途需要的欄位。\n7. 管理名錄採依頁面延遲載入：主管或管理員停留在首頁、打卡、訂餐或個人記錄時，不讀取完整人員管理欄位；只有進入班表管理、人員設定或單位設定時才讀取。",
    "規格管理名錄延遲載入",
)
write(spec_path, spec)

readme_path = "README.md"
readme = read(readme_path)
readme = replace_once(
    readme,
    "- 人員資料查詢依用途分為 `get_my_profile_v2()`、`get_schedule_directory_v2()` 與 `get_employee_admin_directory_v2()`；不得再以單一名錄同時服務登入、班表及管理頁面。",
    "- 人員資料查詢依用途分為 `get_my_profile_v2()`、`get_schedule_directory_v2()` 與 `get_employee_admin_directory_v2()`；不得再以單一名錄同時服務登入、班表及管理頁面。管理名錄只在進入管理功能時延遲載入。",
    "README 延遲載入規則",
)
write(readme_path, readme)

agents_path = "AGENTS.md"
agents = read(agents_path)
agents = replace_once(
    agents,
    "7. 人員資料介面依用途固定分為本人資料、共同班表名錄與管理名錄；新增頁面時不得直接讀取 `set_employee`，也不得把管理名錄拿給一般頁面使用。",
    "7. 人員資料介面依用途固定分為本人資料、共同班表名錄與管理名錄；新增頁面時不得直接讀取 `set_employee`，也不得把管理名錄拿給一般頁面使用。管理名錄必須依管理頁面延遲載入，不得在一般登入初始化時預載。",
    "AGENTS 延遲載入規則",
)
write(agents_path, agents)

# Static regression checks.
final_path = "scripts/check-v2-final.js"
final = read(final_path)
final = replace_once(
    final,
    '''assert(sourceWebApi.includes("get_my_profile_v2") && sourceWebApi.includes("get_schedule_directory_v2") && sourceWebApi.includes("get_employee_admin_directory_v2") && sourceWebApi.includes("get_department_directory_v2"), "前端尚未依用途使用安全名錄 RPC");
assert(!sourceWebApi.includes("get_employee_directory_v2"), "前端仍使用混合用途舊人員名錄 RPC");''',
    '''assert(sourceWebApi.includes("get_my_profile_v2") && sourceWebApi.includes("get_schedule_directory_v2") && sourceWebApi.includes("get_employee_admin_directory_v2") && sourceWebApi.includes("get_department_directory_v2"), "前端尚未依用途使用安全名錄 RPC");
assert(!sourceWebApi.includes("get_employee_directory_v2"), "前端仍使用混合用途舊人員名錄 RPC");
const loadStateSource = sourceWebApi.slice(sourceWebApi.indexOf("async function loadState()"), sourceWebApi.indexOf("async function syncLeaveAndOvertimeCatalogs"));
assert(!loadStateSource.includes("getEmployeeAdminDirectoryRows"), "一般登入初始化仍預載完整管理名錄");
assert(sourceWebApi.includes("async function loadEmployeeAdminDirectory()"), "前端缺少管理名錄延遲載入介面");
assert(sourceRenderer.includes("async function ensureManagerDirectoryLoaded()") && sourceRenderer.includes("await ensureManagerDirectoryLoaded();"), "班表與設定頁未依需要載入管理名錄");''',
    "V2 延遲載入 assertions",
)
final = replace_once(
    final,
    'assert(authoritativeSpec.includes("頁面與資料權限矩陣"), "正式規格書缺少跨頁面權限矩陣");',
    'assert(authoritativeSpec.includes("頁面與資料權限矩陣"), "正式規格書缺少跨頁面權限矩陣");\nassert(authoritativeSpec.includes("管理名錄採依頁面延遲載入"), "正式規格書缺少管理名錄延遲載入規則");',
    "規格延遲載入 assertion",
)
write(final_path, final)

print("lazy admin directory refactor prepared")
