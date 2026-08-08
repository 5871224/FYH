from pathlib import Path

root = Path('.')
r = root / 'src' / 'renderer'

# app-config: access/data loading is now part of the canonical bundle, not post-load wrappers.
p = r / 'app-config.js'
t = p.read_text(encoding='utf-8')
t = t.replace('  document.write(\'<script src="./login-fast-home.mjs?v=20260807-schedule-first-load"><\\/script>\');\n', '')
t = t.replace('  document.write(\'<script defer src="./page-lazy-data.mjs?v=20260807-permission-tags-loading"><\\/script>\');\n', '')
p.write_text(t, encoding='utf-8')
for name in ['login-fast-home.mjs', 'page-lazy-data.mjs']:
    q = r / name
    if q.exists(): q.unlink()

# Add canonical page-data module to both production and test manifests.
for filename in ['scripts/build-js.js', 'scripts/renderer-core-source.js']:
    p = root / filename
    t = p.read_text(encoding='utf-8')
    needle = '  "renderer-runtime-helpers.js",\n  "renderer-records-actions.js",'
    if needle not in t:
        raise RuntimeError(f'page data insertion point missing: {filename}')
    t = t.replace(needle, '  "renderer-runtime-helpers.js",\n  "renderer-page-data.js",\n  "renderer-records-actions.js",')
    p.write_text(t, encoding='utf-8')

# Startup: fast home is a normal state transition. Full schedule is loaded only when schedule is opened.
p = r / 'renderer.js'
t = p.read_text(encoding='utf-8')
start = t.index('async function loadApp()')
end = t.index('\n\nloadApp();', start)
new = '''async function loadApp() {
  managerDirectoryLoaded = false;
  managerDirectoryLoading = null;
  bindEvents();
  bindGroupFeatureEvents();
  pushAppBackHistoryGuard();
  authErrorMessage = "";
  try {
    const authContext = await window.schedulerApi.initializeAuth();
    currentSession = authContext.session;
    currentProfile = authContext.profile;
    if (!currentSession?.user) {
      state = createEmptyState();
      resetLoadedUserRuntimeState();
      clearScheduleApplicationState();
      appView = "home";
      authModalOpen = true;
      renderAll();
      syncCoreActionsMenu();
      return;
    }
    await initializeAuthenticatedHome(authContext);
  } catch (error) {
    setSaveStatus(`載入失敗：${error.message}`);
    authErrorMessage = error.message || "載入失敗";
    state = createEmptyState();
    currentSession = null;
    currentProfile = null;
    resetLoadedUserRuntimeState();
    clearScheduleApplicationState();
    renderAll();
    syncCoreActionsMenu();
    return;
  }
  renderAll();
  syncCoreActionsMenu();
}'''
t = t[:start] + new + t[end:]
p.write_text(t, encoding='utf-8')

# Sign-in uses the auth result directly; do not perform a second auth initialization request.
p = r / 'renderer-auth-actions.js'
t = p.read_text(encoding='utf-8')
old = '''    await window.schedulerApi.signIn(loginAccount, password);
    closeSignInDialog();
    await loadApp();'''
new = '''    const authContext = await window.schedulerApi.signIn(loginAccount, password);
    closeSignInDialog();
    await initializeAuthenticatedHome(authContext);
    renderAll();
    syncCoreActionsMenu();'''
if old not in t: raise RuntimeError('sign-in block not found')
t = t.replace(old, new, 1)
p.write_text(t, encoding='utf-8')

# Schedule click owns the loading state; no capture listener or API replacement.
p = r / 'renderer-events-click.js'
t = p.read_text(encoding='utf-8')
old = '''      if (target.dataset.homeAction === "schedule") {
        try {
          await ensureManagerDirectoryLoaded();
        } catch (error) {
          showInfoMessage(`讀取班表管理資料失敗：${error.message || error}`);
          return;
        }
        appView = "schedule";
        renderAll();
        return;
      }'''
new = '''      if (target.dataset.homeAction === "schedule") {
        const firstLoad = !scheduleApplicationLoaded;
        target.disabled = true;
        target.setAttribute("aria-busy", "true");
        if (firstLoad) await showScheduleLoadingIndicator();
        try {
          await ensureScheduleApplicationLoaded();
          if (hasPermission("member_settings")) await ensureManagerDirectoryLoaded();
          appView = "schedule";
          renderAll();
        } catch (error) {
          showInfoMessage(`讀取班表失敗：${error.message || error}`);
        } finally {
          if (firstLoad) hideScheduleLoadingIndicator();
          target.disabled = false;
          target.removeAttribute("aria-busy");
        }
        return;
      }'''
if old not in t: raise RuntimeError('schedule home action block not found')
t = t.replace(old, new, 1)
p.write_text(t, encoding='utf-8')

# Session reset includes canonical schedule-load state.
p = r / 'renderer-events-session.js'
t = p.read_text(encoding='utf-8')
needle = '    state = createEmptyState();\n    appView = "home";'
if needle not in t: raise RuntimeError('session reset marker missing')
t = t.replace(needle, '    state = createEmptyState();\n    clearScheduleApplicationState();\n    appView = "home";', 1)
p.write_text(t, encoding='utf-8')

# A full application reload through group settings is still canonical and marks schedule data loaded.
p = r / 'renderer-groups-permissions-archive.js'
t = p.read_text(encoding='utf-8')
needle = '  currentMember = resolveCurrentMember();\n  managerDirectoryLoaded = false;\n  managerDirectoryLoading = null;\n  renderAll();\n}\n\nfunction isArchivedDate'
if needle not in t: raise RuntimeError('reload group marker missing')
t = t.replace(needle, '  currentMember = resolveCurrentMember();\n  scheduleApplicationLoaded = true;\n  managerDirectoryLoaded = false;\n  managerDirectoryLoading = null;\n  renderAll();\n}\n\nfunction isArchivedDate', 1)
p.write_text(t, encoding='utf-8')

# Test contracts now describe the canonical page-data module, not removed wrappers.
p = root / 'tests' / 'login-fast-home.test.js'
p.write_text('''const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("登入首頁與班表延後載入由正式 bundle 模組提供", () => {
  const config = read("src/renderer/app-config.js");
  const pageData = read("src/renderer/renderer-page-data.js");
  const build = read("scripts/build-js.js");
  assert.doesNotMatch(config, /login-fast-home|page-lazy-data/);
  assert.match(build, /renderer-page-data\\.js/);
  assert.match(pageData, /async function initializeAuthenticatedHome/);
  assert.match(pageData, /async function ensureScheduleApplicationLoaded/);
  assert.doesNotMatch(pageData, /schedulerApi\\.[A-Za-z0-9_]+\\s*=/);
});

test("登入成功後直接沿用 signIn 回傳身分，不重做 initializeAuth", () => {
  const auth = read("src/renderer/renderer-auth-actions.js");
  const start = auth.indexOf("async function handleSignIn");
  const end = auth.indexOf("async function handleSignOut", start);
  const block = auth.slice(start, end);
  assert.match(block, /const authContext = await window\\.schedulerApi\\.signIn/);
  assert.match(block, /await initializeAuthenticatedHome\\(authContext\\)/);
  assert.doesNotMatch(block, /initializeAuth/);
  assert.doesNotMatch(block, /await loadApp\\(\\)/);
});

test("首頁初始化只取得 appInfo 與權限，不讀完整班表", () => {
  const pageData = read("src/renderer/renderer-page-data.js");
  const start = pageData.indexOf("async function initializeAuthenticatedHome");
  const end = pageData.indexOf("async function ensureScheduleApplicationLoaded", start);
  const block = pageData.slice(start, end);
  assert.match(block, /getAppInfo\\(\\)/);
  assert.match(block, /getGroupAccessBundle\\(\\)/);
  assert.doesNotMatch(block, /loadState\\(\\)/);
  assert.doesNotMatch(block, /loadScheduleEntries/);
});

test("班表完整資料只在正式 ensureScheduleApplicationLoaded 載入", () => {
  const pageData = read("src/renderer/renderer-page-data.js");
  const events = read("src/renderer/renderer-events-click.js");
  assert.match(pageData, /const payload = await window\\.schedulerApi\\.loadState\\(\\)/);
  assert.match(pageData, /initializeGroupPermissionState\\(payload\\)/);
  assert.match(events, /await ensureScheduleApplicationLoaded\\(\\)/);
  assert.match(events, /showScheduleLoadingIndicator/);
});
''', encoding='utf-8')

p = root / 'tests' / 'lazy-page-data-loading.test.js'
p.write_text('''const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("首頁與班表資料載入使用正式模組，不靠後載入攔截器", () => {
  const config = read("src/renderer/app-config.js");
  const pageData = read("src/renderer/renderer-page-data.js");
  const events = read("src/renderer/renderer-events-click.js");
  assert.doesNotMatch(config, /page-lazy-data|login-fast-home/);
  assert.doesNotMatch(pageData, /stopImmediatePropagation|addEventListener\\(\"click\"/);
  assert.doesNotMatch(pageData, /schedulerApi\\.[A-Za-z0-9_]+\\s*=/);
  assert.match(events, /await ensureScheduleApplicationLoaded\\(\\)/);
});

test("簽到簿群組審核 API 由正式 web-api 提供", () => {
  const records = read("src/renderer/renderer-records-page.js");
  const webApi = read("src/renderer/web-api.js");
  const publishedApp = read("docs/app.js");
  assert.doesNotMatch(records, /loadRecordsPageWithReview/);
  assert.match(records, /recordsState\\.activeTab === "review"/);
  assert.match(webApi, /requestFunction\\("attendance-review-groups"/);
  assert.match(publishedApp, /attendance-review-groups/);
  assert.doesNotMatch(webApi, /renderer-group-backend-bridges/);
});
''', encoding='utf-8')

p = root / 'tests' / 'schedule-first-load-cycle.test.js'
p.write_text('''const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("首次班表以八週週期載入且只呼叫一次正式班表查詢 RPC", () => {
  const webApi = read("src/renderer/web-api.js");
  const loadStart = webApi.indexOf("async function loadState()");
  const loadEnd = webApi.indexOf("async function loadScheduleEntries", loadStart);
  const block = webApi.slice(loadStart, loadEnd);
  assert.match(block, /const scheduleRange = getScheduleLoadRange\\(settings\\)/);
  assert.match(block, /const visibleStartDate = addDaysToDateString\\(scheduleRange\\.startDate, 7\\)/);
  assert.match(block, /scheduleStartDate: visibleStartDate/);
  assert.doesNotMatch(block, /settings\\.schedule_start_date/);
  assert.equal((block.match(/callRpc\\(\"get_schedule_entries_v3\"/g) || []).length, 1);
  assert.doesNotMatch(block, /restSelect|schedule_entries\\?select/);
});

test("班表初始化不再依賴頁面補丁或第二次同區間查詢", () => {
  const pageData = read("src/renderer/renderer-page-data.js");
  assert.match(pageData, /await ensureVisibleScheduleLoaded\\(\\)/);
  assert.doesNotMatch(pageData, /page-lazy-data|groupRpc|stopImmediatePropagation/);
});

test("單位打卡設定仍延後到單位設定頁載入", () => {
  const department = read("src/renderer/renderer-settings-department.js");
  const webApi = read("src/renderer/web-api.js");
  assert.match(department, /ensureDepartmentAttendanceSettingsLoaded/);
  assert.match(department, /getDepartmentAttendanceSettings/);
  assert.match(webApi, /async function getDepartmentAttendanceSettings\\(\\)/);
});

test("規格書明定首次班表不相容舊瀏覽位置", () => {
  const spec = read("規格書.md");
  assert.match(spec, /首次畫面不得使用或相容舊的 `schedule_start_date` 瀏覽位置/);
  assert.match(spec, /同一首次載入不得再對同一可視區間補查第二次 `schedule_entries`/);
});
''', encoding='utf-8')

# Member-order test now expects its narrow persistence operation, not the deleted generic full-state save.
p = root / 'tests' / 'member-order-and-department-width.test.js'
t = p.read_text(encoding='utf-8')
t = t.replace('  assert.equal(calls.includes("save"), true);', '  assert.equal(calls.includes("save"), false);\n  assert.equal(calls.includes("reorder"), true);')
p.write_text(t, encoding='utf-8')

print('canonical page loading integrated')
