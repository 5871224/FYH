/* 簽到簿、簽到審核與訂餐設定操作。 */

function timeValueFromIso(value) {
  return value ? formatClockTime(value) : "";
}

function findAttendanceReviewRow(token) {
  const [userId, workDate] = String(token || "").split(":");
  return ensureAttendanceReviewState().rows.find((row) => row.user_id === userId && row.work_date === workDate)
    || { user_id: userId, work_date: workDate };
}

function attendanceReviewLocationOptions(row, location) {
  const review = ensureAttendanceReviewState();
  const groupId = String(row?.groupId || "").trim();
  const currentId = String(location?.departmentId || "").trim();
  return (review.departments || [])
    .filter((department) => groupId && String(department.group_id || department.groupId || "").trim() === groupId)
    .map((department) => ({ id: String(department.id || "").trim(), name: String(department.name || "").trim() }))
    .filter((department) => department.id)
    .map((department) => `<option value="${escapeHtml(department.id)}" ${department.id === currentId ? "selected" : ""}>${escapeHtml(department.name || department.id)}</option>`)
    .join("");
}

function openAttendanceReviewEditModal(token) {
  const row = findAttendanceReviewRow(token);
  openEntityListModal({
    title: "編輯簽到紀錄",
    hideFooterClose: true,
    body: `<div class="form-grid two-col">
      <div class="form-row"><label>上班時間</label><input id="reviewClockInTime" type="time" value="${escapeHtml(timeValueFromIso(row.clock_in_at))}"></div>
      <div class="form-row"><label>下班時間</label><input id="reviewClockOutTime" type="time" value="${escapeHtml(timeValueFromIso(row.clock_out_at))}"></div>
      <div class="form-row"><label>上班地點</label><select id="reviewClockInLocation">${attendanceReviewLocationOptions(row, row.clock_in_location)}</select></div>
      <div class="form-row"><label>下班地點</label><select id="reviewClockOutLocation">${attendanceReviewLocationOptions(row, row.clock_out_location)}</select></div>
      <div class="form-row"><label>上班時數</label><input id="reviewRegularHours" type="number" min="0" step="0.5" value="${row.regularHours === null || row.regularHours === undefined ? "" : escapeHtml(String(row.regularHours))}"></div>
      <div class="form-row"><label>加班時數</label><input id="reviewOvertimeHours" type="number" min="0" step="0.5" value="${row.overtimeHours === null || row.overtimeHours === undefined ? "" : escapeHtml(String(row.overtimeHours))}"></div>
      <div class="form-row form-row-wide"><label>備註</label><textarea id="reviewAttendanceNote" rows="4">${escapeHtml(row.note || "")}</textarea></div>
      <div class="form-row form-row-wide"><label>本次異動原因</label><textarea id="reviewAttendanceReason" rows="2" placeholder="選填，會保存於修改歷程"></textarea></div>
    </div>`,
    footerButtons: `<button class="btn-cancel" type="button" data-close-button="true">取消</button><button class="btn-primary" type="button" data-save-attendance-review="${escapeHtml(token)}">儲存</button>`
  });
}

async function saveAttendanceReviewEdit(token) {
  const row = findAttendanceReviewRow(token);
  try {
    await window.schedulerApi.saveAttendanceReviewRecord({
      userId: row.user_id,
      workDate: row.work_date,
      clockInTime: document.getElementById("reviewClockInTime")?.value || "",
      clockOutTime: document.getElementById("reviewClockOutTime")?.value || "",
      clockInLocationDepartmentId: document.getElementById("reviewClockInLocation")?.value || "",
      clockOutLocationDepartmentId: document.getElementById("reviewClockOutLocation")?.value || "",
      regularHours: document.getElementById("reviewRegularHours")?.value ?? "",
      overtimeHours: document.getElementById("reviewOvertimeHours")?.value ?? "",
      note: document.getElementById("reviewAttendanceNote")?.value || "",
      reason: document.getElementById("reviewAttendanceReason")?.value || ""
    });
    closeModal();
    await Promise.all([loadAttendanceReview(false), loadRecordsPage(false)]);
    renderAll();
    showInfoMessage("簽到資料已更新，狀態已回到未審");
  } catch (error) {
    setSaveStatus(`儲存簽到資料失敗：${error.message}`);
  }
}

function normalizeAttendanceCommonNotes(value) {
  const source = Array.isArray(value) ? value : String(value || "").split(/\r?\n/);
  return [...new Set(source.map((note) => String(note || "").trim()).filter(Boolean))];
}

function openAttendanceCommonNotesModal() {
  const notes = normalizeAttendanceCommonNotes(ensureRecordsState().commonAttendanceNotes || []);
  openEntityListModal({
    title: "常用備註",
    hideFooterClose: true,
    body: `<div class="form-row"><label>每個備註請用換行分隔</label><textarea id="attendanceCommonNotesInput" rows="10" placeholder="每行一個常用備註">${escapeHtml(notes.join("\n"))}</textarea></div>`,
    footerButtons: `<button class="btn-cancel" type="button" data-close-button="true">取消</button><button class="btn-primary" type="button" data-save-attendance-common-notes="true">儲存</button>`
  });
}

async function saveAttendanceCommonNotes() {
  const input = document.getElementById("attendanceCommonNotesInput");
  const notes = normalizeAttendanceCommonNotes(input?.value || "");
  try {
    const result = await window.schedulerApi.saveAttendanceCommonNotes({ notes });
    ensureRecordsState().commonAttendanceNotes = normalizeAttendanceCommonNotes(result?.commonNotes || notes);
    closeModal();
    renderAll();
    showInfoMessage("常用備註已儲存");
  } catch (error) {
    setSaveStatus(`儲存常用備註失敗：${error.message}`);
  }
}

async function savePersonalAttendanceInput(input) {
  if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) return;
  const field = input.dataset.personalAttendanceField || "";
  const workDate = input.dataset.personalAttendanceDate || "";
  const submittedValue = input.value;
  setPersonalAttendanceDraft(workDate, field, submittedValue);
  try {
    await window.schedulerApi.savePersonalAttendanceDay({ field, workDate, value: submittedValue });
    await loadRecordsPage(false);
    clearPersonalAttendanceDraft(workDate, field, submittedValue);
    const scrollSnapshot = captureRecordsScrollPosition();
    renderAll();
    restoreRecordsScrollPosition(scrollSnapshot);
  } catch (error) {
    showInfoMessage(error.message || "儲存簽到資料失敗");
  }
}

function attendanceReviewToken(row) {
  return `${row?.user_id || ""}:${row?.work_date || ""}`;
}

function applyAttendanceReviewSetResult(tokens, reviewed, result = {}) {
  const tokenSet = new Set((Array.isArray(tokens) ? tokens : [tokens]).map(String).filter(Boolean));
  const review = ensureAttendanceReviewState();
  const currentRows = Array.isArray(review.rows) ? review.rows : [];
  const serverRecords = new Map((Array.isArray(result.records) ? result.records : [])
    .map((row) => [attendanceReviewToken(row), row]));
  const movingOutOfCurrentFilter = (review.filters.status === "unreviewed" && reviewed)
    || (review.filters.status === "reviewed" && !reviewed);
  const matchedCount = currentRows.filter((row) => tokenSet.has(attendanceReviewToken(row))).length;
  const updatedRows = currentRows.map((row) => {
    const token = attendanceReviewToken(row);
    if (!tokenSet.has(token)) return row;
    const serverRecord = serverRecords.get(token) || {};
    return {
      ...row,
      id: serverRecord.id || row.id || "",
      reviewed,
      reviewedAt: reviewed ? (serverRecord.reviewedAt || result.reviewedAt || row.reviewedAt || null) : null
    };
  });
  const nextRows = movingOutOfCurrentFilter
    ? updatedRows.filter((row) => !tokenSet.has(attendanceReviewToken(row)))
    : updatedRows;
  const nextTotal = movingOutOfCurrentFilter
    ? Math.max(0, Number(review.total || 0) - matchedCount)
    : Number(review.total || 0);
  const pageSize = Math.max(1, Number(review.pageSize || 50));
  const pageCount = Math.max(1, Math.ceil(nextTotal / pageSize));
  const nextPage = Math.min(Number(review.page || 1), pageCount);

  recordsState = {
    ...recordsState,
    attendanceReview: {
      ...review,
      rows: nextRows,
      total: nextTotal,
      page: nextPage
    }
  };

  const actorId = window.schedulerApi.getAuthContext?.()?.profile?.id || "";
  if (actorId && Array.isArray(recordsState.personal)) {
    recordsState = {
      ...recordsState,
      personal: recordsState.personal.map((record) => tokenSet.has(`${actorId}:${record.date || ""}`)
        ? { ...record, reviewed }
        : record)
    };
  }
  return nextPage !== Number(review.page || 1);
}

async function setAttendanceReviewed(token, reviewed) {
  try {
    const result = await window.schedulerApi.setAttendanceReviewed({ token, reviewed });
    const pageChanged = applyAttendanceReviewSetResult([token], reviewed, result);
    if (pageChanged) await loadAttendanceReview(false);
    renderAll();
    showInfoMessage(reviewed ? "已設為已審" : "已退回未審");
  } catch (error) {
    showInfoMessage(error.message || "審核操作失敗");
  }
}

async function batchReviewAttendance(mode) {
  const tokens = Array.from(document.querySelectorAll("[data-attendance-review-check]:checked"))
    .map((item) => item.dataset.attendanceReviewCheck)
    .filter(Boolean);
  if (!tokens.length) {
    showInfoMessage("請先勾選簽到紀錄");
    return;
  }
  const reviewed = mode === "reviewed";
  const confirmed = await confirmAction(`確定要將 ${tokens.length} 筆紀錄${reviewed ? "設為已審" : "退回未審"}嗎？`);
  if (!confirmed) return;
  try {
    const result = await window.schedulerApi.setAttendanceReviewed({ tokens, reviewed });
    const pageChanged = applyAttendanceReviewSetResult(tokens, reviewed, result);
    if (pageChanged) await loadAttendanceReview(false);
    renderAll();
    showInfoMessage(reviewed ? "批次審核已完成" : "批次退回已完成");
  } catch (error) {
    showInfoMessage(error.message || "批次審核失敗");
  }
}

function attendanceHistoryActionLabel(value) {
  const labels = {
    clock_in: "上班打卡",
    clock_out: "下班打卡",
    employee_regularHours: "修改上班時數",
    employee_overtimeHours: "修改加班時數",
    employee_note: "修改備註",
    admin_edit: "主管修正",
    reviewed: "設為已審",
    returned: "設為未審",
    unreviewed: "設為未審"
  };
  return labels[String(value || "")] || String(value || "異動紀錄");
}

function attendanceHistoryLocationLabel(location) {
  if (!location || typeof location !== "object") return "未指定";
  return String(location.name || location.departmentId || "未指定");
}

function attendanceHistoryChangeSummary(log = {}) {
  const before = log.before_data && typeof log.before_data === "object" ? log.before_data : {};
  const after = log.after_data && typeof log.after_data === "object" ? log.after_data : {};
  const parts = [];
  if (String(before.clock_in_at || "") !== String(after.clock_in_at || "")) {
    parts.push(`上班 ${before.clock_in_at ? formatClockTime(before.clock_in_at) : "未填"} → ${after.clock_in_at ? formatClockTime(after.clock_in_at) : "未填"}`);
  }
  if (String(before.clock_out_at || "") !== String(after.clock_out_at || "")) {
    parts.push(`下班 ${before.clock_out_at ? formatClockTime(before.clock_out_at) : "未填"} → ${after.clock_out_at ? formatClockTime(after.clock_out_at) : "未填"}`);
  }
  if (attendanceHistoryLocationLabel(before.clock_in_location) !== attendanceHistoryLocationLabel(after.clock_in_location)) {
    parts.push(`上班地點 ${attendanceHistoryLocationLabel(before.clock_in_location)} → ${attendanceHistoryLocationLabel(after.clock_in_location)}`);
  }
  if (attendanceHistoryLocationLabel(before.clock_out_location) !== attendanceHistoryLocationLabel(after.clock_out_location)) {
    parts.push(`下班地點 ${attendanceHistoryLocationLabel(before.clock_out_location)} → ${attendanceHistoryLocationLabel(after.clock_out_location)}`);
  }
  if (before.regular_minutes !== after.regular_minutes) {
    parts.push(`上班時數 ${before.regular_minutes == null ? "未填" : Number(before.regular_minutes) / 60} → ${after.regular_minutes == null ? "未填" : Number(after.regular_minutes) / 60}`);
  }
  if (before.overtime_minutes !== after.overtime_minutes) {
    parts.push(`加班時數 ${before.overtime_minutes == null ? "未填" : Number(before.overtime_minutes) / 60} → ${after.overtime_minutes == null ? "未填" : Number(after.overtime_minutes) / 60}`);
  }
  if (String(before.note || "") !== String(after.note || "")) parts.push("備註已修改");
  return parts.join("；") || "-";
}

async function openAttendanceHistoryModal(recordId) {
  try {
    const result = await window.schedulerApi.getAttendanceHistory(recordId);
    openEntityListModal({
      title: "簽到修改歷程",
      body: `<div class="records-table-wrap"><table class="records-table"><thead><tr><th>時間</th><th>操作</th><th>變更內容</th><th>原因</th><th>操作人</th></tr></thead><tbody>${(result.logs || []).map((log) => `<tr><td>${formatRecordDateTime(log.created_at)}</td><td>${escapeHtml(attendanceHistoryActionLabel(log.action))}</td><td>${escapeHtml(attendanceHistoryChangeSummary(log))}</td><td>${escapeHtml(log.reason || "")}</td><td>${escapeHtml(log.operator_name || "")}</td></tr>`).join("") || '<tr><td colspan="5">沒有歷程</td></tr>'}</tbody></table></div>`
    });
  } catch (error) {
    setSaveStatus(`讀取歷程失敗：${error.message}`);
  }
}

async function exportAttendanceReview() {
  const filters = ensureAttendanceReviewState().filters;
  try {
    setSaveStatus("正在準備已審加班資料...", true);
    const result = await window.schedulerApi.exportAttendanceReview({
      fromDate: filters.fromDate,
      toDate: filters.toDate,
      memberId: filters.memberId
    });
    if (result.empty) showInfoMessage("所選期間沒有已審資料");
    setSaveStatus("");
  } catch (error) {
    setSaveStatus(`匯出加班失敗：${error.message || error}`);
  }
}

async function cancelMealFromRecords() {
  const confirmed = await confirmAction("確定要取消今日整張訂單嗎？");
  if (!confirmed) return;
  try {
    await window.schedulerApi.cancelTodayMealOrder();
    await loadRecordsPage();
    showInfoMessage("今日訂餐已取消");
  } catch (error) {
    showInfoMessage(error.message || "取消訂餐失敗");
  }
}

function readMealAdminProducts() {
  return Array.from(document.querySelectorAll("[data-meal-product-row]")).map((row) => ({
    id: row.querySelector('[data-meal-product-field="id"]')?.value || "",
    name: row.querySelector('[data-meal-product-field="name"]')?.value || "",
    price: Number(row.querySelector('[data-meal-product-field="price"]')?.value || 0),
    isActive: Boolean(row.querySelector('[data-meal-product-field="isActive"]')?.checked),
    is_active: Boolean(row.querySelector('[data-meal-product-field="isActive"]')?.checked)
  })).filter((item) => item.name.trim());
}

function commitMealProductOrderFromDom() {
  recordsState.mealAdmin.products = readMealAdminProducts();
  renderAll();
}

async function deleteMealProduct(button) {
    const row = button.closest("[data-meal-product-row]");
    if (!(row instanceof HTMLTableRowElement)) return;
    const productId = row.querySelector('[data-meal-product-field="id"]')?.value || "";
    const productName = row.querySelector('[data-meal-product-field="name"]')?.value?.trim() || "此品項";
    const rowIndex = Number(row.dataset.mealProductRow || button.dataset.deleteMealProduct || -1);

    if (!productId) {
      if (rowIndex >= 0) recordsState.mealAdmin.products.splice(rowIndex, 1);
      renderAll();
      return;
    }

    const confirmed = await confirmAction(`確定刪除「${productName}」嗎？已有訂餐記錄的品項不能刪除，只能取消啟用。`);
    if (!confirmed) return;
    try {
      await window.schedulerApi.deleteMealProduct(productId);
      await loadMealAdminSettings(false);
      renderAll();
      showInfoMessage("品項已刪除");
    } catch (error) {
      showInfoMessage(error.message || "刪除品項失敗");
    }
  }

async function saveMealSettingsFromPage() {
    const subsidyInput = document.querySelector("[data-meal-company-subsidy]");
    const rawSubsidy = subsidyInput instanceof HTMLInputElement ? subsidyInput.value.trim() : "";
    if (!/^[1-9]\d*$/.test(rawSubsidy)) {
      if (subsidyInput instanceof HTMLInputElement) rejectInput(subsidyInput, null, MEAL_SUBSIDY_ERROR);
      return;
    }
    try {
      await window.schedulerApi.saveMealAdminSettings({
        dailyCutoffTime: document.querySelector("[data-meal-cutoff-time]")?.value || "10:30",
        companySubsidy: Number(rawSubsidy),
        products: readMealAdminProducts()
      });
      await loadMealAdminSettings(false);
      await loadTodayMealOrder();
      showInfoMessage("訂餐設定已儲存");
    } catch (error) {
      setSaveStatus(`訂餐設定儲存失敗：${error.message}`);
    }
  }

/* 簽到審核列印：依目前篩選條件載入全部結果，A4 橫式每頁 40 筆。 */
const ATTENDANCE_REVIEW_PRINT_PAGE_SIZE = 40;
const ATTENDANCE_REVIEW_PRINT_PREVIEW_ID = "attendanceReviewPrintPreview";
const ATTENDANCE_REVIEW_PRINT_STYLE_ID = "attendanceReviewPrintStyles";
const ATTENDANCE_REVIEW_PRINT_PAGE_STYLE_ID = "attendanceReviewPrintPageStyle";

function attendanceReviewPrintChunks(rows, size = ATTENDANCE_REVIEW_PRINT_PAGE_SIZE) {
  const pages = [];
  for (let index = 0; index < rows.length; index += size) pages.push(rows.slice(index, index + size));
  return pages;
}

function attendanceReviewPrintLocation(location) {
  return attendanceLocationName(location);
}

function renderAttendanceReviewPrintClock(row) {
  const clockIn = row.clock_in_at ? formatClockTime(row.clock_in_at) : "-";
  const clockOut = row.clock_out_at ? formatClockTime(row.clock_out_at) : "-";
  const inLocation = attendanceReviewPrintLocation(row.clock_in_location);
  const outLocation = attendanceReviewPrintLocation(row.clock_out_location);
  return `<div class="attendance-review-print-clock">
    <div class="attendance-punch-line"><span>上班 ${escapeHtml(clockIn)}</span>${inLocation ? `<small>${escapeHtml(inLocation)}</small>` : ""}</div>
    <div class="attendance-punch-line"><span>下班 ${escapeHtml(clockOut)}</span>${outLocation ? `<small>${escapeHtml(outLocation)}</small>` : ""}</div>
  </div>`;
}

function renderAttendanceReviewPrintTable(rows) {
  return `<table class="records-table attendance-review-table attendance-review-print-table">
    <colgroup>
      <col class="ar-print-date"><col class="ar-print-employee"><col class="ar-print-icon"><col class="ar-print-shift">
      <col class="ar-print-clock"><col class="ar-print-hours"><col class="ar-print-hours"><col class="ar-print-note">
      <col class="ar-print-issue"><col class="ar-print-status">
    </colgroup>
    <thead><tr><th>日期</th><th>員工</th><th>圖示</th><th>班別</th><th>打卡時間</th><th>上班<br>時數</th><th>加班<br>時數</th><th>備註</th><th>異常</th><th>狀態</th></tr></thead>
    <tbody>${rows.map((row) => `<tr>
      <td><div class="attendance-review-print-cell">${escapeHtml(row.work_date || "")}</div></td>
      <td><div class="attendance-review-print-cell">${escapeHtml(row.employee_name || "")}</div></td>
      <td class="attendance-review-print-icon">${renderScheduleIcon(row)}</td>
      <td><div class="attendance-review-print-cell">${escapeHtml(row.shiftName || "-")}${row.shiftTime ? `<small>${escapeHtml(row.shiftTime)}</small>` : ""}</div></td>
      <td>${renderAttendanceReviewPrintClock(row)}</td>
      <td><div class="attendance-review-print-cell attendance-review-print-center">${row.regularHours === null || row.regularHours === undefined ? "" : escapeHtml(String(row.regularHours))}</div></td>
      <td><div class="attendance-review-print-cell attendance-review-print-center">${row.overtimeHours === null || row.overtimeHours === undefined ? "" : escapeHtml(String(row.overtimeHours))}</div></td>
      <td><div class="attendance-review-print-cell">${escapeHtml(row.note || "")}</div></td>
      <td><div class="attendance-review-print-cell">${escapeHtml((row.issues || []).join("、") || "正常")}</div></td>
      <td class="attendance-review-status-col">${renderReviewStatus(row.reviewed)}</td>
    </tr>`).join("")}</tbody>
  </table>`;
}

function ensureAttendanceReviewPrintStyles() {
  if (document.getElementById(ATTENDANCE_REVIEW_PRINT_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = ATTENDANCE_REVIEW_PRINT_STYLE_ID;
  style.textContent = `
    #${ATTENDANCE_REVIEW_PRINT_PREVIEW_ID}{position:fixed;inset:0;z-index:1300;overflow:auto;background:#e9e5dd;color:#2f2923}
    .attendance-review-print-toolbar{position:sticky;top:0;z-index:3;display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:58px;padding:10px 16px;border-bottom:1px solid #ddd4c7;background:#fffdf8;box-sizing:border-box}
    .attendance-review-print-toolbar>div{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .attendance-review-print-pages{padding:16px}
    .attendance-review-print-page{width:297mm;height:210mm;margin:0 auto 16px;padding:4mm;background:#fff;box-sizing:border-box;overflow:hidden;box-shadow:0 8px 26px #0002}
    .attendance-review-print-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:7px;line-height:1.05}
    .attendance-review-print-table col.ar-print-date{width:18mm}.attendance-review-print-table col.ar-print-employee{width:18mm}.attendance-review-print-table col.ar-print-icon{width:14mm}.attendance-review-print-table col.ar-print-shift{width:21mm}
    .attendance-review-print-table col.ar-print-clock{width:50mm}.attendance-review-print-table col.ar-print-hours{width:13mm}.attendance-review-print-table col.ar-print-note{width:62mm}.attendance-review-print-table col.ar-print-issue{width:45mm}.attendance-review-print-table col.ar-print-status{width:13mm}
    .attendance-review-print-table th,.attendance-review-print-table td{box-sizing:border-box;border:1px solid #d8d0c5;vertical-align:middle;overflow:hidden}
    .attendance-review-print-table th{height:6mm;padding:.2mm .35mm;background:#f7f3ed;text-align:center;font-size:7.2px;font-weight:900;white-space:nowrap}
    .attendance-review-print-table tbody tr,.attendance-review-print-table tbody td{height:4.7mm;max-height:4.7mm}
    .attendance-review-print-table td{padding:.12mm .3mm}
    .attendance-review-print-cell{display:-webkit-box;max-height:4.05mm;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow-wrap:anywhere}
    .attendance-review-print-cell small{display:block;font-size:5.8px;line-height:1.05;color:#5e554d}
    .attendance-review-print-center{text-align:center;-webkit-line-clamp:1;white-space:nowrap}
    .attendance-review-print-clock span{display:block;white-space:nowrap}.attendance-review-print-clock small{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .attendance-review-print-icon{padding:.15mm!important}
    .attendance-review-print-icon .personal-record-schedule-cell{height:4mm!important;min-height:0!important;border-radius:.7mm!important;overflow:hidden}
    .attendance-review-print-icon .seg{min-height:0!important}.attendance-review-print-icon .seg-label{font-size:5.5px!important;line-height:1!important}
    /* 列印版沿用簽到審核頁的表格、色彩與狀態視覺，只壓縮尺寸以維持每頁 40 筆。 */
    .attendance-review-print-page{background:var(--panel);color:var(--text);font-family:"Microsoft JhengHei UI","PingFang TC",sans-serif}
    .attendance-review-print-table{width:100%;min-width:0!important;border-collapse:collapse;table-layout:fixed;color:var(--text);font-size:8px;line-height:1.08;background:transparent}
    .attendance-review-print-table th,.attendance-review-print-table td{height:4.7mm;max-height:4.7mm;padding:.15mm .55mm;border:0;border-bottom:1px solid var(--line);background:transparent;color:var(--text);text-align:center;vertical-align:middle;font-size:8px}
    .attendance-review-print-table th{height:6mm;max-height:6mm;color:var(--muted);font-weight:800;background:rgba(248,243,231,.72);white-space:nowrap}
    .attendance-review-print-table .attendance-review-print-cell{max-height:4.05mm;line-height:1.08}
    .attendance-review-print-table .attendance-review-print-cell small{color:var(--muted);font-size:6.5px}
    .attendance-review-print-table .attendance-review-print-clock{display:flex;flex-direction:column;justify-content:center;gap:0;max-height:4.15mm;overflow:hidden;line-height:1.02}
    .attendance-review-print-table .attendance-punch-line{display:flex;align-items:center;justify-content:center;gap:1mm;min-width:0;white-space:nowrap;font-size:7px;line-height:1.02}
    .attendance-review-print-table .attendance-punch-line small{display:block;max-width:23mm;overflow:hidden;color:var(--muted);font-size:6px;line-height:1.02;text-overflow:ellipsis;white-space:nowrap}
    .attendance-review-print-table .attendance-review-status{min-width:10mm;padding:.15mm 1mm;border-radius:999px;font-size:6.5px;line-height:1.15;font-weight:700}
    .attendance-review-print-table .attendance-review-status.is-unreviewed{background:#fff4d6;color:#8a5a00;border:1px solid #efc66a}
    .attendance-review-print-table .attendance-review-status.is-reviewed{background:#e8f7ef;color:#176b45;border:1px solid #8bc9aa}
    .attendance-review-print-table .attendance-review-status-col{text-align:center}
    @media(max-width:760px){.attendance-review-print-toolbar{align-items:flex-start;flex-direction:column}.attendance-review-print-pages{padding:8px}.attendance-review-print-page{margin-left:0;margin-right:0}}
    @media print{
      html,body{background:#fff!important}
      body.attendance-review-printing>*:not(#${ATTENDANCE_REVIEW_PRINT_PREVIEW_ID}){display:none!important}
      body.attendance-review-printing #${ATTENDANCE_REVIEW_PRINT_PREVIEW_ID}{position:static;overflow:visible;background:#fff}
      body.attendance-review-printing .attendance-review-print-toolbar{display:none!important}
      body.attendance-review-printing .attendance-review-print-pages{padding:0}
      body.attendance-review-printing .attendance-review-print-page{margin:0;box-shadow:none;break-after:page;page-break-after:always;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      body.attendance-review-printing .attendance-review-print-page:last-child{break-after:auto;page-break-after:auto}
    }
  `;
  document.head.appendChild(style);
}

async function loadAllAttendanceReviewPrintRows(filters) {
  const first = await window.schedulerApi.getAttendanceReviewList({ ...filters, page: 1 });
  const total = Math.max(0, Number(first.total || 0));
  const pageSize = Math.max(1, Number(first.pageSize || 50));
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const rows = Array.isArray(first.rows) ? [...first.rows] : [];
  for (let page = 2; page <= pageCount; page += 1) {
    const result = await window.schedulerApi.getAttendanceReviewList({ ...filters, page });
    if (Array.isArray(result.rows)) rows.push(...result.rows);
  }
  return rows.slice(0, total);
}

function closeAttendanceReviewPrintPreview() {
  document.getElementById(ATTENDANCE_REVIEW_PRINT_PREVIEW_ID)?.remove();
  document.body.classList.remove("attendance-review-printing");
}

function openAttendanceReviewPrintPreview(rows, filters) {
  ensureAttendanceReviewPrintStyles();
  closeAttendanceReviewPrintPreview();
  const root = document.createElement("section");
  root.id = ATTENDANCE_REVIEW_PRINT_PREVIEW_ID;
  const pages = attendanceReviewPrintChunks(rows);
  root.innerHTML = `<div class="attendance-review-print-toolbar">
    <div><strong>簽到審核列印預覽</strong><span>${escapeHtml(filters.fromDate || "")} ～ ${escapeHtml(filters.toDate || "")}</span><span>共 ${rows.length} 筆</span></div>
    <div><span style="font-weight:800">A4 橫式</span><button class="ghost-btn" type="button" data-attendance-review-print-close>返回</button><button class="primary-btn" type="button" data-attendance-review-print-now>列印</button></div>
  </div><div class="attendance-review-print-pages">${pages.map((pageRows) => `<section class="attendance-review-print-page">${renderAttendanceReviewPrintTable(pageRows)}</section>`).join("")}</div>`;
  document.body.appendChild(root);
  root.querySelector("[data-attendance-review-print-close]")?.addEventListener("click", closeAttendanceReviewPrintPreview);
  root.querySelector("[data-attendance-review-print-now]")?.addEventListener("click", () => {
    let pageStyle = document.getElementById(ATTENDANCE_REVIEW_PRINT_PAGE_STYLE_ID);
    if (!pageStyle) {
      pageStyle = document.createElement("style");
      pageStyle.id = ATTENDANCE_REVIEW_PRINT_PAGE_STYLE_ID;
      document.head.appendChild(pageStyle);
    }
    pageStyle.textContent = "@page{size:A4 landscape;margin:0}";
    document.body.classList.add("attendance-review-printing");
    window.addEventListener("afterprint", () => document.body.classList.remove("attendance-review-printing"), { once: true });
    requestAnimationFrame(() => window.print());
  });
}

async function printAttendanceReview(button) {
  if (!hasPermission("attendance_review")) {
    showInfoMessage("沒有簽到審核權限");
    return;
  }
  const review = ensureAttendanceReviewState();
  if (review.loading) {
    showInfoMessage("簽到審核資料仍在載入中");
    return;
  }
  const filters = { ...review.filters };
  const originalText = button?.textContent || "列印";
  if (button) {
    button.disabled = true;
    button.textContent = "準備列印…";
  }
  try {
    const rows = await loadAllAttendanceReviewPrintRows(filters);
    if (!rows.length) {
      showInfoMessage("目前篩選條件沒有可列印資料");
      return;
    }
    openAttendanceReviewPrintPreview(rows, filters);
  } catch (error) {
    showInfoMessage(`準備簽到審核列印失敗：${error?.message || error}`);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}
