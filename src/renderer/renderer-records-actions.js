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
  const groupId = String(row?.groupId || "");
  const currentId = String(location?.departmentId || "");
  const currentName = String(location?.name || "");
  const departments = (review.departments || [])
    .filter((department) => !groupId || String(department.group_id || department.groupId || "") === groupId)
    .map((department) => ({ id: String(department.id || ""), name: String(department.name || "") }))
    .filter((department) => department.id);
  if (currentId && !departments.some((department) => department.id === currentId)) {
    departments.unshift({ id: currentId, name: currentName || "目前打卡地點" });
  }
  const emptyLabel = currentName && !currentId ? `保留目前地點（${currentName}）` : "管理員補登";
  return `<option value="" ${!currentId ? "selected" : ""}>${escapeHtml(emptyLabel)}</option>${departments
    .map((department) => `<option value="${escapeHtml(department.id)}" ${department.id === currentId ? "selected" : ""}>${escapeHtml(department.name || department.id)}</option>`)
    .join("")}`;
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
