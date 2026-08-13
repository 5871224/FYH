class BackendError extends Error {
  constructor(statusCode, code, message, details = null) {
    super(String(message || code || "Backend error"));
    this.name = "BackendError";
    this.statusCode = Number(statusCode) || 500;
    this.code = String(code || "BACKEND_ERROR");
    this.details = details;
  }
}

function normalizeBackendError(error) {
  if (error instanceof BackendError) return error;
  return new BackendError(500, "INTERNAL_ERROR", "後端服務發生錯誤");
}

module.exports = {
  BackendError,
  normalizeBackendError
};
