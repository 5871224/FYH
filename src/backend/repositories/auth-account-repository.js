const { BackendError } = require("../errors");

function normalizeLoginAccount(value) {
  return String(value || "").trim().toLowerCase();
}

function createAuthAccountRepository(database) {
  if (!database || typeof database.one !== "function" || typeof database.query !== "function") {
    throw new BackendError(500, "AUTH_ACCOUNT_DATABASE_REQUIRED", "帳號 Repository 尚未設定資料庫");
  }

  async function findByLoginAccount(loginAccount) {
    const normalized = normalizeLoginAccount(loginAccount);
    if (!normalized) return null;
    return database.one(`
      select
        account.employee_id,
        account.login_account,
        account.password_hash,
        account.password_changed_at,
        employee.employee_code,
        employee.full_name,
        employee.home_department_id,
        employee.group_id,
        employee.access_role_id,
        employee.hire_date,
        employee.leave_date,
        employee.deleted_at
      from public.auth_accounts account
      join public.set_employee employee on employee.id = account.employee_id
      where lower(account.login_account) = $1
      limit 1
    `, [normalized]);
  }

  async function findByEmployeeId(employeeId) {
    const id = String(employeeId || "").trim();
    if (!id) return null;
    return database.one(`
      select
        account.employee_id,
        account.login_account,
        account.password_hash,
        account.password_changed_at,
        employee.employee_code,
        employee.full_name,
        employee.home_department_id,
        employee.group_id,
        employee.access_role_id,
        employee.hire_date,
        employee.leave_date,
        employee.deleted_at
      from public.auth_accounts account
      join public.set_employee employee on employee.id = account.employee_id
      where account.employee_id = $1::uuid
      limit 1
    `, [id]);
  }

  async function savePasswordHash(employeeId, passwordHash) {
    const id = String(employeeId || "").trim();
    const hash = String(passwordHash || "");
    if (!id || !hash) {
      throw new BackendError(400, "AUTH_ACCOUNT_PASSWORD_INPUT_REQUIRED", "帳號與密碼雜湊不可空白");
    }
    const result = await database.query(`
      update public.auth_accounts
      set password_hash = $2,
          password_changed_at = now(),
          updated_at = now()
      where employee_id = $1::uuid
    `, [id, hash]);
    return result.rowCount > 0;
  }

  async function upsertAccount({ employeeId, loginAccount, passwordHash }) {
    const id = String(employeeId || "").trim();
    const login = normalizeLoginAccount(loginAccount);
    const hash = String(passwordHash || "");
    if (!id || !login || !hash) {
      throw new BackendError(400, "AUTH_ACCOUNT_INPUT_REQUIRED", "帳號資料不可空白");
    }
    return database.one(`
      insert into public.auth_accounts (
        employee_id,
        login_account,
        password_hash,
        password_changed_at,
        created_at,
        updated_at
      ) values ($1::uuid, $2, $3, now(), now(), now())
      on conflict (employee_id) do update
      set login_account = excluded.login_account,
          password_hash = excluded.password_hash,
          password_changed_at = now(),
          updated_at = now()
      returning employee_id, login_account, password_changed_at
    `, [id, login, hash]);
  }

  async function deleteByEmployeeId(employeeId) {
    const id = String(employeeId || "").trim();
    if (!id) return false;
    const result = await database.query(
      "delete from public.auth_accounts where employee_id = $1::uuid",
      [id]
    );
    return result.rowCount > 0;
  }

  return Object.freeze({
    findByLoginAccount,
    findByEmployeeId,
    savePasswordHash,
    upsertAccount,
    deleteByEmployeeId
  });
}

module.exports = {
  normalizeLoginAccount,
  createAuthAccountRepository
};
