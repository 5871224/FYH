/* 記錄頁、訂餐統計、加班審核、打卡管理與訂餐設定畫面。
 * 由 renderer.js 拆分；不變更查詢、審核或儲存流程。
 */

function formatRecordDateTime(value) {
  return value ? formatClockTime(value) : "-";
}

function renderHomeIconButton() {
  return `<button class="settings-icon-btn page-home-btn" type="button" data-home-action="home" aria-label="返回首頁" title="返回首頁"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg></button>`;
}

function renderRecordsTabs() {
  const tabs = [
    ["personal", "個人記錄", true],
    ["overtime", "加班審核", isAdmin()],
    ["attendance", "打卡管理", isAdmin()]
  ].filter((tab) => tab[2]);
  if (!tabs.some((tab) => tab[0] === recordsState.activeTab)) recordsState.activeTab = "personal";
  return `<div class="record-tabs">${tabs.map(([id, label]) => `<button class="ghost-btn compact-btn ${recordsState.activeTab === id ? "active" : ""}" type="button" data-records-tab="${id}">${label}</button>`).join("")}</div>`;
}

function memberOptions(selectedValue, members = state.members) {
  return `<option value="">全部人員</option>${(members || []).map((member) => `<option value="${escapeHtml(member.id)}" ${selectedValue === member.id ? "selected" : ""}>${escapeHtml(member.full_name || member.name || member.employee_code || member.code || "")}</option>`).join("")}`;
}

function departmentOptions(selectedValue) {
  return `<option value="">全部單位</option>${state.departments.map((department) => `<option value="${escapeHtml(department.id)}" ${selectedValue === department.id ? "selected" : ""}>${escapeHtml(department.name)}</option>`).join("")}`;
}

function renderPersonalRecordsSection() {
  return `<section class="records-section"><h2>個人記錄</h2><div class="records-table-wrap"><table class="records-table"><thead><tr><th>日期</th><th>班別</th><th>上班</th><th>下班</th><th>加班</th><th>訂餐</th></tr></thead><tbody>${recordsState.personal.map((record) => `<tr><td>${escapeHtml(record.date || "")}</td><td>${escapeHtml(record.shiftName || "-")}<br><span>${escapeHtml(record.shiftTime || "")}</span></td><td>${formatRecordDateTime(record.clockIn)}<br><span>${escapeHtml(record.clockInDepartment || "")}</span></td><td>${formatRecordDateTime(record.clockOut)}<br><span>${escapeHtml(record.clockOutDepartment || "")}</span></td><td>${escapeHtml(getOvertimeStatusLabel(record.overtimeStatus || ""))}<br><span>${Number(record.overtimeHours || 0)} 小時</span></td><td>${escapeHtml(record.mealText || "-")}</td></tr>`).join("") || '<tr><td colspan="6">沒有資料</td></tr>'}</tbody></table></div></section>`;
}

function renderMealReportSection() {
  const report = recordsState.mealStats || {};
  const filters = recordsState.mealFilters;
  return `<section class="records-section"><h2>訂餐統計</h2><div class="records-filter-row"><input type="date" value="${escapeHtml(filters.fromDate)}" data-meal-report-filter="fromDate"><input type="date" value="${escapeHtml(filters.toDate)}" data-meal-report-filter="toDate"><select data-meal-report-filter="departmentId">${departmentOptions(filters.departmentId)}</select><select data-meal-report-filter="memberId">${memberOptions(filters.memberId)}</select><button class="primary-btn compact-btn" type="button" data-load-meal-report="true">查詢</button><button class="ghost-btn compact-btn" type="button" data-export-meal-report="true">匯出</button></div>${report.error ? `<div class="auth-error">${escapeHtml(report.error)}</div>` : ""}<div class="meal-stats-grid"><div><strong>${Number(report.totals?.quantity || 0)}</strong><span>期間總數量</span></div><div><strong>$${Number(report.totals?.amount || 0).toFixed(0)}</strong><span>期間總金額</span></div></div><div class="records-table-wrap"><table class="records-table"><thead><tr><th>日期</th><th>單位</th><th>員工</th><th>品項</th><th>數量</th><th>小計</th><th>備註</th></tr></thead><tbody>${(report.details || []).map((row) => `<tr><td>${escapeHtml(row.date || "")}</td><td>${escapeHtml(row.departmentName || "")}</td><td>${escapeHtml(row.employeeName || "")}</td><td>${escapeHtml(row.productName || "")}</td><td>${Number(row.quantity || 0)}</td><td>$${Number(row.amount || 0).toFixed(0)}</td><td>${escapeHtml(row.note || "")}</td></tr>`).join("") || '<tr><td colspan="7">沒有訂餐資料</td></tr>'}</tbody></table></div></section>`;
}

function renderOvertimeReviewSection() {
  const review = recordsState.overtimeReview;
  const filters = review.filters;
  return `<section class="records-section"><h2>加班審核</h2><div class="records-filter-row"><input type="date" value="${escapeHtml(filters.fromDate || "")}" data-overtime-review-filter="fromDate"><input type="date" value="${escapeHtml(filters.toDate || "")}" data-overtime-review-filter="toDate"><select data-overtime-review-filter="status"><option value="pending" ${filters.status === "pending" ? "selected" : ""}>待審</option><option value="approved" ${filters.status === "approved" ? "selected" : ""}>核准</option><option value="returned" ${filters.status === "returned" ? "selected" : ""}>退回</option><option value="all" ${filters.status === "all" ? "selected" : ""}>全部</option></select><button class="primary-btn compact-btn" type="button" data-load-overtime-review="true">查詢</button><button class="ghost-btn compact-btn" type="button" data-open-admin-overtime-create="true">代為申請</button></div>${review.error ? `<div class="auth-error">${escapeHtml(review.error)}</div>` : ""}<div class="records-table-wrap"><table class="records-table"><thead><tr><th>日期</th><th>員工</th><th>狀態</th><th>提早</th><th>延後</th><th>合計</th><th>備註</th><th>操作</th></tr></thead><tbody>${review.requests.map((row) => `<tr><td>${escapeHtml(row.work_date || "")}${row.attendance_changed_warning ? "<br><span>打卡時間已異動</span>" : ""}</td><td>${escapeHtml(row.employee?.full_name || "")}</td><td>${escapeHtml(getOvertimeStatusLabel(row.status || ""))}</td><td>${Number(row.early_overtime_hours || 0)}</td><td>${Number(row.late_overtime_hours || 0)}</td><td>${Number(row.total_overtime_hours || 0)}</td><td>${escapeHtml(row.employee_note || "")}</td><td><button class="ghost-btn compact-btn" type="button" data-open-overtime-review="${escapeHtml(row.id)}">調整</button><button class="primary-btn compact-btn" type="button" data-approve-overtime="${escapeHtml(row.id)}">核准</button><button class="ghost-btn compact-btn" type="button" data-return-overtime="${escapeHtml(row.id)}">退回</button></td></tr>`).join("") || '<tr><td colspan="8">沒有資料</td></tr>'}</tbody></table></div></section>`;
}

function renderAttendanceAdminSection() {
  const admin = recordsState.attendanceAdmin;
  const filters = admin.filters;
  return `<section class="records-section"><h2>打卡管理</h2><div class="records-admin-toolbar attendance-admin-toolbar"><div class="records-admin-filters attendance-admin-filters"><label class="records-admin-field"><span>開始日期</span><input type="date" value="${escapeHtml(filters.fromDate)}" data-attendance-filter="fromDate"></label><label class="records-admin-field"><span>結束日期</span><input type="date" value="${escapeHtml(filters.toDate)}" data-attendance-filter="toDate"></label><label class="records-admin-field"><span>人員</span><select data-attendance-filter="memberId">${memberOptions(filters.memberId, admin.members)}</select></label><label class="records-admin-field"><span>異常類型</span><select data-attendance-filter="issueType"><option value="__all__" ${filters.abnormalOnly ? "" : "selected"}>全部顯示</option><option value="" ${filters.abnormalOnly && !filters.issueType ? "selected" : ""}>全部異常</option>${admin.issueTypes.map((type) => `<option value="${escapeHtml(type)}" ${filters.issueType === type ? "selected" : ""}>${escapeHtml(type)}</option>`).join("")}</select></label></div></div>${admin.error ? `<div class="auth-error">${escapeHtml(admin.error)}</div>` : ""}<div class="records-table-wrap"><table class="records-table"><thead><tr><th>日期</th><th>員工</th><th>班別</th><th>上班</th><th>下班</th><th>異常</th><th>備註</th><th>操作</th></tr></thead><tbody>${admin.rows.map((row) => `<tr><td>${escapeHtml(row.work_date || "")}</td><td>${escapeHtml(row.employee_name_snapshot || "")}<br><span>${escapeHtml(row.employee_code_snapshot || "")}</span></td><td>${escapeHtml(row.shift_name || "-")}<br><span>${escapeHtml(`${String(row.shift_start_time || "").slice(0, 5)}-${String(row.shift_end_time || "").slice(0, 5)}`)}</span></td><td>${formatRecordDateTime(row.clock_in_at)}<br><span>${escapeHtml(row.clock_in_department_name_snapshot || "")}</span></td><td>${formatRecordDateTime(row.clock_out_at)}<br><span>${escapeHtml(row.clock_out_department_name_snapshot || "")}</span></td><td>${escapeHtml((row.issues || []).join("、") || "正常")}</td><td>${escapeHtml(row.attendance_note || "")}</td><td><button class="ghost-btn compact-btn" type="button" data-edit-attendance="${escapeHtml(row.user_id)}:${escapeHtml(row.work_date)}:${escapeHtml(row.id || "")}">編輯</button>${row.id ? `<button class="ghost-btn compact-btn" type="button" data-view-attendance-history="${escapeHtml(row.id)}">歷程</button>` : ""}</td></tr>`).join("") || '<tr><td colspan="8">沒有資料</td></tr>'}</tbody></table></div><p class="home-subtitle">共 ${Number(admin.total || 0)} 筆，第 ${Number(admin.page || 1)} 頁</p></section>`;
}

function renderMealSettingsSection() {
  const mealAdmin = recordsState.mealAdmin;
  return `<section class="records-section"><h2>訂餐設定</h2><div class="records-filter-row"><label>訂餐截止時間 <input type="time" value="${escapeHtml(String(mealAdmin.settings?.daily_cutoff_time || "10:30").slice(0, 5))}" data-meal-cutoff-time></label><button class="ghost-btn compact-btn" type="button" data-add-meal-product="true">新增商品</button><button class="primary-btn compact-btn" type="button" data-save-meal-settings="true">儲存</button></div>${mealAdmin.error ? `<div class="auth-error">${escapeHtml(mealAdmin.error)}</div>` : ""}<div class="meal-settings-table-wrap"><table class="meal-settings-table"><thead><tr><th class="meal-settings-drag-col"></th><th>品項</th><th class="meal-settings-price-col">價格</th><th class="meal-settings-active-col">啟用</th></tr></thead><tbody>${mealAdmin.products.map((product, index) => `<tr draggable="true" data-meal-product-row="${index}"><td class="meal-settings-drag-col"><span class="meal-drag-handle" title="拖曳排序">≡</span></td><td><input type="text" value="${escapeHtml(product.name || "")}" data-meal-product-field="name"></td><td><input type="number" min="0" step="1" value="${escapeHtml(String(product.price || 0))}" data-meal-product-field="price"></td><td><input type="checkbox" ${product.is_active !== false ? "checked" : ""} data-meal-product-field="isActive"><input type="hidden" value="${escapeHtml(product.id || "")}" data-meal-product-field="id"></td></tr>`).join("") || '<tr><td colspan="4">尚無商品</td></tr>'}</tbody></table></div></section>`;
}
