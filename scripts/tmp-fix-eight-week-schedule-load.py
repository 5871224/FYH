from pathlib import Path


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 occurrence, found {count}")
    p.write_text(text.replace(old, new, 1), encoding="utf-8")


api_path = Path("src/renderer/web-api.js")
api = api_path.read_text(encoding="utf-8")

old_call_rpc = '''  async function callRpc(functionName, payload = {}, options = {}) {
    const { prefer = "return=representation" } = options;
    return requestJson(`/rest/v1/rpc/${functionName}`, {
      method: "POST",
      auth: true,
      headers: {
        Accept: "application/json",
        Prefer: prefer
      },
      body: JSON.stringify(payload || {})
    });
  }
'''
new_call_rpc = '''  async function callRpc(functionName, payload = {}, options = {}) {
    const { prefer = "return=representation" } = options;
    return requestJson(`/rest/v1/rpc/${functionName}`, {
      method: "POST",
      auth: true,
      headers: {
        Accept: "application/json",
        Prefer: prefer
      },
      body: JSON.stringify(payload || {})
    });
  }

  const RPC_PAGE_SIZE = 1000;

  function parseContentRangeTotal(value) {
    const match = String(value || "").match(/\\/(\\d+)$/);
    return match ? Number(match[1]) : null;
  }

  async function callRpcAllRows(functionName, payload = {}) {
    const rows = [];
    let offset = 0;
    while (true) {
      assertSessionActive();
      const response = await fetch(`${baseUrl}/rest/v1/rpc/${functionName}`, {
        method: "POST",
        headers: buildHeaders({
          auth: true,
          extra: {
            Accept: "application/json",
            Prefer: "count=exact",
            "Range-Unit": "items",
            Range: `${offset}-${offset + RPC_PAGE_SIZE - 1}`
          }
        }),
        body: JSON.stringify(payload || {})
      });
      if (!response.ok) {
        throw new Error(await readError(response));
      }
      touchSession();
      const text = await response.text();
      const page = text ? JSON.parse(text) : [];
      if (!Array.isArray(page)) {
        throw new Error(`${functionName} 回傳格式錯誤`);
      }
      rows.push(...page);
      const total = parseContentRangeTotal(response.headers.get("Content-Range"));
      if (!page.length || (total !== null && rows.length >= total)) {
        break;
      }
      offset += page.length;
      if (total === null && page.length < RPC_PAGE_SIZE) {
        break;
      }
    }
    return rows;
  }
'''
if api.count(old_call_rpc) != 1:
    raise SystemExit(f"callRpc marker count={api.count(old_call_rpc)}")
api = api.replace(old_call_rpc, new_call_rpc, 1)

old_range = '''  function getScheduleLoadRange(settings = {}) {
    const today = toDateStringFromDate(new Date());
    const anchorDate = toDateObject(settings.eight_week_start_date) ? settings.eight_week_start_date : today;
    const periods = Math.floor(diffDays(anchorDate, today) / 56);
    const visibleStart = addDaysToDateString(anchorDate, periods * 56) || today;
    // 7-day buffer covers the current 6-day consecutive-work rule; widen this if rules look farther.
    return {
      startDate: addDaysToDateString(visibleStart, -7),
      endDate: addDaysToDateString(visibleStart, 62)
    };
  }
'''
new_range = '''  function getScheduleLoadRange(settings = {}) {
    const today = toDateStringFromDate(new Date());
    const anchorDate = toDateObject(settings.eight_week_start_date) ? settings.eight_week_start_date : today;
    const periods = Math.floor(diffDays(anchorDate, today) / 56);
    const visibleStart = addDaysToDateString(anchorDate, periods * 56) || today;
    return {
      startDate: visibleStart,
      endDate: addDaysToDateString(visibleStart, 55)
    };
  }
'''
if api.count(old_range) != 1:
    raise SystemExit(f"schedule load range marker count={api.count(old_range)}")
api = api.replace(old_range, new_range, 1)

old_initial = '''    const scheduleRange = getScheduleLoadRange(settings);
    const visibleStartDate = addDaysToDateString(scheduleRange.startDate, 7) || taipeiDateString();
    const visibleStart = toDateObject(visibleStartDate);
    const scheduleEntryRows = await callRpc("get_schedule_entries_v3", {
      p_start_date: scheduleRange.startDate,
      p_end_date: scheduleRange.endDate
    }) || [];
'''
new_initial = '''    const scheduleRange = getScheduleLoadRange(settings);
    const visibleStartDate = scheduleRange.startDate || taipeiDateString();
    const visibleStart = toDateObject(visibleStartDate);
    const scheduleEntryRows = await callRpcAllRows("get_schedule_entries_v3", {
      p_start_date: scheduleRange.startDate,
      p_end_date: scheduleRange.endDate
    });
'''
if api.count(old_initial) != 1:
    raise SystemExit(f"initial schedule load marker count={api.count(old_initial)}")
api = api.replace(old_initial, new_initial, 1)

old_lazy = '''    const rows = await callRpc("get_schedule_entries_v3", {
      p_start_date: startDate,
      p_end_date: endDate
    }) || [];
'''
new_lazy = '''    const rows = await callRpcAllRows("get_schedule_entries_v3", {
      p_start_date: startDate,
      p_end_date: endDate
    });
'''
if api.count(old_lazy) != 1:
    raise SystemExit(f"lazy schedule load marker count={api.count(old_lazy)}")
api = api.replace(old_lazy, new_lazy, 1)
api_path.write_text(api, encoding="utf-8")


date_path = Path("src/renderer/renderer-date-utils.js")
date_text = date_path.read_text(encoding="utf-8")
old_buffer = '''function getBufferedVisibleDateRange() {
  const range = getVisibleDateRange();
  // 7-day buffer matches the current 6-day consecutive-work ceiling; widen if compliance rules look farther.
  return {
    startDate: addDaysToDateString(range.startDate, -7),
    endDate: addDaysToDateString(range.endDate, 7)
  };
}
'''
new_buffer = '''function getVisibleScheduleLoadRange() {
  return getVisibleDateRange();
}
'''
if date_text.count(old_buffer) != 1:
    raise SystemExit(f"buffered range marker count={date_text.count(old_buffer)}")
date_text = date_text.replace(old_buffer, new_buffer, 1)
if date_text.count("const range = getBufferedVisibleDateRange();") != 1:
    raise SystemExit(f"buffered range usage count={date_text.count('const range = getBufferedVisibleDateRange();')}")
date_text = date_text.replace("const range = getBufferedVisibleDateRange();", "const range = getVisibleScheduleLoadRange();", 1)
date_path.write_text(date_text, encoding="utf-8")


test_path = Path("tests/schedule-eight-week-loading.test.js")
test_path.write_text(r'''const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("班表初始讀取範圍固定為目前八週 56 天", () => {
  const api = read("src/renderer/web-api.js");
  assert.match(api, /startDate: visibleStart,\s*endDate: addDaysToDateString\(visibleStart, 55\)/);
  assert.match(api, /const visibleStartDate = scheduleRange\.startDate \|\| taipeiDateString\(\)/);
  assert.doesNotMatch(api, /addDaysToDateString\(visibleStart, -7\)/);
  assert.doesNotMatch(api, /addDaysToDateString\(visibleStart, 62\)/);
});

test("目前八週班表 RPC 必須分頁讀到全部列，不受單次回傳上限截斷", () => {
  const api = read("src/renderer/web-api.js");
  assert.match(api, /const RPC_PAGE_SIZE = 1000/);
  assert.match(api, /async function callRpcAllRows\(functionName, payload = \{\}\)/);
  assert.match(api, /"Range-Unit": "items"/);
  assert.match(api, /Range: `\$\{offset\}-\$\{offset \+ RPC_PAGE_SIZE - 1\}`/);
  assert.match(api, /parseContentRangeTotal\(response\.headers\.get\("Content-Range"\)\)/);
  assert.match(api, /offset \+= page\.length/);
});

test("初始八週與切換八週都使用完整分頁讀取", () => {
  const api = read("src/renderer/web-api.js");
  const calls = api.match(/callRpcAllRows\("get_schedule_entries_v3"/g) || [];
  assert.equal(calls.length, 2);
  assert.doesNotMatch(api, /callRpc\("get_schedule_entries_v3"/);
});

test("切換八週只載入目標 56 天，不預載前後一週", () => {
  const dateUtils = read("src/renderer/renderer-date-utils.js");
  assert.match(dateUtils, /function getVisibleScheduleLoadRange\(\) \{\s*return getVisibleDateRange\(\);\s*\}/);
  assert.match(dateUtils, /const range = getVisibleScheduleLoadRange\(\);/);
  assert.doesNotMatch(dateUtils, /getBufferedVisibleDateRange/);
});

test("前後八週導覽仍在切換後按需載入班表", () => {
  const rendererFiles = fs.readdirSync(path.join(root, "src", "renderer"))
    .filter((name) => name.endsWith(".js") && name !== "app.js")
    .map((name) => read(path.join("src", "renderer", name)))
    .join("\n");
  const start = rendererFiles.indexOf("async function changeSchedulePeriodWeeks(weeks)");
  assert.ok(start >= 0, "找不到 changeSchedulePeriodWeeks");
  const body = rendererFiles.slice(start, start + 1800);
  assert.match(body, /await ensureVisibleScheduleLoaded\(\)/);
});
''', encoding="utf-8")

spec_path = Path("規格書.md")
spec = spec_path.read_text(encoding="utf-8")
heading = "### 班表八週資料載入（2026-08-09）"
if heading not in spec:
    spec += f'''\n\n{heading}\n- 班表頁一次只載入目前顯示的 8 週，共 56 天；不得額外預載上一週或下一週班表。\n- 目前 56 天內的班表資料筆數不得受單次 REST／RPC 回傳列數上限截斷；前端必須分頁讀取直到取得該 56 天的全部班表列。\n- 「前一週／後一週」只移動目前 8 週畫面的水平捲軸，不重新讀取班表。\n- 「前八週／後八週」切換到另一個 56 天範圍時，才按需讀取該 8 週全部班表；已載入區間可保留快取，但不得預讀尚未切換的下一個 8 週。\n'''
spec_path.write_text(spec, encoding="utf-8")

print("eight-week schedule loading fix applied")
