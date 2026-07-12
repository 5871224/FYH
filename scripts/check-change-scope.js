const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const ALLOWED_HEADING = "允許修改範圍";
const FORBIDDEN_HEADING = "禁止修改範圍";
const TOO_BROAD_PATTERNS = new Set(["*", "**", "**/*", ".", "./", "/"]);

function extractScopeSection(body, heading) {
  const lines = String(body || "").replace(/\r/g, "").split("\n");
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start < 0) return [];

  const section = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const raw = lines[index].trim();
    if (/^##\s+/.test(raw)) break;
    if (!raw || raw.startsWith("```") || raw.startsWith("<!--") || raw.endsWith("-->")) continue;

    const value = raw
      .replace(/^[-*+]\s+/, "")
      .replace(/^`|`$/g, "")
      .trim();
    if (!value || value.startsWith("#")) continue;
    section.push(value);
  }
  return section;
}

function normalizePattern(pattern) {
  let value = String(pattern || "").trim().replaceAll("\\", "/");
  value = value.replace(/^\.\//, "").replace(/^\/+/, "");
  if (value.endsWith("/")) value += "**";
  return value;
}

function validatePatterns(patterns, label, required) {
  const normalized = patterns.map(normalizePattern).filter(Boolean);
  if (required && normalized.length === 0) {
    throw new Error(`PR 說明必須在「${label}」列出至少一個檔案或路徑規則`);
  }
  const broad = normalized.filter((pattern) => TOO_BROAD_PATTERNS.has(pattern));
  if (broad.length) {
    throw new Error(`「${label}」不可使用過度寬泛的規則：${broad.join(", ")}`);
  }
  return normalized;
}

function globToRegExp(pattern) {
  const normalized = normalizePattern(pattern);
  let expression = "^";
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];
    const following = normalized[index + 2];
    if (char === "*" && next === "*" && following === "/") {
      expression += "(?:.*/)?";
      index += 2;
    } else if (char === "*" && next === "*") {
      expression += ".*";
      index += 1;
    } else if (char === "*") {
      expression += "[^/]*";
    } else if (char === "?") {
      expression += "[^/]";
    } else {
      expression += char.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
    }
  }
  expression += "$";
  return new RegExp(expression);
}

function matchesAny(file, patterns) {
  const normalizedFile = String(file || "").replaceAll("\\", "/").replace(/^\.\//, "");
  return patterns.some((pattern) => globToRegExp(pattern).test(normalizedFile));
}

function assessScope({ allowedPatterns, forbiddenPatterns = [], changedFiles }) {
  const allowed = validatePatterns(allowedPatterns, ALLOWED_HEADING, true);
  const forbidden = validatePatterns(forbiddenPatterns, FORBIDDEN_HEADING, false);
  const files = [...new Set((changedFiles || []).map((file) => String(file || "").trim()).filter(Boolean))];

  const outsideAllowed = files.filter((file) => !matchesAny(file, allowed));
  const explicitlyForbidden = files.filter((file) => matchesAny(file, forbidden));

  return {
    allowed,
    forbidden,
    files,
    outsideAllowed,
    explicitlyForbidden,
    ok: outsideAllowed.length === 0 && explicitlyForbidden.length === 0
  };
}

function getChangedFiles(baseSha, headSha, cwd = process.cwd()) {
  const output = execFileSync(
    "git",
    ["-c", "core.quotepath=false", "diff", "--name-only", "--diff-filter=ACMRTUXB", `${baseSha}...${headSha}`],
    { encoding: "utf8", cwd }
  );
  return output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function run() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !fs.existsSync(eventPath)) {
    console.log("Change scope check skipped: not running inside a GitHub event.");
    return;
  }

  const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
  const pullRequest = event.pull_request;
  if (!pullRequest) {
    console.log("Change scope check skipped: this event is not a pull request.");
    return;
  }

  const body = pullRequest.body || "";
  const allowedPatterns = extractScopeSection(body, ALLOWED_HEADING);
  const forbiddenPatterns = extractScopeSection(body, FORBIDDEN_HEADING);
  const changedFiles = getChangedFiles(pullRequest.base.sha, pullRequest.head.sha);
  const result = assessScope({ allowedPatterns, forbiddenPatterns, changedFiles });

  if (!result.ok) {
    const messages = [];
    if (result.outsideAllowed.length) {
      messages.push(`超出允許修改範圍：\n- ${result.outsideAllowed.join("\n- ")}`);
    }
    if (result.explicitlyForbidden.length) {
      messages.push(`命中禁止修改範圍：\n- ${result.explicitlyForbidden.join("\n- ")}`);
    }
    throw new Error(messages.join("\n\n"));
  }

  console.log(`Change scope check passed (${result.files.length} files).`);
  console.log(`Allowed patterns: ${result.allowed.join(", ")}`);
  if (result.forbidden.length) console.log(`Forbidden patterns: ${result.forbidden.join(", ")}`);
}

if (require.main === module) {
  run();
}

module.exports = {
  extractScopeSection,
  normalizePattern,
  globToRegExp,
  matchesAny,
  assessScope,
  getChangedFiles
};
