const { BackendError } = require("./errors");

async function requireScheduleManage(database, employeeId) {
  const row = await database.one(`
    select employee.id, employee.access_role_id
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
  `, [employeeId]);
  if (!row?.id) throw new BackendError(403, "SCHEDULE_MANAGE_DENIED", "沒有班表管理權限");
  return row;
}

function normalizeDate(value, message) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new BackendError(400, "DATE_INVALID", message);
  return text;
}

function createNativeScheduleExtra(database) {
  if (!database || typeof database.one !== "function" || typeof database.query !== "function" || typeof database.transaction !== "function") {
    throw new BackendError(500, "SCHEDULE_EXTRA_DATABASE_REQUIRED", "班表附加功能尚未設定資料庫");
  }

  async function saveHolidays(employeeId, holidays) {
    if (!Array.isArray(holidays)) throw new BackendError(400, "HOLIDAYS_INVALID", "假日資料格式錯誤");
    const rows = holidays
      .filter((item) => item && item.id && item.date)
      .map((item, index) => ({
        id: String(item.id).trim(),
        date: normalizeDate(item.date, "假日日期格式錯誤"),
        name: String(item.name || "").trim() || "假日",
        sortOrder: index
      }));
    if (new Set(rows.map((item) => item.date)).size !== rows.length) {
      throw new BackendError(400, "HOLIDAY_DATE_DUPLICATE", "假日日期不可重複");
    }

    return database.transaction(async (transaction) => {
      await requireScheduleManage(transaction, employeeId);
      const keptIds = [];
      for (const item of rows) {
        const saved = await transaction.one(`
          insert into public.holidays(id, holiday_date, name, sort_order)
          values ($1::uuid, $2::date, $3, $4::integer)
          on conflict(holiday_date) do update set
            name = excluded.name,
            sort_order = excluded.sort_order,
            updated_at = now()
          returning id
        `, [item.id, item.date, item.name, item.sortOrder]);
        if (saved?.id) keptIds.push(saved.id);
      }
      await transaction.query(`
        delete from public.holidays
        where not (id = any($1::uuid[]))
      `, [keptIds]);
      return { ok: true, count: rows.length };
    });
  }

  async function exportRows(employeeId, startDate, endDate) {
    const start = normalizeDate(startDate, "匯出日期範圍不正確");
    const end = normalizeDate(endDate, "匯出日期範圍不正確");
    if (start > end) throw new BackendError(400, "EXPORT_DATE_RANGE_INVALID", "匯出日期範圍不正確");
    await requireScheduleManage(database, employeeId);

    const range = await database.one("select ($2::date - $1::date)::integer as days", [start, end]);
    if (Number(range?.days || 0) > 366) {
      throw new BackendError(400, "EXPORT_DATE_RANGE_TOO_LARGE", "單次匯出期間不可超過 366 天");
    }

    const result = await database.query(`
      select
        schedule.member_id,
        employee.employee_code,
        employee.full_name as employee_name,
        employee.home_department_id,
        department.name as department_name,
        employee.pay_by_day,
        schedule.work_date,
        schedule.leave_type_id,
        leave_type.code as leave_code,
        leave_type.name as leave_name,
        schedule.leave_all_day,
        schedule.leave_start_time,
        schedule.leave_end_time,
        schedule.leave_reason,
        schedule.overtime_type_id,
        overtime_type.name as overtime_name,
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
      join public.set_employee actor on actor.id = $1::uuid and actor.deleted_at is null
      join public.access_roles actor_role on actor_role.id = actor.access_role_id
      join public.access_role_groups actor_group
        on actor_group.role_id = actor_role.id
       and actor_group.group_id = schedule.group_id
      left join public.set_departments department on department.id = employee.home_department_id
      left join public.set_leave leave_type on leave_type.id = schedule.leave_type_id
      left join public.set_overtime overtime_type on overtime_type.id = schedule.overtime_type_id
      where schedule.work_date between $2::date and $3::date
        and (schedule.leave_type_id is not null or schedule.overtime_type_id is not null)
      order by schedule.work_date, employee.sort_order, employee.full_name, employee.id
    `, [employeeId, start, end]);
    return result.rows || [];
  }

  return Object.freeze({ saveHolidays, exportRows });
}

module.exports = { createNativeScheduleExtra };
