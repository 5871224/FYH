from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, got {count}: {old[:180]!r}")
    file_path.write_text(text.replace(old, new, 1), encoding="utf-8")


# Retry browser-level network failures for read-only Edge Function calls that opt in.
replace_once(
    "src/renderer/web-api.js",
    '''  async function requestFunction(functionName, payload, { retryTransientOnce = false } = {}) {\n    for (let attempt = 0; ; attempt += 1) {\n      assertSessionActive();\n      const response = await fetch(`${baseUrl}/functions/v1/${functionName}`, {\n        method: "POST",\n        cache: "no-store",\n        headers: buildHeaders({\n          auth: true,\n          extra: {\n            Accept: "application/json"\n          }\n        }),\n        body: JSON.stringify(payload || {})\n      });\n      if (!response.ok) {\n        if (response.status === 404) {\n          throw new Error(`尚未部署 ${functionName} Edge Function`);\n        }\n        const message = await readError(response);\n        if (retryTransientOnce && attempt === 0 && [502, 503, 504].includes(response.status)) {\n          await new Promise((resolve) => setTimeout(resolve, 300));\n          continue;\n        }\n        throw new Error(message);\n      }\n      touchSession();\n      const text = await response.text();\n      return text ? JSON.parse(text) : null;\n    }\n  }\n''',
    '''  async function requestFunction(functionName, payload, { retryTransientOnce = false } = {}) {\n    for (let attempt = 0; ; attempt += 1) {\n      assertSessionActive();\n      let response;\n      try {\n        response = await fetch(`${baseUrl}/functions/v1/${functionName}`, {\n          method: "POST",\n          cache: "no-store",\n          headers: buildHeaders({\n            auth: true,\n            extra: {\n              Accept: "application/json"\n            }\n          }),\n          body: JSON.stringify(payload || {})\n        });\n      } catch (error) {\n        if (retryTransientOnce && attempt === 0) {\n          await new Promise((resolve) => setTimeout(resolve, 300));\n          continue;\n        }\n        throw error;\n      }\n      if (!response.ok) {\n        if (response.status === 404) {\n          throw new Error(`尚未部署 ${functionName} Edge Function`);\n        }\n        const message = await readError(response);\n        if (retryTransientOnce && attempt === 0 && [502, 503, 504].includes(response.status)) {\n          await new Promise((resolve) => setTimeout(resolve, 300));\n          continue;\n        }\n        throw new Error(message);\n      }\n      touchSession();\n      const text = await response.text();\n      return text ? JSON.parse(text) : null;\n    }\n  }\n''',
)


# Add a clock helper used by attendance-review overtime export rest periods.
replace_once(
    "src/renderer/web-api.js",
    '''  function downloadBlob(blob, fileName) {\n''',
    '''  function addMinutesToClockTime(value, minutesToAdd) {\n    const match = String(value || "").match(/^([01]\\d|2[0-3]):([0-5]\\d)/);\n    if (!match) return "";\n    const baseMinutes = Number(match[1]) * 60 + Number(match[2]);\n    const delta = Number(minutesToAdd || 0);\n    if (!Number.isFinite(delta)) return `${match[1]}:${match[2]}`;\n    const normalizedMinutes = ((baseMinutes + Math.round(delta)) % 1440 + 1440) % 1440;\n    return `${String(Math.floor(normalizedMinutes / 60)).padStart(2, "0")}:${String(normalizedMinutes % 60).padStart(2, "0")}`;\n  }\n\n  function downloadBlob(blob, fileName) {\n''',
)


# Rest-day / regular-holiday overtime export: insert one unpaid hour after four hours from exported overtime start.
replace_once(
    "src/renderer/web-api.js",
    '''      if (scheduledStart && scheduledEnd) {\n        const adjustedStart = subtractOvertimeHoursFromClockTime(scheduledStart, row.overtimeHours);\n        return [{\n          employee_code: row.employee_code || "",\n          work_date: row.work_date || "",\n          overtime_type_id: "attendance-rest-day",\n          overtime_start_time: adjustedStart.time || scheduledStart,\n          overtime_end_time: scheduledEnd,\n          overtime_previous_day: adjustedStart.previousDay,\n          overtime_subsidy_type: 1,\n          overtime_use_rest_1: false,\n          overtime_use_rest_2: false\n        }];\n      }\n''',
    '''      if (scheduledStart && scheduledEnd) {\n        const adjustedStart = subtractOvertimeHoursFromClockTime(scheduledStart, row.overtimeHours);\n        const overtimeStart = adjustedStart.time || scheduledStart;\n        const rest1Start = addMinutesToClockTime(overtimeStart, 4 * 60);\n        const rest1End = addMinutesToClockTime(overtimeStart, 5 * 60);\n        return [{\n          employee_code: row.employee_code || "",\n          work_date: row.work_date || "",\n          overtime_type_id: "attendance-rest-day",\n          overtime_start_time: overtimeStart,\n          overtime_end_time: scheduledEnd,\n          overtime_previous_day: adjustedStart.previousDay,\n          overtime_subsidy_type: 1,\n          overtime_use_rest_1: true,\n          overtime_rest_1_start_time: rest1Start,\n          overtime_rest_1_end_time: rest1End,\n          overtime_rest_1_paid: 0,\n          overtime_use_rest_2: false\n        }];\n      }\n''',
)


# Attendance review paging: only newest request may update state; pagination does not optimistically move page.
replace_once(
    "src/renderer/renderer-records-page.js",
    '''/* 簽到簿、訂餐統計及訂餐設定資料讀取控制。 */\n\n''',
    '''/* 簽到簿、訂餐統計及訂餐設定資料讀取控制。 */\n\nlet attendanceReviewLoadRequestId = 0;\n\n''',
)
replace_once(
    "src/renderer/renderer-records-page.js",
    '''async function loadAttendanceReview(shouldRender = true) {\n  if (!hasPermission("attendance_review")) return;\n  const review = ensureAttendanceReviewState();\n  recordsState = {\n    ...recordsState,\n    attendanceReview: { ...review, loading: true, error: "" }\n  };\n  if (shouldRender) renderAll();\n  try {\n    const result = await window.schedulerApi.getAttendanceReviewList({\n      ...recordsState.attendanceReview.filters,\n      page: recordsState.attendanceReview.page\n    });\n    recordsState = {\n      ...recordsState,\n      commonAttendanceNotes: Array.isArray(result.commonNotes) ? result.commonNotes : recordsState.commonAttendanceNotes,\n      attendanceReview: {\n        ...recordsState.attendanceReview,\n        loading: false,\n        loaded: true,\n        rows: result.rows || [],\n        members: result.members || [],\n        departments: result.departments || [],\n        issueTypes: result.issueTypes || [],\n        total: Number(result.total || 0),\n        page: Number(result.page || 1),\n        pageSize: Number(result.pageSize || 50),\n        error: ""\n      }\n    };\n  } catch (error) {\n    recordsState = {\n      ...recordsState,\n      attendanceReview: {\n        ...recordsState.attendanceReview,\n        loading: false,\n        loaded: false,\n        rows: [],\n        error: error.message || "讀取簽到審核失敗"\n      }\n    };\n  }\n  if (shouldRender) renderAll();\n}\n''',
    '''async function loadAttendanceReview(shouldRender = true, requestedPage = null) {\n  if (!hasPermission("attendance_review")) return false;\n  const review = ensureAttendanceReviewState();\n  const requestId = ++attendanceReviewLoadRequestId;\n  const page = requestedPage === null\n    ? Math.max(1, Number(review.page || 1))\n    : Math.max(1, Number(requestedPage || 1));\n  const requestFilters = { ...review.filters };\n  const keepExistingPageOnError = requestedPage !== null && review.loaded;\n  recordsState = {\n    ...recordsState,\n    attendanceReview: { ...review, loading: true, error: "" }\n  };\n  if (shouldRender) renderAll();\n  try {\n    const result = await window.schedulerApi.getAttendanceReviewList({\n      ...requestFilters,\n      page\n    });\n    if (requestId !== attendanceReviewLoadRequestId) return false;\n    recordsState = {\n      ...recordsState,\n      commonAttendanceNotes: Array.isArray(result.commonNotes) ? result.commonNotes : recordsState.commonAttendanceNotes,\n      attendanceReview: {\n        ...recordsState.attendanceReview,\n        loading: false,\n        loaded: true,\n        rows: result.rows || [],\n        members: result.members || [],\n        departments: result.departments || [],\n        issueTypes: result.issueTypes || [],\n        total: Number(result.total || 0),\n        page: Number(result.page || page),\n        pageSize: Number(result.pageSize || 50),\n        error: ""\n      }\n    };\n  } catch (error) {\n    if (requestId !== attendanceReviewLoadRequestId) return false;\n    const current = ensureAttendanceReviewState();\n    recordsState = {\n      ...recordsState,\n      attendanceReview: {\n        ...current,\n        loading: false,\n        loaded: keepExistingPageOnError ? Boolean(review.loaded) : false,\n        rows: keepExistingPageOnError ? review.rows : [],\n        page: keepExistingPageOnError ? Number(review.page || 1) : current.page,\n        error: error.message || "讀取簽到審核失敗"\n      }\n    };\n  }\n  if (requestId === attendanceReviewLoadRequestId && shouldRender) renderAll();\n  return requestId === attendanceReviewLoadRequestId && !recordsState.attendanceReview.error;\n}\n''',
)

replace_once(
    "src/renderer/renderer-records-events.js",
    '''    if (target.dataset.attendanceReviewPage) {\n      const page = Number(target.dataset.attendanceReviewPage || 1);\n      if (page > 0) { ensureAttendanceReviewState().page = page; void loadAttendanceReview(); }\n      return;\n    }\n''',
    '''    if (target.dataset.attendanceReviewPage) {\n      const review = ensureAttendanceReviewState();\n      if (review.loading) return;\n      const page = Number(target.dataset.attendanceReviewPage || 1);\n      if (page > 0) void loadAttendanceReview(true, page);\n      return;\n    }\n''',
)

replace_once(
    "src/renderer/renderer-records-views.js",
    '''    <button class="ghost-btn compact-btn" type="button" data-attendance-review-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>上一頁</button>\n    <span>共 ${total} 筆，第 ${page} / ${pages} 頁</span>\n    <button class="ghost-btn compact-btn" type="button" data-attendance-review-page="${page + 1}" ${page >= pages ? "disabled" : ""}>下一頁</button>\n''',
    '''    <button class="ghost-btn compact-btn" type="button" data-attendance-review-page="${page - 1}" ${(page <= 1 || review.loading) ? "disabled" : ""}>上一頁</button>\n    <span>共 ${total} 筆，第 ${page} / ${pages} 頁</span>\n    <button class="ghost-btn compact-btn" type="button" data-attendance-review-page="${page + 1}" ${(page >= pages || review.loading) ? "disabled" : ""}>下一頁</button>\n''',
)


# Formal regression contract.
Path("tests/attendance-review-pagination-rest-break.test.js").write_text('''const test = require("node:test");\nconst assert = require("node:assert/strict");\nconst fs = require("node:fs");\nconst path = require("node:path");\n\nconst root = path.resolve(__dirname, "..");\nconst read = (file) => fs.readFileSync(path.join(root, file), "utf8");\n\ntest("簽到審核換頁會重試網路層失敗並防止過期請求覆蓋", () => {\n  const webApi = read("src/renderer/web-api.js");\n  const page = read("src/renderer/renderer-records-page.js");\n  const events = read("src/renderer/renderer-records-events.js");\n  const views = read("src/renderer/renderer-records-views.js");\n\n  assert.match(webApi, /async function requestFunction[\\s\\S]*?try \\{[\\s\\S]*?await fetch[\\s\\S]*?catch \\(error\\)[\\s\\S]*?retryTransientOnce && attempt === 0[\\s\\S]*?setTimeout\\(resolve, 300\\)/);\n  assert.match(webApi, /getAttendanceReviewList[\\s\\S]*?retryTransientOnce: true/);\n  assert.match(page, /let attendanceReviewLoadRequestId = 0/);\n  assert.match(page, /loadAttendanceReview\\(shouldRender = true, requestedPage = null\\)/);\n  assert.match(page, /requestId !== attendanceReviewLoadRequestId/);\n  assert.match(page, /keepExistingPageOnError/);\n  assert.match(events, /if \\(review\\.loading\\) return;/);\n  assert.match(events, /loadAttendanceReview\\(true, page\\)/);\n  assert.match(views, /page <= 1 \\|\\| review\\.loading/);\n  assert.match(views, /page >= pages \\|\\| review\\.loading/);\n});\n\ntest("休息日或例假簽到審核匯出在加班開始四小時後帶一小時休息", () => {\n  const webApi = read("src/renderer/web-api.js");\n  const exporter = read("src/renderer/browser-exporter.js");\n  const spec = read("規格書.md");\n\n  assert.match(webApi, /function addMinutesToClockTime/);\n  assert.match(webApi, /const overtimeStart = adjustedStart\\.time \\|\\| scheduledStart/);\n  assert.match(webApi, /addMinutesToClockTime\\(overtimeStart, 4 \\* 60\\)/);\n  assert.match(webApi, /addMinutesToClockTime\\(overtimeStart, 5 \\* 60\\)/);\n  assert.match(webApi, /overtime_use_rest_1: true/);\n  assert.match(webApi, /overtime_rest_1_start_time: rest1Start/);\n  assert.match(webApi, /overtime_rest_1_end_time: rest1End/);\n  assert.match(webApi, /overtime_rest_1_paid: 0/);\n  assert.match(exporter, /overtime_use_rest_1 \\? formatCompactTime\\(row\\.overtime_rest_1_start_time\\)/);\n  assert.match(spec, /加班開始時間起算 4 小時/);\n  assert.match(spec, /11:30.*15:30.*16:30/);\n});\n''', encoding="utf-8")


# Update the canonical specification.
replace_once(
    "規格書.md",
    '''**文件版本：** 2026-08-11''',
    '''**文件版本：** 2026-08-13''',
)
replace_once(
    "規格書.md",
    '''11. 上述「例假／休息日＋班別」若當日「加班時數」另有填值，該時數視為班別開始前的額外加班，匯出開始時間必須由班別開始時間向前扣除相同時數，結束時間仍使用班別結束時間；例如班別 `08:00-17:00`、加班 2 小時，匯出為 `06:00-17:00`。若開始時間向前跨過 `00:00`，匯出的前一天欄位設為 `1`。\n12. 簽到審核清單讀取遇到 `502`、`503` 或 `504` 時，等待 300 毫秒後自動重試一次；編輯、審核、退回等寫入操作不得自動重送。\n''',
    '''11. 上述「例假／休息日＋班別」若當日「加班時數」另有填值，該時數視為班別開始前的額外加班，匯出開始時間必須由班別開始時間向前扣除相同時數，結束時間仍使用班別結束時間；例如班別 `08:00-17:00`、加班 2 小時，匯出為 `06:00-17:00`。若開始時間向前跨過 `00:00`，匯出的前一天欄位設為 `1`。休息日或例假的簽到審核加班匯出固定自動帶入「休息1」一小時，插入點為匯出的加班開始時間起算 4 小時；例如加班開始為 `11:30`，休息1為 `15:30-16:30`，休息1給薪類別為 `0`。\n12. 簽到審核清單讀取遇到 `502`、`503`、`504` 或瀏覽器網路層 `Failed to fetch` 類錯誤時，等待 300 毫秒後自動重試一次；換頁讀取期間停用上一頁／下一頁，且只有最新一次清單請求可以更新畫面，避免過期回應覆蓋新頁。編輯、審核、退回等寫入操作不得自動重送。\n''',
)
