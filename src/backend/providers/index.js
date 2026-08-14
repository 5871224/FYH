const { createUnconfiguredProvider } = require("./unconfigured-provider");

function createBackendProviderFromEnv() {
  return createUnconfiguredProvider();
}

module.exports = {
  createBackendProviderFromEnv
};
