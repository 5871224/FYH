const { BackendError } = require("./errors");

function requireId(value, label) {
  const text = String(value || "").trim();
  if (!text) throw new BackendError(400, "ARCHIVE_INPUT_REQUIRED", `${label}不可空白`);
  return text;
}

function requireDateRange(startDate, endDate) {
  const start = String(startDate || "").trim();
  const end = String(endDate || "").trim();
  if (!start || !end || start > end) {
    throw new BackendError(400, "ARCHIVE_DATE_RANGE_INVALID", "封存日期範圍不正確");
  }
  return { start, end };
}

async function requirePermission(database, employeeId, groupId, permission) {
  const row = await database.one(`
    select employee.id, employee.full_name
    from public.set_employee employee
    join public.access_roles role on role.id = employee.access_role_id
    join public.access_role_groups role_group
      on role_group.role_id = role.id
     and role_group.group_id = $2::uuid
    where employee.id = $1::uuid
      and employee.deleted_at is null
      and $3 = any(coalesce(role.permissions, '{}'::text[]))
      and public.is_employee_account_effective(
        employee.hire_date,
        employee.leave_date,
        (timezone('Asia/Taipei', now()))::date
      )
    limit 1
  `, [employeeId, groupId, permission]);
  if (!row?.id) {
    throw new BackendError(403, "ARCHIVE_PERMISSION_DENIED", "沒有此群組的班表權限");
  }
  return row;
}

function createNativeArchive(database) {
  if (!database || typeof database.one !== "function" || typeof database.query !== "function" || typeof database.transaction !== "function") {
    throw new BackendError(500, "ARCHIVE_DATABASE_REQUIRED", "封存功能尚未設定資料庫");
  }

  async function list(employeeId, groupId = "") {
    const id = requireId(employeeId, "登入人員識別碼");
    const targetGroupId = String(groupId || "").trim();
    const result = await database.query(`
      select
        archive.id,
        archive.group_id,
        archive.group_code_snapshot as group_code,
        archive.group_name_snapshot as group_name,
        archive.start_date,
        archive.end_date,
        archive.archived_at,
        archive.archived_by_name_snapshot as archived_by_name,
        archive.member_count,
        archive.entry_count
      from public.schedule_archives archive
      join public.set_employee employee on employee.id = $1::uuid
      join public.access_roles role on role.id = employee.access_role_id
      join public.access_role_groups role_group
        on role_group.role_id = role.id
       and role_group.group_id = archive.group_id
      where employee.deleted_at is null
        and 'schedule_view' = any(coalesce(role.permissions, '{}'::text[]))
        and public.is_employee_account_effective(
          employee.hire_date,
          employee.leave_date,
          (timezone('Asia/Taipei', now()))::date
        )
        and ($2::uuid is null or archive.group_id = $2::uuid)
      order by archive.start_date desc, archive.archived_at desc
    `, [id, targetGroupId || null]);
    return result.rows || [];
  }

  async function entries(employeeId, archiveId) {
    const id = requireId(employeeId, "登入人員識別碼");
    const archiveKey = requireId(archiveId, "封存識別碼");
    const archive = await database.one(`
      select archive.id, archive.group_id
      from public.schedule_archives archive
      where archive.id = $1::uuid
      limit 1
    `, [archiveKey]);
    if (!archive?.id) throw new BackendError(404, "ARCHIVE_NOT_FOUND", "找不到封存班表");
    await requirePermission(database, id, archive.group_id, "schedule_view");
    const result = await database.query(`
      select *
      from public.schedule_archive_entries
      where archive_id = $1::uuid
      order by work_date, member_sort_order, employee_name_snapshot, id
    `, [archiveKey]);
    return result.rows || [];
  }

  async function archive(employeeId, groupId, startDate, endDate) {
    const id = requireId(employeeId, "登入人員識別碼");
    const targetGroupId = requireId(groupId, "群組識別碼");
    const range = requireDateRange(startDate, endDate);

    return database.transaction(async (transaction) => {
      const actor = await requirePermission(transaction, id, targetGroupId, "schedule_manage");
      const group = await transaction.one(`
        select id, code, name
        from public.schedule_groups
        where id = $1::uuid and deleted_at is null
        for update
      `, [targetGroupId]);
      if (!group?.id) throw new BackendError(404, "GROUP_NOT_FOUND", "找不到群組");

      const overlap = await transaction.one(`
        select id
        from public.schedule_archives
        where group_id = $1::uuid
          and daterange(start_date, end_date, '[]') && daterange($2::date, $3::date, '[]')
        limit 1
      `, [targetGroupId, range.start, range.end]);
      if (overlap?.id) throw new BackendError(409, "ARCHIVE_RANGE_OVERLAP", "封存日期範圍不可重疊");

      const created = await transaction.one(`
        insert into public.schedule_archives(
          group_id, group_code_snapshot, group_name_snapshot,
          start_date, end_date, archived_by, archived_by_name_snapshot
        ) values ($1::uuid, $2, $3, $4::date, $5::date, $6::uuid, $7)
        returning id
      `, [targetGroupId, group.code, group.name, range.start, range.end, id, actor.full_name || ""]);

      await transaction.query(`
        insert into public.schedule_archive_entries(
          archive_id, source_schedule_entry_id, source_member_id, source_department_id,
          source_shift_id, source_leave_id, source_overtime_id, work_date,
          employee_code_snapshot, employee_name_snapshot, member_sort_order,
          department_name_snapshot, department_sort_order,
          shift_name_snapshot, shift_start_time_snapshot, shift_end_time_snapshot,
          shift_color_snapshot, shift_text_color_snapshot,
          leave_code_snapshot, leave_name_snapshot, leave_color_snapshot,
          overtime_name_snapshot, overtime_color_snapshot,
          leave_all_day, leave_start_time, leave_end_time, leave_reason,
          overtime_start_time, overtime_end_time, overtime_reason, note
        )
        select
          $1::uuid, entry.id, member.id,
          coalesce(entry.support_department_id, member.home_department_id),
          entry.shift_type_id, entry.leave_type_id, entry.overtime_type_id,
          archive_date.work_date,
          coalesce(member.employee_code, ''), coalesce(member.full_name, ''), coalesce(member.sort_order, 0),
          coalesce(department.name, ''), coalesce(department.sort_order, 0),
          coalesce(shift.name, ''), shift.start_time, shift.end_time, shift.color, shift.text_color,
          coalesce(leave_type.code, ''), coalesce(leave_type.name, ''), leave_type.color,
          coalesce(overtime_type.name, ''), overtime_type.color,
          coalesce(entry.leave_all_day, true), entry.leave_start_time, entry.leave_end_time, entry.leave_reason,
          entry.overtime_start_time, entry.overtime_end_time, entry.overtime_reason, null
        from public.set_employee member
        cross join lateral (
          select generated_date::date as work_date
          from generate_series($2::date, $3::date, interval '1 day') generated_date
        ) archive_date
        left join public.schedule_entries entry
          on entry.member_id = member.id
         and entry.work_date = archive_date.work_date
         and entry.group_id = $4::uuid
        left join public.set_departments department
          on department.id = coalesce(entry.support_department_id, member.home_department_id)
        left join public.set_shift shift on shift.id = entry.shift_type_id
        left join public.set_leave leave_type on leave_type.id = entry.leave_type_id
        left join public.set_overtime overtime_type on overtime_type.id = entry.overtime_type_id
        where member.group_id = $4::uuid
          and (
            (member.deleted_at is null and public.is_employee_employed_on(member.hire_date, member.leave_date, archive_date.work_date))
            or entry.id is not null
          )
      `, [created.id, range.start, range.end, targetGroupId]);

      const counts = await transaction.one(`
        select count(*)::integer as entry_count,
               count(distinct source_member_id)::integer as member_count
        from public.schedule_archive_entries
        where archive_id = $1::uuid
      `, [created.id]);
      await transaction.query(`
        update public.schedule_archives
        set entry_count = $2::integer, member_count = $3::integer
        where id = $1::uuid
      `, [created.id, Number(counts?.entry_count || 0), Number(counts?.member_count || 0)]);

      return {
        ok: true,
        archiveId: String(created.id),
        entryCount: Number(counts?.entry_count || 0),
        memberCount: Number(counts?.member_count || 0)
      };
    });
  }

  async function unarchive(employeeId, archiveId) {
    const id = requireId(employeeId, "登入人員識別碼");
    const archiveKey = requireId(archiveId, "封存識別碼");
    return database.transaction(async (transaction) => {
      const row = await transaction.one(`
        select id, group_id, start_date, end_date
        from public.schedule_archives
        where id = $1::uuid
        for update
      `, [archiveKey]);
      if (!row?.id) throw new BackendError(404, "ARCHIVE_NOT_FOUND", "找不到封存班表");
      await requirePermission(transaction, id, row.group_id, "schedule_manage");
      const group = await transaction.one(`
        select id from public.schedule_groups
        where id = $1::uuid and deleted_at is null
      `, [row.group_id]);
      if (!group?.id) throw new BackendError(409, "ARCHIVE_GROUP_DELETED", "群組已刪除，無法解除封存");
      await transaction.query("delete from public.schedule_archives where id = $1::uuid", [archiveKey]);
      return {
        ok: true,
        groupId: String(row.group_id),
        startDate: row.start_date,
        endDate: row.end_date
      };
    });
  }

  return Object.freeze({ list, entries, archive, unarchive });
}

module.exports = { createNativeArchive };
