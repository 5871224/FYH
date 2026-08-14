const { createNativeAuthProvider } = require("./providers/native-auth-provider");
const { createNativeIdentityRepository } = require("./repositories/native-identity-repository");
const { createNativeAccessRepository } = require("./repositories/native-access-repository");
const { createPostgresSessionStore } = require("./postgres-session-store");

function createNativeRuntime(database, options = {}) {
  const identityRepository = options.identityRepository
    || createNativeIdentityRepository(database);
  const accessRepository = options.accessRepository
    || createNativeAccessRepository(database);
  const provider = options.provider
    || createNativeAuthProvider(identityRepository, { accessRepository });
  const sessionStore = options.sessionStore
    || createPostgresSessionStore(database, options.sessionOptions);

  return Object.freeze({
    provider,
    sessionStore,
    identityRepository,
    accessRepository
  });
}

module.exports = {
  createNativeRuntime
};
