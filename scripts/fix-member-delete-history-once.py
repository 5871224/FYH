from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if new in text:
        return
    if old not in text:
        raise RuntimeError(f"找不到待替換內容：{path}")
    write(path, text.replace(old, new, 1))


def append_once(path: str, marker: str, content: str) -> None:
    text = read(path)
    if marker in text:
        return
    write(path, text.rstrip() + "\n\n" + content.strip() + "\n")


# 1. 全量儲存不得把未出現在目前畫面的人員改為停用。
replace_once(
    "src/renderer/web-api.js",
    '''    const profileMap = await ensureMemberProfiles(state);
    const memberCodes = (state.members || []).map((member) => member.code).filter(Boolean);
    if (memberCodes.length) {
      await restUpdate("set_employee", {
        employee_code: `not.${buildInFilter(memberCodes)}`
      }, {
        is_active: false
      }, {
        auth: true,
        prefer: "return=minimal"
      });
    }
    for (const member of state.members || []) {''',
    '''    const profileMap = await ensureMemberProfiles(state);
    for (const member of state.members || []) {'''
)

# 2. member-auth-admin 改用單一交易 RPC，歷史資料存在時回傳 409 與明細。
member_auth_path = "supabase/functions/member-auth-admin/index.ts"
member_auth = read(member_auth_path)
start = member_auth.index("async function countRows(ctx: any, table: string, column: string, value: string) {")
end = member_auth.index("console.assert(buildLoginEmail")
new_delete_block = '''async function deleteMember(ctx: any, body: any) {
  const employeeCode = String(body?.employeeCode || "").trim();
  const actorRole = normalizeRole(body?.actorRole);
  if (!employeeCode) throw new Error("請提供人員工號");

  const profile = await findProfileByCode(ctx, employeeCode);
  if (!profile?.id) return { ok: true, deleted: false, softDeleted: false };
  if (normalizeRole(profile.role) === "admin" && !hasAdminAccess(actorRole)) {
    throw new Error("只有管理員可以刪除管理員帳號");
  }
  if (normalizeRole(profile.role) === "admin" && await countEffectiveAdmins(ctx) <= 1) {
    throw new Error("系統必須保留至少一個有效管理員");
  }

  const { data, error } = await ctx.supabaseAdmin.rpc("delete_member_account_v4", {
    p_target_id: profile.id
  });
  if (error) throw error;

  const result = data || { ok: true, deleted: false, softDeleted: false };
  if (result?.blocked) {
    return new Response(JSON.stringify(result), {
      status: 409,
      headers: { "Content-Type": "application/json" }
    });
  }
  return { ...result, employeeCode };
}

'''
member_auth = member_auth[:start] + new_delete_block + member_auth[end:]
member_auth = member_auth.replace(
    '      if (body?.action === "delete_member") return Response.json(await deleteMember(ctx, body));',
    '''      if (body?.action === "delete_member") {
        const result = await deleteMember(ctx, body);
        return result instanceof Response ? result : Response.json(result);
      }'''
)
write(member_auth_path, member_auth)

# 3. 備援 member-delete-v2 同步使用相同 RPC 與 409 回應。
member_delete_path = "supabase/functions/member-delete-v2/index.ts"
member_delete = read(member_delete_path)
member_delete = member_delete.replace('rpc("delete_member_account_v3"', 'rpc("delete_member_account_v4"')
member_delete = member_delete.replace(
    '''  return {
    ...(result.data || { ok: true, deleted: false, softDeleted: false }),
    selfDelete,
    employeeCode: target.employee_code
  };''',
    '''  const payload = result.data || { ok: true, deleted: false, softDeleted: false };
  if (payload?.blocked) {
    return new Response(JSON.stringify(payload), {
      status: 409,
      headers: { "Content-Type": "application/json" }
    });
  }

  return {
    ...payload,
    selfDelete,
    employeeCode: target.employee_code
  };'''
)
member_delete = member_delete.replace(
    '''      return Response.json(await removeMember(ctx, await req.json()));''',
    '''      const result = await removeMember(ctx, await req.json());
      return result instanceof Response ? result : Response.json(result);'''
)
write(member_delete_path, member_delete)

# 4. 正式資料庫：列出歷史資料類型與筆數、禁止軟刪除、阻擋舊前端直接停用。
sql_section = r'''
-- ============================================================================================
-- 區段 25：人員刪除歷史保護與禁止隱性停用
-- ============================================================================================

begin;

create or replace function public.delete_member_account_v4(p_target_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_profile public.set_employee%rowtype;
  v_schedule_count bigint := 0;
  v_attendance_count bigint := 0;
  v_attendance_action_count bigint := 0;
  v_overtime_count bigint := 0;
  v_overtime_review_count bigint := 0;
  v_overtime_management_count bigint := 0;
  v_meal_count bigint := 0;
  v_settings_count bigint := 0;
  v_details text[] := array[]::text[];
begin
  select *
    into v_profile
    from public.set_employee
   where id = p_target_id
   for update;

  if not found then
    return jsonb_build_object(
      'ok', true,
      'deleted', false,
      'softDeleted', false,
      'blocked', false
    );
  end if;

  select count(*) into v_schedule_count
  from public.schedule_entries
  where member_id = p_target_id;

  select count(*) into v_attendance_count
  from public.attendance_records
  where user_id = p_target_id;

  select count(distinct action_log.id) into v_attendance_action_count
  from public.attendance_action_logs action_log
  left join public.attendance_records attendance_record
    on attendance_record.id = action_log.attendance_record_id
  where action_log.operator_user_id = p_target_id
     or attendance_record.user_id = p_target_id;

  select count(*) into v_overtime_count
  from public.attendance_overtime_requests
  where user_id = p_target_id;

  select count(distinct review_log.id) into v_overtime_review_count
  from public.overtime_review_logs review_log
  left join public.attendance_overtime_requests overtime_request
    on overtime_request.id = review_log.overtime_request_id
  where review_log.operator_user_id = p_target_id
     or overtime_request.user_id = p_target_id;

  select count(distinct overtime_request.id) into v_overtime_management_count
  from public.attendance_overtime_requests overtime_request
  where overtime_request.created_by_user_id = p_target_id
     or overtime_request.reviewed_by = p_target_id
     or overtime_request.deleted_by = p_target_id;

  select count(*) into v_meal_count
  from public.meal_orders
  where user_id = p_target_id;

  select
    (select count(*) from public.meal_settings where updated_by = p_target_id)
    +
    (select count(*) from public.set_departments where attendance_settings_updated_by = p_target_id)
  into v_settings_count;

  if v_schedule_count > 0 then
    v_details := array_append(v_details, format('班表資料 %s 筆', v_schedule_count));
  end if;
  if v_attendance_count > 0 then
    v_details := array_append(v_details, format('打卡資料 %s 筆', v_attendance_count));
  end if;
  if v_attendance_action_count > 0 then
    v_details := array_append(v_details, format('打卡異動紀錄 %s 筆', v_attendance_action_count));
  end if;
  if v_overtime_count > 0 then
    v_details := array_append(v_details, format('加班申請 %s 筆', v_overtime_count));
  end if;
  if v_overtime_review_count > 0 then
    v_details := array_append(v_details, format('加班審核紀錄 %s 筆', v_overtime_review_count));
  end if;
  if v_overtime_management_count > 0 then
    v_details := array_append(v_details, format('加班管理紀錄 %s 筆', v_overtime_management_count));
  end if;
  if v_meal_count > 0 then
    v_details := array_append(v_details, format('訂餐資料 %s 筆', v_meal_count));
  end if;
  if v_settings_count > 0 then
    v_details := array_append(v_details, format('系統設定異動 %s 筆', v_settings_count));
  end if;

  if cardinality(v_details) > 0 then
    return jsonb_build_object(
      'ok', false,
      'deleted', false,
      'softDeleted', false,
      'blocked', true,
      'code', 'MEMBER_HAS_HISTORY',
      'message', format(
        '無法刪除「%s」：已有%s。請保留人員資料；離職人員請填寫離職日。',
        v_profile.full_name,
        array_to_string(v_details, '、')
      ),
      'history', jsonb_build_object(
        'schedule', v_schedule_count,
        'attendance', v_attendance_count,
        'attendanceActions', v_attendance_action_count,
        'overtimeRequests', v_overtime_count,
        'overtimeReviews', v_overtime_review_count,
        'overtimeManagement', v_overtime_management_count,
        'mealOrders', v_meal_count,
        'settings', v_settings_count
      )
    );
  end if;

  delete from auth.users where id = p_target_id;

  if exists (select 1 from public.set_employee where id = p_target_id) then
    raise exception '登入帳號刪除後，人員資料未同步刪除';
  end if;

  return jsonb_build_object(
    'ok', true,
    'deleted', true,
    'softDeleted', false,
    'blocked', false,
    'employeeCode', v_profile.employee_code
  );
end;
$$;

create or replace function public.delete_member_account_v3(p_target_id uuid)
returns jsonb
language sql
security definer
set search_path = public, auth, pg_temp
as $$
  select public.delete_member_account_v4(p_target_id)
$$;

create or replace function public.block_direct_member_deactivation_v2()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if old.is_active is true
     and new.is_active is false
     and auth.role() = 'authenticated' then
    raise exception '人員不可由前端直接改為停用，請使用正式刪除檢查流程'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists block_direct_member_deactivation_v2 on public.set_employee;
create trigger block_direct_member_deactivation_v2
before update of is_active on public.set_employee
for each row execute function public.block_direct_member_deactivation_v2();

revoke all on function public.delete_member_account_v4(uuid) from public, anon, authenticated;
revoke all on function public.delete_member_account_v3(uuid) from public, anon, authenticated;
revoke all on function public.block_direct_member_deactivation_v2() from public, anon, authenticated;
grant execute on function public.delete_member_account_v4(uuid) to service_role;
grant execute on function public.delete_member_account_v3(uuid) to service_role;

commit;
'''
append_once("supabase/002_current_updates.sql", "區段 25：人員刪除歷史保護與禁止隱性停用", sql_section)
append_once("supabase/001_current_schema.sql", "人員刪除歷史保護與禁止隱性停用", sql_section.replace("區段 25：", ""))

# 5. 正式規格同步。
replace_once(
    "規格書.md",
    '''1. 有班表、打卡、打卡異動、加班、審核或訂餐歷史時保留人員歷史，後端拒絕刪除。
2. 可刪除時，Supabase Auth 與 `set_employee` 必須在同一交易一致完成。
3. 系統永遠保留至少一位有效管理員。
4. 主管或管理員刪除自己時需再次驗證目前密碼，完成後立即登出。''',
    '''1. 有班表、打卡、打卡異動、加班、審核、訂餐或系統設定異動歷史時，後端拒絕刪除，提示所有非零的資料類型與筆數。
2. 刪除被歷史資料阻擋時，人員資料與登入帳號保持原狀，不得改為停用、不得從管理名錄消失，也不得刪除其既有班表。
3. 全量儲存或畫面名錄缺少某人員時，不得據此把該人員改為停用；`is_active` 不作為刪除替代狀態。
4. 確認完全沒有任何歷史關聯時，Supabase Auth 與 `set_employee` 必須在同一交易一致完成刪除。
5. 系統永遠保留至少一位有效管理員。
6. 主管或管理員刪除自己時需再次驗證目前密碼，完成後立即登出。
7. 人員離職應填寫離職日並保留歷史，不使用刪除或停用代替離職。'''
)

# 6. 防回歸檢查。
check_path = "scripts/check-v2-final.js"
check = read(check_path)
check = check.replace(
    '  "supabase/functions/member-delete-v2/index.ts",',
    '  "supabase/functions/member-delete-v2/index.ts",\n  "supabase/functions/member-auth-admin/index.ts",'
)
check = check.replace(
    'assert(memberDelete.includes(\'rpc("delete_member_account_v3"\'), "帳號刪除未使用交易 RPC");',
    'assert(memberDelete.includes(\'rpc("delete_member_account_v4"\'), "帳號刪除未使用歷史保護交易 RPC");'
)
check = check.replace(
    'assert(!memberDelete.includes(\'.from("set_employee").delete()\'), "仍存在前端直接刪除人員資料的不同步流程");',
    '''assert(!memberDelete.includes('.from("set_employee").delete()'), "仍存在前端直接刪除人員資料的不同步流程");
const memberAuthAdmin = read("supabase/functions/member-auth-admin/index.ts");
assert(memberAuthAdmin.includes('rpc("delete_member_account_v4"'), "正式人員管理端點未使用歷史保護交易 RPC");
assert(memberAuthAdmin.includes("status: 409") && memberAuthAdmin.includes("result?.blocked"), "已有歷史資料時未回傳阻擋狀態");
assert(!memberAuthAdmin.includes("update({ is_active: false })"), "人員刪除仍會改成停用狀態");
assert(databaseUpdates.includes("MEMBER_HAS_HISTORY"), "人員刪除缺少穩定歷史阻擋錯誤碼");
assert(databaseUpdates.includes("block_direct_member_deactivation_v2"), "資料庫未阻擋舊前端直接停用人員");'''
)
check = check.replace(
    'assert(sourceWebApi.includes(\'restRpc("get_schedule_export_rows_v2"\') && sourceWebApi.includes("loadScheduleExportRows"), "前端缺少班表正式匯出資料查詢");',
    '''assert(sourceWebApi.includes('restRpc("get_schedule_export_rows_v2"') && sourceWebApi.includes("loadScheduleExportRows"), "前端缺少班表正式匯出資料查詢");
const saveStateSource = sourceWebApi.slice(sourceWebApi.indexOf("async function saveState(state)"), sourceWebApi.indexOf("async function syncCatalogs(state)"));
assert(!saveStateSource.includes("is_active: false"), "全量儲存仍可能把未出現在畫面的人員改為停用");'''
)
write(check_path, check)

print("人員刪除歷史保護修正完成")
