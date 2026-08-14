const { BackendError } = require("../errors");

function createNativeAccessRepository(database) {
  if (!database || typeof database.one !== "function" || typeof database.query !== "function") {
    throw new BackendError(500, "ACCESS_DATABASE_REQUIRED", "權限資料層尚未設定資料庫");
  }

  async function getAccessBundle(employeeId) {
    const id = String(employeeId || "").trim();
    if (!id) {
      throw new BackendError(401, "AUTH_REQUIRED", "請先登入");
    }

    const actor = await database.one(`
      select
        employee.group_id,
        employee.access_role_id,
        role.name as role_name,
        role.permissions,
        coalesce(array(
          select role_group.group_id
          from public.access_role_groups role_group
          join public.schedule_groups grp on grp.id = role_group.group_id
          where role_group.role_id = employee.access_role_id
            and grp.deleted_at is null
          order by grp.sort_order, grp.name, grp.id
        ), '{}'::uuid[]) as applicable_group_ids
      from public.set_employee employee
      join public.access_roles role on role.id = employee.access_role_id
      where employee.id = $1::uuid
        and employee.deleted_at is null
        and public.is_employee_account_effective(
          employee.hire_date,
          employee.leave_date,
          (timezone('Asia/Taipei', now()))::date
        )
      limit 1
    `, [id]);

    if (!actor) {
      throw new BackendError(401, "AUTH_REQUIRED", "登入已失效，請重新登入");
    }

    const permissions = Array.isArray(actor.permissions) ? actor.permissions : [];
    const canManagePermissions = permissions.includes("permission_settings");
    const canManageMembers = permissions.includes("member_settings");

    const groupsResult = await database.query(`
      select
        grp.id,
        grp.code,
        grp.name,
        grp.meal_enabled,
        grp.status,
        grp.sort_order,
        coalesce(
          array_agg(department.name order by department.sort_order, department.name)
            filter (where department.id is not null),
          '{}'::text[]
        ) as unit_names
      from public.schedule_groups grp
      left join public.set_departments department
        on department.group_id = grp.id
       and department.deleted_at is null
      where grp.deleted_at is null
        and (
          $2::boolean
          or exists (
            select 1
            from public.access_role_groups role_group
            where role_group.role_id = $3::uuid
              and role_group.group_id = grp.id
          )
        )
      group by grp.id
      order by grp.sort_order, grp.name, grp.id
    `, [id, canManagePermissions, String(actor.access_role_id)]);

    const rolesResult = await database.query(`
      select
        role.id,
        role.code,
        role.name,
        role.permissions,
        role.is_system,
        role.sort_order,
        coalesce(
          array_agg(role_group.group_id order by grp.sort_order, grp.name, grp.id)
            filter (where grp.id is not null),
          '{}'::uuid[]
        ) as group_ids
      from public.access_roles role
      left join public.access_role_groups role_group on role_group.role_id = role.id
      left join public.schedule_groups grp
        on grp.id = role_group.group_id
       and grp.deleted_at is null
      where $2::boolean
         or $3::boolean
         or role.id = $4::uuid
      group by role.id
      order by role.sort_order, role.name, role.id
    `, [id, canManagePermissions, canManageMembers, String(actor.access_role_id)]);

    return {
      actor: {
        groupId: actor.group_id,
        roleId: actor.access_role_id,
        roleName: actor.role_name,
        permissions,
        applicableGroupIds: Array.isArray(actor.applicable_group_ids)
          ? actor.applicable_group_ids
          : []
      },
      groups: (groupsResult.rows || []).map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        mealEnabled: row.meal_enabled === true,
        status: row.status,
        sortOrder: Number(row.sort_order || 0),
        unitNames: Array.isArray(row.unit_names) ? row.unit_names : []
      })),
      roles: (rolesResult.rows || []).map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        permissions: Array.isArray(row.permissions) ? row.permissions : [],
        isSystem: row.is_system === true,
        groupIds: Array.isArray(row.group_ids) ? row.group_ids : [],
        sortOrder: Number(row.sort_order || 0)
      }))
    };
  }

  return Object.freeze({ getAccessBundle });
}

module.exports = {
  createNativeAccessRepository
};