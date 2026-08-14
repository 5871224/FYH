const { BackendError } = require("../errors");

const MEMBER_PERMISSION = "member_settings";
const PRIVILEGED_PERMISSION = "permission_settings";

function normalizeCode(value) {
  return String(value || "").trim();
}

function normalizeCodeKey(value) {
  return normalizeCode(value).toLowerCase();
}

function createNativeMemberRepository(database) {
  if (!database || typeof database.one !== "function" || typeof database.query !== "function" || typeof database.transaction !== "function") {
    throw new BackendError(500, "MEMBER_DATABASE_REQUIRED", "人員資料層尚未設定資料庫");
  }

  async function getActor(transaction, employeeId) {
    const row = await transaction.one(`
      select
        employee.id,
        employee.group_id,
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
      group by employee.id, employee.group_id, role.permissions
      limit 1
    `, [employeeId]);
    if (!row?.id) throw new BackendError(401, "AUTH_REQUIRED", "請先登入");
    const permissions = Array.isArray(row.permissions) ? row.permissions : [];
    if (!permissions.includes(MEMBER_PERMISSION)) {
      throw new BackendError(403, "MEMBER_SETTINGS_DENIED", "沒有管理人員的權限");
    }
    return {
      id: String(row.id),
      permissions,
      groupIds: new Set((Array.isArray(row.group_ids) ? row.group_ids : []).map(String)),
      canManagePermissions: permissions.includes(PRIVILEGED_PERMISSION)
    };
  }

  function assertActorGroup(actor, groupId, message) {
    const id = String(groupId || "");
    if (!id || !actor.groupIds.has(id)) {
      throw new BackendError(403, "MEMBER_GROUP_DENIED", message || "沒有管理此群組人員的權限");
    }
  }

  function rowPermissions(row) {
    return Array.isArray(row?.role_permissions) ? row.role_permissions : [];
  }

  function isPrivileged(row) {
    return rowPermissions(row).includes(PRIVILEGED_PERMISSION);
  }

  async function findMemberByCode(transaction, employeeCode, lock = false) {
    const key = normalizeCodeKey(employeeCode);
    if (!key) return null;
    return transaction.one(`
      select
        employee.*,
        role.permissions as role_permissions,
        account.password_hash
      from public.set_employee employee
      join public.access_roles role on role.id = employee.access_role_id
      left join public.auth_accounts account on account.employee_id = employee.id
      where lower(btrim(employee.employee_code)) = $1
      limit 1
      ${lock ? "for update of employee" : ""}
    `, [key]);
  }

  async function assertManageableTarget(transaction, actor, profile) {
    if (!profile?.id || profile.deleted_at) return;
    assertActorGroup(actor, profile.group_id, "沒有管理此人員所屬群組的權限");
    if (isPrivileged(profile) && !actor.canManagePermissions) {
      throw new BackendError(403, "PRIVILEGED_MEMBER_DENIED", "只有權限管理者可以修改此帳號");
    }
  }

  async function getRole(transaction, roleId) {
    const role = await transaction.one(`
      select id, code, name, permissions
      from public.access_roles
      where id = $1::uuid
      limit 1
    `, [roleId]);
    if (!role?.id) throw new BackendError(400, "ACCESS_ROLE_NOT_FOUND", "找不到權限角色");
    return { ...role, permissions: Array.isArray(role.permissions) ? role.permissions : [] };
  }

  async function assertRoleAppliesToGroup(transaction, roleId, groupId) {
    const row = await transaction.one(`
      select group_id
      from public.access_role_groups
      where role_id = $1::uuid and group_id = $2::uuid
      limit 1
    `, [roleId, groupId]);
    if (!row?.group_id) {
      throw new BackendError(400, "ACCESS_ROLE_GROUP_MISMATCH", "此權限角色不適用指定群組");
    }
  }

  async function assertGroupActive(transaction, groupId) {
    const group = await transaction.one(`
      select id
      from public.schedule_groups
      where id = $1::uuid
        and deleted_at is null
        and status = 'active'
      limit 1
    `, [groupId]);
    if (!group?.id) throw new BackendError(400, "MEMBER_GROUP_NOT_FOUND", "找不到可使用的群組");
  }

  async function resolveDepartment(transaction, departmentId, groupId) {
    const id = String(departmentId || "").trim();
    if (!id) return null;
    const row = await transaction.one(`
      select id
      from public.set_departments
      where id = $1::uuid
        and group_id = $2::uuid
        and deleted_at is null
      limit 1
    `, [id, groupId]);
    if (!row?.id) {
      throw new BackendError(400, "MEMBER_DEPARTMENT_GROUP_MISMATCH", "所屬單位不在指定群組或已刪除");
    }
    return String(row.id);
  }

  async function assertScheduleShifts(transaction, shiftIds, groupId) {
    const ids = Array.isArray(shiftIds) ? shiftIds.map(String) : [];
    if (!ids.length) return;
    const result = await transaction.query(`
      select id
      from public.set_shift
      where id = any($1::uuid[])
        and group_id = $2::uuid
        and deleted_at is null
    `, [ids, groupId]);
    const valid = new Set((result.rows || []).map((row) => String(row.id)));
    if (ids.some((id) => !valid.has(id))) {
      throw new BackendError(400, "MEMBER_SHIFT_GROUP_MISMATCH", "排班班別不在指定群組或已刪除");
    }
  }

  async function countOtherEffectivePrivileged(transaction, excludedEmployeeId) {
    const row = await transaction.one(`
      select count(*)::integer as count
      from public.set_employee employee
      join public.access_roles role on role.id = employee.access_role_id
      where employee.id <> $1::uuid
        and employee.deleted_at is null
        and 'permission_settings' = any(coalesce(role.permissions, '{}'::text[]))
        and public.is_employee_account_effective(
          employee.hire_date,
          employee.leave_date,
          (timezone('Asia/Taipei', now()))::date
        )
    `, [excludedEmployeeId]);
    return Number(row?.count || 0);
  }

  async function isEffectiveWithDates(transaction, hireDate, leaveDate) {
    const row = await transaction.one(`
      select public.is_employee_account_effective(
        $1::date,
        $2::date,
        (timezone('Asia/Taipei', now()))::date
      ) as effective
    `, [hireDate || null, leaveDate || null]);
    return row?.effective === true;
  }

  async function assertLastPrivilegedProtected(transaction, existing, nextRole, member) {
    if (!existing?.id || !isPrivileged(existing)) return;
    const wasEffective = await isEffectiveWithDates(transaction, existing.hire_date, existing.leave_date);
    if (!wasEffective) return;
    const nextEffective = await isEffectiveWithDates(transaction, member.hireDate, member.leaveDate);
    const remainsPrivileged = nextRole.permissions.includes(PRIVILEGED_PERMISSION) && nextEffective;
    if (!remainsPrivileged && await countOtherEffectivePrivileged(transaction, existing.id) === 0) {
      throw new BackendError(409, "LAST_PRIVILEGED_ACCOUNT", "系統必須保留至少一個有效的權限管理帳號");
    }
  }

  async function assertGroupChangeAllowed(transaction, profile, newGroupId) {
    if (!profile?.id || String(profile.group_id || "") === String(newGroupId || "")) return;
    const row = await transaction.one(`
      select count(*)::integer as count
      from public.schedule_entries entry
      where entry.member_id = $1::uuid
        and not public.is_schedule_date_archived(entry.group_id, entry.work_date)
    `, [profile.id]);
    if (Number(row?.count || 0) > 0) {
      throw new BackendError(
        409,
        "MEMBER_HAS_UNARCHIVED_SCHEDULE",
        "此人員在原群組仍有未封存班表，請先處理後再變更所屬群組"
      );
    }
  }

  async function getDirectory(employeeId) {
    const id = String(employeeId || "").trim();
    if (!id) throw new BackendError(401, "AUTH_REQUIRED", "請先登入");
    const result = await database.query(`
      with actor as materialized (
        select employee.access_role_id
        from public.set_employee employee
        join public.access_roles role on role.id = employee.access_role_id
        where employee.id = $1::uuid
          and employee.deleted_at is null
          and 'member_settings' = any(coalesce(role.permissions, '{}'::text[]))
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
      select employee.*
      from public.set_employee employee
      join allowed_groups allowed on allowed.group_id = employee.group_id
      where employee.deleted_at is null
      order by employee.sort_order, employee.full_name, employee.id
    `, [id]);
    return result.rows || [];
  }

  async function validateGroupChange(employeeId, employeeCode, newGroupId) {
    return database.transaction(async (transaction) => {
      const actor = await getActor(transaction, employeeId);
      const profile = await findMemberByCode(transaction, employeeCode, true);
      if (!profile?.id || profile.deleted_at) {
        throw new BackendError(404, "MEMBER_NOT_FOUND", "找不到人員資料");
      }
      await assertManageableTarget(transaction, actor, profile);
      await assertGroupActive(transaction, newGroupId);
      assertActorGroup(actor, newGroupId, "此角色不可管理目標群組");
      await assertGroupChangeAllowed(transaction, profile, newGroupId);
      return { ok: true, employeeCode: profile.employee_code, groupId: String(newGroupId) };
    });
  }

  async function saveMember(employeeId, member, previousEmployeeCode, defaultPasswordHash) {
    try {
      return await database.transaction(async (transaction) => {
        const actor = await getActor(transaction, employeeId);
        const targetByNewCode = await findMemberByCode(transaction, member.employeeCode, true);
        const previousCode = normalizeCode(previousEmployeeCode);
        let profile = null;

        await assertGroupActive(transaction, member.groupId);
        assertActorGroup(actor, member.groupId, "沒有管理指定群組人員的權限");

        if (previousCode) {
          profile = await findMemberByCode(transaction, previousCode, true);
          if (!profile?.id || profile.deleted_at) {
            throw new BackendError(409, "MEMBER_SOURCE_NOT_FOUND", "找不到原人員資料，請重新整理後再試");
          }
          if (targetByNewCode?.id && String(targetByNewCode.id) !== String(profile.id)) {
            throw new BackendError(409, "MEMBER_CODE_DUPLICATE", `工號 ${member.employeeCode} 已存在，不能重複使用`);
          }
        } else if (targetByNewCode?.id) {
          throw new BackendError(409, "MEMBER_CODE_DUPLICATE", `工號 ${member.employeeCode} 已存在，不能重複使用`);
        }

        await assertManageableTarget(transaction, actor, profile);
        const accessRole = await getRole(transaction, member.accessRoleId);
        await assertRoleAppliesToGroup(transaction, accessRole.id, member.groupId);
        if (accessRole.permissions.includes(PRIVILEGED_PERMISSION) && !actor.canManagePermissions) {
          throw new BackendError(403, "PRIVILEGED_ROLE_ASSIGN_DENIED", "只有權限管理者可以指定此權限角色");
        }
        if (profile) {
          await assertLastPrivilegedProtected(transaction, profile, accessRole, member);
          await assertGroupChangeAllowed(transaction, profile, member.groupId);
        }

        const homeDepartmentId = await resolveDepartment(transaction, member.homeDepartmentId, member.groupId);
        await assertScheduleShifts(transaction, member.scheduleShiftIds, member.groupId);

        const profileParams = [
          member.employeeCode,
          member.fullName,
          accessRole.id,
          member.groupId,
          member.hireDate || null,
          member.leaveDate || null,
          Boolean(member.payByDay),
          Math.min(6, Math.max(0, Number(member.fixedRestWeekday) || 0)),
          homeDepartmentId,
          member.scheduleShiftIds,
          Math.max(0, Number(member.monthlyRestDays) || 0)
        ];

        if (!profile) {
          const row = await transaction.one(`
            insert into public.set_employee(
              id, employee_code, full_name, access_role_id, group_id,
              hire_date, leave_date, pay_by_day, fixed_rest_weekday,
              home_department_id, schedule_shift_ids, monthly_rest_days
            ) values (
              $1::uuid, $2, $3, $4::uuid, $5::uuid,
              $6::date, $7::date, $8::boolean, $9::integer,
              $10::uuid, $11::uuid[], $12::numeric
            )
            returning id, employee_code
          `, [member.id, ...profileParams]);
          if (!row?.id) throw new BackendError(409, "MEMBER_CREATE_FAILED", "建立人員失敗");
          await transaction.query(`
            insert into public.auth_accounts(
              employee_id, login_account, password_hash, password_changed_at, created_at, updated_at
            ) values ($1::uuid, $2, $3, now(), now(), now())
          `, [row.id, normalizeCodeKey(member.employeeCode), defaultPasswordHash]);
          return { ok: true, created: true, id: String(row.id), employeeCode: row.employee_code };
        }

        const updated = await transaction.one(`
          update public.set_employee
          set employee_code = $2,
              full_name = $3,
              access_role_id = $4::uuid,
              group_id = $5::uuid,
              hire_date = $6::date,
              leave_date = $7::date,
              pay_by_day = $8::boolean,
              fixed_rest_weekday = $9::integer,
              home_department_id = $10::uuid,
              schedule_shift_ids = $11::uuid[],
              monthly_rest_days = $12::numeric,
              updated_at = now()
          where id = $1::uuid and deleted_at is null
          returning id, employee_code
        `, [profile.id, ...profileParams]);
        if (!updated?.id) throw new BackendError(409, "MEMBER_UPDATE_FAILED", "人員資料更新失敗");
        await transaction.query(`
          update public.auth_accounts
          set login_account = $2,
              updated_at = now()
          where employee_id = $1::uuid
        `, [profile.id, normalizeCodeKey(member.employeeCode)]);
        return { ok: true, created: false, id: String(updated.id), employeeCode: updated.employee_code };
      });
    } catch (error) {
      if (error?.code === "23505") {
        throw new BackendError(409, "MEMBER_CODE_DUPLICATE", `工號 ${member.employeeCode} 已存在，不能重複使用`);
      }
      throw error;
    }
  }

  async function resetPassword(employeeId, employeeCode, passwordHash) {
    return database.transaction(async (transaction) => {
      const actor = await getActor(transaction, employeeId);
      const profile = await findMemberByCode(transaction, employeeCode, true);
      if (!profile?.id || profile.deleted_at) {
        throw new BackendError(404, "MEMBER_NOT_FOUND", "找不到這位人員的登入帳號");
      }
      await assertManageableTarget(transaction, actor, profile);
      const result = await transaction.query(`
        update public.auth_accounts
        set password_hash = $2,
            password_changed_at = now(),
            updated_at = now()
        where employee_id = $1::uuid
      `, [profile.id, passwordHash]);
      if (result.rowCount < 1) {
        throw new BackendError(404, "MEMBER_AUTH_ACCOUNT_NOT_FOUND", "找不到這位人員的登入帳號");
      }
      await transaction.query(
        "delete from public.auth_sessions where employee_id = $1::uuid",
        [profile.id]
      );
      return {
        ok: true,
        employeeCode: profile.employee_code,
        selfReset: String(profile.id) === String(actor.id)
      };
    });
  }

  async function deleteMember(employeeId, employeeCode, options = {}) {
    return database.transaction(async (transaction) => {
      const actor = await getActor(transaction, employeeId);
      const profile = await findMemberByCode(transaction, employeeCode, true);
      if (!profile?.id || profile.deleted_at) {
        return { ok: true, deleted: false, softDeleted: false, hardDeleted: false, blocked: false };
      }
      await assertManageableTarget(transaction, actor, profile);
      const selfDelete = String(profile.id) === String(actor.id);
      if (selfDelete) {
        if (typeof options.verifySelfPassword !== "function") {
          throw new BackendError(400, "CURRENT_PASSWORD_REQUIRED", "刪除自己的帳號前，請輸入目前密碼");
        }
        const verified = await options.verifySelfPassword(profile.password_hash || "");
        if (!verified) throw new BackendError(400, "CURRENT_PASSWORD_INVALID", "目前密碼不正確");
      }

      if (isPrivileged(profile) && await isEffectiveWithDates(transaction, profile.hire_date, profile.leave_date)) {
        if (await countOtherEffectivePrivileged(transaction, profile.id) === 0) {
          throw new BackendError(409, "LAST_PRIVILEGED_ACCOUNT", "系統必須保留至少一個有效的權限管理帳號");
        }
      }

      const schedule = await transaction.one(`
        select
          count(*)::integer as total_count,
          count(*) filter (
            where not public.is_schedule_date_archived(entry.group_id, entry.work_date)
          )::integer as unarchived_count
        from public.schedule_entries entry
        where entry.member_id = $1::uuid
      `, [profile.id]);
      const unarchived = Number(schedule?.unarchived_count || 0);
      if (unarchived > 0) {
        throw new BackendError(
          409,
          "MEMBER_HAS_UNARCHIVED_SCHEDULE",
          "此人員仍有未封存班表，請先完成班表封存或清除相關排班。",
          { history: { unarchivedSchedule: unarchived } }
        );
      }

      const attendance = await transaction.one(
        "select count(*)::integer as count from public.attendance_days where user_id = $1::uuid",
        [profile.id]
      );
      const meals = await transaction.one(
        "select count(*)::integer as count from public.meal_orders where user_id = $1::uuid",
        [profile.id]
      );
      const scheduleCount = Number(schedule?.total_count || 0);
      const attendanceCount = Number(attendance?.count || 0);
      const mealCount = Number(meals?.count || 0);
      const hardDeleted = scheduleCount === 0 && attendanceCount === 0 && mealCount === 0;

      await transaction.query(
        "delete from public.auth_sessions where employee_id = $1::uuid",
        [profile.id]
      );

      if (hardDeleted) {
        await transaction.query(
          "delete from public.set_employee where id = $1::uuid and deleted_at is null",
          [profile.id]
        );
      } else {
        await transaction.query(`
          update public.set_employee
          set deleted_at = now(), updated_at = now()
          where id = $1::uuid and deleted_at is null
        `, [profile.id]);
      }

      return {
        ok: true,
        deleted: true,
        softDeleted: !hardDeleted,
        hardDeleted,
        blocked: false,
        selfDelete,
        employeeCode: profile.employee_code,
        history: hardDeleted ? undefined : {
          schedule: scheduleCount,
          attendance: attendanceCount,
          mealOrders: mealCount
        }
      };
    });
  }

  return Object.freeze({
    getDirectory,
    validateGroupChange,
    saveMember,
    resetPassword,
    deleteMember
  });
}

module.exports = {
  normalizeCode,
  normalizeCodeKey,
  createNativeMemberRepository
};
