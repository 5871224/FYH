const { BackendError } = require("../errors");

function createNativeScheduleRepository(database) {
  if (!database
    || typeof database.one !== "function"
    || typeof database.query !== "function"
    || typeof database.transaction !== "function") {
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

  async function saveEntries(employeeId, entries) {
    const id = String(employeeId || "").trim();
    if (!id) {
      throw new BackendError(401, "AUTH_REQUIRED", "請先登入");
    }
    if (!Array.isArray(entries)) {
      throw new BackendError(400, "SCHEDULE_ENTRIES_INVALID", "班表資料格式錯誤");
    }
    if (!entries.length) return [];

    const entriesJson = JSON.stringify(entries);
    return database.transaction(async (transaction) => {
      const actor = await transaction.one(`
        select employee.access_role_id
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
      `, [id]);

      if (!actor?.access_role_id) {
        throw new BackendError(403, "SCHEDULE_MANAGE_DENIED", "沒有班表管理權限");
      }

      const validation = await transaction.one(`
        with incoming as materialized (
          select *
          from jsonb_to_recordset($1::jsonb) as item(
            member_id uuid,
            work_date date,
            delete_entry boolean,
            support_department_id uuid,
            shift_type_id uuid,
            leave_type_id uuid,
            leave_all_day boolean,
            leave_start_time time,
            leave_end_time time,
            leave_reason text,
            overtime_type_id uuid,
            overtime_start_time time,
            overtime_end_time time,
            overtime_use_rest_1 boolean,
            overtime_rest_1_start_time time,
            overtime_rest_1_end_time time,
            overtime_use_rest_2 boolean,
            overtime_rest_2_start_time time,
            overtime_rest_2_end_time time,
            overtime_reason text,
            note text
          )
        )
        select
          exists(
            select 1
            from incoming item
            where not coalesce(item.delete_entry, false)
              and item.shift_type_id is null
              and item.leave_type_id is null
              and item.overtime_type_id is null
          ) as has_blank_entry,
          exists(
            select 1
            from incoming item
            left join public.set_employee member on member.id = item.member_id
            where item.member_id is null
               or item.work_date is null
               or member.id is null
               or member.group_id is null
               or not exists(
                 select 1
                 from public.access_role_groups allowed
                 where allowed.role_id = $2::uuid
                   and allowed.group_id = member.group_id
               )
               or exists(
                 select 1
                 from public.schedule_archives archive
                 where archive.group_id = member.group_id
                   and item.work_date between archive.start_date and archive.end_date
               )
               or (member.deleted_at is not null and not coalesce(item.delete_entry, false))
          ) as has_forbidden_entry
      `, [entriesJson, String(actor.access_role_id)]);

      if (validation?.has_blank_entry) {
        throw new BackendError(400, "SCHEDULE_ENTRY_BLANK", "班表儲存內容不可空白");
      }
      if (validation?.has_forbidden_entry) {
        throw new BackendError(
          403,
          "SCHEDULE_ENTRY_FORBIDDEN",
          "包含無權管理、已封存或已刪除人員的班表資料"
        );
      }

      const result = await transaction.query(`
        with incoming as materialized (
          select *
          from jsonb_to_recordset($1::jsonb) as item(
            member_id uuid,
            work_date date,
            delete_entry boolean,
            support_department_id uuid,
            shift_type_id uuid,
            leave_type_id uuid,
            leave_all_day boolean,
            leave_start_time time,
            leave_end_time time,
            leave_reason text,
            overtime_type_id uuid,
            overtime_start_time time,
            overtime_end_time time,
            overtime_use_rest_1 boolean,
            overtime_rest_1_start_time time,
            overtime_rest_1_end_time time,
            overtime_use_rest_2 boolean,
            overtime_rest_2_start_time time,
            overtime_rest_2_end_time time,
            overtime_reason text,
            note text
          )
        ),
        deleted as (
          delete from public.schedule_entries entry
          using incoming item
          where entry.member_id = item.member_id
            and entry.work_date = item.work_date
            and coalesce(item.delete_entry, false)
          returning entry.*
        ),
        upserted as (
          insert into public.schedule_entries(
            member_id,
            work_date,
            support_department_id,
            shift_type_id,
            leave_type_id,
            leave_all_day,
            leave_start_time,
            leave_end_time,
            leave_reason,
            overtime_type_id,
            overtime_start_time,
            overtime_end_time,
            overtime_use_rest_1,
            overtime_rest_1_start_time,
            overtime_rest_1_end_time,
            overtime_use_rest_2,
            overtime_rest_2_start_time,
            overtime_rest_2_end_time,
            overtime_reason,
            note
          )
          select
            item.member_id,
            item.work_date,
            item.support_department_id,
            item.shift_type_id,
            item.leave_type_id,
            coalesce(item.leave_all_day, true),
            case when item.leave_type_id is null then null else item.leave_start_time end,
            case when item.leave_type_id is null then null else item.leave_end_time end,
            case when item.leave_type_id is null then null else item.leave_reason end,
            item.overtime_type_id,
            case when item.overtime_type_id is null then null else item.overtime_start_time end,
            case when item.overtime_type_id is null then null else item.overtime_end_time end,
            case when item.overtime_type_id is null then false else coalesce(item.overtime_use_rest_1, false) end,
            case when item.overtime_type_id is null or not coalesce(item.overtime_use_rest_1, false) then null else item.overtime_rest_1_start_time end,
            case when item.overtime_type_id is null or not coalesce(item.overtime_use_rest_1, false) then null else item.overtime_rest_1_end_time end,
            case when item.overtime_type_id is null then false else coalesce(item.overtime_use_rest_2, false) end,
            case when item.overtime_type_id is null or not coalesce(item.overtime_use_rest_2, false) then null else item.overtime_rest_2_start_time end,
            case when item.overtime_type_id is null or not coalesce(item.overtime_use_rest_2, false) then null else item.overtime_rest_2_end_time end,
            case when item.overtime_type_id is null then null else item.overtime_reason end,
            item.note
          from incoming item
          where not coalesce(item.delete_entry, false)
            and (
              item.shift_type_id is not null
              or item.leave_type_id is not null
              or item.overtime_type_id is not null
            )
          on conflict(member_id, work_date) do update set
            support_department_id = excluded.support_department_id,
            shift_type_id = excluded.shift_type_id,
            leave_type_id = excluded.leave_type_id,
            leave_all_day = excluded.leave_all_day,
            leave_start_time = excluded.leave_start_time,
            leave_end_time = excluded.leave_end_time,
            leave_reason = excluded.leave_reason,
            overtime_type_id = excluded.overtime_type_id,
            overtime_start_time = excluded.overtime_start_time,
            overtime_end_time = excluded.overtime_end_time,
            overtime_use_rest_1 = excluded.overtime_use_rest_1,
            overtime_rest_1_start_time = excluded.overtime_rest_1_start_time,
            overtime_rest_1_end_time = excluded.overtime_rest_1_end_time,
            overtime_use_rest_2 = excluded.overtime_use_rest_2,
            overtime_rest_2_start_time = excluded.overtime_rest_2_start_time,
            overtime_rest_2_end_time = excluded.overtime_rest_2_end_time,
            overtime_reason = excluded.overtime_reason,
            note = excluded.note,
            updated_at = now()
          returning *
        )
        select * from upserted
        order by work_date, member_id, id
      `, [entriesJson]);

      return result.rows || [];
    });
  }

  return Object.freeze({
    getBootstrap,
    getEntries,
    saveEntries
  });
}

module.exports = {
  createNativeScheduleRepository
};
