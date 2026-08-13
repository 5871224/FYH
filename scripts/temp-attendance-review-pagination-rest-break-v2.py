from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, got {count}: {old[:180]!r}")
    file_path.write_text(text.replace(old, new, 1), encoding="utf-8")


# 1. Retry browser/network-level fetch failures once for read-only calls that opt in.
replace_once(
    "src/renderer/web-api.js",
    '''  async function requestFunction(functionName, payload, { retryTransientOnce = false } = {}) {\n    for (let attempt = 0; ; attempt += 1) {\n      assertSessionActive();\n      const response = await fetch(`${baseUrl}/functions/v1/${functionName}`, {\n        method: "POST",\n        cache: "no-store",\n        headers: buildHeaders({\n          auth: true,\n          extra: {\n            Accept: "application/json"\n          }\n        }),\n        body: JSON.stringify(payload || {})\n      });\n      if (!response.ok) {\n        if (response.status === 404) {\n          throw new Error(`尚未部署 ${functionName} Edge Function`);\n        }\n        const message = await readError(response);\n        if (retryTransientOnce && attempt === 0 && [502, 503, 504].includes(response.status)) {\n          await new Promise((resolve) => setTimeout(resolve, 300));\n          continue;\n        }\n        throw new Error(message);\n      }\n      touchSession();\n      const text = await response.text();\n      return text ? JSON.parse(text) : null;\n    }\n  }\n''',
    '''  async function requestFunction(functionName, payload, { retryTransientOnce = false } = {}) {\n    for (let attempt = 0; ; attempt += 1) {\n      assertSessionActive();\n      let response;\n      try {\n        response = await fetch(`${baseUrl}/functions/v1/${functionName}`, {\n          method: "POST",\n          cache: "no-store",\n          headers: buildHeaders({\n            auth: true,\n            extra: {\n              Accept: "application/json"\n            }\n          }),\n          body: JSON.stringify(payload || {})\n        });\n      } catch (error) {\n        if (retryTransientOnce && attempt === 0) {\n          await new Promise((resolve) => setTimeout(resolve, 300));\n          continue;\n        }\n        throw error;\n      }\n      if (!response.ok) {\n        if (response.status === 404) {\n          throw new Error(`尚未部署 ${functionName} Edge Function`);\n        }\n        const message = await readError(response);\n        if (retryTransientOnce && attempt === 0 && [502, 503, 504].includes(response.status)) {\n          await new Promise((resolve) => setTimeout(resolve, 300));\n          continue;\n        }\n        throw new Error(message);\n      }\n      touchSession();\n      const text = await response.text();\n      return text ? JSON.parse(text) : null;\n    }\n  }\n''',
)


# 2. Clock helper for rest-period calculation.
replace_once(
    "src/renderer/web-api.js",
    '''  function downloadBlob(blob, fileName) {\n''',
    '''  function addMinutesToClockTime(value, minutesToAdd) {\n    const match = String(value || "").match(/^([01]\\d|2[0-3]):([0-5]\\d)/);\n    if (!match) return "";\n    const baseMinutes = Number(match[1]) * 60 + Number(match[2]);\n    const delta = Number(minutesToAdd || 0);\n    if (!Number.isFinite(delta)) return `${match[1]}:${match[2]}`;\n    const normalizedMinutes = ((baseMinutes + Math.round(delta)) % 1440 + 1440) % 1440;\n    return `${String(Math.floor(normalizedMinutes / 60)).padStart(2, "0")}:${String(normalizedMinutes % 60).padStart(2, "0")}`;\n  }\n\n  function downloadBlob(blob, fileName) {\n''',
)


# 3. Rest-day / regular-holiday overtime: unpaid one-hour break after four hours.
# Keep the original overtime_start_time expression so the existing contract stays valid.
replace_once(
    "src/renderer/web-api.js",
    '''      if (scheduledStart && scheduledEnd) {\n        const adjustedStart = subtractOvertimeHoursFromClockTime(scheduledStart, row.overtimeHours);\n        return [{\n          employee_code: row.employee_code || "",\n          work_date: row.work_date || "",\n          overtime_type_id: "attendance-rest-day",\n          overtime_start_time: adjustedStart.time || scheduledStart,\n          overtime_end_time: scheduledEnd,\n          overtime_previous_day: adjustedStart.previousDay,\n          overtime_subsidy_type: 1,\n          overtime_use_rest_1: false,\n          overtime_use_rest_2: false\n        }];\n      }\n''',
    '''      if (scheduledStart && scheduledEnd) {\n        const adjustedStart = subtractOvertimeHoursFromClockTime(scheduledStart, row.overtimeHours);\n        const overtimeStart = adjustedStart.time || scheduledStart;\n        const rest1Start = addMinutesToClockTime(overtimeStart, 4 * 60);\n        const rest1End = addMinutesToClockTime(overtimeStart, 5 * 60);\n        return [{\n          employee_code: row.employee_code || "",\n          work_date: row.work_date || "",\n          overtime_type_id: "attendance-rest-day",\n          overtime_start_time: adjustedStart.time || scheduledStart,\n          overtime_end_time: scheduledEnd,\n          overtime_previous_day: adjustedStart.previousDay,\n          overtime_subsidy_type: 1,\n          overtime_use_rest_1: true,\n          overtime_rest_1_start_time: rest1Start,\n          overtime_rest_1_end_time: rest1End,\n          overtime_rest_1_paid: 0,\n          overtime_use_rest_2: false\n        }];\n      }\n''',
)


# 4. Store attendance-review request sequencing inside recordsState (canonical state), not a top-level mutable variable.
replace_once(
    "src/renderer/renderer-foundation.js",
    '''      page: 1,\n      pageSize: 50,\n      filters: {\n''',
    '''      page: 1,\n      pageSize: 50,\n      requestId: 0,\n      filters: {\n''',
)

replace_once(
    "src/renderer/renderer-records-page.js",
    '''    page: Number(current.page || 1),\n    pageSize: Number(current.pageSize || 50),\n    filters: {\n''',
    '''    page: Number(current.page || 1),\n    pageSize: Number(current.pageSize || 50),\n    requestId: Number(current.requestId || 0),\n    filters: {\n''',
)

replace_once(
    "src/renderer/renderer-records-page.js",
    '''async function loadAttendanceReview(shouldRender = true) {\n  if (!hasPermission("attendance_review")) return;\n  const review = ensureAttendanceReviewState();\n  recordsState = {\n    ...recordsState,\n    attendanceReview: { ...review, loading: true, error: "" }\n  };\n  if (shouldRender) renderAll();\n  try {\n    const result = await window.schedulerApi.getAttendanceReviewList({\n      ...recordsState.attendanceReview.filters,\n      page: recordsState.attendanceReview.page\n    });\n    recordsState = {\n      ...recordsState,\n      commonAttendanceNotes: Array.isArray(result.commonNotes) ? result.commonNotes : recordsState.commonAttendanceNotes,\n      attendanceReview: {\n        ...recordsState.attendanceReview,\n        loading: false,\n        loaded: true,\n        rows: result.rows || [],\n        members: result.members || [],\n        departments: result.departments || [],\n        issueTypes: result.issueTypes || [],\n        total: Number(result.total || 0),\n        page: Number(result.page || 1),\n        pageSize: Number(result.pageSize || 50),\n        error: ""\n      }\n    };\n  } catch (error) {\n    recordsState = {\n      ...recordsState,\n      attendanceReview: {\n        ...recordsState.attendanceReview,\n        loading: false,\n        loaded: false,\n        rows: [],\n        error: error.message || "讀取簽到審核失敗"\n      }\n    };\n  }\n  if (shouldRender) renderAll();\n}\n''',
    '''async function loadAttendanceReview(shouldRender = true) {\n  if (!hasPermission("attendance_review")) return false;\n  const review = ensureAttendanceReviewState();\n  const requestId = Number(review.requestId || 0) + 1;\n  const requestFilters = { ...review.filters };\n  const requestPage = Math.max(1, Number(review.page || 1));\n  recordsState = {\n    ...recordsState,\n    attendanceReview: { ...review, loading: true, error: "", requestId }\n  };\n  if (shouldRender) renderAll();\n  try {\n    const result = await window.schedulerApi.getAttendanceReviewList({\n      ...requestFilters,\n      page: requestPage\n    });\n    const current = ensureAttendanceReviewState();\n    if (Number(current.requestId || 0) !== requestId) return false;\n    recordsState = {\n      ...recordsState,\n      commonAttendanceNotes: Array.isArray(result.commonNotes) ? result.commonNotes : recordsState.commonAttendanceNotes,\n      attendanceReview: {\n        ...current,\n        loading: false,\n        loaded: true,\n        rows: result.rows || [],\n        members: result.members || [],\n        departments: result.departments || [],\n        issueTypes: result.issueTypes || [],\n        total: Number(result.total || 0),\n        page: Number(result.page || requestPage),\n        pageSize: Number(result.pageSize || 50),\n        error: ""\n      }\n    };\n  } catch (error) {\n    const current = ensureAttendanceReviewState();\n    if (Number(current.requestId || 0) !== requestId) return false;\n    recordsState = {\n      ...recordsState,\n      attendanceReview: {\n        ...current,\n        loading: false,\n        error: error.message || "讀取簽到審核失敗"\n      }\n    };\n  }\n  if (shouldRender) renderAll();\n  return !recordsState.attendanceReview.error;\n}\n''',
)


# 5. Prevent repeated paging while a page request is running.
replace_once(
    "src/renderer/renderer-records-events.js",
    '''    if (target.dataset.attendanceReviewPage) {\n      const page = Number(target.dataset.attendanceReviewPage || 1);\n      if (page > 0) { ensureAttendanceReviewState().page = page; void loadAttendanceReview(); }\n      return;\n    }\n''',
    '''    if (target.dataset.attendanceReviewPage) {\n      const review = ensureAttendanceReviewState();\n      if (review.loading) return;\n      const page = Number(target.dataset.attendanceReviewPage || 1);\n      if (page > 0) { review.page = page; void loadAttendanceReview(); }\n      return;\n    }\n''',
)

replace_once(
    "src/renderer/renderer-records-views.js",
    '''    <button class="ghost-btn compact-btn" type="button" data-attendance-review-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>上一頁</button>\n    <span>共 ${total} 筆，第 ${page} / ${pages} 頁</span>\n    <button class="ghost-btn compact-btn" type="button" data-attendance-review-page="${page + 1}" ${page >= pages ? "disabled" : ""}>下一頁</button>\n''',
    '''    <button class="ghost-btn compact-btn" type="button" data-attendance-review-page="${page - 1}" ${(page <= 1 || review.loading) ? "disabled" : ""}>上一頁</button>\n    <span>共 ${total} 筆，第 ${page} / ${pages} 頁</span>\n    <button class="ghost-btn compact-btn" type="button" data-attendance-review-page="${page + 1}" ${(page >= pages || review.loading) ? "disabled" : ""}>下一頁</button>\n''',
)


# 6. Regression contracts for paging stability and the requested break calculation.
Path("tests/attendance-review-pagination-rest-break.test.js").write_text('''const test = require("node:test");\nconst assert = require("node:assert/strict");\nconst fs = require("node:fs");\nconst path = require("node:path");\n\nconst root = path.resolve(__dirname, "..");\nconst read = (file) => fs.readFileSync(path.join(root, file), "utf8");\n\ntest("簽到審核換頁會重試網路層失敗並防止過期請求覆蓋", () => {\n  const webApi = read("src/renderer/web-api.js");\n  const foundation = read("src/renderer/renderer-foundation.js");\n  const page = read("src/renderer/renderer-records-page.js");\n  const events = read("src/renderer/renderer-records-events.js");\n  const views = read("src/renderer/renderer-records-views.js");\n\n  assert.match(webApi, /async function requestFunction[\\s\\S]*?try \\{[\\s\\S]*?await fetch[\\s\\S]*?catch \\(error\\)[\\s\\S]*?retryTransientOnce && attempt === 0[\\s\\S]*?setTimeout\\(resolve, 300\\)/);\n  assert.match(webApi, /getAttendanceReviewList[\\s\\S]*?retryTransientOnce: true/);\n  assert.match(foundation, /attendanceReview:[\\s\\S]*?requestId: 0/);\n  assert.match(page, /requestId: Number\\(current\\.requestId \\|\\| 0\\)/);\n  assert.match(page, /const requestId = Number\\(review\\.requestId \\|\\| 0\\) \\+ 1/);\n  assert.match(page, /Number\\(current\\.requestId \\|\\| 0\\) !== requestId/);\n  assert.doesNotMatch(page, /let attendanceReviewLoadRequestId/);\n  assert.match(events, /if \\(review\\.loading\\) return;/);\n  assert.match(views, /page <= 1 \\|\\| review\\.loading/);\n  assert.match(views, /page >= pages \\|\\| review\\.loading/);\n});\n\ntest("休息日或例假簽到審核匯出在加班開始四小時後帶一小時休息", () => {\n  const webApi = read("src/renderer/web-api.js");\n\n  assert.match(webApi, /function addMinutesToClockTime/);\n  const helperStart = webApi.indexOf("function addMinutesToClockTime");\n  const helperEnd = webApi.indexOf("\\n  function downloadBlob", helperStart);\n  const helperSource = webApi.slice(helperStart, helperEnd).trim();\n  const helper = Function(`${helperSource}; return addMinutesToClockTime;`)();\n  assert.equal(helper("11:30", 4 * 60), "15:30");\n  assert.equal(helper("11:30", 5 * 60), "16:30");\n\n  assert.match(webApi, /const overtimeStart = adjustedStart\\.time \\|\\| scheduledStart/);\n  assert.match(webApi, /addMinutesToClockTime\\(overtimeStart, 4 \\* 60\\)/);\n  assert.match(webApi, /addMinutesToClockTime\\(overtimeStart, 5 \\* 60\\)/);\n  assert.match(webApi, /overtime_use_rest_1: true/);\n  assert.match(webApi, /overtime_rest_1_start_time: rest1Start/);\n  assert.match(webApi, /overtime_rest_1_end_time: rest1End/);\n  assert.match(webApi, /overtime_rest_1_paid: 0/);\n});\n''', encoding="utf-8")
