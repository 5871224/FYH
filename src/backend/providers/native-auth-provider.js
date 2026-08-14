const { BackendError } = require("../errors");

function createNativeAuthProvider(identityRepository, options = {}) {
  if (!identityRepository
    || typeof identityRepository.authenticate !== "function"
    || typeof identityRepository.findEffectiveByEmployeeId !== "function"
    || typeof identityRepository.changeCredential !== "function") {
    throw new BackendError(500, "IDENTITY_REPOSITORY_REQUIRED", "登入服務尚未設定身份資料層");
  }

  const accessRepository = options.accessRepository || null;

  async function toContext(profile) {
    const employeeId = String(profile.id);
    const access = accessRepository && typeof accessRepository.getAccessBundle === "function"
      ? await accessRepository.getAccessBundle(employeeId)
      : null;

    return {
      providerSession: { employeeId },
      user: { id: employeeId, email: "" },
      profile: {
        id: employeeId,
        employee_code: profile.employee_code,
        full_name: profile.full_name,
        home_department_id: profile.home_department_id,
        position_name: profile.position_name,
        hire_date: profile.hire_date,
        leave_date: profile.leave_date,
        pay_by_day: profile.pay_by_day,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
        schedule_department_ids: profile.schedule_department_ids || [],
        monthly_rest_days: profile.monthly_rest_days,
        fixed_rest_weekday: profile.fixed_rest_weekday,
        schedule_shift_ids: profile.schedule_shift_ids || [],
        sort_order: profile.sort_order,
        group_id: profile.group_id,
        access_role_id: profile.access_role_id,
        deleted_at: profile.deleted_at,
        access
      }
    };
  }

  async function signIn({ loginAccount, password } = {}) {
    const login = String(loginAccount || "").trim();
    const secret = String(password || "");
    if (!login || !secret) {
      throw new BackendError(400, "LOGIN_INPUT_REQUIRED", "請輸入登入帳號與密碼");
    }

    const profile = await identityRepository.authenticate(login, secret);
    if (!profile?.id) {
      throw new BackendError(401, "INVALID_CREDENTIALS", "登入帳號或密碼錯誤");
    }
    return toContext(profile);
  }

  async function getAuthContext(providerSession) {
    const employeeId = String(providerSession?.employeeId || "").trim();
    const profile = employeeId
      ? await identityRepository.findEffectiveByEmployeeId(employeeId)
      : null;
    if (!profile?.id) {
      throw new BackendError(401, "AUTH_REQUIRED", "登入已失效，請重新登入");
    }
    return toContext(profile);
  }

  async function signOut() {
    return { ok: true };
  }

  async function changePassword(providerSession, newPassword) {
    const employeeId = String(providerSession?.employeeId || "").trim();
    if (!employeeId) {
      throw new BackendError(401, "AUTH_REQUIRED", "請先登入");
    }
    const changed = await identityRepository.changeCredential(employeeId, newPassword);
    if (!changed) {
      throw new BackendError(401, "AUTH_REQUIRED", "登入已失效，請重新登入");
    }
    return { ok: true, providerSession: { employeeId } };
  }

  return Object.freeze({
    health: async () => ({ ready: true }),
    signIn,
    getAuthContext,
    signOut,
    changePassword
  });
}

module.exports = {
  createNativeAuthProvider
};