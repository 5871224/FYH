from pathlib import Path
import re

ROOT = Path('.')

def read(path):
    return (ROOT / path).read_text(encoding='utf-8-sig')

def write(path, text):
    (ROOT / path).write_text(text.replace('\r\n','\n').rstrip()+'\n', encoding='utf-8')

# 1) 正式班表資料載入：設定先讀，其他班表必要資料與唯一班表區間平行讀取。
path = 'src/renderer/web-api.js'
text = read(path)
pattern = re.compile(r"  async function loadState\(\) \{.*?\n  \}\n\n  async function syncLeaveAndOvertimeCatalogs", re.S)
replacement = '''  async function loadState() {
    const auth = Boolean(currentSession?.access_token);
    try {
      const settingsRows = await restSelect("scheduler_settings", {
        select: "*",
        filters: { id: `eq.${documentId}` },
        limit: "1",
        auth
      });
      const settings = settingsRows?.[0] || {};
      const scheduleRange = getScheduleLoadRange(settings);
      const visibleStartDate = addDaysToDateString(scheduleRange.startDate, 7) || taipeiDateString();
      const visibleStart = toDateObject(visibleStartDate);
      const memberOrderPromise = currentSession?.access_token
        ? requestFunction("member-order-v2", { action: "list" })
        : Promise.resolve({ memberIds: [] });

      const [
        departmentRows,
        profileRows,
        shiftRows,
        leaveRows,
        overtimeRows,
        holidayRows,
        scheduleEntryRows,
        memberOrderResult
      ] = await Promise.all([
        getDepartmentDirectoryRows(),
        getScheduleDirectoryRows(),
        restSelect("set_shift", { select: "*", order: "sort_order.asc,name.asc", auth }),
        restSelect("set_leave", { select: "*", order: "sort_order.asc,code.asc", auth }),
        restSelect("set_overtime", { select: "*", order: "sort_order.asc,name.asc", auth }),
        restSelect("holidays", { select: "*", order: "sort_order.asc,holiday_date.asc", auth }),
        restSelect("schedule_entries", {
          select: "*",
          filters: getScheduleEntryFilters(scheduleRange),
          order: "work_date.asc",
          auth
        }),
        memberOrderPromise
      ]);

      const departments = mapDepartmentRows(departmentRows);
      let members = mapMemberDirectoryRows(profileRows);
      members = applyMemberOrder(members, memberOrderResult?.memberIds || []);
      const schedule = mapScheduleRows(scheduleEntryRows, members);

      return {
        year: visibleStart?.getFullYear() || new Date().getFullYear(),
        month: visibleStart?.getMonth() ?? new Date().getMonth(),
        selected: { type: null, id: null },
        deptFilter: "all",
        tableView: settings.table_view === "shift" ? "shift" : "member",
        tableDeptScopeFilter: "all",
        tableStatsVisible: settings.table_stats_visible !== false,
        scheduleStartDate: visibleStartDate,
        departments,
        members,
        shifts: mapShiftRows(shiftRows),
        leaves: mapLeaveRows(leaveRows),
        overtime: mapOvertimeRows(overtimeRows),
        holidays: mapHolidayRows(holidayRows),
        rules: {
          weekStart: clampInteger(settings.week_start, 0, 6, 0),
          monthStartDay: clampInteger(settings.month_start_day, 1, 31, 1),
          eightWeekStartDate: settings.eight_week_start_date || ""
        },
        schedule,
        scheduleLoadedRanges: [scheduleRange]
      };
    } catch (error) {
      if (!currentSession?.access_token && /permission denied|42501|401|403/i.test(error.message || "")) {
        throw new Error("未登入時無法讀取正式班表，請檢查正規化資料表的匿名讀取權限");
      }
      throw error;
    }
  }

  async function syncLeaveAndOvertimeCatalogs'''
text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise RuntimeError('找不到唯一 loadState 區段')

# 單位打卡設定改為真正進入單位設定才讀。
needle = '''  async function getTodayAttendance() {
    ensureSignedIn();'''
insert = '''  async function getDepartmentAttendanceSettings() {
    ensureSignedIn();
    const result = await requestFunction("department-attendance-v2", {});
    return Array.isArray(result?.settings) ? result.settings : [];
  }

  async function getTodayAttendance() {
    ensureSignedIn();'''
if text.count(needle) != 1:
    raise RuntimeError('找不到 getTodayAttendance 插入點')
text = text.replace(needle, insert, 1)
if text.count('    getTodayAttendance,') != 1:
    raise RuntimeError('找不到 schedulerApi 匯出 getTodayAttendance')
text = text.replace('    getTodayAttendance,', '    getDepartmentAttendanceSettings,\n    getTodayAttendance,', 1)
write(path, text)

# 2) 頁面按需載入：首頁已取得 bundle；進班表只補 entityMap，不重抓 bundle，不再補第二次班表查詢。
path = 'src/renderer/page-lazy-data.mjs'
text = read(path)
old = '''      if (!pageData.bootstrapActive) {
        const result = await fullLoadGroupAccessData();
        pageData.groupBundleLoaded = Boolean(groupFeatureState?.bundle?.actor);
        pageData.groupEntitiesLoaded = true;
        return result;
      }
'''
new = '''      if (!pageData.bootstrapActive) {
        const entityMap = await groupRpc("get_group_entity_map_v1");
        groupFeatureState.entityMap = entityMap && typeof entityMap === "object"
          ? entityMap
          : { departments: [], members: [], shifts: [], archiveRanges: [] };
        pageData.groupBundleLoaded = Boolean(groupFeatureState?.bundle?.actor);
        pageData.groupEntitiesLoaded = true;
        return {
          bundle: groupFeatureState.bundle,
          entityMap: groupFeatureState.entityMap
        };
      }
'''
if text.count(old) != 1:
    raise RuntimeError('找不到 page lazy 群組完整重讀區段')
text = text.replace(old, new, 1)
old2 = '''        await reloadGroupApplicationState();
        if (typeof ensureVisibleScheduleLoaded === "function") {
          await ensureVisibleScheduleLoaded();
        }
        pageData.scheduleLoaded = true;'''
new2 = '''        await reloadGroupApplicationState();
        pageData.scheduleLoaded = true;'''
if text.count(old2) != 1:
    raise RuntimeError('找不到首次班表二次載入區段')
text = text.replace(old2, new2, 1)
write(path, text)

# 3) reload 不再保留舊 scheduleStartDate；正式 loadState 已決定首次 8 週週期。
path = 'src/renderer/renderer-groups-permissions-archive.mjs'
text = read(path)
text = text.replace('''  const previousStartDate = state?.scheduleStartDate || "";\n''', '', 1)
text = text.replace('''  if (previousStartDate) state.scheduleStartDate = previousStartDate;\n''', '', 1)
write(path, text)

# 4) 單位設定才載入管理員的地址/GPS/IP/打卡開關。
path = 'src/renderer/renderer-settings-department.js'
text = read(path)
prefix = '''let departmentAttendanceSettingsUserId = "";

async function ensureDepartmentAttendanceSettingsLoaded() {
  if (!isAdmin()) return;
  const userId = currentProfile?.id || "";
  if (userId && departmentAttendanceSettingsUserId === userId) return;
  const settings = await window.schedulerApi.getDepartmentAttendanceSettings();
  const byDepartment = new Map((settings || []).map((row) => [row.departmentId, row]));
  state.departments = state.departments.map((department) => {
    const attendance = byDepartment.get(department.id);
    return attendance ? {
      ...department,
      address: attendance.address || "",
      latitude: attendance.latitude ?? "",
      longitude: attendance.longitude ?? "",
      publicIp: attendance.publicIp || "",
      attendanceEnabled: Boolean(attendance.attendanceEnabled)
    } : department;
  });
  departmentAttendanceSettingsUserId = userId;
}

'''
if not text.startswith('async function openDepartmentSettings()'):
    raise RuntimeError('renderer-settings-department.js 起始結構不符')
text = prefix + text
old = '''  try {
    await ensureManagerDirectoryLoaded();
  } catch (error) {'''
new = '''  try {
    await ensureManagerDirectoryLoaded();
    await ensureDepartmentAttendanceSettingsLoaded();
  } catch (error) {'''
if text.count(old) != 1:
    raise RuntimeError('找不到 openDepartmentSettings 管理資料載入區段')
text = text.replace(old, new, 1)
write(path, text)

# 5) cache bust：正式頁面載入器換版。
path = 'src/renderer/app-config.js'
text = read(path).replace('20260807-page-lazy-data', '20260807-schedule-first-load')
write(path, text)

# 6) 規格書寫清楚，不保留舊首次載入方式。
path = '規格書.md'
text = read(path)
marker = '## 9.8 頁面資料按需載入'
if marker not in text:
    raise RuntimeError('找不到 9.8 頁面資料按需載入')
section_start = text.index(marker)
next_header = text.find('\n# 十、', section_start)
if next_header < 0:
    raise RuntimeError('找不到第十章')
new_section = '''## 9.8 頁面資料按需載入

1. 登入階段只取得 Session、本人基本資料、角色權限、所屬群組、適用群組與首頁必要的訂餐開關；不得預載完整班表、簽到審核、訂餐統計或管理設定。
2. 第一次進入班表時，先讀 `scheduler_settings` 的正式週期設定，再以 `eight_week_start_date` 與今天計算今天所在的 56 天週期；首次畫面不得使用或相容舊的 `schedule_start_date` 瀏覽位置。
3. 確定八週起點後，單位目錄、人員目錄、班別、假別、加班設定、假日、人員排序與該八週含 7 日緩衝的班表資料平行讀取；同一首次載入不得再對同一可視區間補查第二次 `schedule_entries`。
4. 首頁已取得的角色／適用群組 bundle 在進入班表時直接沿用；班表只補載群組實體對照，不重複讀取相同權限 bundle。
5. 單位地址、GPS、固定 IP 與打卡開關只在管理員真正進入「單位設定」時載入，不列入班表首次載入。
6. 人員完整管理欄位只在真正進入「人員設定」時載入；共用班表人員目錄仍只提供班表需要的正式欄位。
7. 簽到簿只載入目前頁籤；預設個人記錄不預載簽到審核。訂餐今日、統計與設定各自於進入該頁籤時載入。
8. 同一登入階段已成功載入的頁面資料可在記憶體沿用；資料寫入後只失效或刷新相關資料範圍。登出或 Session 失效時清除全部頁面快取。
9. 按需載入是效能與資料最小化機制，不取代安全控制；RPC、RLS 與 Edge Function 仍必須驗證功能權限及適用群組。
'''
text = text[:section_start] + new_section + text[next_header:]
write(path, text)

# 7) 回歸測試：固定首次週期與單次班表載入契約。
test = '''const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("首次班表應以八週起算日決定今天所在週期且只查一次班表", () => {
  const webApi = read("src/renderer/web-api.js");
  const lazy = read("src/renderer/page-lazy-data.mjs");
  const loadStart = webApi.indexOf("async function loadState()");
  const loadEnd = webApi.indexOf("async function syncLeaveAndOvertimeCatalogs", loadStart);
  const loadBlock = webApi.slice(loadStart, loadEnd);

  assert.match(loadBlock, /const scheduleRange = getScheduleLoadRange\(settings\)/);
  assert.match(loadBlock, /const visibleStartDate = addDaysToDateString\(scheduleRange\.startDate, 7\)/);
  assert.match(loadBlock, /scheduleStartDate: visibleStartDate/);
  assert.doesNotMatch(loadBlock, /settings\.schedule_start_date/);
  assert.equal((loadBlock.match(/restSelect\("schedule_entries"/g) || []).length, 1);
  assert.doesNotMatch(loadBlock, /department-attendance-v2/);

  const ensureStart = lazy.indexOf("async function ensureSchedulePageData()");
  const ensureEnd = lazy.indexOf("document.body.addEventListener", ensureStart);
  const ensureBlock = lazy.slice(ensureStart, ensureEnd);
  assert.doesNotMatch(ensureBlock, /ensureVisibleScheduleLoaded/);
});

test("班表只補群組實體對照且單位打卡設定延後到單位設定", () => {
  const lazy = read("src/renderer/page-lazy-data.mjs");
  const department = read("src/renderer/renderer-settings-department.js");
  const webApi = read("src/renderer/web-api.js");

  assert.match(lazy, /get_group_entity_map_v1/);
  assert.match(lazy, /bundle: groupFeatureState\.bundle/);
  assert.match(department, /ensureDepartmentAttendanceSettingsLoaded/);
  assert.match(department, /getDepartmentAttendanceSettings/);
  assert.match(webApi, /async function getDepartmentAttendanceSettings\(\)/);
  assert.match(webApi, /getDepartmentAttendanceSettings,/);
});

test("規格書明定首次班表不相容舊瀏覽位置", () => {
  const spec = read("規格書.md");
  assert.match(spec, /首次畫面不得使用或相容舊的 `schedule_start_date` 瀏覽位置/);
  assert.match(spec, /同一首次載入不得再對同一可視區間補查第二次 `schedule_entries`/);
});
'''
write('tests/schedule-first-load-cycle.test.js', test)
