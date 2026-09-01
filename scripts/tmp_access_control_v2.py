from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent


def read(file):
    return (ROOT / file).read_text(encoding="utf-8").replace("\r\n", "\n").replace("\r", "\n")


def write(file, text):
    path = ROOT / file
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def replace_exact(text, old, new, label):
    if old not in text:
        raise RuntimeError(f"missing exact target: {label}")
    return text.replace(old, new, 1)


def replace_regex(text, pattern, replacement, label, count=1, flags=0):
    next_text, replaced = re.subn(pattern, replacement, text, count=count, flags=flags)
    if replaced == 0:
        raise RuntimeError(f"missing regex target: {label}")
    return next_text


def replace_section(text, start_marker, end_marker, replacement, label):
    start = text.find(start_marker)
    if start < 0:
        raise RuntimeError(f"missing section start: {label}")
    end = text.find(end_marker, start + len(start_marker))
    if end < 0:
        raise RuntimeError(f"missing section end: {label}")
    return text[:start] + replacement.rstrip() + "\n\n" + text[end:]


def sql_function_span(text, name, start_at=0):
    match = re.search(rf"(?im)^create(?:\s+or\s+replace)?\s+function\s+public\.{re.escape(name)}\s*\(", text[start_at:])
    if not match:
        return None
    start = start_at + match.start()
    body_match = re.search(r"\bas\s+(\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$)", text[start:], flags=re.I)
    if not body_match:
        raise RuntimeError(f"cannot locate SQL body tag for {name}")
    tag = body_match.group(1)
    body_start = start + body_match.end()
    end = text.find(tag + ";", body_start)
    if end < 0:
        raise RuntimeError(f"cannot locate SQL body end for {name}")
    return start, end + len(tag) + 1


def remove_sql_functions(text, name):
    while True:
        span = sql_function_span(text, name)
        if not span:
            return text
        start, end = span
        text = text[:start] + text[end:].lstrip("\n")


def replace_sql_function(text, name, replacement):
    span = sql_function_span(text, name)
    if not span:
        raise RuntimeError(f"SQL function not found: {name}")
    start, end = span
    return text[:start] + replacement.rstrip() + "\n\n" + text[end:].lstrip("\n")


def transform_sql():
    file = "supabase/002_current_updates.sql"
    sql = read(file)

    sql = re.sub(r"\baccess_role_groups\b", "access_role_group_permissions", sql)
    sql = sql.replace("idx_access_role_groups_group", "idx_access_role_group_permissions_group")

    access_tables = r'''create table if not exists public.access_roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  common_permissions text[] not null default '{}',
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.access_roles
  add column if not exists common_permissions text[] not null default '{}';

create table if not exists public.access_role_group_permissions (
  role_id uuid not null references public.access_roles(id) on delete cascade,
  group_id uuid not null references public.schedule_groups(id) on delete cascade,
  permissions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (role_id, group_id)
);

-- 一次性資料轉換：把舊角色權限轉成新版矩陣，轉換完成後立即刪除舊欄位與舊關聯表。
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='access_roles' and column_name='permissions'
  ) then
    execute $migrate$
      update public.access_roles
      set common_permissions = array_remove(array[
        case when permissions && array['permission_settings','group_settings']::text[] then 'settings' end,
        case when 'schedule_manage'=any(permissions) then 'export' end,
        case when 'leave_settings'=any(permissions) then 'leave_settings' end
      ], null)
    $migrate$;
  end if;

  if to_regclass('public.access_role_groups') is not null then
    execute $migrate$
      insert into public.access_role_group_permissions(role_id,group_id,permissions)
      select legacy.role_id, legacy.group_id,
        array_remove(array[
          case when 'schedule_view'=any(role.permissions) or 'schedule_manage'=any(role.permissions) or 'member_settings'=any(role.permissions) then 'schedule_view' end,
          case when 'schedule_manage'=any(role.permissions) or 'member_settings'=any(role.permissions) then 'schedule_manage' end,
          case when 'department_settings'=any(role.permissions) then 'department_settings' end,
          case when 'attendance_review'=any(role.permissions) then 'attendance_review' end,
          case when 'meal_admin'=any(role.permissions) then 'meal_admin' end
        ], null)
      from public.access_role_groups legacy
      join public.access_roles role on role.id=legacy.role_id
      on conflict(role_id,group_id) do update
      set permissions=excluded.permissions,updated_at=now()
    $migrate$;
  end if;
end $$;

alter table public.access_roles drop column if exists permissions;
drop table if exists public.access_role_groups;'''
    sql = replace_regex(
        sql,
        r"create table if not exists public\.access_roles \([\s\S]*?\n\);\n\ncreate table if not exists public\.access_role_group_permissions \([\s\S]*?\n\);",
        lambda _: access_tables,
        "access table definitions",
        flags=re.I,
    )

    role_seed = r'''insert into public.access_roles(code,name,common_permissions,is_system) values
('admin','管理員',array['settings','export','leave_settings'],true),
('manager','主管',array['export','leave_settings'],true),
('employee','員工','{}'::text[],true)
on conflict(code) do update set common_permissions=excluded.common_permissions;'''
    sql = replace_regex(
        sql,
        r"insert into public\.access_roles\(code,name,permissions,is_system\) values[\s\S]*?on conflict\(code\) do nothing;",
        lambda _: role_seed,
        "role seed",
        flags=re.I,
    )

    group_seed = r'''insert into public.access_role_group_permissions(role_id,group_id,permissions)
select role.id,grp.id,
  case role.code
    when 'employee' then array['schedule_view']::text[]
    else array['schedule_view','schedule_manage','department_settings','attendance_review','meal_admin']::text[]
  end
from public.access_roles role
cross join public.schedule_groups grp
where role.code in ('admin','manager','employee') and grp.code='STORE'
on conflict(role_id,group_id) do update set permissions=excluded.permissions,updated_at=now();'''
    sql = replace_regex(
        sql,
        r"insert into public\.access_role_group_permissions\(role_id,group_id\)[\s\S]*?on conflict do nothing;",
        lambda _: group_seed,
        "group permission seed",
        flags=re.I,
    )

    for obsolete in [
        "has_access_permission",
        "role_applies_to_group",
        "can_access_group",
        "get_group_access_bundle_v1",
        "save_access_role_v1",
        "delete_access_role_v1",
    ]:
        sql = remove_sql_functions(sql, obsolete)

    permission_helpers = r'''create or replace function public.role_has_common_permission(p_role_id uuid,p_permission text)
returns boolean language sql stable security definer set search_path=public,pg_catalog as $$
  select exists(
    select 1 from public.access_roles role
    where role.id=p_role_id and p_permission=any(coalesce(role.common_permissions,'{}'::text[]))
  )
$$;

create or replace function public.role_has_group_permission(p_role_id uuid,p_group_id uuid,p_permission text)
returns boolean language sql stable security definer set search_path=public,pg_catalog as $$
  select exists(
    select 1 from public.access_role_group_permissions item
    where item.role_id=p_role_id and item.group_id=p_group_id
      and p_permission=any(coalesce(item.permissions,'{}'::text[]))
  )
$$;

create or replace function public.role_has_any_group_permission(p_role_id uuid,p_permission text)
returns boolean language sql stable security definer set search_path=public,pg_catalog as $$
  select exists(
    select 1 from public.access_role_group_permissions item
    where item.role_id=p_role_id and p_permission=any(coalesce(item.permissions,'{}'::text[]))
  )
$$;

create or replace function public.has_common_permission(p_user_id uuid,p_permission text)
returns boolean language sql stable security definer set search_path=public,pg_catalog as $$
  select exists(
    select 1 from public.set_employee employee
    where employee.id=p_user_id and employee.deleted_at is null
      and public.role_has_common_permission(employee.access_role_id,p_permission)
      and public.is_employee_account_effective(employee.hire_date,employee.leave_date,(timezone('Asia/Taipei',now()))::date)
  )
$$;

create or replace function public.has_group_permission(p_user_id uuid,p_group_id uuid,p_permission text)
returns boolean language sql stable security definer set search_path=public,pg_catalog as $$
  select exists(
    select 1 from public.set_employee employee
    where employee.id=p_user_id and employee.deleted_at is null
      and public.role_has_group_permission(employee.access_role_id,p_group_id,p_permission)
      and public.is_employee_account_effective(employee.hire_date,employee.leave_date,(timezone('Asia/Taipei',now()))::date)
  )
$$;

create or replace function public.has_any_group_permission(p_user_id uuid,p_permission text)
returns boolean language sql stable security definer set search_path=public,pg_catalog as $$
  select exists(
    select 1 from public.set_employee employee
    where employee.id=p_user_id and employee.deleted_at is null
      and public.role_has_any_group_permission(employee.access_role_id,p_permission)
      and public.is_employee_account_effective(employee.hire_date,employee.leave_date,(timezone('Asia/Taipei',now()))::date)
  )
$$;

create or replace function public.has_group_access(p_user_id uuid,p_group_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_catalog as $$
  select exists(
    select 1 from public.set_employee employee
    join public.access_role_group_permissions item
      on item.role_id=employee.access_role_id and item.group_id=p_group_id
    where employee.id=p_user_id and employee.deleted_at is null
      and cardinality(coalesce(item.permissions,'{}'::text[]))>0
      and public.is_employee_account_effective(employee.hire_date,employee.leave_date,(timezone('Asia/Taipei',now()))::date)
  )
$$;'''

    span = sql_function_span(sql, "current_access_role_id")
    if not span:
        raise RuntimeError("current_access_role_id not found")
    _, end = span
    sql = sql[:end] + "\n\n" + permission_helpers + sql[end:]

    # Replace old helper calls with the new explicit common/group model.
    mappings = {
        "permission_settings": ("common", "settings"),
        "group_settings": ("common", "settings"),
        "leave_settings": ("common", "leave_settings"),
        "member_settings": ("group", "schedule_manage"),
        "schedule_view": ("group", "schedule_view"),
        "schedule_manage": ("group", "schedule_manage"),
        "department_settings": ("group", "department_settings"),
        "attendance_review": ("group", "attendance_review"),
        "meal_admin": ("group", "meal_admin"),
    }
    for old_perm, (kind, new_perm) in mappings.items():
        pattern = rf"public\.has_access_permission\(([^,\n]+),\s*'{old_perm}'\)"
        def helper_repl(match, kind=kind, new_perm=new_perm):
            actor = match.group(1)
            helper = "has_common_permission" if kind == "common" else "has_any_group_permission"
            return f"public.{helper}({actor},'{new_perm}')"
        sql = re.sub(pattern, helper_repl, sql)

        for alias in ["role", "other_role", "access_role"]:
            exprs = [
                rf"'{old_perm}'\s*=\s*any\(coalesce\({alias}\.permissions,'\{{\}}'::text\[\]\)\)",
                rf"'{old_perm}'\s*=\s*any\({alias}\.permissions\)",
            ]
            helper = "role_has_common_permission" if kind == "common" else "role_has_any_group_permission"
            for expr in exprs:
                sql = re.sub(expr, f"public.{helper}({alias}.id,'{new_perm}')", sql)

    sql = sql.replace("public.can_access_group(", "public.has_group_permission(")
    sql = sql.replace("public.role_applies_to_group(", "public.has_group_access(")
    sql = sql.replace(",'member_settings')", ",'schedule_manage')")

    # No old permission names survive in runtime SQL. Migration strings above are inside dynamic SQL only.
    sql = re.sub(r"'permission_settings'", "'settings'", sql)
    sql = re.sub(r"'group_settings'", "'settings'", sql)
    sql = re.sub(r"'member_settings'", "'schedule_manage'", sql)

    # Group settings is global/common; creating a group never grants hidden group access.
    sql = re.sub(
        r"\s*if v_created then select access_role_id into v_actor_role from public\.set_employee where id=auth\.uid\(\); insert into public\.access_role_group_permissions values\(v_actor_role,v_id,now\(\)\) on conflict do nothing; end if;",
        "",
        sql,
    )
    sql = sql.replace(
        "declare v_id uuid; v_code text; v_name text; v_meal boolean; v_status text; v_sort integer; v_created boolean:=false; v_actor_role uuid; v_row public.schedule_groups%rowtype;",
        "declare v_id uuid; v_code text; v_name text; v_meal boolean; v_status text; v_sort integer; v_created boolean:=false; v_row public.schedule_groups%rowtype;",
    )
    sql = re.sub(
        r"elsif not public\.has_group_access\(auth\.uid\(\),v_id\) and not public\.has_common_permission\(auth\.uid\(\),'settings'\) then raise exception '此角色不可管理該群組' using errcode='42501'; end if;",
        "elsif not public.has_common_permission(auth.uid(),'settings') then raise exception '沒有設定權限' using errcode='42501'; end if;",
        sql,
    )
    sql = re.sub(
        r"if public\.has_group_access\(auth\.uid\(\),v_id\) or public\.has_common_permission\(auth\.uid\(\),'settings'\) then update public\.schedule_groups set sort_order=v_order,updated_at=now\(\) where id=v_id and deleted_at is null; v_order:=v_order\+1; end if;",
        "update public.schedule_groups set sort_order=v_order,updated_at=now() where id=v_id and deleted_at is null; v_order:=v_order+1;",
        sql,
    )

    # Export is a common permission, independent from a group management permission.
    sql = re.sub(
        r"if not public\.has_any_group_permission\(auth\.uid\(\),'schedule_manage'\) then raise exception '沒有班表管理權限'",
        "if not public.has_common_permission(auth.uid(),'export') then raise exception '沒有匯出權限'",
        sql,
    )

    # Schedule bootstrap/list CTEs only include groups with schedule_view.
    sql = re.sub(
        r"join public\.access_role_group_permissions role_group on role_group\.role_id=actor\.access_role_id\n(\s*)\)",
        r"join public.access_role_group_permissions role_group on role_group.role_id=actor.access_role_id\n\1where 'schedule_view'=any(coalesce(role_group.permissions,'{}'::text[]))\n\1)",
        sql,
    )
    sql = re.sub(
        r"join public\.access_role_group_permissions role_group on role_group\.role_id=actor\.access_role_id\s*\), visible_schedule",
        "join public.access_role_group_permissions role_group on role_group.role_id=actor.access_role_id where 'schedule_view'=any(coalesce(role_group.permissions,'{}'::text[]))\n), visible_schedule",
        sql,
    )

    # Schedule writes need schedule_manage on the target member group.
    sql = re.sub(
        r"where allowed\.role_id=v_role_id and allowed\.group_id=member\.group_id\n\s*\)",
        "where allowed.role_id=v_role_id and allowed.group_id=member.group_id\n           and 'schedule_manage'=any(coalesce(allowed.permissions,'{}'::text[]))\n       )",
        sql,
    )

    # Bootstrap no longer embeds the old role bundle; browser obtains it from access-control.
    sql = re.sub(r",?\s*'accessBundle'\s*,\s*public\.get_group_access_bundle_v1\(\)\s*", "", sql)

    # Role sorting belongs to access-control too.
    sql = re.sub(
        r"\s*elsif v_category='access-role' then[\s\S]*?update public\.access_roles set sort_order=v_index,updated_at=now\(\) where id=v_id;",
        "",
        sql,
    )

    # Remove obsolete grants/revokes.
    sql = "\n".join(
        line for line in sql.split("\n")
        if not re.search(r"get_group_access_bundle_v1|save_access_role_v1|delete_access_role_v1", line)
    )

    # Later schema maintenance blocks must use common_permissions.
    sql = re.sub(
        r"alter table public\.access_roles\s+add column if not exists permissions text\[\][^;]*;",
        "alter table public.access_roles add column if not exists common_permissions text[] not null default '{}';",
        sql,
        flags=re.I,
    )

    write(file, sql)


def transform_runtime():
    file = "supabase/functions/_shared/runtime.ts"
    source = read(file)
    source = re.sub(
        r"export function hasPermission\([\s\S]*?\n}\n\nexport function canAccessGroup\([\s\S]*?\n}\n?",
        r'''export function hasCommonPermission(ctx: any, actorId: string, permission: string) {
  return rpcBoolean(ctx, "has_common_permission", { p_user_id: actorId, p_permission: permission });
}

export function hasAnyGroupPermission(ctx: any, actorId: string, permission: string) {
  return rpcBoolean(ctx, "has_any_group_permission", { p_user_id: actorId, p_permission: permission });
}

export function hasGroupPermission(ctx: any, actorId: string, groupId: string, permission: string) {
  if (!isUuid(groupId)) return Promise.resolve(false);
  return rpcBoolean(ctx, "has_group_permission", { p_user_id: actorId, p_group_id: groupId, p_permission: permission });
}
''',
        source,
        count=1,
    )
    write(file, source)


def transform_edge_permissions():
    for file in [
        "supabase/functions/attendance-ledger/index.ts",
        "supabase/functions/attendance-review-groups/index.ts",
    ]:
        source = read(file)
        source = source.replace("hasPermission", "hasAnyGroupPermission")
        source = source.replace('from("access_role_groups")', 'from("access_role_group_permissions")')
        source = re.sub(
            r'\.select\("group_id"\)\.eq\("role_id", actor\.access_role_id\)',
            '.select("group_id,permissions").eq("role_id", actor.access_role_id).contains("permissions", ["attendance_review"])',
            source,
        )
        source = re.sub(
            r'''const allowed = await ctx\.supabaseAdmin\.rpc\("can_access_group", \{
\s*p_user_id: actor\.id, p_group_id: target\.data\.group_id, p_permission: "attendance_review"
\s*\}\);
\s*if \(allowed\.error\) throw allowed\.error;
\s*if \(!allowed\.data\)''',
            'const allowed = await hasGroupPermission(ctx, actor.id, target.data.group_id, "attendance_review");\n  if (!allowed)',
            source,
        )
        if "hasGroupPermission(" in source and "hasGroupPermission," not in source.split("\n", 2)[1]:
            source = re.sub(
                r'import \{ ([^\n]+) \} from "\.\./_shared/runtime\.ts";',
                lambda m: f'import {{ {m.group(1)}, hasGroupPermission }} from "../_shared/runtime.ts";',
                source,
                count=1,
            )
        write(file, source)

    file = "supabase/functions/attendance-ledger-export/index.ts"
    source = read(file).replace("canAccessGroup", "hasGroupPermission").replace("hasPermission", "hasAnyGroupPermission")
    write(file, source)

    file = "supabase/functions/meal-report-v2/index.ts"
    source = read(file).replace("hasPermission", "hasAnyGroupPermission")
    source = source.replace('from("access_role_groups")', 'from("access_role_group_permissions")')
    source = re.sub(
        r'\.select\("group_id"\)\.eq\("role_id", actor\.access_role_id\)',
        '.select("group_id,permissions").eq("role_id", actor.access_role_id).contains("permissions", ["meal_admin"])',
        source,
    )
    write(file, source)


def transform_member_auth():
    file = "supabase/functions/member-auth-admin/index.ts"
    source = read(file)
    source = source.replace(
        "actorIdOf, canAccessGroup, hasPermission,",
        "actorIdOf, hasAnyGroupPermission, hasCommonPermission, hasGroupPermission,",
    )
    source = source.replace("permissions: string[];", "common_permissions: string[];")
    source = source.replace(
        'const MEMBER_PERMISSION = "member_settings";\nconst PRIVILEGED_PERMISSION = "permission_settings";',
        'const SCHEDULE_MANAGE_PERMISSION = "schedule_manage";\nconst SETTINGS_PERMISSION = "settings";',
    )
    source = source.replace(
        "if (!await hasPermission(ctx, actorId, MEMBER_PERMISSION))",
        "if (!await hasAnyGroupPermission(ctx, actorId, SCHEDULE_MANAGE_PERMISSION))",
    )
    source = source.replace(
        "canManagePermissions: await hasPermission(ctx, actorId, PRIVILEGED_PERMISSION)",
        "canManagePermissions: await hasCommonPermission(ctx, actorId, SETTINGS_PERMISSION)",
    )
    source = source.replace('.select("id,code,name,permissions")', '.select("id,code,name,common_permissions")')
    source = source.replace(
        "permissions: Array.isArray(data.permissions) ? data.permissions : []",
        "common_permissions: Array.isArray(data.common_permissions) ? data.common_permissions : []",
    )
    source = source.replace('from("access_role_groups")', 'from("access_role_group_permissions")')
    source = re.sub(
        r'''\.select\("group_id"\)
\s*\.eq\("role_id", roleId\)
\s*\.eq\("group_id", groupId\)''',
        '.select("group_id,permissions")\n    .eq("role_id", roleId)\n    .eq("group_id", groupId)\n    .contains("permissions", ["schedule_view"])',
        source,
    )
    source = source.replace("role.permissions.includes(PRIVILEGED_PERMISSION)", "role.common_permissions.includes(SETTINGS_PERMISSION)")
    source = source.replace('.select("id,permissions")', '.select("id,common_permissions")')
    source = source.replace(
        "Array.isArray(role.permissions) && role.permissions.includes(PRIVILEGED_PERMISSION)",
        "Array.isArray(role.common_permissions) && role.common_permissions.includes(SETTINGS_PERMISSION)",
    )
    source = source.replace(
        "nextRole.permissions.includes(PRIVILEGED_PERMISSION)",
        "nextRole.common_permissions.includes(SETTINGS_PERMISSION)",
    )
    source = source.replace(
        "canAccessGroup(ctx, actor.actorId, profile.group_id, MEMBER_PERMISSION)",
        "hasGroupPermission(ctx, actor.actorId, profile.group_id, SCHEDULE_MANAGE_PERMISSION)",
    )
    source = source.replace(
        "canAccessGroup(ctx, actor.actorId, member.groupId, MEMBER_PERMISSION)",
        "hasGroupPermission(ctx, actor.actorId, member.groupId, SCHEDULE_MANAGE_PERMISSION)",
    )
    source = source.replace(
        "accessRole.permissions.includes(PRIVILEGED_PERMISSION)",
        "accessRole.common_permissions.includes(SETTINGS_PERMISSION)",
    )
    source = source.replace("PRIVILEGED_PERMISSION", "SETTINGS_PERMISSION")
    source = source.replace("MEMBER_PERMISSION", "SCHEDULE_MANAGE_PERMISSION")
    write(file, source)


def write_access_control_edge():
    source = r'''import { withSupabase } from "npm:@supabase/server@^1";
import { actorIdOf, isProfileEffective, isUuid } from "../_shared/runtime.ts";

const COMMON_PERMISSIONS = new Set(["settings", "export", "leave_settings"]);
const GROUP_PERMISSIONS = new Set(["schedule_view", "schedule_manage", "department_settings", "attendance_review", "meal_admin"]);
const SETTINGS_PERMISSION = "settings";

function uniqueAllowed(values: unknown, allowed: Set<string>) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || "").trim()).filter((value) => allowed.has(value)))];
}

function normalizeGroupRows(value: unknown) {
  const rows = Array.isArray(value) ? value : [];
  const byGroup = new Map<string, string[]>();
  for (const row of rows) {
    const groupId = String(row?.groupId || "").trim();
    if (!isUuid(groupId)) continue;
    const permissions = uniqueAllowed(row?.permissions, GROUP_PERMISSIONS);
    if (permissions.includes("schedule_manage") && !permissions.includes("schedule_view")) permissions.unshift("schedule_view");
    if (permissions.length) byGroup.set(groupId, permissions);
  }
  return [...byGroup.entries()].map(([groupId, permissions]) => ({ groupId, permissions }));
}

async function getActor(ctx: any) {
  const actorId = actorIdOf(ctx);
  const result = await ctx.supabaseAdmin.from("set_employee")
    .select("id,group_id,access_role_id,hire_date,leave_date,deleted_at")
    .eq("id", actorId).is("deleted_at", null).single();
  if (result.error) throw result.error;
  if (!isProfileEffective(result.data)) throw new Error("此帳號目前不在有效期間");
  const roleResult = await ctx.supabaseAdmin.from("access_roles")
    .select("id,code,name,name_vi,common_permissions,is_system,sort_order")
    .eq("id", result.data.access_role_id).single();
  if (roleResult.error) throw roleResult.error;
  return { profile: result.data, role: roleResult.data };
}

async function getGroupPermissionRows(ctx: any, roleIds: string[]) {
  if (!roleIds.length) return [];
  const result = await ctx.supabaseAdmin.from("access_role_group_permissions")
    .select("role_id,group_id,permissions").in("role_id", roleIds);
  if (result.error) throw result.error;
  return result.data || [];
}

function roleDto(role: any, rows: any[]) {
  return {
    id: role.id,
    code: role.code,
    name: role.name,
    nameVi: role.name_vi || "",
    commonPermissions: Array.isArray(role.common_permissions) ? role.common_permissions : [],
    groupPermissions: rows.filter((row) => row.role_id === role.id).map((row) => ({
      groupId: row.group_id,
      permissions: Array.isArray(row.permissions) ? row.permissions : []
    })),
    isSystem: Boolean(role.is_system),
    sortOrder: Number(role.sort_order || 0)
  };
}

async function bundle(ctx: any) {
  const actor = await getActor(ctx);
  const actorRows = await getGroupPermissionRows(ctx, [actor.role.id]);
  const actorGroupPermissions = Object.fromEntries(actorRows.map((row) => [row.group_id, Array.isArray(row.permissions) ? row.permissions : []]));
  const commonPermissions = Array.isArray(actor.role.common_permissions) ? actor.role.common_permissions : [];
  const canSettings = commonPermissions.includes(SETTINGS_PERMISSION);
  const managedGroupIds = actorRows.filter((row) => (row.permissions || []).includes("schedule_manage")).map((row) => row.group_id);
  const visibleGroupIds = new Set(actorRows.filter((row) => (row.permissions || []).length).map((row) => row.group_id));

  const groupResult = await ctx.supabaseAdmin.from("schedule_groups")
    .select("id,code,name,name_vi,meal_enabled,status,sort_order,deleted_at")
    .is("deleted_at", null).order("sort_order").order("name");
  if (groupResult.error) throw groupResult.error;
  const allGroups = groupResult.data || [];
  const groups = canSettings ? allGroups : allGroups.filter((group) => visibleGroupIds.has(group.id));

  const roleResult = await ctx.supabaseAdmin.from("access_roles")
    .select("id,code,name,name_vi,common_permissions,is_system,sort_order").order("sort_order").order("name");
  if (roleResult.error) throw roleResult.error;
  let roles = roleResult.data || [];
  const allRoleRows = await getGroupPermissionRows(ctx, roles.map((role) => role.id));
  if (!canSettings) {
    const visibleRoleIds = new Set([actor.role.id]);
    for (const row of allRoleRows) if (managedGroupIds.includes(row.group_id)) visibleRoleIds.add(row.role_id);
    roles = roles.filter((role) => visibleRoleIds.has(role.id));
  }

  const departmentResult = await ctx.supabaseAdmin.from("set_departments")
    .select("group_id,name,sort_order,deleted_at").is("deleted_at", null);
  if (departmentResult.error) throw departmentResult.error;
  const unitNames = new Map<string, string[]>();
  for (const department of departmentResult.data || []) {
    const list = unitNames.get(department.group_id) || [];
    list.push(department.name);
    unitNames.set(department.group_id, list);
  }

  return {
    actor: {
      groupId: actor.profile.group_id,
      roleId: actor.role.id,
      roleName: actor.role.name,
      commonPermissions,
      groupPermissions: actorGroupPermissions
    },
    groups: groups.map((group) => ({
      id: group.id, code: group.code, name: group.name, nameVi: group.name_vi || "",
      mealEnabled: Boolean(group.meal_enabled), status: group.status, sortOrder: Number(group.sort_order || 0),
      unitNames: unitNames.get(group.id) || []
    })),
    roles: roles.map((role) => roleDto(role, allRoleRows))
  };
}

async function countEffectiveSettingsAccounts(ctx: any, excludingRoleId = "") {
  const roleResult = await ctx.supabaseAdmin.from("access_roles").select("id,common_permissions");
  if (roleResult.error) throw roleResult.error;
  const roleIds = (roleResult.data || [])
    .filter((role) => role.id !== excludingRoleId && (role.common_permissions || []).includes(SETTINGS_PERMISSION))
    .map((role) => role.id);
  if (!roleIds.length) return 0;
  const employeeResult = await ctx.supabaseAdmin.from("set_employee")
    .select("id,access_role_id,hire_date,leave_date,deleted_at").in("access_role_id", roleIds).is("deleted_at", null);
  if (employeeResult.error) throw employeeResult.error;
  return (employeeResult.data || []).filter((profile) => isProfileEffective(profile)).length;
}

async function assertSettings(actor: any) {
  if (!(actor.role.common_permissions || []).includes(SETTINGS_PERMISSION)) throw new Error("沒有設定權限");
}

async function saveRole(ctx: any, actor: any, body: any) {
  await assertSettings(actor);
  const input = body?.role || {};
  const requestedId = String(input.id || "").trim();
  const id = requestedId && isUuid(requestedId) ? requestedId : crypto.randomUUID();
  const name = String(input.name || "").trim();
  const nameVi = String(input.nameVi || "").trim();
  if (!name) throw new Error("角色名稱不可空白");
  const commonPermissions = uniqueAllowed(input.commonPermissions, COMMON_PERMISSIONS);
  const groupPermissions = normalizeGroupRows(input.groupPermissions);

  const groupIds = groupPermissions.map((row) => row.groupId);
  if (groupIds.length) {
    const groupResult = await ctx.supabaseAdmin.from("schedule_groups").select("id").in("id", groupIds).is("deleted_at", null);
    if (groupResult.error) throw groupResult.error;
    const valid = new Set((groupResult.data || []).map((row) => row.id));
    if (groupIds.some((groupId) => !valid.has(groupId))) throw new Error("群組權限包含不存在的群組");
  }

  const existingResult = await ctx.supabaseAdmin.from("access_roles")
    .select("id,code,name,common_permissions,is_system,sort_order").eq("id", id).maybeSingle();
  if (existingResult.error) throw existingResult.error;
  const existing = existingResult.data || null;
  if (existing && (existing.common_permissions || []).includes(SETTINGS_PERMISSION)
      && !commonPermissions.includes(SETTINGS_PERMISSION)) {
    const usersResult = await ctx.supabaseAdmin.from("set_employee")
      .select("id,hire_date,leave_date,deleted_at").eq("access_role_id", id).is("deleted_at", null);
    if (usersResult.error) throw usersResult.error;
    const hasEffectiveUser = (usersResult.data || []).some((profile) => isProfileEffective(profile));
    if (hasEffectiveUser && await countEffectiveSettingsAccounts(ctx, id) === 0) {
      throw new Error("系統必須保留至少一個有效的權限管理帳號");
    }
  }

  const code = existing?.code || `role-${id.replaceAll("-", "")}`;
  const sortOrder = Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : Number(existing?.sort_order ?? 1000000);
  const upsertResult = await ctx.supabaseAdmin.from("access_roles").upsert({
    id, code, name, name_vi: nameVi || null, common_permissions: commonPermissions,
    is_system: Boolean(existing?.is_system), sort_order: sortOrder, updated_at: new Date().toISOString()
  }).select("id,code,name,name_vi,common_permissions,is_system,sort_order").single();
  if (upsertResult.error) throw upsertResult.error;

  const deleteResult = await ctx.supabaseAdmin.from("access_role_group_permissions").delete().eq("role_id", id);
  if (deleteResult.error) throw deleteResult.error;
  if (groupPermissions.length) {
    const insertResult = await ctx.supabaseAdmin.from("access_role_group_permissions").insert(
      groupPermissions.map((row) => ({ role_id: id, group_id: row.groupId, permissions: row.permissions }))
    );
    if (insertResult.error) throw insertResult.error;
  }
  const rows = await getGroupPermissionRows(ctx, [id]);
  return { ok: true, role: roleDto(upsertResult.data, rows) };
}

async function deleteRole(ctx: any, actor: any, body: any) {
  await assertSettings(actor);
  const roleId = String(body?.roleId || "").trim();
  if (!isUuid(roleId)) throw new Error("角色識別碼格式錯誤");
  const usedResult = await ctx.supabaseAdmin.from("set_employee").select("id").eq("access_role_id", roleId).is("deleted_at", null).limit(1);
  if (usedResult.error) throw usedResult.error;
  if ((usedResult.data || []).length) throw new Error("此角色仍有人員使用，請先改用其他角色");
  const result = await ctx.supabaseAdmin.from("access_roles").delete().eq("id", roleId);
  if (result.error) throw result.error;
  return { ok: true };
}

async function reorderRoles(ctx: any, actor: any, body: any) {
  await assertSettings(actor);
  const ids = [...new Set((Array.isArray(body?.roleIds) ? body.roleIds : []).map((id) => String(id || "").trim()).filter(isUuid))];
  for (let index = 0; index < ids.length; index += 1) {
    const result = await ctx.supabaseAdmin.from("access_roles").update({ sort_order: index, updated_at: new Date().toISOString() }).eq("id", ids[index]);
    if (result.error) throw result.error;
  }
  return { ok: true, count: ids.length };
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return Response.json({ message: "Method Not Allowed" }, { status: 405 });
    try {
      const actor = await getActor(ctx);
      const body = await req.json();
      const action = String(body?.action || "bundle");
      if (action === "bundle") return Response.json(await bundle(ctx));
      if (action === "saveRole") return Response.json(await saveRole(ctx, actor, body));
      if (action === "deleteRole") return Response.json(await deleteRole(ctx, actor, body));
      if (action === "reorderRoles") return Response.json(await reorderRoles(ctx, actor, body));
      throw new Error("不支援的權限操作");
    } catch (error) {
      const message = error instanceof Error ? error.message : "權限操作失敗";
      return Response.json({ message }, { status: /權限/.test(message) ? 403 : 400 });
    }
  })
};
'''
    write("supabase/functions/access-control/index.ts", source)


def transform_web_api():
    file = "src/renderer/web-api.js"
    source = read(file)
    source = replace_exact(
        source,
        '  async function getGroupAccessBundle() { return callRpc("get_group_access_bundle_v1", {}) || {}; }',
        '  async function getGroupAccessBundle() { return requestFunction("access-control", { action: "bundle" }) || {}; }',
        "web access bundle",
    )
    source = replace_section(
        source,
        "  async function saveAccessRole(role) {",
        "  async function validateMemberGroupChange",
        r'''  async function saveAccessRole(role) {
    return requestFunction("access-control", { action: "saveRole", role });
  }
  async function deleteAccessRole(roleId) {
    return requestFunction("access-control", { action: "deleteRole", roleId });
  }
  async function reorderAccessRoles(roleIds) {
    return requestFunction("access-control", { action: "reorderRoles", roleIds });
  }
''',
        "web role actions",
    )
    source = source.replace(
        "accessBundle: bootstrap.accessBundle || { actor: {}, groups: [], roles: [] }",
        "accessBundle: await getGroupAccessBundle()",
    )
    source = source.replace("    deleteAccessRole,\n", "    deleteAccessRole,\n    reorderAccessRoles,\n")
    write(file, source)


def transform_renderer_permissions():
    file = "src/renderer/renderer-groups-permissions-archive.js"
    source = read(file)
    source = replace_regex(
        source,
        r"const GROUP_PERMISSION_LABELS = \{[\s\S]*?\n\};",
        lambda _: r'''const COMMON_PERMISSION_LABELS = {
  settings: "設定",
  export: "匯出",
  leave_settings: "假別設定"
};

const GROUP_PERMISSION_LABELS = {
  schedule_view: "班表查看",
  schedule_manage: "班表管理",
  department_settings: "單位設定",
  attendance_review: "簽到審核",
  meal_admin: "訂餐管理"
};''',
        "renderer permission labels",
        flags=re.I,
    )
    source = replace_section(
        source,
        "function getAccessActor()",
        "function chooseCurrentGroupId()",
        r'''function getAccessActor() { return groupFeatureState.bundle?.actor || {}; }
function getCommonPermissions() { return Array.isArray(getAccessActor().commonPermissions) ? getAccessActor().commonPermissions : []; }
function hasCommonPermission(permission) { return getCommonPermissions().includes(permission); }
function getActorGroupPermissions(groupId) {
  const map = getAccessActor().groupPermissions;
  return map && typeof map === "object" && Array.isArray(map[groupId]) ? map[groupId] : [];
}
function hasGroupPermission(groupId, permission) { return Boolean(groupId && getActorGroupPermissions(groupId).includes(permission)); }
function hasAnyGroupPermission(permission) {
  const map = getAccessActor().groupPermissions;
  return Boolean(map && typeof map === "object" && Object.values(map).some((permissions) => Array.isArray(permissions) && permissions.includes(permission)));
}
function getAllGroups() { return Array.isArray(groupFeatureState.bundle?.groups) ? groupFeatureState.bundle.groups : []; }
function getSelectableGroups() { return getAllGroups().filter((group) => group.status === "active" && hasGroupPermission(group.id, "schedule_view")); }
function getCurrentGroup() { return getAllGroups().find((group) => group.id === groupFeatureState.currentGroupId) || null; }
function getActorGroup() { return getAllGroups().find((group) => group.id === getAccessActor().groupId) || null; }
function getAllRoles() { return Array.isArray(groupFeatureState.bundle?.roles) ? groupFeatureState.bundle.roles : []; }
function getRoleById(roleId) { return getAllRoles().find((role) => role.id === roleId) || null; }
function getRoleGroupPermissions(role, groupId) {
  const rows = Array.isArray(role?.groupPermissions) ? role.groupPermissions : [];
  return rows.find((row) => row.groupId === groupId)?.permissions || [];
}
function getDefaultAccessRoleId() {
  const currentGroupId = groupFeatureState.currentGroupId;
  return getAllRoles().find((role) => {
    const common = Array.isArray(role.commonPermissions) ? role.commonPermissions : [];
    const groupPermissions = getRoleGroupPermissions(role, currentGroupId);
    return common.length === 0 && groupPermissions.length === 1 && groupPermissions[0] === "schedule_view";
  })?.id || getAllRoles()[0]?.id || "";
}
''',
        "renderer permission helpers",
    )
    source = source.replace("if (!roleAppliesToGroup(groupId)) return;", 'if (!hasGroupPermission(groupId, "schedule_view")) return;')

    source = replace_section(
        source,
        "function ensureFunctionMenuButtons()",
        "function groupUnitNames(group)",
        r'''function ensureFunctionMenuButtons() {
  const menu = document.getElementById("coreActionsMenu");
  if (!menu) return;
  const definitions = [
    ["groupSettingsMenuButton", "群組設定", "group-settings"],
    ["permissionSettingsMenuButton", "權限設定", "permission-settings"],
    ["scheduleConditionsMenuButton", "排班條件", "schedule-conditions"],
    ["scheduleArchiveMenuButton", "班表封存", "schedule-archive"]
  ];
  definitions.forEach(([id, label, action]) => {
    let button = document.getElementById(id);
    if (!button) {
      button = document.createElement("button");
      button.id = id;
      button.type = "button";
      button.className = "ghost-btn ops-btn group-feature-action";
      button.dataset.groupFeatureAction = action;
      button.textContent = label;
      menu.prepend(button);
    }
    const visible = action === "group-settings" || action === "permission-settings"
      ? hasCommonPermission("settings")
      : action === "schedule-conditions"
        ? canEditSchedule()
        : hasGroupPermission(groupFeatureState.currentGroupId, "schedule_view");
    button.style.display = visible ? "" : "none";
    button.disabled = !visible;
  });
}

function syncPermissionUi() {
  ensureGroupSelector();
  ensureFunctionMenuButtons();
  markArchivedScheduleCells();
  const groupId = groupFeatureState.currentGroupId;
  const visibility = {
    shiftSettingsButton: hasGroupPermission(groupId, "schedule_manage"),
    restComplianceButton: hasGroupPermission(groupId, "schedule_manage"),
    deptSettingsButton: hasGroupPermission(groupId, "department_settings"),
    leaveSettingsButton: hasCommonPermission("leave_settings"),
    overtimeSettingsButton: false,
    weekStartSettingsButton: hasGroupPermission(groupId, "schedule_manage"),
    autoSchedulePreviewButton: hasGroupPermission(groupId, "schedule_manage"),
    autoFillSchedulePreviewButton: hasGroupPermission(groupId, "schedule_manage"),
    autoScheduleApplyButton: hasGroupPermission(groupId, "schedule_manage"),
    autoScheduleCancelButton: hasGroupPermission(groupId, "schedule_manage"),
    exportSapButton: hasCommonPermission("export"),
    exportLeaveButton: hasCommonPermission("export"),
    exportOvertimeButton: hasCommonPermission("export")
  };
  Object.entries(visibility).forEach(([id, visible]) => {
    const element = document.getElementById(id);
    if (!element) return;
    element.style.display = visible ? "" : "none";
    element.disabled = !visible;
  });
  document.querySelectorAll("[data-open-department-settings]").forEach((element) => { element.style.display = hasGroupPermission(groupId, "department_settings") ? "" : "none"; });
  document.querySelectorAll("[data-open-member-settings]").forEach((element) => { element.style.display = hasGroupPermission(groupId, "schedule_manage") ? "" : "none"; });
  const mealButton = document.querySelector('[data-home-action="meal"]');
  const actorGroup = getActorGroup();
  if (mealButton) mealButton.style.display = actorGroup?.mealEnabled && actorGroup?.status === "active" ? "" : "none";
  document.querySelectorAll('[data-meal-tab="stats"], [data-meal-tab="settings"]').forEach((tab) => { tab.style.display = hasAnyGroupPermission("meal_admin") ? "" : "none"; });
}
''',
        "renderer menu visibility",
    )

    role_ui = r'''function permissionTagList(labels) {
  if (!labels.length) return '<span class="group-unit-empty">-</span>';
  return `<div class="permission-summary-tags">${labels.map((label) => `<span class="group-unit-tag permission-summary-tag">${escapeHtml(label)}</span>`).join("")}</div>`;
}
function renderCommonPermissionSummary(role) {
  return permissionTagList((role.commonPermissions || []).map((permission) => COMMON_PERMISSION_LABELS[permission]).filter(Boolean));
}
function renderGroupPermissionSummary(role) {
  const rows = getAllGroups().map((group) => {
    const labels = getRoleGroupPermissions(role, group.id).map((permission) => GROUP_PERMISSION_LABELS[permission]).filter(Boolean);
    if (!labels.length) return "";
    return `<div class="permission-group-summary-row"><strong>${escapeHtml(getLocalizedName(group))}</strong>${permissionTagList(labels)}</div>`;
  }).filter(Boolean);
  return rows.join("") || '<span class="group-unit-empty">-</span>';
}

function openPermissionSettings() {
  if (!hasCommonPermission("settings")) return;
  modalContext = { category: "permission-settings" };
  openEntityListModal({
    title: "權限設定",
    modalClass: "modal modal-wide permission-settings-modal settings-list-modal",
    body: `<div class="records-table-wrap"><table class="records-table permission-settings-table"><thead><tr><th class="permission-role-drag-col"></th><th class="permission-role-col">角色名稱</th><th>共用權限</th><th class="permission-items-col">群組權限</th><th class="permission-actions-col">操作</th></tr></thead><tbody id="permissionSettingsRows">${getAllRoles().map((role) => `<tr data-permission-role-id="${escapeHtml(role.id)}"><td class="permission-role-drag-col"><span class="settings-order-drag-handle" draggable="true" data-permission-role-drag-handle="${escapeHtml(role.id)}" title="拖曳排序" aria-label="拖曳排序">≡</span></td><td class="permission-role-col">${escapeHtml(getLocalizedName(role))}</td><td>${renderCommonPermissionSummary(role)}</td><td class="permission-summary-cell permission-items-col">${renderGroupPermissionSummary(role)}</td><td class="permission-actions-col"><button class="settings-icon-btn" type="button" data-edit-access-role="${escapeHtml(role.id)}" aria-label="編輯" title="編輯">${actionIcon("edit")}</button><button class="settings-icon-btn settings-icon-btn-danger" type="button" data-delete-access-role="${escapeHtml(role.id)}" aria-label="刪除" title="刪除">${actionIcon("delete")}</button></td></tr>`).join("")}</tbody></table></div>`,
    headerButtons: '<button class="btn-primary" type="button" data-add-access-role="true">新增</button>',
    hideFooterClose: true
  });
}

function accessPermissionCheckbox(attributeText, permission, label, checked) {
  return `<label class="permission-check"><input type="checkbox" ${attributeText}="${permission}" ${checked ? "checked" : ""}>${escapeHtml(label)}</label>`;
}

function openAccessRoleForm(roleId = "") {
  const role = getAllRoles().find((item) => item.id === roleId) || { id: "", code: "", name: "", nameVi: "", commonPermissions: [], groupPermissions: [] };
  const common = new Set(role.commonPermissions || []);
  modalContext = { category: "access-role-form", targetId: role.id || "" };
  openEntityListModal({
    title: role.id ? "修改角色" : "新增角色",
    modalClass: "modal modal-wide access-role-form-modal",
    body: `<div class="form-row"><label for="accessRoleName">角色名稱</label><input id="accessRoleName" type="text" maxlength="30" value="${escapeHtml(role.name)}"></div><div class="form-row"><label for="accessRoleNameVi">越文名稱</label><input id="accessRoleNameVi" type="text" maxlength="60" value="${escapeHtml(role.nameVi || "")}" placeholder="可留空"></div><fieldset class="role-permission-fieldset"><legend>共用權限</legend><div class="role-permission-grid">${Object.entries(COMMON_PERMISSION_LABELS).map(([permission,label]) => accessPermissionCheckbox("data-role-common-permission", permission, label, common.has(permission))).join("")}</div></fieldset><fieldset class="role-group-fieldset"><legend>群組權限</legend><div class="records-table-wrap"><table class="records-table role-group-permission-table"><thead><tr><th>群組</th>${Object.values(GROUP_PERMISSION_LABELS).map((label) => `<th>${escapeHtml(label)}</th>`).join("")}</tr></thead><tbody>${getAllGroups().map((group) => { const selected = new Set(getRoleGroupPermissions(role, group.id)); return `<tr data-role-group-row="${escapeHtml(group.id)}"><td>${escapeHtml(getLocalizedName(group))}</td>${Object.entries(GROUP_PERMISSION_LABELS).map(([permission,label]) => `<td>${accessPermissionCheckbox(`data-role-group-permission="${group.id}" data-role-group-permission-name`, permission, label, selected.has(permission))}</td>`).join("")}</tr>`; }).join("")}</tbody></table></div></fieldset>`,
    headerButtons: `<button class="btn-primary" type="button" data-save-access-role="true">${role.id ? "儲存修改" : "新增"}</button>`,
    hideFooterClose: true
  });
}

async function saveAccessRoleFromForm() {
  const name = document.getElementById("accessRoleName")?.value.trim() || "";
  const nameVi = document.getElementById("accessRoleNameVi")?.value.trim() || "";
  if (!name) { reportValidationError("請填寫角色名稱"); return; }
  const existing = getAllRoles().find((role) => role.id === modalContext.targetId) || null;
  const commonPermissions = Array.from(document.querySelectorAll("[data-role-common-permission]:checked")).map((input) => input.dataset.roleCommonPermission || "").filter(Boolean);
  const groupPermissions = getAllGroups().map((group) => ({
    groupId: group.id,
    permissions: Array.from(document.querySelectorAll(`[data-role-group-permission="${group.id}"]:checked`)).map((input) => input.dataset.roleGroupPermissionName || "").filter(Boolean)
  })).filter((row) => row.permissions.length);
  await window.schedulerApi.saveAccessRole({ id: existing?.id || "", code: existing?.code || "", name, nameVi, commonPermissions, groupPermissions, sortOrder: existing?.sortOrder ?? getAllRoles().length });
  await reloadGroupApplicationState();
  openPermissionSettings();
}

async function deleteAccessRole(roleId) {
  const role = getAllRoles().find((item) => item.id === roleId);
  if (!role) return;
  if (!await confirmAction(`確定要刪除角色「${role.name}」嗎？`)) return;
  await window.schedulerApi.deleteAccessRole(roleId);
  await reloadGroupApplicationState();
  openPermissionSettings();
}
'''
    source = replace_section(source, "function permissionSummary(role)", "async function loadArchiveList", role_ui, "role UI")
    source = source.replace('await window.schedulerApi.reorderSettings("access-role", orderedIds);', 'await window.schedulerApi.reorderAccessRoles(orderedIds);')
    source = source.replace('if (!hasPermission("group_settings")) return;', 'if (!hasCommonPermission("settings")) return;')
    source = source.replace('if (!hasPermission("permission_settings")) return;', 'if (!hasCommonPermission("settings")) return;')
    source = source.replace('if (!hasPermission("schedule_view")) return;', 'if (!hasGroupPermission(groupFeatureState.currentGroupId, "schedule_view")) return;')
    source = source.replace('hasPermission("schedule_manage")', 'hasGroupPermission(groupFeatureState.currentGroupId, "schedule_manage")')
    source = source.replace('roleAppliesToGroup(archive.group_id)', 'hasGroupPermission(archive.group_id, "schedule_manage")')
    source = source.replace('${hasPermission("permission_settings") ? "" : "disabled"}', '${hasCommonPermission("settings") ? "" : "disabled"}')

    old_event = r'''if (target.dataset.rolePermission === "schedule_manage" && target.checked) {
      const view = document.querySelector('[data-role-permission="schedule_view"]');
      if (view) view.checked = true;
      return;
    }
    if (target.dataset.rolePermission === "schedule_view" && !target.checked) {
      const manage = document.querySelector('[data-role-permission="schedule_manage"]');
      if (manage) manage.checked = false;
    }'''
    new_event = r'''if (target.dataset.roleGroupPermissionName === "schedule_manage" && target.checked) {
      const groupId = target.dataset.roleGroupPermission || "";
      const view = document.querySelector(`[data-role-group-permission="${groupId}"][data-role-group-permission-name="schedule_view"]`);
      if (view) view.checked = true;
      return;
    }
    if (target.dataset.roleGroupPermissionName === "schedule_view" && !target.checked) {
      const groupId = target.dataset.roleGroupPermission || "";
      const manage = document.querySelector(`[data-role-group-permission="${groupId}"][data-role-group-permission-name="schedule_manage"]`);
      if (manage) manage.checked = false;
    }'''
    if old_event in source:
        source = source.replace(old_event, new_event)

    # Review group filter is based on attendance_review, not schedule_view.
    source = re.sub(
        r'''function renderAttendanceGroupOptions\(selectedValue\) \{ return `<option value="">全部群組</option>\$\{getSelectableGroups\(\)\.map''',
        'function renderAttendanceGroupOptions(selectedValue) { const reviewGroups = getAllGroups().filter((group) => group.status === "active" && hasGroupPermission(group.id, "attendance_review")); return `<option value="">全部群組</option>${reviewGroups.map',
        source,
    )
    write(file, source)


def transform_auth_and_renderer_calls():
    file = "src/renderer/renderer-auth-context.js"
    source = read(file)
    source = replace_section(
        source,
        "function canManagePermissions()",
        "async function ensureManagerDirectoryLoaded()",
        r'''function canManagePermissions() {
  return hasCommonPermission("settings");
}

function hasManagementAccess() {
  if (getCommonPermissions().length) return true;
  const groupMap = getAccessActor().groupPermissions;
  return Boolean(groupMap && typeof groupMap === "object" && Object.values(groupMap).some((permissions) => Array.isArray(permissions) && permissions.some((permission) => permission !== "schedule_view")));
}

function canEditSchedule() {
  return hasGroupPermission(groupFeatureState.currentGroupId, "schedule_manage");
}

function canManageMembersInCurrentGroup() {
  return hasGroupPermission(groupFeatureState.currentGroupId, "schedule_manage");
}

function canManageDepartmentsInCurrentGroup() {
  return hasGroupPermission(groupFeatureState.currentGroupId, "department_settings");
}
''',
        "auth helpers",
    )
    source = re.sub(
        r'''function canEditMemberAccount\(_member\) \{
\s*return hasPermission\("member_settings"\);
\}''',
        'function canEditMemberAccount(member) {\n  return hasGroupPermission(member?.groupId || groupFeatureState.currentGroupId, "schedule_manage");\n}',
        source,
    )
    source = source.replace("if (!hasManagementAccess() || managerDirectoryLoaded)", 'if (!hasAnyGroupPermission("schedule_manage") || managerDirectoryLoaded)')
    write(file, source)

    renderer_dir = ROOT / "src/renderer"
    skip = {"app.js", "app-config.js", "renderer-groups-permissions-archive.js", "renderer-auth-context.js"}
    for path in renderer_dir.glob("*.js"):
        if path.name in skip:
            continue
        source = path.read_text(encoding="utf-8")
        source = source.replace('hasPermission("permission_settings")', 'hasCommonPermission("settings")')
        source = source.replace('hasPermission("group_settings")', 'hasCommonPermission("settings")')
        source = source.replace('hasPermission("leave_settings")', 'hasCommonPermission("leave_settings")')
        source = source.replace('hasPermission("member_settings")', 'hasGroupPermission(groupFeatureState.currentGroupId, "schedule_manage")')
        source = source.replace('hasPermission("schedule_manage")', 'hasGroupPermission(groupFeatureState.currentGroupId, "schedule_manage")')
        source = source.replace('hasPermission("schedule_view")', 'hasGroupPermission(groupFeatureState.currentGroupId, "schedule_view")')
        source = source.replace('hasPermission("department_settings")', 'hasGroupPermission(groupFeatureState.currentGroupId, "department_settings")')
        source = source.replace('hasPermission("attendance_review")', 'hasAnyGroupPermission("attendance_review")')
        source = source.replace('hasPermission("meal_admin")', 'hasAnyGroupPermission("meal_admin")')
        path.write_text(source, encoding="utf-8")


def update_checks_and_deploy():
    file = "scripts/deploy-edge-functions.ps1"
    source = read(file)
    source = source.replace('$functions = @(\n  "member-auth-admin",', '$functions = @(\n  "access-control",\n  "member-auth-admin",')
    write(file, source)

    file = ".github/workflows/deploy-pages.yml"
    source = read(file)
    source = source.replace(
        "          deno check --node-modules-dir=auto supabase/functions/attendance-clock/index.ts",
        "          deno check --node-modules-dir=auto supabase/functions/access-control/index.ts\n          deno check --node-modules-dir=auto supabase/functions/attendance-clock/index.ts",
    )
    source = source.replace(
        "          ! grep -R -nE 'legacy_role|access_role_legacy_role' supabase/functions",
        "          ! grep -R -nE 'legacy_role|access_role_legacy_role|access_role_groups|has_access_permission|can_access_group|role_applies_to_group' supabase/functions",
    )
    write(file, source)

    file = "tests/access-architecture.test.js"
    source = read(file)
    source = source.replace('"access_roles", "access_role_groups", "schedule_archives"', '"access_roles", "access_role_group_permissions", "schedule_archives"')
    source = source.replace("  assert.match(sql, /has_access_permission/);", "  assert.match(sql, /has_common_permission/);\n  assert.match(sql, /has_group_permission/);\n  assert.match(sql, /access_role_group_permissions/);")
    source = source.replace("  assert.match(sql, /'permission_settings'/);", "  assert.match(sql, /'settings'/);")
    source = source.replace(
        "  assert.doesNotMatch(sql, /employee\\.role\\s*=\\s*'admin'/);",
        "  assert.doesNotMatch(sql, /employee\\.role\\s*=\\s*'admin'/);\n  assert.doesNotMatch(sql, /create table if not exists public\\.access_role_groups/);\n  assert.doesNotMatch(sql, /function public\\.(?:has_access_permission|can_access_group|role_applies_to_group)/);",
    )
    source = source.replace(
        "  assert.match(webApi, /accessRoleId: member\\?\\.roleId/);",
        "  assert.match(webApi, /accessRoleId: member\\?\\.roleId/);\n  assert.match(webApi, /requestFunction\\(\"access-control\"/);",
    )
    write(file, source)

    file = "scripts/check-normalized-storage.js"
    source = read(file)
    target = 'assert(webApi.includes(\'requestFunction("member-auth-admin"\'), "member account mutations must use the canonical member-auth-admin Edge Function");'
    source = source.replace(target, target + '\nassert(webApi.includes(\'requestFunction("access-control"\'), "access role operations must use the canonical access-control Edge Function");')
    write(file, source)


def add_architecture_test():
    source = r'''const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const sql = read("supabase/002_current_updates.sql");
const webApi = read("src/renderer/web-api.js");
const groups = read("src/renderer/renderer-groups-permissions-archive.js");
const runtime = read("supabase/functions/_shared/runtime.ts");

test("權限資料模型只保留最新版", () => {
  assert.match(sql, /common_permissions text\[\]/);
  assert.match(sql, /create table if not exists public\.access_role_group_permissions/);
  assert.match(sql, /permissions text\[\] not null default '\{\}'/);
  assert.match(sql, /drop table if exists public\.access_role_groups/);
  assert.match(sql, /alter table public\.access_roles drop column if exists permissions/);
  assert.doesNotMatch(sql, /create(?:\s+or\s+replace)?\s+function public\.(?:has_access_permission|can_access_group|role_applies_to_group)/i);
  assert.doesNotMatch(sql, /create(?:\s+or\s+replace)?\s+function public\.(?:get_group_access_bundle_v1|save_access_role_v1|delete_access_role_v1)/i);
});

test("前端只使用共用與群組權限", () => {
  assert.match(groups, /commonPermissions/);
  assert.match(groups, /groupPermissions/);
  assert.match(groups, /hasCommonPermission/);
  assert.match(groups, /hasGroupPermission/);
  assert.doesNotMatch(groups, /applicableGroupIds|role\.permissions|role\.groupIds|getAccessPermissions|roleAppliesToGroup/);
  assert.match(webApi, /requestFunction\("access-control"/);
  assert.doesNotMatch(webApi, /get_group_access_bundle_v1|save_access_role_v1|delete_access_role_v1/);
});

test("Edge Function 不使用舊權限 helper", () => {
  assert.match(runtime, /hasCommonPermission/);
  assert.match(runtime, /hasGroupPermission/);
  assert.doesNotMatch(runtime, /hasPermission|canAccessGroup|has_access_permission|can_access_group/);
  for (const name of fs.readdirSync(path.join(root, "supabase/functions"))) {
    const index = path.join(root, "supabase/functions", name, "index.ts");
    if (!fs.existsSync(index)) continue;
    const source = fs.readFileSync(index, "utf8");
    assert.doesNotMatch(source, /access_role_groups|has_access_permission|can_access_group|role_applies_to_group/);
  }
});
'''
    write("tests/access-control-v2.test.js", source)


transform_sql()
transform_runtime()
transform_edge_permissions()
transform_member_auth()
write_access_control_edge()
transform_web_api()
transform_renderer_permissions()
transform_auth_and_renderer_calls()
update_checks_and_deploy()
add_architecture_test()
print("access control v2 transformation completed")
