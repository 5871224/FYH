/* 記錄頁、管理報表及分頁資料讀取控制。
 * 所有記錄功能使用正式 API 與單一狀態初始化來源。
 */

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
    return recordsState;
  }

function ensureOvertimeReviewState() {
    const current = recordsState.overtimeReview || {};
    const filters = current.filters || {};
    recordsState.overtimeReview = {
      loading: Boolean(current.loading),
      requests: current.requests || [],
      members: current.members || [],
      total: Number(current.total || 0),
      page: Number(current.page || 1),
      pageSize: Number(current.pageSize || 20),
      filters: {
        status: filters.status || "pending",
        fromDate: filters.fromDate || addDaysToDateString(getTodayDateString(), -30),
        toDate: filters.toDate || getTodayDateString(),
        memberId: filters.memberId || ""
      },
      error: current.error || ""
    };
    return recordsState.overtimeReview;
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
      if (isAdmin()) await Promise.all([loadOvertimeReview(false), loadAttendanceAdmin(false)]);
    } catch (error) {
      recordsState = { ...recordsState, loading: false, personal: [], error: error.message || "讀取記錄失敗" };
    }
    renderAll();
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

async function loadOvertimeReview(shouldRender = true) {
    if (!isAdmin()) return;
    const review = ensureOvertimeReviewState();
    recordsState = {
      ...recordsState,
      overtimeReview: { ...review, loading: true, error: "" }
    };
    if (shouldRender) renderAll();
    try {
      const result = await window.schedulerApi.getOvertimeReviewList({
        ...recordsState.overtimeReview.filters,
        page: recordsState.overtimeReview.page
      });
      recordsState = {
        ...recordsState,
        overtimeReview: {
          ...recordsState.overtimeReview,
          loading: false,
          requests: result.requests || [],
          members: result.members || [],
          total: Number(result.total || 0),
          page: Number(result.page || 1),
          pageSize: Number(result.pageSize || 20),
          error: ""
        }
      };
    } catch (error) {
      recordsState = {
        ...recordsState,
        overtimeReview: {
          ...recordsState.overtimeReview,
          loading: false,
          requests: [],
          error: error.message || "讀取加班審核失敗"
        }
      };
    }
    if (shouldRender) renderAll();
  }

async function loadAttendanceAdmin(shouldRender = true) {
    if (!isAdmin()) return;
    recordsState = { ...recordsState, attendanceAdmin: { ...recordsState.attendanceAdmin, loading: true, error: "" } };
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
          pageSize: Number(result.pageSize || 50),
          error: ""
        }
      };
    } catch (error) {
      recordsState = { ...recordsState, attendanceAdmin: { ...recordsState.attendanceAdmin, loading: false, rows: [], error: error.message || "讀取打卡管理失敗" } };
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
