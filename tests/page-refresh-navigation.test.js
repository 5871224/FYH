const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const rendererDir = path.join(__dirname, "../src/renderer");
const modules = ["renderer-auth-context.js", "renderer-page-data.js", "renderer-app-shell.js"]
  .map((name) => fs.readFileSync(path.join(rendererDir, name), "utf8"))
  .join("\n");

function createStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function createHarness(storage, permissions = {}) {
  const calls = [];
  const context = vm.createContext({
    authenticated: false,
    currentUser: null,
    currentProfile: null,
    appView: "home",
    state: {},
    recordsState: { activeTab: "personal" },
    groupFeatureState: { catalog: {}, bundle: null, currentGroupId: "" },
    authModalOpen: false,
    authErrorMessage: "",
    window: {
      sessionStorage: storage,
      schedulerApi: {
        async getAppInfo() { return {}; },
        async getGroupAccessBundle() { return { actor: {}, groups: [], roles: [] }; }
      }
    },
    document: {
      getElementById() { return null; },
      querySelector() { return null; },
      body: { classList: { toggle() {} } }
    },
    createEmptyState() { return {}; },
    resetLoadedUserRuntimeState() { context.recordsState = { activeTab: "personal" }; },
    chooseCurrentGroupId() { return "group"; },
    getSelectableGroups() { return permissions.schedule ? [{ id: "group" }] : []; },
    hasAnyGroupPermission(permission) { return permission === "attendance_review" && Boolean(permissions.review); },
    hasGroupPermission() { return false; },
    hasCommonPermission() { return false; },
    resetToolbarCollapseOnScheduleEntry() { calls.push("toolbar"); },
    async loadRecordsPage() { calls.push("personal"); },
    async loadAttendanceReview() { calls.push("review"); },
    async loadAttachmentManager() { calls.push("attachments"); },
    showInfoMessage(message) { calls.push(String(message)); }
  });
  vm.runInContext(modules, context);
  context.ensureScheduleApplicationLoaded = async () => { calls.push("schedule"); return true; };
  async function signIn(userId) {
    return context.initializeAuthenticatedHome({
      authenticated: true,
      user: { id: userId },
      profile: { id: userId }
    });
  }
  return { context, calls, signIn };
}

test("重新整理班表仍回到班表，且只載入班表資料", async () => {
  const storage = createStorage();
  const first = createHarness(storage, { schedule: true });
  await first.signIn("member-a");
  first.context.appView = "schedule";
  first.context.syncAppView();

  const refreshed = createHarness(storage, { schedule: true });
  await refreshed.signIn("member-a");
  assert.equal(refreshed.context.appView, "schedule");
  assert.deepEqual(refreshed.calls, ["schedule"]);
});

test("重新整理簽到審核保留頁籤，只載入目前頁籤資料", async () => {
  const storage = createStorage();
  const first = createHarness(storage, { review: true });
  await first.signIn("member-a");
  first.context.appView = "records";
  first.context.recordsState.activeTab = "review";
  first.context.syncAppView();

  const refreshed = createHarness(storage, { review: true });
  await refreshed.signIn("member-a");
  assert.equal(refreshed.context.appView, "records");
  assert.equal(refreshed.context.recordsState.activeTab, "review");
  assert.deepEqual(refreshed.calls, ["review"]);
});

test("權限取消後不可還原簽到審核，改回個人紀錄", async () => {
  const storage = createStorage();
  const first = createHarness(storage, { review: true });
  await first.signIn("member-a");
  first.context.appView = "records";
  first.context.recordsState.activeTab = "attachments";
  first.context.syncAppView();

  const refreshed = createHarness(storage);
  await refreshed.signIn("member-a");
  assert.equal(refreshed.context.appView, "records");
  assert.equal(refreshed.context.recordsState.activeTab, "personal");
  assert.deepEqual(refreshed.calls, ["personal"]);
});

test("首頁、不同帳號、登出都不會還原別人的班表", async () => {
  const storage = createStorage();
  const first = createHarness(storage, { schedule: true });
  await first.signIn("member-a");
  first.context.appView = "schedule";
  first.context.syncAppView();

  const other = createHarness(storage, { schedule: true });
  await other.signIn("member-b");
  assert.equal(other.context.appView, "home");
  assert.deepEqual(other.calls, []);
  other.context.appView = "schedule";
  other.context.syncAppView();
  other.context.appView = "home";
  other.context.syncAppView();

  const homeRefresh = createHarness(storage, { schedule: true });
  await homeRefresh.signIn("member-b");
  assert.equal(homeRefresh.context.appView, "home");
  homeRefresh.context.appView = "schedule";
  homeRefresh.context.syncAppView();
  homeRefresh.context.clearAuthIdentity();

  const afterLogout = createHarness(storage, { schedule: true });
  await afterLogout.signIn("member-b");
  assert.equal(afterLogout.context.appView, "home");
  assert.deepEqual(afterLogout.calls, []);
});
