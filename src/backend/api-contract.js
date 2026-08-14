const CONTRACT_VERSION = 1;
const API_PREFIX = `/api/v${CONTRACT_VERSION}`;

const ROUTES = Object.freeze({
  health: Object.freeze({ method: "GET", path: `${API_PREFIX}/health`, auth: false }),
  authSignIn: Object.freeze({ method: "POST", path: `${API_PREFIX}/auth/sign-in`, auth: false }),
  authContext: Object.freeze({ method: "GET", path: `${API_PREFIX}/auth/context`, auth: true }),
  authSignOut: Object.freeze({ method: "POST", path: `${API_PREFIX}/auth/sign-out`, auth: true }),
  authPassword: Object.freeze({ method: "PUT", path: `${API_PREFIX}/auth/password`, auth: true }),
  scheduleBootstrap: Object.freeze({ method: "GET", path: `${API_PREFIX}/schedule/bootstrap`, auth: true }),
  scheduleEntries: Object.freeze({ method: "GET", path: `${API_PREFIX}/schedule/entries`, auth: true }),
  scheduleEntriesSave: Object.freeze({ method: "PUT", path: `${API_PREFIX}/schedule/entries`, auth: true }),
  schedulePreferencesSave: Object.freeze({ method: "PUT", path: `${API_PREFIX}/schedule/preferences`, auth: true }),
  settingsReorder: Object.freeze({ method: "PUT", path: `${API_PREFIX}/settings/order`, auth: true }),
  departmentSave: Object.freeze({ method: "PUT", path: `${API_PREFIX}/settings/department`, auth: true }),
  departmentDelete: Object.freeze({ method: "POST", path: `${API_PREFIX}/settings/department/delete`, auth: true }),
  shiftSave: Object.freeze({ method: "PUT", path: `${API_PREFIX}/settings/shift`, auth: true }),
  catalogSave: Object.freeze({ method: "PUT", path: `${API_PREFIX}/settings/catalog`, auth: true }),
  catalogDelete: Object.freeze({ method: "POST", path: `${API_PREFIX}/settings/catalog/delete`, auth: true })
});

function findRoute(method, pathname) {
  const normalizedMethod = String(method || "GET").toUpperCase();
  const normalizedPath = String(pathname || "");
  return Object.entries(ROUTES).find(([, route]) => (
    route.method === normalizedMethod && route.path === normalizedPath
  )) || null;
}

module.exports = {
  CONTRACT_VERSION,
  API_PREFIX,
  ROUTES,
  findRoute
};
