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
  scheduleArchives: Object.freeze({ method: "GET", path: `${API_PREFIX}/schedule/archives`, auth: true }),
  scheduleArchiveCreate: Object.freeze({ method: "POST", path: `${API_PREFIX}/schedule/archives`, auth: true }),
  scheduleArchiveEntries: Object.freeze({ method: "GET", path: `${API_PREFIX}/schedule/archives/entries`, auth: true }),
  scheduleArchiveUnarchive: Object.freeze({ method: "POST", path: `${API_PREFIX}/schedule/archives/unarchive`, auth: true }),
  scheduleHolidaysSave: Object.freeze({ method: "PUT", path: `${API_PREFIX}/schedule/holidays`, auth: true }),
  scheduleExportRows: Object.freeze({ method: "GET", path: `${API_PREFIX}/schedule/export`, auth: true }),
  attendanceDepartmentSettings: Object.freeze({ method: "GET", path: `${API_PREFIX}/attendance/department-settings`, auth: true }),
  attendanceToday: Object.freeze({ method: "GET", path: `${API_PREFIX}/attendance/today`, auth: true }),
  attendanceClock: Object.freeze({ method: "POST", path: `${API_PREFIX}/attendance/clock`, auth: true }),
  attendancePersonalList: Object.freeze({ method: "POST", path: `${API_PREFIX}/attendance/personal/list`, auth: true }),
  attendancePersonalSave: Object.freeze({ method: "PUT", path: `${API_PREFIX}/attendance/personal`, auth: true }),
  attendanceReviewList: Object.freeze({ method: "POST", path: `${API_PREFIX}/attendance/review/list`, auth: true }),
  attendanceCommonNotes: Object.freeze({ method: "PUT", path: `${API_PREFIX}/attendance/review/common-notes`, auth: true }),
  attendanceReviewSave: Object.freeze({ method: "PUT", path: `${API_PREFIX}/attendance/review/record`, auth: true }),
  attendanceReviewSet: Object.freeze({ method: "POST", path: `${API_PREFIX}/attendance/review/set`, auth: true }),
  attendanceHistory: Object.freeze({ method: "GET", path: `${API_PREFIX}/attendance/review/history`, auth: true }),
  attendanceExport: Object.freeze({ method: "POST", path: `${API_PREFIX}/attendance/review/export`, auth: true }),
  mealToday: Object.freeze({ method: "GET", path: `${API_PREFIX}/meal/today`, auth: true }),
  mealSave: Object.freeze({ method: "PUT", path: `${API_PREFIX}/meal/today`, auth: true }),
  mealCancel: Object.freeze({ method: "POST", path: `${API_PREFIX}/meal/today/cancel`, auth: true }),
  mealAdminSettings: Object.freeze({ method: "GET", path: `${API_PREFIX}/meal/admin`, auth: true }),
  mealAdminSettingsSave: Object.freeze({ method: "PUT", path: `${API_PREFIX}/meal/admin`, auth: true }),
  mealProductDelete: Object.freeze({ method: "POST", path: `${API_PREFIX}/meal/admin/product/delete`, auth: true }),
  mealReport: Object.freeze({ method: "POST", path: `${API_PREFIX}/meal/report`, auth: true }),
  settingsReorder: Object.freeze({ method: "PUT", path: `${API_PREFIX}/settings/order`, auth: true }),
  departmentSave: Object.freeze({ method: "PUT", path: `${API_PREFIX}/settings/department`, auth: true }),
  departmentDelete: Object.freeze({ method: "POST", path: `${API_PREFIX}/settings/department/delete`, auth: true }),
  shiftSave: Object.freeze({ method: "PUT", path: `${API_PREFIX}/settings/shift`, auth: true }),
  catalogSave: Object.freeze({ method: "PUT", path: `${API_PREFIX}/settings/catalog`, auth: true }),
  catalogDelete: Object.freeze({ method: "POST", path: `${API_PREFIX}/settings/catalog/delete`, auth: true }),
  membersDirectory: Object.freeze({ method: "GET", path: `${API_PREFIX}/members`, auth: true }),
  memberSave: Object.freeze({ method: "PUT", path: `${API_PREFIX}/members`, auth: true }),
  memberGroupChangeValidate: Object.freeze({ method: "POST", path: `${API_PREFIX}/members/group-change/validate`, auth: true }),
  memberPasswordReset: Object.freeze({ method: "POST", path: `${API_PREFIX}/members/password/reset`, auth: true }),
  memberDelete: Object.freeze({ method: "POST", path: `${API_PREFIX}/members/delete`, auth: true }),
  accessBundle: Object.freeze({ method: "GET", path: `${API_PREFIX}/access`, auth: true }),
  groupSave: Object.freeze({ method: "PUT", path: `${API_PREFIX}/settings/group`, auth: true }),
  groupDelete: Object.freeze({ method: "POST", path: `${API_PREFIX}/settings/group/delete`, auth: true }),
  groupsReorder: Object.freeze({ method: "PUT", path: `${API_PREFIX}/settings/groups/order`, auth: true }),
  accessRoleSave: Object.freeze({ method: "PUT", path: `${API_PREFIX}/settings/access-role`, auth: true }),
  accessRoleDelete: Object.freeze({ method: "POST", path: `${API_PREFIX}/settings/access-role/delete`, auth: true })
});

function findRoute(method, pathname) {
  const normalizedMethod = String(method || "GET").toUpperCase();
  const normalizedPath = String(pathname || "");
  return Object.entries(ROUTES).find(([, route]) => route.method === normalizedMethod && route.path === normalizedPath) || null;
}

module.exports = { CONTRACT_VERSION, API_PREFIX, ROUTES, findRoute };
