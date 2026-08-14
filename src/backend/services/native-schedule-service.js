const { BackendError } = require("../errors");

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function normalizeDate(value, label) {
  const text = String(value || "").trim();
  if (!ISO_DATE_PATTERN.test(text)) {
    throw new BackendError(400, "SCHEDULE_DATE_INVALID", `${label}格式錯誤`);
  }
  return text;
}

function createNativeScheduleService(scheduleRepository, accessRepository) {
  if (!scheduleRepository
    || typeof scheduleRepository.getBootstrap !== "function"
    || typeof scheduleRepository.getEntries !== "function") {
    throw new BackendError(500, "SCHEDULE_REPOSITORY_REQUIRED", "班表服務尚未設定資料層");
  }
  if (!accessRepository || typeof accessRepository.getAccessBundle !== "function") {
    throw new BackendError(500, "ACCESS_REPOSITORY_REQUIRED", "班表服務尚未設定權限資料層");
  }

  async function getBootstrap(employeeId, documentId = "default") {
    const [bootstrap, accessBundle] = await Promise.all([
      scheduleRepository.getBootstrap(employeeId, documentId),
      accessRepository.getAccessBundle(employeeId)
    ]);
    if (!bootstrap) {
      throw new BackendError(403, "SCHEDULE_VIEW_DENIED", "沒有查看班表的權限");
    }
    return {
      ...bootstrap,
      accessBundle
    };
  }

  async function getEntries(employeeId, startDate, endDate, options = {}) {
    const normalizedStartDate = normalizeDate(startDate, "開始日期");
    const normalizedEndDate = normalizeDate(endDate, "結束日期");
    if (normalizedStartDate > normalizedEndDate) {
      throw new BackendError(400, "SCHEDULE_RANGE_INVALID", "班表日期範圍不正確");
    }
    const offset = Math.max(0, Number(options.offset) || 0);
    const limit = Math.min(1000, Math.max(1, Number(options.limit) || 1000));
    return scheduleRepository.getEntries(
      employeeId,
      normalizedStartDate,
      normalizedEndDate,
      offset,
      limit
    );
  }

  return Object.freeze({
    getBootstrap,
    getEntries
  });
}

module.exports = {
  createNativeScheduleService
};
