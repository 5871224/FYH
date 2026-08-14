const { BackendError } = require("../errors");

function createNativeIdentityRepository(database) {
  if (!database || typeof database.one !== "function" || typeof database.query !== "function") {
    throw new BackendError(500, "IDENTITY_DATABASE_REQUIRED", "身份資料層尚未設定資料庫");
  }

  async function authenticate(loginAccount, credential) {
    const login = String(loginAccount || "").trim().toLowerCase();
    const secret = String(credential || "");
    if (!login || !secret) return null;

    return database.one(`
      select
        employee.id,
        employee.employee_code,
        employee.full_name,
        employee.home_department_id,
        employee.position_name,
        employee.hire_date,
        employee.leave_date,
        employee.pay_by_day,
        employee.created_at,
        employee.updated_at,
        employee.schedule_department_ids,
        employee.monthly_rest_days,
        employee.fixed_rest_weekday,
        employee.schedule_shift_ids,
        employee.sort_order,
        employee.group_id,
        employee.access_role_id,
        employee.deleted_at
      from public.auth_accounts account
      join public.set_employee employee on employee.id = account.employee_id
      where lower(account.login_account) = $1
        and account.disabled_at is null
        and employee.deleted_at is null
        and (employee.hire_date is null or employee.hire_date <= (timezone('Asia/Taipei', now()))::date)
        and (employee.leave_date is null or employee.leave_date >= (timezone('Asia/Taipei', now()))::date)
        and crypt($2, account.password_hash) = account.password_hash
      limit 1
    `, [login, secret]);
  }

  async function findEffectiveByEmployeeId(employeeId) {
    const id = String(employeeId || "").trim();
    if (!id) return null;

    return database.one(`
      select
        employee.id,
        employee.employee_code,
        employee.full_name,
        employee.home_department_id,
        employee.position_name,
        employee.hire_date,
        employee.leave_date,
        employee.pay_by_day,
        employee.created_at,
        employee.updated_at,
        employee.schedule_department_ids,
        employee.monthly_rest_days,
        employee.fixed_rest_weekday,
        employee.schedule_shift_ids,
        employee.sort_order,
        employee.group_id,
        employee.access_role_id,
        employee.deleted_at
      from public.auth_accounts account
      join public.set_employee employee on employee.id = account.employee_id
      where account.employee_id = $1::uuid
        and account.disabled_at is null
        and employee.deleted_at is null
        and (employee.hire_date is null or employee.hire_date <= (timezone('Asia/Taipei', now()))::date)
        and (employee.leave_date is null or employee.leave_date >= (timezone('Asia/Taipei', now()))::date)
      limit 1
    `, [id]);
  }

  async function changeCredential(employeeId, newCredential) {
    const id = String(employeeId || "").trim();
    const secret = String(newCredential || "");
    if (!id || !secret) {
      throw new BackendError(400, "CREDENTIAL_REQUIRED", "新密碼不可空白");
    }

    const result = await database.query(`
      update public.auth_accounts
      set password_hash = crypt($2, gen_salt('bf', 12)),
          password_changed_at = now(),
          updated_at = now()
      where employee_id = $1::uuid
        and disabled_at is null
    `, [id, secret]);
    return result.rowCount > 0;
  }

  return Object.freeze({
    authenticate,
    findEffectiveByEmployeeId,
    changeCredential
  });
}

module.exports = {
  createNativeIdentityRepository
};