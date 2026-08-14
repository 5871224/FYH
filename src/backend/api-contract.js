const CONTRACT_VERSION = 1;
const API_PREFIX = `/api/v${CONTRACT_VERSION}`;

const ROUTES = Object.freeze({
  health: Object.freeze({ method: "GET", path: `${API_PREFIX}/health`, auth: false }),
  authSignIn: Object.freeze({ method: "POST", path: `${API_PREFIX}/auth/sign-in`, auth: false }),
  authContext: Object.freeze({ method: "GET", path: `${API_PREFIX}/auth/context`, auth: true }),
  authSignOut: Object.freeze({ method: "POST", path: `${API_PREFIX}/auth/sign-out`, auth: true }),
  authPassword: Object.freeze({ method: "PUT", path: `${API_PREFIX}/auth/password`, auth: true }),
  scheduleBootstrap: Object.freeze({ method: "GET", path: `${API_PREFIX}/schedule/bootstrap`, auth: true }),
  scheduleEntries: Object.freeze({ method: "GET", path: `${API_PREFIX}/schedule/entries`, auth: true })
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
