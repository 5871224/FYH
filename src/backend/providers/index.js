const { createSupabaseAuthProvider } = require("./supabase-auth-provider");
const { createUnconfiguredProvider } = require("./unconfigured-provider");

function createBackendProviderFromEnv(env = process.env, options = {}) {
  const baseUrl = String(env.SUPABASE_URL || "").trim();
  const anonKey = String(env.SUPABASE_ANON_KEY || "").trim();
  if (!baseUrl || !anonKey) {
    return createUnconfiguredProvider();
  }
  return createSupabaseAuthProvider({
    baseUrl,
    anonKey,
    fetchImpl: options.fetchImpl || globalThis.fetch,
    now: options.now
  });
}

module.exports = {
  createBackendProviderFromEnv
};
