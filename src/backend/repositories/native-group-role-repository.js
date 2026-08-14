const { BackendError } = require("../errors");

const GROUP_PERMISSION = "group_settings";
const ROLE_PERMISSION = "permission_settings";
const ALLOWED_PERMISSIONS = Object.freeze([
  "schedule_view",
  "schedule_manage",
  "group_settings",
  "department_settings",
  "member_settings",
  "leave_settings",
  "permission_settings",
  "attendance_review",
  "meal_admin"
]);
const GROUP_SCOPED_PERMISSIONS = Object.freeze([
  "schedule_view",
  "schedule_manage",
  "group_settings",
  "department_settings",
  "member_settings",
  "attendance_review",
  "meal_admin"
]);

function createNativeGroupRoleRepository(database) {
  if (!database || typeof database.one !== "function" || typeof database.query !== "function" || typeof database.transaction !== "function") {
    throw new BackendError(500, "GROUP_ROLE_DATABASE_REQUIRED", "群組與角色資料層尚未設定資料庫");
  }

  async function getActor(transaction, employeeId) {
    const row = await transaction.one(`
      select
        employee.id,
        employee.access_role_id,
        role.permissions,
        coalesce(array_agg(role_group.group_id) filter (where role_group.group_id is not null), '{}'::uuid[]) as group_ids
      from public.set_employee employee
      join public.access_roles role on role.id = employee.access_role_id
      left join public.access_role_groups role_group on role_group.role_id = role.id
      where employee.id = $1::uuid
        and employee.deleted_at is null
        and public.is_employee_account_effective(
          employee.hire_date,
          employee.leave_date,
          (timezone('Asia/Taipei', now()))::date
        )
      group by employee.id, employee.access_role_id, role.permissions
      limit 1
    `, [employeeId]);
    if (!row?.id) throw new BackendError(401, "AUTH_REQUIRED", "請先登入");
    return {
      id: String(row.id),
      roleId: String(row.access_role_id),
      permissions: Array.isArray(row.permissions) ? row.permissions : [],
      groupIds: new Set((Array.isArray(row.group_ids) ? row.group_ids : []).map(String))
    };
  }

  function requirePermission(actor, permission, message) {
    if (!actor.permissions.includes(permission)) {
      throw new BackendError(403, "ACCESS_DENIED", message);
    }
  }

  function actorCanGroup(actor, groupId) {
    return actor.permissions.includes(ROLE_PERMISSION) || actor.groupIds.has(String(groupId || ""));
  }

  async function saveGroup(employeeId, group) {
    try {
      return await database.transaction(async (transaction) => {
        const actor = await getActor(transaction, employeeId);
        requirePermission(actor, GROUP_PERMISSION, "沒有群組設定權限");
        const existing = group.suppliedId
          ? await transaction.one(`
              select id, deleted_at
              from public.schedule_groups
              where id = $1::uuid
              for update
            `, [group.id])
          : null;
        const created = !existing?.id;
        if (existing?.id && !actorCanGroup(actor, existing.id)) {
          throw new BackendError(403, "GROUP_MANAGE_DENIED", "此角色不可管理該群組");
        }
        if (group.suppliedId && !existing?.id && !actor.permissions.includes(ROLE_PERMISSION)) {
          throw new BackendError(403, "GROUP_MANAGE_DENIED", "此角色不可管理該群組");
        }

        const row = await transaction.one(`
          insert into public.schedule_groups(
            id, code, name, meal_enabled, status, sort_order, deleted_at
          ) values (
            $1::uuid, $2, $3, $4::boolean, $5, $6::integer, null
          )
          on conflict(id) do update set
            code = excluded.code,
            name = excluded.name,
            meal_enabled = excluded.meal_enabled,
            status = excluded.status,
            sort_order = excluded.sort_order,
            deleted_at = null,
            updated_at = now()
          returning id, code, name, meal_enabled, status, sort_order
        `, [group.id, group.code, group.name, group.mealEnabled, group.status, group.sortOrder]);
        if (!row?.id) throw new BackendError(409, "GROUP_SAVE_FAILED", "群組儲存失敗");

        if (created) {
          await transaction.query(`
            insert into public.access_role_groups(role_id, group_id)
            values ($1::uuid, $2::uuid)
            on conflict do nothing
          `, [actor.roleId, row.id]);
        }
        return {
          ok: true,
          group: {
            id: String(row.id),
            code: row.code,
            name: row.name,
            mealEnabled: row.meal_enabled === true,
            status: row.status,
            sortOrder: Number(row.sort_order || 0)
          }
        };
      });
    } catch (error) {
      if (error?.code === "23505") {
        throw new BackendError(409, "GROUP_CODE_DUPLICATE", "群組代碼已存在");
      }
      throw error;
    }
  }

  async function deleteGroup(employeeId, groupId, confirmName) {
    return database.transaction(async (transaction) => {
      const actor = await getActor(transaction, employeeId);
      requirePermission(actor, GROUP_PERMISSION, "沒有群組設定權限");
      if (!actor.groupIds.has(String(groupId))) {
        throw new BackendError(403, "GROUP_DELETE_DENIED", "沒有刪除此群組的權限");
      }

      const group = await transaction.one(`
        select id, name
        from public.schedule_groups
        where id = $1::uuid and deleted_at is null
        for update
      `, [groupId]);
      if (!group?.id) throw new BackendError(404, "GROUP_NOT_FOUND", "找不到群組");
      if (String(confirmName || "").trim() !== String(group.name || "")) {
        throw new BackendError(400, "GROUP_CONFIRM_NAME_MISMATCH", "群組名稱確認不符");
      }

      const counts = await transaction.one(`
        select
          (select count(*)::integer from public.set_departments where group_id = $1::uuid and deleted_at is null) as departments,
          (select count(*)::integer from public.set_shift where group_id = $1::uuid and deleted_at is null) as shifts,
          (select count(*)::integer from public.set_employee where group_id = $1::uuid and deleted_at is null) as members,
          (select count(*)::integer from public.schedule_entries where group_id = $1::uuid and not public.is_schedule_date_archived($1::uuid, work_date)) as unarchived_schedules,
          (select count(*)::integer from public.schedule_archives where group_id = $1::uuid) as archives
      `, [groupId]);

      await transaction.query(`
        delete from public.schedule_entries
        where group_id = $1::uuid
          and not public.is_schedule_date_archived($1::uuid, work_date)
      `, [groupId]);
      await transaction.query("select set_config('fyh.group_delete', 'on', true)");
      await transaction.query(`
        update public.set_employee
        set group_id = null,
            home_department_id = null,
            schedule_shift_ids = '{}'::uuid[],
            updated_at = now()
        where group_id = $1::uuid and deleted_at is null
      `, [groupId]);
      await transaction.query(`
        update public.set_shift
        set deleted_at = now(), updated_at = now()
        where group_id = $1::uuid and deleted_at is null
      `, [groupId]);
      await transaction.query(`
        update public.set_departments
        set deleted_at = now(), updated_at = now()
        where group_id = $1::uuid and deleted_at is null
      `, [groupId]);
      await transaction.query(`
        update public.schedule_groups
        set deleted_at = now(), status = 'inactive', updated_at = now()
        where id = $1::uuid
      `, [groupId]);

      return {
        ok: true,
        counts: {
          departments: Number(counts?.departments || 0),
          shifts: Number(counts?.shifts || 0),
          members: Number(counts?.members || 0),
          unarchivedSchedules: Number(counts?.unarchived_schedules || 0),
          archives: Number(counts?.archives || 0)
        }
      };
    });
  }

  async function reorderGroups(employeeId, groupIds) {
    return database.transaction(async (transaction) => {
      const actor = await getActor(transaction, employeeId);
      requirePermission(actor, GROUP_PERMISSION, "沒有群組設定權限");
      let order = 0;
      for (const groupId of groupIds) {
        if (!actorCanGroup(actor, groupId)) continue;
        const result = await transaction.query(`
          update public.schedule_groups
          set sort_order = $2::integer, updated_at = now()
          where id = $1::uuid and deleted_at is null
        `, [groupId, order]);
        if (result.rowCount > 0) order += 1;
      }
      return { ok: true, count: order };
    });
  }

  async function countOtherEffectivePrivilegedEmployees(transaction, roleId) {
    const row = await transaction.one(`
      select count(*)::integer as count
      from public.set_employee employee
      join public.access_roles role on role.id = employee.access_role_id
      where employee.access_role_id <> $1::uuid
        and employee.deleted_at is null
        and 'permission_settings' = any(coalesce(role.permissions, '{}'::text[]))
        and public.is_employee_account_effective(
          employee.hire_date,
          employee.leave_date,
          (timezone('Asia/Taipei', now()))::date
        )
    `, [roleId]);
    return Number(row?.count || 0);
  }

  async function roleHasEffectiveEmployee(transaction, roleId) {
    const row = await transaction.one(`
      select exists(
        select 1
        from public.set_employee employee
        where employee.access_role_id = $1::uuid
          and employee.deleted_at is null
          and public.is_employee_account_effective(
            employee.hire_date,
            employee.leave_date,
            (timezone('Asia/Taipei', now()))::date
          )
      ) as used
    `, [roleId]);
    return row?.used === true;
  }

  async function saveRole(employeeId, role) {
    try {
      return await database.transaction(async (transaction) => {
        const actor = await getActor(transaction, employeeId);
        requirePermission(actor, ROLE_PERMISSION, "沒有權限設定權限");

        const existing = role.suppliedId
          ? await transaction.one(`
              select id, code, name, permissions, is_system, sort_order
              from public.access_roles
              where id = $1::uuid
              for update
            `, [role.id])
          : null;

        const wasPrivileged = Array.isArray(existing?.permissions) && existing.permissions.includes(ROLE_PERMISSION);
        const willBePrivileged = role.permissions.includes(ROLE_PERMISSION);
        if (wasPrivileged && !willBePrivileged
          && await roleHasEffectiveEmployee(transaction, existing.id)
          && await countOtherEffectivePrivilegedEmployees(transaction, existing.id) === 0) {
          throw new BackendError(409, "LAST_PRIVILEGED_ACCOUNT", "系統必須保留至少一個有效的權限管理帳號");
        }

        const row = existing?.id
          ? await transaction.one(`
              update public.access_roles
              set name = $2,
                  permissions = $3::text[],
                  updated_at = now()
              where id = $1::uuid
              returning id, code, name, permissions, is_system, sort_order
            `, [existing.id, role.name, role.permissions])
          : await transaction.one(`
              insert into public.access_roles(id, code, name, permissions, is_system, sort_order)
              values ($1::uuid, $2, $3, $4::text[], false, $5::integer)
              returning id, code, name, permissions, is_system, sort_order
            `, [role.id, role.code, role.name, role.permissions, role.sortOrder]);
        if (!row?.id) throw new BackendError(409, "ACCESS_ROLE_SAVE_FAILED", "權限角色儲存失敗");

        await transaction.query(`
          delete from public.access_role_groups role_group
          using public.schedule_groups grp
          where role_group.role_id = $1::uuid
            and grp.id = role_group.group_id
            and grp.deleted_at is null
        `, [row.id]);
        if (role.groupIds.length) {
          await transaction.query(`
            insert into public.access_role_groups(role_id, group_id)
            select $1::uuid, id
            from public.schedule_groups
            where id = any($2::uuid[]) and deleted_at is null
            on conflict do nothing
          `, [row.id, role.groupIds]);
        }

        return {
          ok: true,
          role: {
            id: String(row.id),
            code: row.code,
            name: row.name,
            permissions: Array.isArray(row.permissions) ? row.permissions : [],
            isSystem: row.is_system === true,
            groupIds: role.groupIds,
            sortOrder: Number(row.sort_order || 0)
          }
        };
      });
    } catch (error) {
      if (error?.code === "23505") {
        throw new BackendError(409, "ACCESS_ROLE_DUPLICATE", "角色代碼或名稱已存在");
      }
      throw error;
    }
  }

  async function deleteRole(employeeId, roleId) {
    return database.transaction(async (transaction) => {
      const actor = await getActor(transaction, employeeId);
      requirePermission(actor, ROLE_PERMISSION, "沒有權限設定權限");
      const role = await transaction.one(`
        select id, permissions
        from public.access_roles
        where id = $1::uuid
        for update
      `, [roleId]);
      if (!role?.id) return { ok: true, deleted: false };

      const used = await transaction.one(`
        select exists(
          select 1 from public.set_employee
          where access_role_id = $1::uuid and deleted_at is null
        ) as used
      `, [roleId]);
      if (used?.used === true) {
        throw new BackendError(409, "ACCESS_ROLE_IN_USE", "此角色仍有人員使用，請先改用其他角色");
      }

      const permissions = Array.isArray(role.permissions) ? role.permissions : [];
      if (permissions.includes(ROLE_PERMISSION)) {
        const remaining = await transaction.one(`
          select count(*)::integer as count
          from public.access_roles
          where id <> $1::uuid
            and 'permission_settings' = any(coalesce(permissions, '{}'::text[]))
        `, [roleId]);
        if (Number(remaining?.count || 0) === 0) {
          throw new BackendError(409, "LAST_PERMISSION_ROLE", "系統必須保留至少一個權限設定角色");
        }
      }

      await transaction.query("delete from public.access_roles where id = $1::uuid", [roleId]);
      return { ok: true, deleted: true };
    });
  }

  return Object.freeze({
    saveGroup,
    deleteGroup,
    reorderGroups,
    saveRole,
    deleteRole
  });
}

module.exports = {
  ALLOWED_PERMISSIONS,
  GROUP_SCOPED_PERMISSIONS,
  createNativeGroupRoleRepository
};
