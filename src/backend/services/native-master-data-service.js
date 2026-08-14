const { BackendError } = require("../errors");

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function requireUuid(value, label) {
  const text = String(value || "").trim();
  if (!UUID_PATTERN.test(text)) {
    throw new BackendError(400, "MASTER_DATA_ID_INVALID", `${label}識別碼格式錯誤`);
  }
  return text;
}

function optionalDate(value, label) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (!DATE_PATTERN.test(text)) {
    throw new BackendError(400, "MASTER_DATA_DATE_INVALID", `${label}格式錯誤`);
  }
  return text;
}

function optionalFiniteNumber(value, label) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new BackendError(400, "MASTER_DATA_NUMBER_INVALID", `${label}格式錯誤`);
  }
  return number;
}

function createNativeMasterDataService(repository) {
  if (!repository
    || typeof repository.saveDepartment !== "function"
    || typeof repository.deleteDepartment !== "function"
    || typeof repository.saveShift !== "function"
    || typeof repository.saveCatalogItem !== "function"
    || typeof repository.deleteCatalogItem !== "function") {
    throw new BackendError(500, "MASTER_DATA_REPOSITORY_REQUIRED", "主檔服務尚未設定資料層");
  }

  async function saveDepartment(employeeId, department) {
    const source = department && typeof department === "object" ? department : {};
    const name = String(source.name || "").trim();
    if (!name) {
      throw new BackendError(400, "DEPARTMENT_NAME_REQUIRED", "單位名稱不可空白");
    }
    const normalized = {
      id: requireUuid(source.id, "單位"),
      groupId: requireUuid(source.groupId, "群組"),
      name,
      startDate: optionalDate(source.startDate, "開始日期"),
      endDate: optionalDate(source.endDate, "結束日期"),
      hiddenFromSchedule: Boolean(source.hiddenFromSchedule),
      sortOrder: Math.max(0, Number(source.sortOrder) || 0),
      address: String(source.address || "").trim() || null,
      latitude: optionalFiniteNumber(source.latitude, "緯度"),
      longitude: optionalFiniteNumber(source.longitude, "經度"),
      publicIp: String(source.publicIp || "").trim() || null,
      attendanceEnabled: Boolean(source.attendanceEnabled)
    };
    if (normalized.startDate && normalized.endDate && normalized.startDate > normalized.endDate) {
      throw new BackendError(400, "DEPARTMENT_DATE_RANGE_INVALID", "單位日期範圍不正確");
    }
    return repository.saveDepartment(employeeId, normalized);
  }

  async function deleteDepartment(employeeId, departmentId) {
    return repository.deleteDepartment(employeeId, requireUuid(departmentId, "單位"));
  }

  async function saveShift(employeeId, shift) {
    const source = shift && typeof shift === "object" ? shift : {};
    const name = String(source.name || "").trim();
    if (!name) {
      throw new BackendError(400, "SHIFT_NAME_REQUIRED", "班別名稱不可空白");
    }
    return repository.saveShift(employeeId, {
      id: requireUuid(source.id, "班別"),
      name,
      applicableDepartmentId: requireUuid(
        source.applicableDepartmentId || source.applicableDeptId,
        "適用單位"
      ),
      color: String(source.color || "").trim() || null,
      textColor: String(source.textColor || "").trim() || null,
      autoTextColor: source.autoTextColor !== false,
      hiddenFromToolbar: Boolean(source.hiddenFromToolbar),
      startTime: String(source.startTime || "").trim() || null,
      endTime: String(source.endTime || "").trim() || null,
      requiredStaffCount: Math.max(0, Number(source.requiredStaffCount) || 0),
      sortOrder: Math.max(0, Number(source.sortOrder) || 0)
    });
  }

  async function saveCatalogItem(employeeId, category, item) {
    const normalizedCategory = String(category || "").trim().toLowerCase();
    if (!['leave', 'overtime'].includes(normalizedCategory)) {
      throw new BackendError(400, "CATALOG_CATEGORY_UNSUPPORTED", "不支援的設定類型");
    }
    const source = item && typeof item === "object" ? item : {};
    const normalized = {
      ...source,
      id: requireUuid(source.id, "設定"),
      name: String(source.name || "").trim(),
      sortOrder: Math.max(0, Number(source.sortOrder) || 0)
    };
    if (!normalized.name) {
      throw new BackendError(
        400,
        "CATALOG_NAME_REQUIRED",
        normalizedCategory === "leave" ? "假別名稱不可空白" : "加班名稱不可空白"
      );
    }
    if (normalizedCategory === "leave") {
      normalized.code = String(source.code || "").trim();
      if (!normalized.code) {
        throw new BackendError(400, "LEAVE_CODE_REQUIRED", "假別代碼不可空白");
      }
    }
    return repository.saveCatalogItem(employeeId, normalizedCategory, normalized);
  }

  async function deleteCatalogItem(employeeId, category, itemId) {
    const normalizedCategory = String(category || "").trim().toLowerCase();
    if (!['shift', 'leave', 'overtime'].includes(normalizedCategory)) {
      throw new BackendError(400, "CATALOG_CATEGORY_UNSUPPORTED", "不支援的設定類型");
    }
    return repository.deleteCatalogItem(
      employeeId,
      normalizedCategory,
      requireUuid(itemId, "設定")
    );
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
  createNativeMasterDataService
};
