/* 記錄頁及主管報表資料讀取控制。
 * 由 renderer.js 拆分；維持既有全域 bundle 執行方式。
 */

async function loadRecordsPage() {
  if (!isLoggedIn()) {
    return;
  }
  recordsState = { ...recordsState, loading: true, error: "" };
  renderAll();
  try {
    const personal = await window.schedulerApi.getPersonalRecords();
    recordsState = {
      ...recordsState,
      loading: false,
      personal: personal.records || [],
      error: ""
    };
    if (isAdmin()) {
      await Promise.all([loadOvertimeReview(false), loadAttendanceAdmin(false)]);
    }
    renderAll();
  } catch (error) {
    recordsState = { ...recordsState, loading: false, personal: [], error: error.message || "讀取記錄失敗" };
  }
  renderAll();
}

async function loadMealReport(shouldRender = true) {
  if (!isManager()) return;
  recordsState = { ...recordsState, mealStats: { ...(recordsState.mealStats || {}), loading: true, error: "" } };
  if (shouldRender) renderAll();
  try {
    const mealStats = await window.schedulerApi.getMealReport(recordsState.mealFilters);
    recordsState = { ...recordsState, mealStats };
  } catch (error) {
    recordsState = { ...recordsState, mealStats: { error: error.message || "讀取訂餐統計失敗" } };
  }
  if (shouldRender) renderAll();
}

async function loadOvertimeReview(shouldRender = true) {
  if (!isAdmin()) return;
  recordsState = {
    ...recordsState,
    overtimeReview: { ...recordsState.overtimeReview, loading: true, error: "" }
  };
  if (shouldRender) renderAll();
  try {
    const result = await window.schedulerApi.getOvertimeReviewList(recordsState.overtimeReview.filters);
    recordsState = {
      ...recordsState,
      overtimeReview: { ...recordsState.overtimeReview, loading: false, requests: result.requests || [], members: result.members || [], error: "" }
    };
  } catch (error) {
    recordsState = {
      ...recordsState,
      overtimeReview: { ...recordsState.overtimeReview, loading: false, requests: [], error: error.message === "加班操作失敗" ? "讀取加班審核失敗" : (error.message || "讀取加班審核失敗") }
    };
  }
  if (shouldRender) renderAll();
}

async function loadAttendanceAdmin(shouldRender = true) {
  if (!isAdmin()) return;
  recordsState = {
    ...recordsState,
    attendanceAdmin: { ...recordsState.attendanceAdmin, loading: true, error: "" }
  };
  if (shouldRender) renderAll();
  try {
    const result = await window.schedulerApi.getAttendanceAdminRecords({
      ...recordsState.attendanceAdmin.filters,
      page: recordsState.attendanceAdmin.page
    });
    recordsState = {
      ...recordsState,
      attendanceAdmin: {
        ...recordsState.attendanceAdmin,
        loading: false,
        rows: result.rows || [],
        members: result.members || [],
        issueTypes: result.issueTypes || [],
        total: Number(result.total || 0),
        page: Number(result.page || 1),
        error: ""
      }
    };
  } catch (error) {
    recordsState = {
      ...recordsState,
      attendanceAdmin: { ...recordsState.attendanceAdmin, loading: false, rows: [], error: error.message === "讀取報表失敗" ? "讀取打卡管理失敗" : (error.message || "讀取打卡管理失敗") }
    };
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
