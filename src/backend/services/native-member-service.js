const { randomUUID } = require("crypto");
const { BackendError } = require("../errors");
const { hashPassword, verifyPassword } = require("../auth/password-hasher");

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_PASSWORD = "0000";

function requireUuid(value, label) {
  const text = String(value || "").trim();
  if (!UUID_PATTERN.test(text)) {
    throw new BackendError(400, "MEMBER_UUID_INVALID", `${label}格式錯誤`);
  }
  return text;
}

function optionalUuid(value, label) {
  const text = String(value || "").trim();
  return text ? requireUuid(text, label) : "";
}

function optionalDate(value, label) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (!ISO_DATE_PATTERN.test(text)) {
    throw new BackendError(400, "MEMBER_DATE_INVALID", `${label}格式錯誤`);
  }
  return text;
}

function normalizeMember(member = {}) {
  const employeeCode = String(member.employeeCode || member.code || "").trim();
  const fullName = String(member.fullName || member.name || "").trim();
  if (!employeeCode || !fullName) {
    throw new BackendError(400, "MEMBER_NAME_REQUIRED", "缺少工號或姓名");
  }

  const groupId = requireUuid(member.groupId, "群組識別碼");
  const accessRoleId = requireUuid(member.accessRoleId || member.roleId, "權限角色識別碼");
  const homeDepartmentId = optionalUuid(member.homeDepartmentId || member.deptId, "所屬單位識別碼");
  const shiftIds = Array.isArray(member.scheduleShiftIds) ? member.scheduleShiftIds : [];
  const scheduleShiftIds = [...new Set(shiftIds.map((value) => requireUuid(value, "排班班別識別碼")))];
  const fixedRestWeekday = Math.min(6, Math.max(0, Math.trunc(Number(member.fixedRestWeekday) || 0)));
  const monthlyRestDays = Math.min(31, Math.max(0, Math.trunc(Number(member.monthlyRestDays) || 0)));

  return {
    id: randomUUID(),
    employeeCode,
    fullName,
    groupId,
    accessRoleId,
    hireDate: optionalDate(member.hireDate, "到職日期"),
    leaveDate: optionalDate(member.leaveDate, "離職日期"),
    payByDay: Boolean(member.payByDay),
    fixedRestWeekday,
    homeDepartmentId,
    scheduleShiftIds,
    monthlyRestDays
  };
}

function createNativeMemberService(memberRepository, options = {}) {
  if (!memberRepository
    || typeof memberRepository.getDirectory !== "function"
    || typeof memberRepository.validateGroupChange !== "function"
    || typeof memberRepository.saveMember !== "function"
    || typeof memberRepository.resetPassword !== "function"
    || typeof memberRepository.deleteMember !== "function") {
    throw new BackendError(500, "MEMBER_REPOSITORY_REQUIRED", "人員服務尚未設定資料層");
  }

  const hash = typeof options.hashPassword === "function" ? options.hashPassword : hashPassword;
  const verify = typeof options.verifyPassword === "function" ? options.verifyPassword : verifyPassword;

  async function getDirectory(employeeId) {
    return memberRepository.getDirectory(requireUuid(employeeId, "登入人員識別碼"));
  }

  async function validateGroupChange(employeeId, employeeCode, newGroupId) {
    const code = String(employeeCode || "").trim();
    if (!code) throw new BackendError(400, "MEMBER_CODE_REQUIRED", "請提供人員工號");
    return memberRepository.validateGroupChange(
      requireUuid(employeeId, "登入人員識別碼"),
      code,
      requireUuid(newGroupId, "目標群組識別碼")
    );
  }

  async function saveMember(employeeId, member, previousEmployeeCode = "") {
    const normalized = normalizeMember(member);
    const defaultPasswordHash = await hash(DEFAULT_PASSWORD);
    return memberRepository.saveMember(
      requireUuid(employeeId, "登入人員識別碼"),
      normalized,
      String(previousEmployeeCode || "").trim(),
      defaultPasswordHash
    );
  }

  async function resetPassword(employeeId, employeeCode, password = DEFAULT_PASSWORD) {
    const code = String(employeeCode || "").trim();
    if (!code) throw new BackendError(400, "MEMBER_CODE_REQUIRED", "缺少工號");
    const secret = String(password || "");
    if (!secret) throw new BackendError(400, "PASSWORD_REQUIRED", "密碼不可空白");
    const passwordHash = await hash(secret);
    return memberRepository.resetPassword(
      requireUuid(employeeId, "登入人員識別碼"),
      code,
      passwordHash
    );
  }

  async function deleteMember(employeeId, employeeCode, currentPassword = "") {
    const actorId = requireUuid(employeeId, "登入人員識別碼");
    const code = String(employeeCode || "").trim();
    if (!code) throw new BackendError(400, "MEMBER_CODE_REQUIRED", "請提供人員工號");
    const password = String(currentPassword || "");
    return memberRepository.deleteMember(actorId, code, {
      verifySelfPassword: async (encodedHash) => {
        if (!password) return false;
        return verify(password, encodedHash);
      }
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
  DEFAULT_PASSWORD,
  normalizeMember,
  createNativeMemberService
};
