const { BackendError } = require("../errors");

function unavailable() {
  throw new BackendError(503, "BACKEND_PROVIDER_NOT_CONFIGURED", "後端 Provider 尚未設定");
}

function createUnconfiguredProvider() {
  return Object.freeze({
    health: async () => ({ ready: false }),
    signIn: unavailable,
    getAuthContext: unavailable,
    signOut: unavailable,
    changePassword: unavailable
  });
}

module.exports = {
  createUnconfiguredProvider
};
