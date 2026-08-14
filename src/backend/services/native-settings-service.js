const { BackendError } = require("../errors");

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_REORDER_IDS = 5000;

function createNativeSettingsService(settingsRepository) {
  if (!settingsRepository
    || typeof settingsRepository.saveSchedulerPreferences !== "function"
    || typeof settingsRepository.reorderSettings !== "function") {
    throw new BackendError(500, "SETTINGS_REPOSITORY_REQUIRED", "設定服務尚未設定資料層");
  }

  async function saveSchedulerPreferences(employeeId, documentId, settings) {
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
      throw new BackendError(400, "SCHEDULER_PREFERENCES_INVALID", "班表偏好設定格式錯誤");
    }
    return settingsRepository.saveSchedulerPreferences(employeeId, documentId, settings);
  }

  async function reorderSettings(employeeId, category, ids) {
    if (!Array.isArray(ids)) {
      throw new BackendError(400, "SETTINGS_REORDER_INVALID", "排序資料不可空白");
    }
    if (ids.length > MAX_REORDER_IDS) {
      throw new BackendError(413, "SETTINGS_REORDER_TOO_LARGE", "單次排序筆數過多");
    }
    const normalizedIds = ids.map((value) => String(value || "").trim());
    if (normalizedIds.some((value) => !UUID_PATTERN.test(value))) {
      throw new BackendError(400, "SETTINGS_REORDER_ID_INVALID", "排序資料識別碼格式錯誤");
    }
    if (new Set(normalizedIds).size !== normalizedIds.length) {
      throw new BackendError(400, "SETTINGS_REORDER_DUPLICATE", "排序資料不可包含重複項目");
    }
    return settingsRepository.reorderSettings(employeeId, category, normalizedIds);
  }

  return Object.freeze({
    saveSchedulerPreferences,
    reorderSettings
  });
}

module.exports = {
  createNativeSettingsService
};
