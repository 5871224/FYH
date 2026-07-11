from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def write(path, content):
    (ROOT / path).write_text(content, encoding="utf-8")


def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f"找不到替換位置：{label}")
    return text.replace(old, new, 1)


sql_block = r'''


-- ============================================================================================
-- 區段 24：單位安全寫入與班表匯出正式資料
-- ============================================================================================

begin;

create or replace function public.save_departments_general_v2(p_departments jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  item jsonb;
  v_id uuid;
  v_name text;
  v_start_date date;
  v_end_date date;
  v_hidden boolean;
  v_sort_order integer;
begin
  if not public.is_manager(auth.uid()) then
    raise exception '此功能限主管或管理員使用' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_departments, '[]'::jsonb)) <> 'array' then
    raise exception '單位資料格式錯誤';
  end if;

  for item in select value from jsonb_array_elements(coalesce(p_departments, '[]'::jsonb)) loop
    begin
      v_id := nullif(btrim(item->>'id'), '')::uuid;
      v_start_date := nullif(btrim(item->>'start_date'), '')::date;
      v_end_date := nullif(btrim(item->>'end_date'), '')::date;
    exception when invalid_text_representation or datetime_field_overflow then
      raise exception '單位識別碼或日期格式錯誤';
    end;
    v_name := btrim(coalesce(item->>'name', ''));
    v_hidden := coalesce((item->>'hidden_from_schedule')::boolean, false);
    v_sort_order := greatest(0, coalesce((item->>'sort_order')::integer, 0));

    if v_id is null or v_name = '' then
      raise exception '單位名稱與識別碼不可空白';
    end if;
    if length(v_name) > 12 then
      raise exception '單位名稱不可超過 12 個字';
    end if;
    if v_start_date is not null and v_end_date is not null and v_start_date > v_end_date then
      raise exception '單位開始日期不得晚於結束日期';
    end if;

    insert into public.set_departments (
      id, name, start_date, end_date, hidden_from_schedule, sort_order
    ) values (
      v_id, v_name, v_start_date, v_end_date, v_hidden, v_sort_order
    )
    on conflict (id) do update set
      name = excluded.name,
      start_date = excluded.start_date,
      end_date = excluded.end_date,
      hidden_from_schedule = excluded.hidden_from_schedule,
      sort_order = excluded.sort_order,
      updated_at = now();
  end loop;
end;
$$;

create or replace function public.delete_department_general_v2(p_department_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if not public.is_manager(auth.uid()) then
    raise exception '此功能限主管或管理員使用' using errcode = '42501';
  end if;
  if p_department_id is null then
    raise exception '缺少單位識別碼';
  end if;
  if exists (select 1 from public.set_employee where home_department_id = p_department_id) then
    raise exception '這個單位仍有人員，請先將人員移轉到其他單位';
  end if;
  if exists (select 1 from public.set_shift where applicable_department_id = p_department_id) then
    raise exception '這個單位仍有班別使用，請先修改相關班別';
  end if;

  begin
    delete from public.set_departments where id = p_department_id;
  exception when foreign_key_violation then
    raise exception '這個單位已有班表、打卡或訂餐歷史，為保留歷史關聯不可刪除';
  end;
end;
$$;

create or replace function public.get_schedule_export_rows_v2(
  p_start_date date,
  p_end_date date
)
returns table (
  member_id uuid,
  employee_code text,
  employee_name text,
  home_department_id uuid,
  department_name text,
  pay_by_day boolean,
  work_date date,
  leave_type_id uuid,
  leave_code text,
  leave_name text,
  leave_all_day boolean,
  leave_start_time time,
  leave_end_time time,
  leave_reason text,
  overtime_type_id uuid,
  overtime_name text,
  overtime_start_time time,
  overtime_end_time time,
  overtime_use_rest_1 boolean,
  overtime_rest_1_start_time time,
  overtime_rest_1_end_time time,
  overtime_use_rest_2 boolean,
  overtime_rest_2_start_time time,
  overtime_rest_2_end_time time,
  overtime_reason text
)
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
begin
  if not public.is_manager(auth.uid()) then
    raise exception '此功能限主管或管理員使用' using errcode = '42501';
  end if;
  if p_start_date is null or p_end_date is null or p_start_date > p_end_date then
    raise exception '匯出日期範圍不正確';
  end if;
  if p_end_date - p_start_date > 366 then
    raise exception '單次匯出期間不可超過 366 天';
  end if;

  return query
  select
    schedule.member_id,
    employee.employee_code,
    employee.full_name,
    employee.home_department_id,
    department.name,
    employee.pay_by_day,
    schedule.work_date,
    schedule.leave_type_id,
    leave_type.code,
    leave_type.name,
    schedule.leave_all_day,
    schedule.leave_start_time,
    schedule.leave_end_time,
    schedule.leave_reason,
    schedule.overtime_type_id,
    overtime_type.name,
    schedule.overtime_start_time,
    schedule.overtime_end_time,
    schedule.overtime_use_rest_1,
    schedule.overtime_rest_1_start_time,
    schedule.overtime_rest_1_end_time,
    schedule.overtime_use_rest_2,
    schedule.overtime_rest_2_start_time,
    schedule.overtime_rest_2_end_time,
    schedule.overtime_reason
  from public.schedule_entries schedule
  join public.set_employee employee on employee.id = schedule.member_id
  left join public.set_departments department on department.id = employee.home_department_id
  left join public.set_leave leave_type on leave_type.id = schedule.leave_type_id
  left join public.set_overtime overtime_type on overtime_type.id = schedule.overtime_type_id
  where schedule.work_date between p_start_date and p_end_date
    and (schedule.leave_type_id is not null or schedule.overtime_type_id is not null)
  order by schedule.work_date, employee.sort_order, employee.full_name, employee.id;
end;
$$;

revoke all on function public.save_departments_general_v2(jsonb) from public, anon;
revoke all on function public.delete_department_general_v2(uuid) from public, anon;
revoke all on function public.get_schedule_export_rows_v2(date, date) from public, anon;
grant execute on function public.save_departments_general_v2(jsonb) to authenticated, service_role;
grant execute on function public.delete_department_general_v2(uuid) to authenticated, service_role;
grant execute on function public.get_schedule_export_rows_v2(date, date) to authenticated, service_role;

commit;
'''

for sql_path in ["supabase/001_current_schema.sql", "supabase/002_current_updates.sql"]:
    sql = read(sql_path).rstrip()
    if "save_departments_general_v2" not in sql:
        sql += sql_block
        write(sql_path, sql + "\n")

web_path = "src/renderer/web-api.js"
web = read(web_path)

old = '''  async function saveDepartmentAttendanceSettings(departments) {
    if (!hasAdminAccess(currentProfile?.role)) {
      return;
    }
    await restRpc("save_department_attendance_fields_bulk", {
      settings: (departments || []).map((department) => ({
        department_id: department.id,
        address: department.address || "",
        latitude: department.latitude === "" || department.latitude === null || department.latitude === undefined ? null : Number(department.latitude),
        longitude: department.longitude === "" || department.longitude === null || department.longitude === undefined ? null : Number(department.longitude),
        attendance_enabled: Boolean(department.attendanceEnabled),
        public_ip: department.publicIp || ""
      }))
    }, {
      auth: true,
      prefer: "return=minimal"
    });
  }
'''
new = old + '''
  async function saveDepartmentGeneralSettings(departments) {
    ensureManager();
    await restRpc("save_departments_general_v2", {
      p_departments: (departments || []).map((department, index) => ({
        ...mapDepartmentWriteRow(department, Number.isInteger(department.sortOrder) ? department.sortOrder : index)
      }))
    }, {
      auth: true,
      prefer: "return=minimal"
    });
  }

  async function loadScheduleExportRows(startDate, endDate) {
    ensureManager();
    const normalizedStart = nullableDate(startDate);
    const normalizedEnd = nullableDate(endDate);
    if (!normalizedStart || !normalizedEnd || normalizedStart > normalizedEnd) {
      throw new Error("匯出日期範圍不正確");
    }
    return await restRpc("get_schedule_export_rows_v2", {
      p_start_date: normalizedStart,
      p_end_date: normalizedEnd
    }, { auth: true }) || [];
  }
'''
web = replace_once(web, old, new, "新增單位安全 RPC 與匯出查詢")

old = '''    if (departments.length) {
      await restInsert("set_departments", departments.map((department, index) => mapDepartmentWriteRow(department, index)), {
        auth: true,
        onConflict: "id",
        prefer: "resolution=merge-duplicates,return=minimal"
      });
      await saveDepartmentAttendanceSettings(departments);
    }
    await deleteRowsNotIn("set_departments", departments.map((department) => department.id));
    const departmentMap = await fetchRowsById("set_departments");
'''
new = '''    if (departments.length) {
      await saveDepartmentGeneralSettings(departments.map((department, index) => ({ ...department, sortOrder: index })));
      await saveDepartmentAttendanceSettings(departments);
    }
    const departmentMap = await fetchRowsById("set_departments");
'''
web = replace_once(web, old, new, "全量儲存單位改用安全 RPC")

old = '''  async function saveDepartmentItem(department, sortOrder = 0) {
    ensureManager();
    await restInsert("set_departments", [mapDepartmentWriteRow(department, sortOrder)], {
      auth: true,
      onConflict: "id",
      prefer: "resolution=merge-duplicates,return=minimal"
    });
    await saveDepartmentAttendanceSettings([department]);
    return { ok: true };
  }
'''
new = '''  async function saveDepartmentItem(department, sortOrder = 0) {
    ensureManager();
    await saveDepartmentGeneralSettings([{ ...department, sortOrder }]);
    await saveDepartmentAttendanceSettings([department]);
    return { ok: true };
  }

  async function deleteDepartmentItem(departmentId) {
    ensureManager();
    await restRpc("delete_department_general_v2", {
      p_department_id: String(departmentId || "").trim()
    }, {
      auth: true,
      prefer: "return=minimal"
    });
    return { ok: true };
  }
'''
web = replace_once(web, old, new, "單筆單位儲存與刪除")

web = replace_once(web, '''    loadEmployeeAdminDirectory,
    loadScheduleEntries,
    saveState,
''', '''    loadEmployeeAdminDirectory,
    loadScheduleEntries,
    loadScheduleExportRows,
    saveState,
''', "公開匯出查詢 API")
web = replace_once(web, '''    syncCatalogs,
    saveDepartmentItem,
    saveShiftItem,
''', '''    syncCatalogs,
    saveDepartmentItem,
    deleteDepartmentItem,
    saveShiftItem,
''', "公開單位刪除 API")
write(web_path, web)

renderer_path = "src/renderer/renderer.js"
renderer = read(renderer_path)
renderer = replace_once(renderer, '''  try {
    await window.schedulerApi.saveDepartmentItem(payload, Math.max(0, sortOrder));
  } catch (error) {
    setSaveStatus(`單位儲存失敗：${error.message}`);
    return;
  }
''', '''  try {
    await window.schedulerApi.saveDepartmentItem(payload, Math.max(0, sortOrder));
  } catch (error) {
    const message = formatSchedulerError(error, "單位儲存失敗");
    setSaveStatus(`單位儲存失敗：${message}`);
    showInfoMessage(`單位儲存失敗：${message}`);
    return;
  }
''', "單位儲存錯誤可見")
renderer = replace_once(renderer, '''  const confirmed = await confirmAction("確定要刪除這個單位嗎？");
  if (!confirmed) {
    return;
  }
  state.departments = state.departments.filter((department) => department.id !== departmentId);
''', '''  const confirmed = await confirmAction("確定要刪除這個單位嗎？");
  if (!confirmed) {
    return;
  }
  try {
    await window.schedulerApi.deleteDepartmentItem(departmentId);
  } catch (error) {
    showInfoMessage(formatSchedulerError(error, "單位刪除失敗"));
    return;
  }
  state.departments = state.departments.filter((department) => department.id !== departmentId);
''', "單位刪除先寫後端")
renderer = replace_once(renderer, '''    if (target.dataset.editDepartment) openDepartmentForm("edit", target.dataset.editDepartment);
    if (target.dataset.saveDepartment) await saveDepartment(target.dataset.saveDepartment);
    if (target.dataset.deleteDepartment) {
''', '''    if (target.dataset.editDepartment) openDepartmentForm("edit", target.dataset.editDepartment);
    if (target.dataset.saveDepartment) {
      await saveDepartment(target.dataset.saveDepartment);
      return;
    }
    if (target.dataset.deleteDepartment) {
''', "單位儲存事件結束")
write(renderer_path, renderer)

exporter_path = "src/renderer/browser-exporter.js"
exporter = read(exporter_path)
insert_after = '''  function isMemberActiveOnDate(member, year, month, day) {
    const date = formatIsoDate(year, month, day);
    if (member.hireDate && date < member.hireDate) {
      return false;
    }
    if (member.leaveDate && date > member.leaveDate) {
      return false;
    }
    return true;
  }
'''
addition = insert_after + '''
  function hasOfficialScheduleExportRows(payload) {
    return Array.isArray(payload?.exportRows);
  }

  function compactIsoDate(value) {
    return String(value || "").replaceAll("-", "");
  }

  function getOfficialSapLeaveRows(payload) {
    const sapCodeMap = new Map([["0036", "OFF"], ["0047", "REST"], ["休息日", "REST"], ["休假", "REST"], ["例假", "OFF"]]);
    return (payload.exportRows || []).flatMap((row) => {
      if (row.pay_by_day || !row.leave_type_id) return [];
      const sapCode = sapCodeMap.get(row.leave_code) || sapCodeMap.get(row.leave_name);
      if (!sapCode) return [];
      const date = compactIsoDate(row.work_date);
      return [[row.employee_name || "", row.employee_code || "", date, date, sapCode]];
    });
  }

  function getOfficialOvertimeRows(payload) {
    return (payload.exportRows || []).flatMap((row) => {
      if (!row.overtime_type_id) return [];
      return [[
        row.employee_code || "",
        compactIsoDate(row.work_date),
        formatCompactTime(row.overtime_start_time),
        formatCompactTime(row.overtime_end_time),
        0,
        1,
        row.overtime_use_rest_1 ? formatCompactTime(row.overtime_rest_1_start_time) : "",
        row.overtime_use_rest_1 ? formatCompactTime(row.overtime_rest_1_end_time) : "",
        row.overtime_use_rest_1 ? 0 : "",
        row.overtime_use_rest_2 ? formatCompactTime(row.overtime_rest_2_start_time) : "",
        row.overtime_use_rest_2 ? formatCompactTime(row.overtime_rest_2_end_time) : "",
        row.overtime_use_rest_2 ? 0 : ""
      ]];
    });
  }

  function getOfficialLeaveRows(payload) {
    const excludedLeaveCodes = new Set(["0036", "0047"]);
    const hiddenDepartmentIds = new Set((payload.state?.departments || []).filter((department) => department?.hiddenFromSchedule).map((department) => department.id));
    return (payload.exportRows || []).flatMap((row) => {
      if (!row.leave_type_id || excludedLeaveCodes.has(row.leave_code) || hiddenDepartmentIds.has(row.home_department_id)) return [];
      const date = compactIsoDate(row.work_date);
      const allDay = row.leave_all_day !== false;
      return [[
        row.employee_code || "",
        date,
        date,
        allDay ? "" : formatCompactTime(row.leave_start_time),
        allDay ? "" : formatCompactTime(row.leave_end_time),
        row.leave_code || "",
        row.leave_reason || row.leave_name || ""
      ]];
    });
  }
'''
exporter = replace_once(exporter, insert_after, addition, "正式匯出資料轉換 helper")
exporter = replace_once(exporter, '''  function getSapLeaveExportRows(payload) {
    const { state, year, month } = payload;
''', '''  function getSapLeaveExportRows(payload) {
    if (hasOfficialScheduleExportRows(payload)) {
      return getOfficialSapLeaveRows(payload);
    }
    const { state, year, month } = payload;
''', "SAP 匯出正式資料")
exporter = replace_once(exporter, '''  function getOvertimeExportRows(payload) {
    const { state, year, month } = payload;
''', '''  function getOvertimeExportRows(payload) {
    if (hasOfficialScheduleExportRows(payload)) {
      return getOfficialOvertimeRows(payload);
    }
    const { state, year, month } = payload;
''', "加班匯出正式資料")
exporter = replace_once(exporter, '''  function getLeaveExportRows(payload) {
    const { state, year, month } = payload;
''', '''  function getLeaveExportRows(payload) {
    if (hasOfficialScheduleExportRows(payload)) {
      return getOfficialLeaveRows(payload);
    }
    const { state, year, month } = payload;
''', "請假匯出正式資料")
old = '''    if (normalizeImportedDate("2025/01/02") !== "2025-01-02") {
      throw new Error("browser exporter date self-check failed");
    }
'''
new = old + '''    const officialPayload = {
      state: { departments: [] },
      exportRows: [{
        employee_code: "SELF_CHECK",
        employee_name: "Self Check",
        home_department_id: null,
        pay_by_day: false,
        work_date: "2026-07-17",
        leave_type_id: "leave-id",
        leave_code: "0010",
        leave_name: "事假",
        leave_all_day: true,
        overtime_type_id: "overtime-id",
        overtime_start_time: "18:00:00",
        overtime_end_time: "20:00:00",
        overtime_use_rest_1: false,
        overtime_use_rest_2: false
      }]
    };
    if (getLeaveExportRows(officialPayload).length !== 1 || getOvertimeExportRows(officialPayload).length !== 1) {
      throw new Error("browser exporter official rows self-check failed");
    }
'''
exporter = replace_once(exporter, old, new, "匯出正式資料 self check")
write(exporter_path, exporter)

live_path = "src/renderer/v2-live-report-filters.js"
live = read(live_path)
live = replace_once(live, '''  function getPreviousPeriodDefaults() {
    const today = parseIsoDate(typeof getTodayDateString === "function" ? getTodayDateString() : "") || new Date();
''', '''  function getPreviousPeriodDefaults() {
    if (typeof getVisibleDateRange === "function") {
      const visible = getVisibleDateRange();
      if (parseIsoDate(visible?.startDate) && parseIsoDate(visible?.endDate)) {
        return { startDay: 1, startDate: visible.startDate, endDate: visible.endDate };
      }
    }
    const today = parseIsoDate(typeof getTodayDateString === "function" ? getTodayDateString() : "") || new Date();
''', "匯出預設目前班表範圍")
live = replace_once(live, '''  function aggregateRows(payload, original, dateColumnIndex) {
    if (!payload?.startDate || !payload?.endDate || typeof original !== "function") {
''', '''  function aggregateRows(payload, original, dateColumnIndex) {
    if (Array.isArray(payload?.exportRows) && typeof original === "function") {
      return original(payload);
    }
    if (!payload?.startDate || !payload?.endDate || typeof original !== "function") {
''', "正式匯出列避免跨月重複")
live = replace_once(live, '''      await ensureScheduleRangeLoaded(startDate, endDate);
      const result = await api[method]({
        state,
        startDate,
        endDate,
        year: start.getFullYear(),
        month: start.getMonth()
      });
''', '''      const exportRows = typeof api.loadScheduleExportRows === "function"
        ? await api.loadScheduleExportRows(startDate, endDate)
        : (await ensureScheduleRangeLoaded(startDate, endDate), null);
      const result = await api[method]({
        state,
        startDate,
        endDate,
        exportRows,
        year: start.getFullYear(),
        month: start.getMonth()
      });
''', "匯出改讀正式後端資料")
write(live_path, live)

spec_path = "規格書.md"
spec = read(spec_path)
spec = replace_once(spec, '''15. 匯出前會重新載入選定期間的正式班表資料，不受目前班表畫面顯示的八週範圍限制。
16. 匯出檔名包含選定的開始日期與結束日期。
''', '''15. 日期範圍預設帶入目前畫面顯示的八週起訖日，使用者可再自行調整。
16. 匯出前由受保護的後端查詢直接讀取選定期間的正式 `schedule_entries`，並關聯人員、假別與加班設定；不得只依賴目前畫面的記憶體資料或目前在職名錄。
17. 已離職、停用或不在目前班表人員列，但在選定期間具有正式班表資料的人員，仍須依歷史資料匯出。
18. 匯出檔名包含選定的開始日期與結束日期。
''', "班表匯出正式資料規格")
spec = replace_once(spec, '''2. 一個單位保存一組目前打卡設定。
3. 主管寫入一般欄位時，前端與後端會排除打卡敏感欄位。
''', '''2. 一個單位保存一組目前打卡設定。
3. 主管寫入一般欄位時，前端與後端會排除打卡敏感欄位。
4. 單位新增、修改與排序使用受保護的單位一般欄位 RPC，不依賴對 `set_departments` 主表的直接讀寫權限；儲存失敗時必須在目前視窗顯示明確錯誤，不得只寫入不可見狀態。
5. 單位刪除由後端再次檢查人員、班別、班表、打卡與訂餐歷史關聯，有引用時拒絕刪除並顯示原因。
''', "單位安全儲存規格")
write(spec_path, spec)

check_path = "scripts/check-v2-final.js"
check = read(check_path)
needle = '''assert(hardenedAccess.includes("drop function if exists public.get_employee_directory_v2"), "混合用途舊人員名錄 RPC 尚未移除");
'''
check = replace_once(check, needle, needle + '''assert(hardenedAccess.includes("save_departments_general_v2") && hardenedAccess.includes("delete_department_general_v2"), "單位一般欄位安全寫入 RPC 缺失");
assert(hardenedAccess.includes("get_schedule_export_rows_v2"), "班表匯出正式資料 RPC 缺失");
''', "SQL RPC 防回歸")
needle = '''assert(sourceWebApi.includes("async function loadEmployeeAdminDirectory()"), "前端缺少管理名錄延遲載入介面");
'''
check = replace_once(check, needle, needle + '''assert(sourceWebApi.includes('restRpc("save_departments_general_v2"') && sourceWebApi.includes('restRpc("delete_department_general_v2"'), "單位新增修改刪除未使用安全 RPC");
assert(!sourceWebApi.includes('restInsert("set_departments"'), "前端仍直接 upsert 單位主表");
assert(sourceWebApi.includes('restRpc("get_schedule_export_rows_v2"') && sourceWebApi.includes("loadScheduleExportRows"), "前端缺少班表正式匯出資料查詢");
''', "前端單位與匯出防回歸")
needle = '''assert(sourceMeal.includes('addEventListener("beforeinput"'), "訂餐數量未在輸入前拒絕小數或負數");
'''
check = replace_once(check, needle, '''const sourceExporter = read("src/renderer/browser-exporter.js");
const sourceLiveReports = read("src/renderer/v2-live-report-filters.js");
assert(sourceExporter.includes("getOfficialLeaveRows") && sourceExporter.includes("getOfficialOvertimeRows"), "請假或加班匯出未使用正式後端資料列");
assert(sourceLiveReports.includes("api.loadScheduleExportRows") && sourceLiveReports.includes("exportRows"), "期間匯出仍只依賴畫面班表資料");
assert(sourceLiveReports.includes("getVisibleDateRange"), "匯出期間未預設目前八週班表範圍");

''' + needle, "匯出防回歸")
needle = '''assert(authoritativeSpec.includes("管理名錄採依頁面延遲載入"), "正式規格書缺少管理名錄延遲載入規則");
'''
check = replace_once(check, needle, needle + '''assert(authoritativeSpec.includes("不得只依賴目前畫面的記憶體資料") && authoritativeSpec.includes("已離職、停用"), "正式規格書缺少班表歷史匯出規則");
assert(authoritativeSpec.includes("單位一般欄位 RPC") && authoritativeSpec.includes("不可見狀態"), "正式規格書缺少單位安全儲存與錯誤提示規則");
''', "規格防回歸")
write(check_path, check)

print("department save and schedule export fixes prepared")
