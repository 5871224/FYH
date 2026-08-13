const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function replaceOne(relativePath, before, after) {
  const file = path.join(root, relativePath);
  const source = fs.readFileSync(file, "utf8");
  if (!source.includes(before)) {
    throw new Error(`Expected block not found in ${relativePath}`);
  }
  fs.writeFileSync(file, source.replace(before, after), "utf8");
}

replaceOne(
  "src/renderer/index.html",
  `        return Object.freeze({
          user,
          session: user ? Object.freeze({ user }) : null,
          profile
        });`,
  `        const authenticated = Boolean(user?.id);
        return Object.freeze({
          authenticated,
          user: authenticated ? user : null,
          profile: authenticated ? profile : null
        });`
);

replaceOne(
  "src/renderer/renderer-auth-context.js",
  `function isLoggedIn() {
  return Boolean(currentSession?.user);
}`,
  `function applyAuthContext(context) {
  const source = context && typeof context === "object" ? context : {};
  authenticated = Boolean(source.authenticated && source.user);
  currentUser = authenticated ? source.user : null;
  currentProfile = authenticated ? (source.profile || null) : null;
  return authenticated;
}

function clearAuthIdentity() {
  authenticated = false;
  currentUser = null;
  currentProfile = null;
}

function isLoggedIn() {
  return authenticated && Boolean(currentUser?.id);
}`
);

replaceOne(
  "src/renderer/renderer-auth-context.js",
  `function getCurrentProfileName() {
  return currentProfile?.full_name || currentSession?.user?.email || "";
}`,
  `function getCurrentProfileName() {
  return currentProfile?.full_name || currentUser?.email || "";
}`
);

replaceOne(
  "src/renderer/renderer-page-data.js",
  `async function initializeAuthenticatedHome(authContext) {
  currentSession = authContext?.session || null;
  currentProfile = authContext?.profile || null;
  if (!currentSession?.user) return false;`,
  `async function initializeAuthenticatedHome(authContext) {
  if (!applyAuthContext(authContext)) return false;`
);

replaceOne(
  "src/renderer/renderer-auth-actions.js",
  `  currentSession = null;
  currentProfile = null;`,
  `  clearAuthIdentity();`
);

replaceOne(
  "src/renderer/renderer-events-session.js",
  `    currentSession = null;
    currentProfile = null;`,
  `    clearAuthIdentity();`
);

replaceOne(
  "src/renderer/renderer.js",
  `let currentSession = null;
let currentProfile = null;`,
  `let authenticated = false;
let currentUser = null;
let currentProfile = null;`
);

replaceOne(
  "src/renderer/renderer.js",
  `    const authContext = await window.schedulerApi.initializeAuth();
    currentSession = authContext.session;
    currentProfile = authContext.profile;
    if (!currentSession?.user) {`,
  `    const authContext = await window.schedulerApi.initializeAuth();
    if (!authContext?.authenticated || !authContext?.user) {
      clearAuthIdentity();`
);

replaceOne(
  "src/renderer/renderer.js",
  `    currentSession = null;
    currentProfile = null;`,
  `    clearAuthIdentity();`
);

replaceOne(
  "tests/provider-neutral-auth-boundary.test.js",
  `  assert.equal(auth.session.access_token, undefined);
  assert.equal(auth.session.refresh_token, undefined);
  assert.equal(auth.session.expires_at, undefined);
  assert.deepEqual(Object.keys(auth.session), ["user"]);`,
  `  assert.equal(auth.authenticated, true);
  assert.equal(auth.session, undefined);
  assert.deepEqual(Object.keys(auth).sort(), ["authenticated", "profile", "user"]);`
);

replaceOne(
  "tests/provider-neutral-auth-boundary.test.js",
  `  assert.equal(auth.session.access_token, undefined);
  assert.equal(auth.user.id, "U2");`,
  `  assert.equal(auth.authenticated, true);
  assert.equal(auth.session, undefined);
  assert.equal(auth.user.id, "U2");`
);

replaceOne(
  "tests/provider-neutral-auth-boundary.test.js",
  `  assert.equal(Object.isFrozen(auth.session), true);
  assert.equal(Object.isFrozen(auth.user), true);`,
  `  assert.equal(Object.isFrozen(auth.profile), true);
  assert.equal(Object.isFrozen(auth.user), true);`
);

const boundaryTest = path.join(root, "tests/provider-neutral-auth-boundary.test.js");
fs.appendFileSync(boundaryTest, `

test("renderer 登入狀態不得依賴 provider Session 結構", () => {
  const rendererFiles = [
    "renderer-auth-context.js",
    "renderer-page-data.js",
    "renderer-auth-actions.js",
    "renderer-events-session.js",
    "renderer.js"
  ];
  const source = rendererFiles
    .map((name) => fs.readFileSync(path.join(root, "src", "renderer", name), "utf8"))
    .join("\\n");
  assert.doesNotMatch(source, /\\bcurrentSession\\b|authContext\\?\\.session|\\.session\\?\\.user/);
  assert.match(source, /\\blet authenticated = false;/);
  assert.match(source, /\\blet currentUser = null;/);
  assert.match(source, /authenticated && Boolean\\(currentUser\\?\\.id\\)/);
});
`, "utf8");

replaceOne(
  "tests/renderer-auth-context.test.js",
  `    currentSession: { user: { id: "U1" } },`,
  `    authenticated: true,
    currentUser: { id: "U1" },`
);

replaceOne(
  "tests/login-fast-home.test.js",
  `  assert.doesNotMatch(pageData, /schedulerApi\\.[A-Za-z0-9_]+\\s*=/);`,
  `  assert.doesNotMatch(pageData, /schedulerApi\\.[A-Za-z0-9_]+\\s*=/);
  assert.doesNotMatch(pageData, /currentSession|authContext\\?\\.session/);
  assert.match(pageData, /applyAuthContext\\(authContext\\)/);`
);

replaceOne(
  "tests/attendance-review-and-page-stability.test.js",
  String.raw`  assert.match(source, /if \(!currentSession\?\.user\)[\s\S]*?appView = "home";/);`,
  String.raw`  assert.match(source, /if \(!authContext\?\.authenticated \|\| !authContext\?\.user\)[\s\S]*?appView = "home";/);`
);

replaceOne(
  "tests/codebase-architecture-guards.test.js",
  String.raw`  assert.match(html, /session: user \? Object\.freeze\(\{ user \}\) : null/);`,
  String.raw`  assert.match(html, /const authenticated = Boolean\(user\?\.id\)/);
  assert.match(html, /user: authenticated \? user : null/);
  assert.match(html, /profile: authenticated \? profile : null/);
  assert.doesNotMatch(html, /session: user \?/);`
);

console.log("Provider-neutral renderer auth refactor applied.");
