from pathlib import Path

path = Path('scripts/tmp_access_control_v2.py')
text = path.read_text(encoding='utf-8')

text = text.replace(
    '    sql = re.sub(r"\\baccess_role_groups\\b", "access_role_group_permissions", sql)\n    sql = sql.replace("idx_access_role_groups_group", "idx_access_role_group_permissions_group")\n',
    '    sql = sql.replace("idx_access_role_groups_group", "idx_access_role_group_permissions_group")\n'
)

text = text.replace(
    r'r"create table if not exists public\.access_roles \([\s\S]*?\n\);\n\ncreate table if not exists public\.access_role_group_permissions \([\s\S]*?\n\);"',
    r'r"create table if not exists public\.access_roles \([\s\S]*?\n\);\n\ncreate table if not exists public\.access_role_groups \([\s\S]*?\n\);"'
)
text = text.replace(
    r'r"insert into public\.access_role_group_permissions\(role_id,group_id\)[\s\S]*?on conflict do nothing;"',
    r'r"insert into public\.access_role_groups\(role_id,group_id\)[\s\S]*?on conflict do nothing;"'
)

text = text.replace(
    "  name text not null unique,\n  common_permissions text[] not null default '{}',\n  is_system boolean not null default false,",
    "  name text not null unique,\n  name_vi text,\n  common_permissions text[] not null default '{}',\n  is_system boolean not null default false,\n  sort_order integer not null default 1000000,"
)

old = '''    # No old permission names survive in runtime SQL. Migration strings above are inside dynamic SQL only.\n    sql = re.sub(r"'permission_settings'", "'settings'", sql)\n    sql = re.sub(r"'group_settings'", "'settings'", sql)\n    sql = re.sub(r"'member_settings'", "'schedule_manage'", sql)\n'''
new = '''    # Protect the one-time legacy-data conversion while runtime SQL is rewritten to the latest model.\n    migration_match = re.search(\n        r"-- 一次性資料轉換：[\\s\\S]*?drop table if exists public\\.access_role_groups;",\n        sql,\n    )\n    if not migration_match:\n        raise RuntimeError("access permission data migration block not found")\n    legacy_migration = migration_match.group(0)\n    migration_placeholder = "-- __ACCESS_CONTROL_V2_DATA_MIGRATION__"\n    sql = sql[:migration_match.start()] + migration_placeholder + sql[migration_match.end():]\n\n    sql = re.sub(r"'permission_settings'", "'settings'", sql)\n    sql = re.sub(r"'group_settings'", "'settings'", sql)\n    sql = re.sub(r"'member_settings'", "'schedule_manage'", sql)\n    sql = re.sub(r"\\baccess_role_groups\\b", "access_role_group_permissions", sql)\n    sql = sql.replace(migration_placeholder, legacy_migration)\n'''
if old not in text:
    raise SystemExit('permission rewrite block not found')
text = text.replace(old, new)

# Replace the employee-role protection trigger as one coherent v2 function.
# This avoids retaining rowtype references to the removed access_roles.permissions
# column and enforces schedule_manage on the concrete old/new member groups.
needle = '    write(file, sql)\n\n\ndef transform_runtime():'
if needle not in text:
    raise SystemExit('transform_sql tail not found')
trigger_patch = r'''    employee_role_guard = r''' + "'''" + r'''create or replace function public.protect_employee_role_changes()
returns trigger language plpgsql security definer set search_path=public,pg_catalog as $$
declare
  v_new_role public.access_roles%rowtype;
  v_old_role public.access_roles%rowtype;
  v_actor_can_settings boolean:=false;
  v_today date:=(timezone('Asia/Taipei',now()))::date;
  v_old_privileged boolean:=false;
  v_new_privileged boolean:=false;
begin
  select * into v_new_role from public.access_roles where id=new.access_role_id;
  if not found then raise exception '找不到權限角色'; end if;

  if tg_op='UPDATE' then
    select * into v_old_role from public.access_roles where id=old.access_role_id;
    v_old_privileged:=old.deleted_at is null and v_old_role.id is not null
      and 'settings'=any(coalesce(v_old_role.common_permissions,'{}'::text[]))
      and public.is_employee_account_effective(old.hire_date,old.leave_date,v_today);
    v_new_privileged:=new.deleted_at is null
      and 'settings'=any(coalesce(v_new_role.common_permissions,'{}'::text[]))
      and public.is_employee_account_effective(new.hire_date,new.leave_date,v_today);
    if v_old_privileged and not v_new_privileged and not exists(
      select 1 from public.set_employee other_employee
      join public.access_roles other_role on other_role.id=other_employee.access_role_id
      where other_employee.id<>old.id and other_employee.deleted_at is null
        and 'settings'=any(coalesce(other_role.common_permissions,'{}'::text[]))
        and public.is_employee_account_effective(other_employee.hire_date,other_employee.leave_date,v_today)
    ) then raise exception '系統必須保留至少一個有效的權限管理帳號' using errcode='23514'; end if;
  end if;

  if (select auth.uid()) is not null and (select auth.role())<>'service_role'
     and coalesce(current_setting('fyh.group_delete',true),'')<>'on' then
    if tg_op='UPDATE' and (old.group_id is null or not public.has_group_permission((select auth.uid()),old.group_id,'schedule_manage')) then
      raise exception '沒有管理人員原群組的權限' using errcode='42501';
    end if;
    if new.group_id is null or not public.has_group_permission((select auth.uid()),new.group_id,'schedule_manage') then
      raise exception '沒有管理人員所屬群組的權限' using errcode='42501';
    end if;
    if new.home_department_id is null or not exists(
      select 1 from public.set_departments department
      where department.id=new.home_department_id and department.group_id=new.group_id and department.deleted_at is null
    ) then raise exception '所屬單位不在所選群組'; end if;
    if exists(
      select 1 from unnest(coalesce(new.schedule_shift_ids,'{}'::uuid[])) shift_id
      where not exists(
        select 1 from public.set_shift shift
        where shift.id=shift_id and shift.group_id=new.group_id and shift.deleted_at is null
      )
    ) then raise exception '排班班別不在人員所屬群組'; end if;
    if tg_op='UPDATE' and new.group_id is distinct from old.group_id then
      perform public.validate_member_group_change_v1(old.employee_code,new.group_id);
    end if;

    v_actor_can_settings:=public.has_common_permission((select auth.uid()),'settings');
    if not v_actor_can_settings then
      if tg_op='UPDATE' and new.access_role_id is distinct from old.access_role_id then
        raise exception '沒有變更權限角色的權限' using errcode='42501';
      end if;
      if tg_op='INSERT' and (
        cardinality(coalesce(v_new_role.common_permissions,'{}'::text[]))>0
        or exists(
          select 1 from public.access_role_group_permissions role_group
          where role_group.role_id=v_new_role.id
            and coalesce(role_group.permissions,'{}'::text[]) && array['schedule_manage','department_settings','attendance_review','meal_admin']::text[]
        )
      ) then raise exception '沒有指派管理權限角色的權限' using errcode='42501'; end if;
    end if;
  end if;
  return new;
end $$;''' + "'''" + r'''
    sql = replace_sql_function(sql, "protect_employee_role_changes", employee_role_guard)
    write(file, sql)


def transform_runtime():'''
text = text.replace(needle, trigger_patch, 1)

# app-config.js is outside the generated renderer bundle. Move its print guard
# onto the canonical canEditSchedule() capability instead of the retired helpers.
needle = '        path.write_text(source, encoding="utf-8")\n\n\ndef update_checks_and_deploy():'
if needle not in text:
    raise SystemExit('renderer transform tail not found')
app_config_patch = '''        path.write_text(source, encoding="utf-8")\n\n    file = "src/renderer/app-config.js"\n    source = read(file)\n    source = source.replace(\n        'return Boolean(hasPermission("schedule_manage") && roleAppliesToGroup(groupFeatureState.currentGroupId));',\n        'return Boolean(typeof canEditSchedule === "function" && canEditSchedule());',\n    )\n    write(file, source)\n\n\ndef update_checks_and_deploy():'''
text = text.replace(needle, app_config_patch, 1)

# Upgrade the formal renderer alignment guard to the canonical common/group
# permission contract. These checks should reject a regression to retired helpers.
needle = '    file = "scripts/check-normalized-storage.js"\n'
if needle not in text:
    raise SystemExit('normalized storage check hook not found')
renderer_guard_patch = '''    file = "scripts/check-renderer-alignment.js"\n    source = read(file)\n    source = source.replace(\n        'assert(renderer.includes(\\'hasPermission("schedule_manage")\\'), "Schedule management must derive from permissions");',\n        'assert(renderer.includes(\\'hasGroupPermission(groupFeatureState.currentGroupId, "schedule_manage")\\'), "Schedule management must derive from current-group permission");'\n    )\n    source = source.replace(\n        'assert(renderer.includes(\\'hasPermission("attendance_review")\\'), "Attendance review UI must derive from permissions");',\n        'assert(renderer.includes(\\'hasAnyGroupPermission("attendance_review")\\'), "Attendance review UI must derive from group permissions");'\n    )\n    source = source.replace(\n        'assert(renderer.includes(\\'hasPermission("member_settings")\\'), "Member settings UI must derive from permissions");',\n        'assert(renderer.includes(\\'function canManageMembersInCurrentGroup()\\') && renderer.includes(\\'hasGroupPermission(groupFeatureState.currentGroupId, "schedule_manage")\\'), "Member settings UI must derive from schedule_manage on the current group");'\n    )\n    source = source.replace(\n        'assert(attendanceExport.includes(\\'hasPermission(ctx, actorId, "attendance_review")\\') && attendanceExport.includes(\\'canAccessGroup(ctx, actorId, groupId, "attendance_review")\\'), "Attendance export must validate permission and group scope through shared runtime helpers");',\n        'assert(attendanceExport.includes(\\'hasAnyGroupPermission(ctx, actorId, "attendance_review")\\') && attendanceExport.includes(\\'hasGroupPermission(ctx, actorId, groupId, "attendance_review")\\'), "Attendance export must validate permission and group scope through shared runtime helpers");'\n    )\n    source = source.replace(\n        'assert(memberAdmin.includes("member_settings") && memberAdmin.includes("permission_settings"), "Member admin must validate member and privileged permissions");',\n        'assert(memberAdmin.includes(\\'SCHEDULE_MANAGE_PERMISSION = "schedule_manage"\\') && memberAdmin.includes(\\'SETTINGS_PERMISSION = "settings"\\'), "Member admin must validate schedule_manage and settings permissions");'\n    )\n    source = source.replace(\n        'assert(!renderer.includes("function renderTodayOvertimePanel"), "Retired overtime panel must stay removed");',\n        'assert(!renderer.includes("hasPermission(") && !renderer.includes("getAccessPermissions(") && !renderer.includes("roleAppliesToGroup("), "Renderer must not restore retired permission helpers");\\nassert(!renderer.includes("function renderTodayOvertimePanel"), "Retired overtime panel must stay removed");'\n    )\n    write(file, source)\n\n    file = "scripts/check-normalized-storage.js"\n'''
text = text.replace(needle, renderer_guard_patch, 1)

# Formal tests intentionally reject phase/v2 filenames. Keep the architecture
# regression test, but give it a permanent domain name and reject stale rowtype
# permission-column references as well.
text = text.replace(
    'write("tests/access-control-v2.test.js", source)',
    'write("tests/access-control-model.test.js", source)'
)
text = text.replace(
    '  assert.doesNotMatch(sql, /create(?:\\s+or\\s+replace)?\\s+function public\\.(?:get_group_access_bundle_v1|save_access_role_v1|delete_access_role_v1)/i);',
    '  assert.doesNotMatch(sql, /create(?:\\s+or\\s+replace)?\\s+function public\\.(?:get_group_access_bundle_v1|save_access_role_v1|delete_access_role_v1)/i);\\n  assert.doesNotMatch(sql, /v_(?:old|new)_role\\.permissions|other_role\\.permissions/);'
)

path.write_text(text, encoding='utf-8')
print('transformer corrections applied')
