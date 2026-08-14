const { BackendError } = require("../errors");

async function getActor(transaction, employeeId) {
  return transaction.one(`
    select employee.id, employee.access_role_id, role.permissions
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
  `, [employeeId]);
}

function requirePermission(actor, permission, message) {
  const permissions = Array.isArray(actor?.permissions) ? actor.permissions : [];
  if (!actor?.access_role_id || !permissions.includes(permission)) {
    throw new BackendError(403, "MASTER_DATA_PERMISSION_DENIED", message);
  }
}

async function requireGroupAccess(transaction, actor, groupId, permission, message) {
  requirePermission(actor, permission, message);
  const row = await transaction.one(`
    select 1 as allowed
    from public.access_role_groups
    where role_id = $1::uuid
      and group_id = $2::uuid
    limit 1
  `, [String(actor.access_role_id), groupId]);
  if (!row?.allowed) {
    throw new BackendError(403, "MASTER_DATA_GROUP_DENIED", message);
  }
}

async function countScheduleReferences(transaction, whereSql, params) {
  return transaction.one(`
    select
      count(*)::bigint as schedule_count,
      count(*) filter (
        where not exists (
          select 1
          from public.schedule_archives archive
          where archive.group_id = entry.group_id
            and entry.work_date between archive.start_date and archive.end_date
        )
      )::bigint as unarchived_count
    from public.schedule_entries entry
    left join public.set_employee member on member.id = entry.member_id
    where ${whereSql}
  `, params);
}

function createNativeMasterDataRepository(database) {
  if (!database
    || typeof database.one !== "function"
    || typeof database.query !== "function"
    || typeof database.transaction !== "function") {
    throw new BackendError(500, "MASTER_DATA_DATABASE_REQUIRED", "主檔資料層尚未設定資料庫");
  }

  async function saveDepartment(employeeId, department) {
    return database.transaction(async (transaction) => {
      const actor = await getActor(transaction, employeeId);
      const group = await transaction.one(`
        select id
        from public.schedule_groups
        where id = $1::uuid
          and deleted_at is null
          and status = 'active'
        limit 1
      `, [department.groupId]);
      if (!group?.id) {
        throw new BackendError(400, "DEPARTMENT_GROUP_INVALID", "找不到可使用的群組");
      }
      await requireGroupAccess(
        transaction,
        actor,
        department.groupId,
        "department_settings",
        "沒有管理此群組單位的權限"
      );

      const existing = await transaction.one(`
        select *
        from public.set_departments
        where id = $1::uuid
        for update
      `, [department.id]);
      if (existing?.deleted_at) {
        throw new BackendError(409, "DEPARTMENT_DELETED", "已刪除單位不可重新啟用");
      }

      const oldGroupId = existing?.group_id ? String(existing.group_id) : "";
      if (oldGroupId && oldGroupId !== department.groupId) {
        await requireGroupAccess(
          transaction,
          actor,
          oldGroupId,
          "department_settings",
          "沒有管理原群組單位的權限"
        );
        const activeMember = await transaction.one(`
          select 1 as found
          from public.set_employee
          where home_department_id = $1::uuid
            and deleted_at is null
          limit 1
        `, [department.id]);
        if (activeMember?.found) {
          throw new BackendError(409, "DEPARTMENT_HAS_MEMBERS", "此單位仍有人員，請先調整人員");
        }
        const schedule = await countScheduleReferences(
          transaction,
          `entry.support_department_id = $1::uuid
            or member.home_department_id = $1::uuid
            or exists (
              select 1
              from public.set_shift shift
              where shift.id = entry.shift_type_id
                and shift.applicable_department_id = $1::uuid
            )`,
          [department.id]
        );
        if (Number(schedule?.unarchived_count || 0) > 0) {
          throw new BackendError(
            409,
            "DEPARTMENT_HAS_UNARCHIVED_SCHEDULE",
            "此單位仍有未封存班表，請先完成班表封存或清除相關排班"
          );
        }
      }

      const canAdminAttendance = Array.isArray(actor?.permissions)
        && actor.permissions.includes("permission_settings");
      const row = await transaction.one(`
        insert into public.set_departments(
          id, name, group_id, start_date, end_date, hidden_from_schedule, sort_order,
          address, latitude, longitude, public_ip, attendance_enabled,
          attendance_settings_updated_at, attendance_settings_updated_by
        ) values (
          $1::uuid, $2, $3::uuid, $4::date, $5::date, $6::boolean, $7::integer,
          $8, $9::double precision, $10::double precision, $11, $12::boolean,
          case when $13::boolean then now() else null end,
          case when $13::boolean then $14::uuid else null end
        )
        on conflict(id) do update set
          name = excluded.name,
          group_id = excluded.group_id,
          start_date = excluded.start_date,
          end_date = excluded.end_date,
          hidden_from_schedule = excluded.hidden_from_schedule,
          sort_order = excluded.sort_order,
          address = case when $13::boolean then excluded.address else public.set_departments.address end,
          latitude = case when $13::boolean then excluded.latitude else public.set_departments.latitude end,
          longitude = case when $13::boolean then excluded.longitude else public.set_departments.longitude end,
          public_ip = case when $13::boolean then excluded.public_ip else public.set_departments.public_ip end,
          attendance_enabled = case when $13::boolean then excluded.attendance_enabled else public.set_departments.attendance_enabled end,
          attendance_settings_updated_at = case when $13::boolean then now() else public.set_departments.attendance_settings_updated_at end,
          attendance_settings_updated_by = case when $13::boolean then $14::uuid else public.set_departments.attendance_settings_updated_by end,
          updated_at = now()
        where public.set_departments.deleted_at is null
        returning id, group_id
      `, [
        department.id,
        department.name,
        department.groupId,
        department.startDate || null,
        department.endDate || null,
        Boolean(department.hiddenFromSchedule),
        Math.max(0, Number(department.sortOrder) || 0),
        canAdminAttendance ? (department.address || null) : null,
        canAdminAttendance && department.latitude !== null ? department.latitude : null,
        canAdminAttendance && department.longitude !== null ? department.longitude : null,
        canAdminAttendance ? (department.publicIp || null) : null,
        canAdminAttendance ? Boolean(department.attendanceEnabled) : false,
        canAdminAttendance,
        employeeId
      ]);

      if (!row?.id) {
        throw new BackendError(409, "DEPARTMENT_SAVE_FAILED", "單位儲存失敗");
      }
      if (oldGroupId && oldGroupId !== department.groupId) {
        await transaction.query(`
          update public.set_shift
          set group_id = $2::uuid,
              updated_at = now()
          where applicable_department_id = $1::uuid
            and deleted_at is null
        `, [department.id, department.groupId]);
      }
      return { ok: true, id: String(row.id), groupId: String(row.group_id) };
    });
  }

  async function deleteDepartment(employeeId, departmentId) {
    return database.transaction(async (transaction) => {
      const actor = await getActor(transaction, employeeId);
      const department = await transaction.one(`
        select id, group_id, deleted_at
        from public.set_departments
        where id = $1::uuid
        for update
      `, [departmentId]);
      if (!department?.id || department.deleted_at) {
        return { ok: true, deleted: false, softDeleted: false, hardDeleted: false };
      }
      await requireGroupAccess(
        transaction,
        actor,
        String(department.group_id),
        "department_settings",
        "沒有刪除此單位的權限"
      );

      const activeMember = await transaction.one(`
        select 1 as found from public.set_employee
        where home_department_id = $1::uuid and deleted_at is null
        limit 1
      `, [departmentId]);
      if (activeMember?.found) {
        throw new BackendError(409, "DEPARTMENT_HAS_MEMBERS", "這個單位仍有人員，請先將人員移轉到其他單位");
      }
      const activeShift = await transaction.one(`
        select 1 as found from public.set_shift
        where applicable_department_id = $1::uuid and deleted_at is null
        limit 1
      `, [departmentId]);
      if (activeShift?.found) {
        throw new BackendError(409, "DEPARTMENT_HAS_SHIFTS", "這個單位仍有班別使用，請先修改相關班別");
      }

      const schedule = await countScheduleReferences(
        transaction,
        `entry.support_department_id = $1::uuid or member.home_department_id = $1::uuid`,
        [departmentId]
      );
      if (Number(schedule?.unarchived_count || 0) > 0) {
        throw new BackendError(
          409,
          "DEPARTMENT_HAS_UNARCHIVED_SCHEDULE",
          "這個單位仍有未封存班表，請先完成班表封存或清除相關排班"
        );
      }

      const references = await transaction.one(`
        select (
          (select count(*) from public.set_employee where home_department_id = $1::uuid)
          + (select count(*) from public.set_shift where applicable_department_id = $1::uuid)
          + (select count(*) from public.meal_orders where department_id = $1::uuid or attendance_department_id = $1::uuid)
        )::bigint as reference_count
      `, [departmentId]);
      const hardDelete = Number(schedule?.schedule_count || 0) === 0
        && Number(references?.reference_count || 0) === 0;

      if (hardDelete) {
        await transaction.query(
          "delete from public.set_departments where id = $1::uuid and deleted_at is null",
          [departmentId]
        );
      } else {
        await transaction.query(`
          update public.set_departments
          set deleted_at = now(), updated_at = now()
          where id = $1::uuid and deleted_at is null
        `, [departmentId]);
      }
      return {
        ok: true,
        deleted: true,
        softDeleted: !hardDelete,
        hardDeleted: hardDelete,
        id: departmentId
      };
    });
  }

  async function saveShift(employeeId, shift) {
    return database.transaction(async (transaction) => {
      const actor = await getActor(transaction, employeeId);
      const department = await transaction.one(`
        select id, group_id
        from public.set_departments
        where id = $1::uuid and deleted_at is null
        limit 1
      `, [shift.applicableDepartmentId]);
      if (!department?.group_id) {
        throw new BackendError(400, "SHIFT_DEPARTMENT_INVALID", "找不到可使用的適用單位");
      }
      const groupId = String(department.group_id);
      await requireGroupAccess(transaction, actor, groupId, "schedule_manage", "沒有管理此群組班別的權限");

      const existing = await transaction.one(`
        select id, group_id, deleted_at
        from public.set_shift
        where id = $1::uuid
        for update
      `, [shift.id]);
      if (existing?.deleted_at) {
        throw new BackendError(409, "SHIFT_DELETED", "已刪除班別不可重新啟用");
      }
      const oldGroupId = existing?.group_id ? String(existing.group_id) : "";
      if (oldGroupId && oldGroupId !== groupId) {
        await requireGroupAccess(transaction, actor, oldGroupId, "schedule_manage", "沒有管理原群組班別的權限");
        const schedule = await countScheduleReferences(
          transaction,
          "entry.shift_type_id = $1::uuid",
          [shift.id]
        );
        if (Number(schedule?.unarchived_count || 0) > 0) {
          throw new BackendError(409, "SHIFT_HAS_UNARCHIVED_SCHEDULE", "此班別仍有未封存班表，無法跨群組移動");
        }
      }

      const row = await transaction.one(`
        insert into public.set_shift(
          id, name, applicable_department_id, group_id, color, text_color,
          auto_text_color, hidden_from_toolbar, start_time, end_time,
          required_staff_count, sort_order
        ) values (
          $1::uuid, $2, $3::uuid, $4::uuid, $5, $6, $7::boolean, $8::boolean,
          $9::time, $10::time, $11::integer, $12::integer
        )
        on conflict(id) do update set
          name = excluded.name,
          applicable_department_id = excluded.applicable_department_id,
          group_id = excluded.group_id,
          color = excluded.color,
          text_color = excluded.text_color,
          auto_text_color = excluded.auto_text_color,
          hidden_from_toolbar = excluded.hidden_from_toolbar,
          start_time = excluded.start_time,
          end_time = excluded.end_time,
          required_staff_count = excluded.required_staff_count,
          sort_order = excluded.sort_order,
          updated_at = now()
        where public.set_shift.deleted_at is null
        returning id, group_id
      `, [
        shift.id,
        shift.name,
        shift.applicableDepartmentId,
        groupId,
        shift.color || null,
        shift.textColor || null,
        shift.autoTextColor !== false,
        Boolean(shift.hiddenFromToolbar),
        shift.startTime || null,
        shift.endTime || null,
        Math.max(0, Number(shift.requiredStaffCount) || 0),
        Math.max(0, Number(shift.sortOrder) || 0)
      ]);
      if (!row?.id) {
        throw new BackendError(409, "SHIFT_SAVE_FAILED", "班別儲存失敗");
      }
      return { ok: true, id: String(row.id), groupId: String(row.group_id) };
    });
  }

  async function saveCatalogItem(employeeId, category, item) {
    return database.transaction(async (transaction) => {
      const actor = await getActor(transaction, employeeId);
      requirePermission(actor, "leave_settings", "沒有假別設定權限");

      if (category === "leave") {
        const inputById = await transaction.one(`
          select id, code, deleted_at
          from public.set_leave
          where id = $1::uuid
          for update
        `, [item.id]);
        const existingByCode = await transaction.one(`
          select id, deleted_at
          from public.set_leave
          where code = $1
          for update
        `, [item.code]);

        let targetId = item.id;
        let restored = false;
        if (existingByCode?.id && String(existingByCode.id) !== item.id) {
          if (!existingByCode.deleted_at || inputById?.id) {
            throw new BackendError(409, "LEAVE_CODE_DUPLICATE", "假別代碼已存在");
          }
          targetId = String(existingByCode.id);
          restored = true;
        } else if (existingByCode?.id && existingByCode.deleted_at) {
          restored = true;
        }

        let row;
        if (restored) {
          row = await transaction.one(`
            update public.set_leave
            set code = $2,
                name = $3,
                color = $4,
                text_color = $5,
                auto_text_color = $6::boolean,
                hidden_from_toolbar = $7::boolean,
                requires_time = $8::boolean,
                requires_reason = $9::boolean,
                sort_order = $10::integer,
                deleted_at = null,
                updated_at = now()
            where id = $1::uuid
            returning id
          `, [
            targetId, item.code, item.name, item.color || null, item.textColor || null,
            item.autoTextColor !== false, Boolean(item.hiddenFromToolbar), Boolean(item.requiresTime),
            Boolean(item.requiresReason), Math.max(0, Number(item.sortOrder) || 0)
          ]);
        } else {
          row = await transaction.one(`
            insert into public.set_leave(
              id, code, name, color, text_color, auto_text_color,
              hidden_from_toolbar, requires_time, requires_reason, sort_order
            ) values ($1::uuid, $2, $3, $4, $5, $6::boolean, $7::boolean, $8::boolean, $9::boolean, $10::integer)
            on conflict(id) do update set
              code = excluded.code,
              name = excluded.name,
              color = excluded.color,
              text_color = excluded.text_color,
              auto_text_color = excluded.auto_text_color,
              hidden_from_toolbar = excluded.hidden_from_toolbar,
              requires_time = excluded.requires_time,
              requires_reason = excluded.requires_reason,
              sort_order = excluded.sort_order,
              updated_at = now()
            where public.set_leave.deleted_at is null
            returning id
          `, [
            targetId, item.code, item.name, item.color || null, item.textColor || null,
            item.autoTextColor !== false, Boolean(item.hiddenFromToolbar), Boolean(item.requiresTime),
            Boolean(item.requiresReason), Math.max(0, Number(item.sortOrder) || 0)
          ]);
        }
        if (!row?.id) {
          throw new BackendError(409, "LEAVE_SAVE_FAILED", "假別儲存失敗");
        }
        return { ok: true, id: String(row.id), category, restored };
      }

      if (category === "overtime") {
        const row = await transaction.one(`
          insert into public.set_overtime(
            id, name, color, text_color, auto_text_color, hidden_from_toolbar,
            start_time, end_time, use_rest_1, rest_1_start_time, rest_1_end_time,
            use_rest_2, rest_2_start_time, rest_2_end_time, sort_order
          ) values (
            $1::uuid, $2, $3, $4, $5::boolean, $6::boolean,
            $7::time, $8::time, $9::boolean, $10::time, $11::time,
            $12::boolean, $13::time, $14::time, $15::integer
          )
          on conflict(id) do update set
            name = excluded.name,
            color = excluded.color,
            text_color = excluded.text_color,
            auto_text_color = excluded.auto_text_color,
            hidden_from_toolbar = excluded.hidden_from_toolbar,
            start_time = excluded.start_time,
            end_time = excluded.end_time,
            use_rest_1 = excluded.use_rest_1,
            rest_1_start_time = excluded.rest_1_start_time,
            rest_1_end_time = excluded.rest_1_end_time,
            use_rest_2 = excluded.use_rest_2,
            rest_2_start_time = excluded.rest_2_start_time,
            rest_2_end_time = excluded.rest_2_end_time,
            sort_order = excluded.sort_order,
            updated_at = now()
          where public.set_overtime.deleted_at is null
          returning id
        `, [
          item.id, item.name, item.color || null, item.textColor || null,
          item.autoTextColor !== false, Boolean(item.hiddenFromToolbar), item.startTime || null,
          item.endTime || null, Boolean(item.useRest1), item.rest1StartTime || null,
          item.rest1EndTime || null, Boolean(item.useRest2), item.rest2StartTime || null,
          item.rest2EndTime || null, Math.max(0, Number(item.sortOrder) || 0)
        ]);
        if (!row?.id) {
          throw new BackendError(409, "OVERTIME_SAVE_FAILED", "加班設定儲存失敗");
        }
        return { ok: true, id: String(row.id), category, restored: false };
      }

      throw new BackendError(400, "CATALOG_CATEGORY_UNSUPPORTED", "不支援的設定類型");
    });
  }

  async function deleteCatalogItem(employeeId, category, itemId) {
    return database.transaction(async (transaction) => {
      const actor = await getActor(transaction, employeeId);
      let schedule;
      let hardDelete = false;

      if (category === "shift") {
        const item = await transaction.one(`
          select id, group_id, deleted_at
          from public.set_shift
          where id = $1::uuid
          for update
        `, [itemId]);
        if (!item?.id || item.deleted_at) {
          return { ok: true, deleted: false, softDeleted: false, hardDeleted: false };
        }
        await requireGroupAccess(
          transaction,
          actor,
          String(item.group_id),
          "schedule_manage",
          "沒有管理此群組班別的權限"
        );
        schedule = await countScheduleReferences(transaction, "entry.shift_type_id = $1::uuid", [itemId]);
        if (Number(schedule?.unarchived_count || 0) > 0) {
          throw new BackendError(
            409,
            "SHIFT_HAS_UNARCHIVED_SCHEDULE",
            "此班別仍有未封存班表，請先完成班表封存或清除相關排班"
          );
        }
        await transaction.query(`
          update public.set_employee
          set schedule_shift_ids = array_remove(schedule_shift_ids, $1::uuid),
              updated_at = now()
          where deleted_at is null
            and $1::uuid = any(schedule_shift_ids)
        `, [itemId]);
        hardDelete = Number(schedule?.schedule_count || 0) === 0;
        if (hardDelete) {
          await transaction.query("delete from public.set_shift where id = $1::uuid and deleted_at is null", [itemId]);
        } else {
          await transaction.query(`
            update public.set_shift set deleted_at = now(), updated_at = now()
            where id = $1::uuid and deleted_at is null
          `, [itemId]);
        }
      } else if (category === "leave" || category === "overtime") {
        requirePermission(actor, "leave_settings", "沒有假別設定權限");
        const table = category === "leave" ? "public.set_leave" : "public.set_overtime";
        const column = category === "leave" ? "leave_type_id" : "overtime_type_id";
        const item = await transaction.one(`
          select id, deleted_at from ${table} where id = $1::uuid for update
        `, [itemId]);
        if (!item?.id || item.deleted_at) {
          return { ok: true, deleted: false, softDeleted: false, hardDeleted: false };
        }
        schedule = await countScheduleReferences(transaction, `entry.${column} = $1::uuid`, [itemId]);
        if (Number(schedule?.unarchived_count || 0) > 0) {
          const message = category === "leave"
            ? "此假別仍有未封存班表，請先完成班表封存或清除相關排班"
            : "此加班設定仍有未封存班表，請先完成班表封存或清除相關排班";
          throw new BackendError(409, "CATALOG_HAS_UNARCHIVED_SCHEDULE", message);
        }
        hardDelete = Number(schedule?.schedule_count || 0) === 0;
        if (hardDelete) {
          await transaction.query(`delete from ${table} where id = $1::uuid and deleted_at is null`, [itemId]);
        } else {
          await transaction.query(`
            update ${table} set deleted_at = now(), updated_at = now()
            where id = $1::uuid and deleted_at is null
          `, [itemId]);
        }
      } else {
        throw new BackendError(400, "CATALOG_CATEGORY_UNSUPPORTED", "不支援的設定類型");
      }

      return {
        ok: true,
        deleted: true,
        softDeleted: !hardDelete,
        hardDeleted: hardDelete,
        category,
        itemId
      };
    });
  }

  return Object.freeze({
    saveDepartment,
    deleteDepartment,
    saveShift,
    saveCatalogItem,
    deleteCatalogItem
  });
}

module.exports = {
  createNativeMasterDataRepository
};
