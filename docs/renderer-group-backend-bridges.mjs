/* 群組化簽到審核 API 與頁面按需讀取。 */

async function requestGroupEdgeFunction(functionName, payload = {}) {
  const config = window.SCHEDULER_CONFIG || {};
  const baseUrl = String(config.supabaseUrl || "").replace(/\/$/, "");
  const anonKey = String(config.supabaseAnonKey || "");
  const token = window.schedulerApi?.getAuthContext?.()?.session?.access_token || "";
  if (!baseUrl || !anonKey || !token) throw new Error("尚未完成登入驗證");
  const response = await fetch(`${baseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    cache: "no-store",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload || {})
  });
  const text = await response.text();
  let result = null;
  if (text) {
    try { result = JSON.parse(text); } catch (_error) { result = text; }
  }
  if (!response.ok) throw new Error(result?.message || result?.error || text || `${functionName} 操作失敗`);
  return result;
}

function attendanceReviewPayload(action, payload = {}) {
  return {
    action,
    ...payload,
    groupId: payload.groupId ?? ensureAttendanceReviewState().filters.groupId ?? ""
  };
}

function overtimeHoursToTime(value) {
  const totalMinutes = Math.round(Number(value || 0) * 60);
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return "";
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
}

(function installGroupBackendBridges() {
  if (!window.schedulerApi || typeof hasPermission !== "function") return;

  window.schedulerApi.getAttendanceReviewList = (filters = {}) => (
    requestGroupEdgeFunction("attendance-review-groups", attendanceReviewPayload("review_list", filters))
  );
  window.schedulerApi.saveAttendanceReviewRecord = (payload = {}) => (
    requestGroupEdgeFunction("attendance-review-groups", attendanceReviewPayload("review_save", payload))
  );
  window.schedulerApi.setAttendanceReviewed = (payload = {}) => (
    requestGroupEdgeFunction("attendance-review-groups", attendanceReviewPayload("review_set", payload))
  );
  window.schedulerApi.getAttendanceHistory = (recordId) => (
    requestGroupEdgeFunction("attendance-review-groups", attendanceReviewPayload("history", { recordId }))
  );
  window.schedulerApi.exportAttendanceReview = async (filters = {}) => {
    const scopedFilters = {
      ...filters,
      groupId: filters.groupId ?? ensureAttendanceReviewState().filters.groupId ?? ""
    };
    const result = await requestGroupEdgeFunction(
      "attendance-review-groups",
      attendanceReviewPayload("export_list", scopedFilters)
    );
    const exportRows = (Array.isArray(result?.rows) ? result.rows : [])
      .filter((row) => Number(row.overtimeHours) > 0)
      .map((row) => ({
        employee_code: row.employee_code || "",
        work_date: row.work_date || "",
        overtime_type_id: "attendance-ledger",
        overtime_start_time: "00:00",
        overtime_end_time: overtimeHoursToTime(row.overtimeHours),
        overtime_previous_day: 0,
        overtime_subsidy_type: 1,
        overtime_use_rest_1: false,
        overtime_use_rest_2: false
      }));
    return window.schedulerApi.exportOvertime({
      startDate: scopedFilters.fromDate,
      endDate: scopedFilters.toDate,
      exportRows
    });
  };

  loadAttendanceReview = async function loadAttendanceReviewByGroup(shouldRender = true) {
    if (!hasPermission("attendance_review")) return;
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
  };

  async function loadPersonalRecordsOnly(shouldRender = true) {
    if (!isLoggedIn()) return;
    ensureRecordsState();
    recordsState = { ...recordsState, loading: true, error: "" };
    if (shouldRender) renderAll();
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
    } catch (error) {
      recordsState = {
        ...recordsState,
        loading: false,
        personal: [],
        error: error.message || "讀取簽到簿失敗"
      };
    }
    if (shouldRender) renderAll();
  }

  loadRecordsPage = async function loadVisibleRecordsTab(shouldRender = true) {
    ensureRecordsState();
    if (recordsState.activeTab === "review" && hasPermission("attendance_review")) {
      await loadAttendanceReview(shouldRender);
      return;
    }
    await loadPersonalRecordsOnly(shouldRender);
  };

  document.body.addEventListener("click", (event) => {
    const tab = event.target.closest?.("button[data-records-tab]");
    if (!tab) return;
    queueMicrotask(() => {
      if (appView !== "records") return;
      void loadRecordsPage();
    });
  });
})();
