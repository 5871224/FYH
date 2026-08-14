const { createNativeAuthProvider } = require("./providers/native-auth-provider");
const { createNativeIdentityRepository } = require("./repositories/native-identity-repository");
const { createNativeAccessRepository } = require("./repositories/native-access-repository");
const { createNativeScheduleRepository } = require("./repositories/native-schedule-repository");
const { createNativeSettingsRepository } = require("./repositories/native-settings-repository");
const { createNativeMasterDataRepository } = require("./repositories/native-master-data-repository");
const { createNativeScheduleService } = require("./services/native-schedule-service");
const { createNativeSettingsService } = require("./services/native-settings-service");
const { createNativeMasterDataService } = require("./services/native-master-data-service");
const { createPostgresSessionStore } = require("./postgres-session-store");

function createNativeRuntime(database, options = {}) {
  const identityRepository = options.identityRepository
    || createNativeIdentityRepository(database);
  const accessRepository = options.accessRepository
    || createNativeAccessRepository(database);
  const scheduleRepository = options.scheduleRepository
    || createNativeScheduleRepository(database);
  const settingsRepository = options.settingsRepository
    || createNativeSettingsRepository(database);
  const masterDataRepository = options.masterDataRepository
    || createNativeMasterDataRepository(database);
  const provider = options.provider
    || createNativeAuthProvider(identityRepository, { accessRepository });
  const sessionStore = options.sessionStore
    || createPostgresSessionStore(database, options.sessionOptions);
  const scheduleService = options.scheduleService
    || createNativeScheduleService(scheduleRepository, accessRepository);
  const settingsService = options.settingsService
    || createNativeSettingsService(settingsRepository);
  const masterDataService = options.masterDataService
    || createNativeMasterDataService(masterDataRepository);

  return Object.freeze({
    provider,
    sessionStore,
    identityRepository,
    accessRepository,
    scheduleRepository,
    settingsRepository,
    masterDataRepository,
    scheduleService,
    settingsService,
    masterDataService,
    services: Object.freeze({
      schedule: scheduleService,
      settings: settingsService,
      masterData: masterDataService
    })
  });
}

module.exports = {
  createNativeRuntime
};
