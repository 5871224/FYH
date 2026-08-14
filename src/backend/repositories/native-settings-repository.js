const { BackendError } = require("../errors");

const CATEGORY_CONFIG = Object.freeze({
  department: Object.freeze({
    table: "public.set_departments",
    permission: "department_settings",
    groupScoped: true,
    deniedMessage: "沒有單位排序權限"
  }),
  member: Object.freeze({
    table: "public.set_employee",
    permission: "member_settings",
    groupScoped: true,
    deniedMessage: "沒有人員排序權限"
  }),
  shift: Object.freeze({
    table: "public.set_shift",
    permission: "schedule_manage",
    groupScoped: true,
    deniedMessage: "沒有班別排序權限"
  }),
  leave: Object.freeze({
    table: "public.set_leave",
    permission: "leave_settings",
    groupScoped: false,
    deniedMessage: "沒有假別排序權限"
  }),
  overtime: Object.freeze({
    table: "public.set_overtime",
    permission: "leave_settings",
    groupScoped: false,
    deniedMessage: "沒有加班設定排序權限"
  }),
  "access-role": Object.freeze({
    table: "public.access_roles",
    permission: "permission_settings",
    groupScoped: false,
    deniedMessage: "沒有角色排序權限",
    allowAllRows: true
  })
});

function createNativeSettingsRepository(database) {
  if (!database
    || typeof database.one !== "function"
    || typeof database.query !== "function"
    || typeof database.transaction !== "function") {
    throw new BackendError(500, "SETTINGS_DATABASE_REQUIRED", "設定資料層尚未設定資料庫");
  }

  async function saveSchedulerPreferences(employeeId, documentId, settings) {
    const actorId = String(employeeId || "").trim();
    if (!actorId) {
      throw new BackendError(401, "AUTH_REQUIRED", "請先登入");
    }
    const id = String(documentId || "default").trim() || "default";
    const payload = JSON.stringify(settings || {});

    const row = await database.one(`
      with actor as (
        select 1
        from public.set_employee employee
        join public.access_roles role on role.id = employee.access_role_id
        where employee.id = $1::uuid
          and employee.deleted_at is null
          and 'schedule_manage' = any(coalesce(role.permissions, '{}'::text[]))
          and public.is_employee_account_effective(
            employee.hire_date,
            employee.leave_date,
            (timezone('Asia/Taipei', now()))::date
          )
        limit 1
      )
      insert into public.scheduler_settings(
        id,
        current_year,
        current_month,
        dept_filter,
        table_view,
        table_dept_scope_filter,
        table_stats_visible,
        schedule_start_date,
        week_start,
        month_start_day,
        eight_week_start_date,
        updated_at
      )
      select
        $2,
        coalesce(($3::jsonb->>'currentYear')::integer, extract(year from now())::integer),
        greatest(0, least(11, coalesce(($3::jsonb->>'currentMonth')::integer, 0))),
        coalesce(nullif($3::jsonb->>'deptFilter', ''), 'all'),
        case when $3::jsonb->>'tableView' = 'shift' then 'shift' else 'member' end,
        coalesce(nullif($3::jsonb->>'tableDeptScopeFilter', ''), 'all'),
        coalesce(($3::jsonb->>'tableStatsVisible')::boolean, true),
        nullif($3::jsonb->>'scheduleStartDate', '')::date,
        greatest(0, least(6, coalesce(($3::jsonb->>'weekStart')::integer, 0))),
        greatest(1, least(31, coalesce(($3::jsonb->>'monthStartDay')::integer, 1))),
        nullif($3::jsonb->>'eightWeekStartDate', '')::date,
        now()
      from actor
      on conflict(id) do update set
        current_year = excluded.current_year,
        current_month = excluded.current_month,
        dept_filter = excluded.dept_filter,
        table_view = excluded.table_view,
        table_dept_scope_filter = excluded.table_dept_scope_filter,
        table_stats_visible = excluded.table_stats_visible,
        schedule_start_date = excluded.schedule_start_date,
        week_start = excluded.week_start,
        month_start_day = excluded.month_start_day,
        eight_week_start_date = excluded.eight_week_start_date,
        updated_at = now()
      returning id
    `, [actorId, id, payload]);

    if (!row?.id) {
      throw new BackendError(403, "SCHEDULE_MANAGE_DENIED", "沒有班表管理權限");
    }
    return { ok: true, id: String(row.id) };
  }

  async function reorderSettings(employeeId, category, ids) {
    const actorId = String(employeeId || "").trim();
    if (!actorId) {
      throw new BackendError(401, "AUTH_REQUIRED", "請先登入");
    }
    const normalizedCategory = String(category || "").trim().toLowerCase();
    const config = CATEGORY_CONFIG[normalizedCategory];
    if (!config) {
      throw new BackendError(400, "SETTINGS_CATEGORY_UNSUPPORTED", "不支援的排序類型");
    }
    const normalizedIds = Array.isArray(ids) ? ids.map((id) => String(id)) : [];
    if (!normalizedIds.length) {
      return { ok: true, category: normalizedCategory, count: 0 };
    }

    return database.transaction(async (transaction) => {
      const actor = await transaction.one(`
        select employee.access_role_id, role.permissions
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
      `, [actorId]);

      const permissions = Array.isArray(actor?.permissions) ? actor.permissions : [];
      if (!actor?.access_role_id || !permissions.includes(config.permission)) {
        throw new BackendError(403, "SETTINGS_REORDER_DENIED", config.deniedMessage);
      }

      let result;
      if (config.groupScoped) {
        result = await transaction.query(`
          update ${config.table} target
          set sort_order = ordered.ordinality - 1,
              updated_at = now()
          from unnest($2::uuid[]) with ordinality ordered(id, ordinality),
               public.access_role_groups allowed
          where target.id = ordered.id
            and target.deleted_at is null
            and allowed.role_id = $1::uuid
            and allowed.group_id = target.group_id
          returning target.id
        `, [String(actor.access_role_id), normalizedIds]);
      } else {
        const activeClause = config.allowAllRows ? "" : "and target.deleted_at is null";
        result = await transaction.query(`
          update ${config.table} target
          set sort_order = ordered.ordinality - 1,
              updated_at = now()
          from unnest($1::uuid[]) with ordinality ordered(id, ordinality)
          where target.id = ordered.id
            ${activeClause}
          returning target.id
        `, [normalizedIds]);
      }

      if (Number(result.rowCount || 0) !== normalizedIds.length) {
        throw new BackendError(403, "SETTINGS_REORDER_SCOPE_DENIED", config.deniedMessage);
      }

      return {
        ok: true,
        category: normalizedCategory,
        count: normalizedIds.length
      };
    });
  }

  return Object.freeze({
    saveSchedulerPreferences,
    reorderSettings
  });
}

module.exports = {
  CATEGORY_CONFIG,
  createNativeSettingsRepository
};
