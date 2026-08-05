/* 簽到簿、訂餐統計及訂餐設定資料讀取控制。 */

function ensureRecordsState() {
  const today = getTodayDateString();
  recordsState.personalFilters = recordsState.personalFilters || {
    fromDate: addDaysToDateString(today, -49),
    toDate: today
  };
  recordsState.personalPage = Number(recordsState.personalPage || 1);
  recordsState.personalTotal = Number(recordsState.personalTotal || 0);
  recordsState.personalPageSize = Number(recordsState.personalPageSize || 50);
  recordsState.mealPage = Number(recordsState.mealPage || 1);
  recordsState.mealReportView = recordsState.mealReportView || "detail";
  recordsState.attendanceReview = recordsState.attendanceReview || createRecordsState().attendanceReview;
  return recordsState;
}

function ensureAttendanceReviewState() {
  ensureRecordsState();
  const current = recordsState.attendanceReview || {};
  const filters = current.filters || {};
  recordsState.attendanceReview = {
    loading: Boolean(current.loading),
    rows: current.rows || [],
    members: current.members || [],
    issueTypes: current.issueTypes || [],
    total: Number(current.total || 0),
    page: Number(current.page || 1),
    pageSize: Number(current.pageSize || 50),
    filters: {
      status: filters.status || "unreviewed",
      fromDate: filters.fromDate || addDaysToDateString(getTodayDateString(), -30),
      toDate: filters.toDate || getTodayDateString(),
      memberId: filters.memberId || "",
      issueType: filters.issueType || ""
    },
    error: current.error || ""
  };
  return recordsState.attendanceReview;
}

async function loadRecordsPage() {
  if (!isLoggedIn()) return;
  ensureRecordsState();
  recordsState = { ...recordsState, loading: true, error: "" };
  renderAll();
  try {
    const result = await window.schedulerApi.getPersonalRecords({
      ...recordsState.personalFilters,
      page: recordsState.personalPage
    });
    recordsState = {
      ...recordsState,
      loading: false,
      personal: result.records || [],
      personalTotal: Number(result.total || 0),
      personalPage: Number(result.page || 1),
      personalPageSize: Number(result.pageSize || 50),
      error: ""
    };
    if (isAdmin()) await loadAttendanceReview(false);
  } catch (error) {
    recordsState = { ...recordsState, loading: false, personal: [], error: error.message || "讀取簽到簿失敗" };
  }
  renderAll();
}

async function loadAttendanceReview(shouldRender = true) {
  if (!isAdmin()) return;
  const review = ensureAttendanceReviewState();
  recordsState = {
    ...recordsState,
    attendanceReview: { ...review, loading: true, error: "" }
  };
  if (shouldRender) renderAll();
  try {
    const result = await window.schedulerApi.getAttendanceReviewList({
      ...recordsState.attendanceReview.filters,
      page: recordsState.attendanceReview.page
    });
    recordsState = {
      ...recordsState,
      attendanceReview: {
        ...recordsState.attendanceReview,
        loading: false,
        rows: result.rows || [],
        members: result.members || [],
        issueTypes: result.issueTypes || [],
        total: Number(result.total || 0),
        page: Number(result.page || 1),
        pageSize: Number(result.pageSize || 50),
        error: ""
      }
    };
  } catch (error) {
    recordsState = {
      ...recordsState,
      attendanceReview: {
        ...recordsState.attendanceReview,
        loading: false,
        rows: [],
        error: error.message || "讀取簽到審核失敗"
      }
    };
  }
  if (shouldRender) renderAll();
}

async function loadMealReport(shouldRender = true) {
  if (!isManager()) return;
  ensureRecordsState();
  recordsState = { ...recordsState, mealStats: { ...(recordsState.mealStats || {}), loading: true, error: "" } };
  if (shouldRender) renderAll();
  try {
    const result = await window.schedulerApi.getMealReport({
      ...recordsState.mealFilters,
      page: recordsState.mealPage
    });
    recordsState = { ...recordsState, mealStats: result, mealPage: Number(result.page || 1) };
  } catch (error) {
    recordsState = { ...recordsState, mealStats: { error: error.message || "讀取訂餐統計失敗" } };
  }
  if (shouldRender) renderAll();
}

async function loadMealAdminSettings(shouldRender = true) {
  if (!isManager()) return;
  recordsState = {
    ...recordsState,
    mealAdmin: { ...recordsState.mealAdmin, loading: true, error: "" }
  };
  if (shouldRender) renderAll();
  try {
    const result = await window.schedulerApi.getMealAdminSettings();
    recordsState = {
      ...recordsState,
      mealAdmin: { loading: false, products: result.products || [], settings: result.settings || { daily_cutoff_time: "10:30" }, error: "" }
    };
  } catch (error) {
    recordsState = {
      ...recordsState,
      mealAdmin: { ...recordsState.mealAdmin, loading: false, error: error.message || "讀取訂餐設定失敗" }
    };
  }
  if (shouldRender) renderAll();
}
