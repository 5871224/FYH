const { createNativeAuthProvider } = require("./providers/native-auth-provider");
const { createNativeIdentityRepository } = require("./repositories/native-identity-repository");
const { createNativeAccessRepository } = require("./repositories/native-access-repository");
const { createNativeScheduleRepository } = require("./repositories/native-schedule-repository");
const { createNativeScheduleService } = require("./services/native-schedule-service");
const { createPostgresSessionStore } = require("./postgres-session-store");

function createNativeRuntime(database, options = {}) {
  const identityRepository = options.identityRepository
    || createNativeIdentityRepository(database);
  const accessRepository = options.accessRepository
    || createNativeAccessRepository(database);
  const scheduleRepository = options.scheduleRepository
    || createNativeScheduleRepository(database);
  const provider = options.provider
    || createNativeAuthProvider(identityRepository, { accessRepository });
  const sessionStore = options.sessionStore
    || createPostgresSessionStore(database, options.sessionOptions);
  const scheduleService = options.scheduleService
    || createNativeScheduleService(scheduleRepository, accessRepository);

  return Object.freeze({
    provider,
    sessionStore,
    identityRepository,
    accessRepository,
    scheduleRepository,
    scheduleService,
    services: Object.freeze({
      schedule: scheduleService
    })
  });
}

module.exports = {
  createNativeRuntime
};
