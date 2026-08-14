const { BackendError } = require("../errors");

function createNativeScheduleRepository(database) {
  if (!database || typeof database.one !== "function" || typeof database.query !== "function") {
    throw new BackendError(500, "SCHEDULE_DATABASE_REQUIRED", "班表資料層尚未設定資料庫");
  }

  async function getBootstrap(employeeId, documentId = "default") {
    const id = String(employeeId || "").trim();
    if (!id) {
      throw new BackendError(401, "AUTH_REQUIRED", "請先登入");
    }
    const documentKey = String(documentId || "default").trim() || "default";

    const row = await database.one(`
      with actor as materialized (
        select employee.access_role_id
        from public.set_employee employee
        join public.access_roles role on role.id = employee.access_role_id
        where employee.id = $1::uuid
          and employee.deleted_at is null
          and 'schedule_view' = any(coalesce(role.permissions, '{}'::text[]))
          and public.is_employee_account_effective(
            employee.hire_date,
            employee.leave_date,
            (timezone('Asia/Taipei', now()))::date
          )
        limit 1
      ),
      allowed_groups as materialized (
        select role_group.group_id
        from actor
        join public.access_role_groups role_group on role_group.role_id = actor.access_role_id
      ),
      visible_schedule as materialized (
        select entry.*
        from public.schedule_entries entry
        join allowed_groups allowed on allowed.group_id = entry.group_id
        where not exists (
          select 1
          from public.schedule_archives archive
          where archive.group_id = entry.group_id
            and entry.work_date between archive.start_date and archive.end_date
        )
      ),
      visible_departments as (
        select department.*
        from public.set_departments department
        join allowed_groups allowed on allowed.group_id = department.group_id
        where department.deleted_at is null
           or exists (
             select 1
             from visible_schedule entry
             left join public.set_employee member on member.id = entry.member_id
             where entry.support_department_id = department.id
                or (entry.support_department_id is null and member.home_department_id = department.id)
           )
      ),
      visible_members as (
        select member.*
        from public.set_employee member
        join allowed_groups allowed on allowed.group_id = member.group_id
        where member.deleted_at is null
           or exists (select 1 from visible_schedule entry where entry.member_id = member.id)
      ),
      visible_shifts as (
        select shift.*
        from public.set_shift shift
        join allowed_groups allowed on allowed.group_id = shift.group_id
        where shift.deleted_at is null
           or exists (select 1 from visible_schedule entry where entry.shift_type_id = shift.id)
      ),
      visible_leaves as (
        select leave_item.*
        from public.set_leave leave_item
        where leave_item.deleted_at is null
           or exists (select 1 from visible_schedule entry where entry.leave_type_id = leave_item.id)
      ),
      visible_overtime as (
        select overtime_item.*
        from public.set_overtime overtime_item
        where overtime_item.deleted_at is null
           or exists (select 1 from visible_schedule entry where entry.overtime_type_id = overtime_item.id)
      )
      select case when exists(select 1 from actor) then jsonb_build_object(
        'settings', coalesce((
          select to_jsonb(setting)
          from public.scheduler_settings setting
          where setting.id = $2
          limit 1
        ), '{}'::jsonb),
        'departments', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', department.id,
            'name', department.name,
            'group_id', department.group_id,
            'start_date', department.start_date,
            'end_date', department.end_date,
            'hidden_from_schedule', department.hidden_from_schedule,
            'sort_order', department.sort_order,
            'deleted_at', department.deleted_at
          ) order by department.sort_order, department.name, department.id)
          from visible_departments department
        ), '[]'::jsonb),
        'members', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', member.id,
            'employee_code', member.employee_code,
            'full_name', member.full_name,
            'group_id', member.group_id,
            'access_role_id', member.access_role_id,
            'home_department_id', member.home_department_id,
            'hire_date', member.hire_date,
            'leave_date', member.leave_date,
            'pay_by_day', member.pay_by_day,
            'fixed_rest_weekday', member.fixed_rest_weekday,
            'schedule_shift_ids', member.schedule_shift_ids,
            'monthly_rest_days', member.monthly_rest_days,
            'sort_order', member.sort_order,
            'deleted_at', member.deleted_at
          ) order by member.sort_order, member.full_name, member.id)
          from visible_members member
        ), '[]'::jsonb),
        'shifts', coalesce((
          select jsonb_agg(to_jsonb(shift) order by shift.sort_order, shift.name, shift.id)
          from visible_shifts shift
        ), '[]'::jsonb),
        'leaves', coalesce((
          select jsonb_agg(to_jsonb(leave_item) order by leave_item.sort_order, leave_item.code, leave_item.id)
          from visible_leaves leave_item
        ), '[]'::jsonb),
        'overtime', coalesce((
          select jsonb_agg(to_jsonb(overtime_item) order by overtime_item.sort_order, overtime_item.name, overtime_item.id)
          from visible_overtime overtime_item
        ), '[]'::jsonb),
        'holidays', coalesce((
          select jsonb_agg(to_jsonb(holiday) order by holiday.sort_order, holiday.holiday_date, holiday.id)
          from public.holidays holiday
        ), '[]'::jsonb)
      ) else null end as payload
    `, [id, documentKey]);

    return row?.payload || null;
  }

  async function getEntries(employeeId, startDate, endDate, offset = 0, limit = 1000) {
    const id = String(employeeId || "").trim();
    if (!id) {
      throw new BackendError(401, "AUTH_REQUIRED", "請先登入");
    }

    const safeOffset = Math.max(0, Number(offset) || 0);
    const safeLimit = Math.min(1000, Math.max(1, Number(limit) || 1000));
    const result = await database.query(`
      with actor as materialized (
        select employee.access_role_id
        from public.set_employee employee
        join public.access_roles role on role.id = employee.access_role_id
        where employee.id = $1::uuid
          and employee.deleted_at is null
          and 'schedule_view' = any(coalesce(role.permissions, '{}'::text[]))
          and public.is_employee_account_effective(
            employee.hire_date,
            employee.leave_date,
            (timezone('Asia/Taipei', now()))::date
          )
        limit 1
      ),
      allowed_groups as materialized (
        select role_group.group_id
        from actor
        join public.access_role_groups role_group on role_group.role_id = actor.access_role_id
      )
      select entry.*
      from public.schedule_entries entry
      join allowed_groups allowed on allowed.group_id = entry.group_id
      where $2::date is not null
        and $3::date is not null
        and $2::date <= $3::date
        and entry.work_date between $2::date and $3::date
      order by entry.work_date, entry.member_id, entry.id
      limit $5::integer
      offset $4::integer
    `, [id, startDate || null, endDate || null, safeOffset, safeLimit]);

    return result.rows || [];
  }

  return Object.freeze({
    getBootstrap,
    getEntries
  });
}

module.exports = {
  createNativeScheduleRepository
};
