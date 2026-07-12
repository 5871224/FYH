function getSelectedOvertimeDate() {
  return attendanceOvertimeState.selectedWorkDate || getTodayDateString();
}

function formatOvertimeShiftTime(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
  return match ? `${String(Number(match[1])).padStart(2, "0")}:${match[2]}` : "--:--";
}

function formatOvertimeAttendanceTime(value) {
  if (!value) return "--:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).format(date);
}

function formatOvertimeHours(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? String(number) : "0";
}

function renderOvertimeEstimate(stateValue, eligibility) {
  const shiftName = stateValue?.shift?.name || "未排班";
  const shiftStart = formatOvertimeShiftTime(stateValue?.shift?.start_time);
  const shiftEnd = formatOvertimeShiftTime(stateValue?.shift?.end_time);
  const clockIn = formatOvertimeAttendanceTime(stateValue?.attendance?.clock_in_at);
  const clockOut = formatOvertimeAttendanceTime(stateValue?.attendance?.clock_out_at);
  const earlyHours = formatOvertimeHours(eligibility?.earlyHours);
  const lateHours = formatOvertimeHours(eligibility?.lateHours);
  const totalHours = formatOvertimeHours(eligibility?.totalHours);
  return `${escapeHtml(shiftName)}：${escapeHtml(shiftStart)} ~ ${escapeHtml(shiftEnd)}　打卡：${escapeHtml(clockIn)} ~ ${escapeHtml(clockOut)}<br>提早 ${escapeHtml(earlyHours)} 小時 + 延後 ${escapeHtml(lateHours)} 小時 = 估算 ${escapeHtml(totalHours)} 小時`;
}

function formatClockButtonStatus(record, kind) {
  const at = kind === "in" ? record.clock_in_at : record.clock_out_at;
  if (!at) return "尚未打卡";
  const departmentName = kind === "in"
    ? record.clock_in_department_name_snapshot
    : record.clock_out_department_name_snapshot;
  const source = kind === "in" ? record.clock_in_source : record.clock_out_source;
  return `${formatClockTime(at)} 在【${departmentName || "未設定"}】打卡${source ? ` (${source})` : ""}`;
}

async function loadTodayAttendanceOvertime(shouldRender = true) {
  if (!isLoggedIn()) return null;
  const workDate = getSelectedOvertimeDate();
  attendanceOvertimeState = { ...attendanceOvertimeState, loading: true, error: "", selectedWorkDate: workDate };
  if (shouldRender) renderAll();
  let status = null;
  try {
    const [dateResult, result] = await Promise.all([
      window.schedulerApi.getEmployeeOvertimeDates(),
      window.schedulerApi.getAttendanceOvertimeForDate(workDate)
    ]);
    status = result;
    attendanceOvertimeState = {
      ...attendanceOvertimeState,
      loading: false,
      status,
      dates: dateResult.dates || [],
      selectedWorkDate: workDate,
      error: ""
    };
  } catch (error) {
    attendanceOvertimeState = {
      ...attendanceOvertimeState,
      loading: false,
      status: null,
      selectedWorkDate: workDate,
      error: error.message || "讀取加班申請狀態失敗"
    };
  }
  if (shouldRender) renderAll();
  return status;
}

async function submitTodayOvertimeRequest() {
  if (attendanceOvertimeState.loading) return;
  const workDate = getSelectedOvertimeDate();
  const earlyHours = Number(document.getElementById("overtimeEarlyHours")?.value || 0);
  const lateHours = Number(document.getElementById("overtimeLateHours")?.value || 0);
  const note = document.getElementById("overtimeEmployeeNote")?.value || "";
  attendanceOvertimeState = { ...attendanceOvertimeState, loading: true, error: "" };
  renderAll();
  try {
    await window.schedulerApi.submitAttendanceOvertime({ workDate, earlyHours, lateHours, note });
    await loadTodayAttendanceOvertime(false);
    showInfoMessage(`${workDate} 加班申請已送出`);
  } catch (error) {
    attendanceOvertimeState = { ...attendanceOvertimeState, loading: false, error: error.message || "送出加班申請失敗" };
  }
  renderAll();
}

async function deleteTodayOvertimeRequest() {
  const workDate = getSelectedOvertimeDate();
  const confirmed = await confirmAction(`確定要刪除 ${workDate} 的加班申請嗎？`);
  if (!confirmed) return;
  attendanceOvertimeState = { ...attendanceOvertimeState, loading: true, error: "" };
  renderAll();
  try {
    await window.schedulerApi.deleteAttendanceOvertime(workDate);
    await loadTodayAttendanceOvertime(false);
    showInfoMessage("加班申請已刪除");
  } catch (error) {
    attendanceOvertimeState = { ...attendanceOvertimeState, loading: false, error: error.message || "刪除加班申請失敗" };
  }
  renderAll();
}

function renderTodayOvertimePanel() {
  const checked = Boolean(attendanceOvertimeState.expanded);
  const toggle = `<label class="overtime-use-label"><input type="checkbox" data-toggle-overtime-panel="true" ${checked ? "checked" : ""}> 加班申請</label>`;
  if (!checked) {
    return `<section class="overtime-request-panel overtime-request-toggle-only">${toggle}</section>`;
  }

  const stateValue = attendanceOvertimeState.status;
  const eligibility = stateValue?.eligibility || null;
  const request = stateValue?.request || null;
  const workDate = getSelectedOvertimeDate();
  const dateRows = attendanceOvertimeState.dates || [];
  const dateValues = [...new Set([workDate, ...dateRows.map((row) => row.workDate).filter(Boolean)])]
    .sort((left, right) => String(right).localeCompare(String(left)));
  const selector = `<div class="form-row overtime-date-row"><label for="overtimeWorkDate">申請日期</label><select id="overtimeWorkDate">${dateValues.map((date) => `<option value="${escapeHtml(date)}" ${date === workDate ? "selected" : ""}>${escapeHtml(date)}</option>`).join("")}</select></div>`;

  if (attendanceOvertimeState.loading) {
    return `<section class="overtime-request-panel">${toggle}${selector}<p class="clock-loading">讀取加班狀態...</p></section>`;
  }
  if (attendanceOvertimeState.error) {
    return `<section class="overtime-request-panel">${toggle}${selector}<div class="auth-error">${escapeHtml(attendanceOvertimeState.error)}</div></section>`;
  }
  if (!stateValue) {
    return `<section class="overtime-request-panel">${toggle}${selector}</section>`;
  }

  if (request) {
    const canDelete = request.status === "pending" || request.status === "returned";
    return `<section class="overtime-request-panel">
      ${toggle}
      ${selector}
      <div class="overtime-request-status-row">
        <p class="home-subtitle overtime-request-status">${getOvertimeStatusLabel(request.status)}，合計 ${Number(request.total_overtime_hours || 0)} 小時</p>
        ${canDelete ? '<button class="ghost-btn" type="button" data-delete-today-overtime="true">刪除申請</button>' : ""}
      </div>
      ${request.attendance_changed_warning ? '<div class="auth-error">打卡時間已異動，需重新審核</div>' : ""}
      <div class="clock-status-grid overtime-hours-summary"><div><span>提早上班</span><strong>${Number(request.early_overtime_hours || 0)} 小時</strong></div><div><span>延後下班</span><strong>${Number(request.late_overtime_hours || 0)} 小時</strong></div></div>
    </section>`;
  }

  if (!eligibility?.eligible) {
    return `<section class="overtime-request-panel">${toggle}${selector}<p class="home-subtitle">${escapeHtml(eligibility?.reasons?.[0] || "目前不可申請加班")}</p></section>`;
  }

  return `<section class="overtime-request-panel">
    ${toggle}
    ${selector}
    <p class="home-subtitle overtime-estimate-text">${renderOvertimeEstimate(stateValue, eligibility)}</p>
    <div class="form-grid two-col overtime-hours-grid">
      <div class="form-row"><label for="overtimeEarlyHours">提早上班時數</label><input id="overtimeEarlyHours" type="number" min="0" step="0.5" value="${Number(eligibility.earlyHours || 0)}"></div>
      <div class="form-row"><label for="overtimeLateHours">延後下班時數</label><input id="overtimeLateHours" type="number" min="0" step="0.5" value="${Number(eligibility.lateHours || 0)}"></div>
      <div class="form-row form-row-wide"><label for="overtimeEmployeeNote">加班備註</label><input id="overtimeEmployeeNote" type="text" placeholder="可填寫加班原因或補充說明"></div>
    </div>
    <button class="btn-primary overtime-submit-btn" type="button" data-submit-today-overtime="true">送出加班申請</button>
  </section>`;
}

document.addEventListener("change", (event) => {
  const target = event.target;
  if (target instanceof HTMLSelectElement && target.id === "overtimeWorkDate") {
    attendanceOvertimeState = { ...attendanceOvertimeState, selectedWorkDate: target.value };
    void loadTodayAttendanceOvertime();
  }
});
