window.SCHEDULER_CONFIG = {
  supabaseUrl: "https://crxxkazdgsaqwqrppbhy.supabase.co",
  supabaseAnonKey: "sb_publishable_t4QuCEqPIF_q2YO9VYa0QA_z7S3JFt7",
  documentId: "default"
};

// Compatibility for the currently published Supabase bundle.
// The generated app bundle does not persist schedule-table drag order itself,
// so these wrappers write the resulting order through reorderSettings().
(function installPublishedScheduleOrderPersistence() {
  if (typeof document === "undefined") {
    return;
  }

  function install() {
    if (!window.schedulerApi?.reorderSettings || typeof window.getSortableSettingsList !== "function") {
      return;
    }

    const wrap = (functionName, category, label) => {
      const original = window[functionName];
      if (typeof original !== "function" || original.__fyhPersistsOrder) {
        return;
      }

      const wrapped = async function (...args) {
        const changed = await original.apply(this, args);
        if (!changed) {
          return changed;
        }
        try {
          const items = window.getSortableSettingsList(category) || [];
          const orderedIds = items
            .filter((item) => !item.deleted)
            .map((item) => item.id)
            .filter(Boolean);
          if (orderedIds.length) {
            await window.schedulerApi.reorderSettings(category, orderedIds);
          }
        } catch (error) {
          window.setSaveStatus?.(`${label}：${error?.message || error}`);
        }
        return changed;
      };
      wrapped.__fyhPersistsOrder = true;
      window[functionName] = wrapped;
    };

    wrap("reorderScheduleTableDepartment", "department", "單位排序儲存失敗");
    wrap("reorderScheduleTableMember", "member", "人員排序儲存失敗");
  }

  if (document.readyState === "complete") {
    install();
  } else {
    window.addEventListener("load", install, { once: true });
  }
})();

// 班表列印：功能選單 -> 日期區間 -> 預覽 -> 瀏覽器列印。
// 格內容沿用正式班表 renderer，維持班別、假別、加班既有文字與顏色。
(function installSchedulePrintFeature() {
  if (typeof document === "undefined") return;

  const BUTTON_ID = "schedulePrintMenuButton";
  const PREVIEW_ID = "schedulePrintPreview";
  const STYLE_ID = "schedulePrintStyles";
  const PAGE_STYLE_ID = "schedulePrintPageStyle";
  const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
  let preview = null;
  let installed = false;

  function canPrint() {
    try {
      if (typeof appView === "undefined" || appView !== "schedule") return false;
      return Boolean(hasPermission("schedule_manage") && roleAppliesToGroup(groupFeatureState.currentGroupId));
    } catch { return false; }
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .schedule-print-range-card{width:min(430px,calc(100vw - 32px));padding:20px;border-radius:22px;overflow:auto}
      .schedule-print-range-card h2{margin:0;font-size:22px}.schedule-print-range-help{margin:7px 0 18px;color:var(--muted);font-size:13px}
      .schedule-print-range-fields{display:grid;gap:14px}.schedule-print-range-field{display:grid;gap:6px}.schedule-print-range-field label{font-weight:800;font-size:13px}
      .schedule-print-range-field input{width:100%;min-height:42px;box-sizing:border-box;padding:8px 10px;border:1px solid var(--line);border-radius:12px;background:#fff;color:var(--text)}
      .schedule-print-range-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:20px}
      #${PREVIEW_ID}{position:fixed;inset:0;z-index:1200;overflow:auto;background:#e9e5dd;color:var(--text)}
      .schedule-print-preview-toolbar{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:60px;padding:10px 16px;border-bottom:1px solid var(--line);background:#fffdf8;box-sizing:border-box}
      .schedule-print-preview-toolbar>div{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.schedule-print-preview-toolbar select{min-height:38px;padding:6px 10px;border:1px solid var(--line);border-radius:12px;background:#fff}
      .schedule-print-pages{padding:16px}.schedule-print-page{margin:0 auto 16px;padding:4mm;background:#fff;box-shadow:0 8px 26px #0002;box-sizing:border-box;overflow:hidden}
      .schedule-print-page[data-orientation="portrait"]{width:210mm;height:297mm;min-height:0;max-height:297mm}.schedule-print-page[data-orientation="landscape"]{width:297mm;height:210mm;min-height:0;max-height:210mm}
      .schedule-print-page-header{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:5mm}.schedule-print-page-header h2{margin:0;font-size:17px}.schedule-print-page-header p{margin:0;color:#665c51;font-size:10px}
      .schedule-print-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:8px}.schedule-print-table col:first-child{width:14mm}.schedule-print-table col:nth-child(2){width:17mm}
      .schedule-print-table th,.schedule-print-table td{border:1px solid var(--schedule-grid-line,#ebe3d8);vertical-align:middle}.schedule-print-table th{height:7.5mm;padding:.6mm;background:var(--schedule-header-bg,#fbf8f1);text-align:center;font-weight:900}.schedule-print-table th span{display:block;font-size:7px;color:#76695b}
      .schedule-print-table .dept-col,.schedule-print-table .person-col{position:static!important;min-width:0!important;width:auto!important;max-width:none!important;padding:1mm .7mm;background:#fffdf8;text-align:center;font-size:8px;line-height:1.2}.schedule-print-table .dept-col{font-weight:900}.schedule-print-table .person-col{font-weight:800}
      .schedule-print-table .cell{min-width:0!important;width:auto!important;max-width:none!important;height:8.5mm;padding:.3mm;cursor:default;background:#fff}.schedule-print-table .cell-inner{min-height:7.6mm;height:7.6mm;border-radius:1.2mm}.schedule-print-table .seg{min-height:0}.schedule-print-table .seg-label{font-size:7px;line-height:1.05}
      .schedule-print-table .inactive-cell,.schedule-print-table .inactive-cell .cell-inner{background:#9b9b9b!important}.schedule-print-weekend,.schedule-print-holiday{background:#f5e9e3!important}
      @media(max-width:760px){.schedule-print-preview-toolbar{align-items:flex-start;flex-direction:column}.schedule-print-pages{padding:10px}.schedule-print-page{margin-left:0;margin-right:0}}
      @media print{html,body{background:#fff!important}body.schedule-printing>*:not(#${PREVIEW_ID}){display:none!important}body.schedule-printing #${PREVIEW_ID}{position:static;overflow:visible;background:#fff}body.schedule-printing .schedule-print-preview-toolbar{display:none!important}body.schedule-printing .schedule-print-pages{padding:0}body.schedule-printing .schedule-print-page{margin:0;box-shadow:none;break-after:page;page-break-after:always;-webkit-print-color-adjust:exact;print-color-adjust:exact}body.schedule-printing .schedule-print-page:last-child{break-after:auto;page-break-after:auto}}
    `;
    document.head.appendChild(style);
  }

  function ensureMenuButton() {
    const menu = document.getElementById("coreActionsMenu");
    if (!menu) return;
    let button = document.getElementById(BUTTON_ID);
    if (!button) {
      button = document.createElement("button");
      button.id = BUTTON_ID;
      button.type = "button";
      button.className = "ghost-btn ops-btn";
      button.textContent = "列印班表";
    }
    const exportSubmenu = menu.querySelector('.core-actions-submenu[aria-label="匯出"]');
    if (exportSubmenu && button.parentElement !== exportSubmenu) {
      const overtimeButton = document.getElementById("exportOvertimeButton");
      if (overtimeButton?.parentElement === exportSubmenu) {
        overtimeButton.insertAdjacentElement("beforebegin", button);
      } else {
        exportSubmenu.appendChild(button);
      }
    } else if (!exportSubmenu && !button.isConnected) {
      menu.prepend(button);
    }
    const visible = canPrint();
    button.style.display = visible ? "" : "none";
    button.disabled = !visible;
  }

  function overlap(item, startDate, endDate) {
    const start = item?.hireDate || item?.startDate || "";
    const end = item?.leaveDate || item?.endDate || "";
    return (!start || start <= endDate) && (!end || end >= startDate);
  }

  function candidateGroups(startDate, endDate) {
    const groupId = groupFeatureState.currentGroupId;
    return state.departments
      .filter((dept) => !dept.deleted && !dept.hiddenFromSchedule && (!groupId || !dept.groupId || dept.groupId === groupId) && overlap(dept, startDate, endDate))
      .map((department) => ({
        department,
        members: state.members.filter((member) => !member.deleted && member.deptId === department.id && (!groupId || !member.groupId || member.groupId === groupId) && overlap(member, startDate, endDate))
      }));
  }

  function scopeGroups(groups, dates, schedule) {
    const scope = state.tableDeptScopeFilter || "all";
    if (scope === "all") return groups;
    return groups.map(({ department, members }) => ({
      department,
      members: members.filter((member) => {
        if (member.deptId === scope) return true;
        return dates.some((dateString) => {
          if (!isMemberActiveOnDateString(member, dateString)) return false;
          const key = getScheduleKeyForDateString(member.id, dateString);
          const shift = getItem("shift", schedule?.[key]?.shift);
          return Boolean(shift && shiftAllowsDepartment(shift, scope));
        });
      })
    })).filter(({ members }) => members.length);
  }

  function splitRows(groups, maxRows) {
    const pages = [];
    let page = [];
    let rows = 0;
    const flush = () => { if (page.length) pages.push(page); page = []; rows = 0; };
    for (const { department, members } of groups) {
      if (!members.length) {
        if (rows >= maxRows) flush();
        page.push({ department, members: [] }); rows += 1; continue;
      }
      for (let i = 0; i < members.length;) {
        if (rows >= maxRows) flush();
        const take = Math.min(maxRows - rows, members.length - i);
        page.push({ department, members: members.slice(i, i + take) });
        rows += take; i += take;
      }
    }
    flush();
    return pages.length ? pages : [[]];
  }

  function chunks(items, size) {
    const result = [];
    for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
    return result.length ? result : [[]];
  }

  function orientation() {
    if (preview.orientationMode !== "auto") return preview.orientationMode;
    return preview.dates.length <= 14 ? "portrait" : "landscape";
  }

  function dateHeader(dateString) {
    const date = toDateObject(dateString);
    return `${date.getMonth() + 1}/${date.getDate()}<span>${WEEKDAYS[date.getDay()]}</span>`;
  }

  function renderTable(dates, groups) {
    let html = '<table class="schedule-print-table"><colgroup><col><col>' + dates.map(() => '<col>').join("") + '</colgroup><thead><tr><th>單位</th><th>姓名</th>';
    html += dates.map((dateString) => {
      const date = toDateObject(dateString);
      const special = state.holidays.some((holiday) => holiday.date === dateString) || date.getDay() === 0 || date.getDay() === 6;
      return `<th class="${special ? "schedule-print-weekend" : ""}">${dateHeader(dateString)}</th>`;
    }).join("") + '</tr></thead><tbody>';
    if (!groups.length) html += `<tr><td colspan="${dates.length + 2}" style="text-align:center;height:10mm">目前沒有符合範圍的人員</td></tr>`;
    for (const { department, members } of groups) {
      if (!members.length) {
        html += `<tr><td class="dept-col">${escapeHtml(department.name)}</td><td class="person-col"></td>${dates.map(() => '<td class="cell inactive-cell"><div class="cell-inner"></div></td>').join("")}</tr>`;
        continue;
      }
      members.forEach((member, index) => {
        html += `<tr>${index === 0 ? `<td class="dept-col" rowspan="${members.length}">${escapeHtml(department.name)}</td>` : ""}<td class="person-col"><div class="member-label">${memberLabel(member)}</div></td>`;
        for (const dateString of dates) {
          if (!isMemberActiveOnDateString(member, dateString)) {
            html += '<td class="cell inactive-cell"><div class="cell-inner"></div></td>'; continue;
          }
          const key = getScheduleKeyForDateString(member.id, dateString);
          html += `<td class="cell">${renderCellInner(key, member.id, dateString, preview.schedule?.[key] || null, true)}</td>`;
        }
        html += '</tr>';
      });
    }
    return html + '</tbody></table>';
  }

  function renderPages() {
    const root = document.querySelector(`#${PREVIEW_ID} .schedule-print-pages`);
    if (!root || !preview) return;
    const mode = orientation();
    const datePages = chunks(preview.dates, mode === "portrait" ? 14 : 31);
    const rowPages = splitRows(preview.groups, mode === "portrait" ? 32 : 22);
    root.innerHTML = datePages.flatMap((datePage) => rowPages.map((rowPage) => `<section class="schedule-print-page" data-orientation="${mode}">${renderTable(datePage, rowPage)}</section>`)).join("");
  }

  async function loadRange(startDate, endDate) {
    const groups = candidateGroups(startDate, endDate);
    const members = [...new Map(groups.flatMap((group) => group.members.map((member) => [member.id, member]))).values()];
    if (!members.length) return { groups, schedule: {} };
    const payload = await window.schedulerApi.loadScheduleEntries({ startDate, endDate, members: members.map(({ id }) => ({ id })) });
    const raw = payload?.schedule && typeof payload.schedule === "object" ? payload.schedule : {};
    return { groups, schedule: cleanupScheduleEntries(raw, state) };
  }

  function openPreview(startDate, endDate, groups, schedule) {
    const dates = enumerateDateRange(startDate, endDate);
    const group = getCurrentGroup();
    preview = { dates, groups: scopeGroups(groups, dates, schedule), schedule, groupName: group?.name || "福圓號", orientationMode: "auto" };
    closeModal();
    document.getElementById(PREVIEW_ID)?.remove();
    const root = document.createElement("section");
    root.id = PREVIEW_ID;
    root.innerHTML = `<div class="schedule-print-preview-toolbar"><div><strong>班表列印預覽</strong><span>${startDate} ～ ${endDate}</span></div><div><span style="font-weight:800">A4</span><label>方向 <select id="schedulePrintOrientation"><option value="auto">自動</option><option value="portrait">直式</option><option value="landscape">橫式</option></select></label><button class="ghost-btn" type="button" data-print-close>返回</button><button class="primary-btn" type="button" data-print-now>列印</button></div></div><div class="schedule-print-pages"></div>`;
    document.body.appendChild(root);
    renderPages();
  }

  function openRangeDialog() {
    if (!canPrint()) { showInfoMessage("沒有班表管理權限"); return; }
    closeCoreActionsMenu();
    const range = getVisibleDateRange();
    setModal(`<div class="modal-overlay"><section class="modal schedule-print-range-card" role="dialog" aria-modal="true"><h2>列印班表</h2><p class="schedule-print-range-help">請先選擇要列印的日期區間。</p><div class="schedule-print-range-fields"><div class="schedule-print-range-field"><label for="schedulePrintStartDate">開始日期</label><input id="schedulePrintStartDate" type="date" value="${escapeHtml(range.startDate)}"></div><div class="schedule-print-range-field"><label for="schedulePrintEndDate">結束日期</label><input id="schedulePrintEndDate" type="date" value="${escapeHtml(range.endDate)}"></div></div><div class="schedule-print-range-actions"><button class="ghost-btn" type="button" data-print-range-cancel>取消</button><button class="primary-btn" type="button" data-print-range-confirm>預覽列印</button></div></section></div>`);
  }

  async function confirmRange(button) {
    const startDate = document.getElementById("schedulePrintStartDate")?.value || "";
    const endDate = document.getElementById("schedulePrintEndDate")?.value || "";
    if (!toDateObject(startDate) || !toDateObject(endDate) || startDate > endDate) { showInfoMessage("請選擇正確的開始日期與結束日期"); return; }
    const text = button.textContent; button.disabled = true; button.textContent = "載入中…";
    try {
      const { groups, schedule } = await loadRange(startDate, endDate);
      openPreview(startDate, endDate, groups, schedule);
    } catch (error) {
      showInfoMessage(`載入列印班表失敗：${error?.message || error}`);
      button.disabled = false; button.textContent = text;
    }
  }

  function doPrint() {
    const mode = orientation();
    let style = document.getElementById(PAGE_STYLE_ID);
    if (!style) { style = document.createElement("style"); style.id = PAGE_STYLE_ID; document.head.appendChild(style); }
    style.textContent = `@page{size:A4 ${mode};margin:0}`;
    document.body.classList.add("schedule-printing");
    requestAnimationFrame(() => window.print());
  }

  function install() {
    if (installed) { ensureMenuButton(); return; }
    if (!window.schedulerApi || typeof setModal !== "function" || typeof renderCellInner !== "function") { setTimeout(install, 50); return; }
    installed = true; ensureStyles(); ensureMenuButton();
    const menu = document.getElementById("coreActionsMenu");
    if (menu) new MutationObserver(ensureMenuButton).observe(menu, { childList: true });
    document.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (target.closest(`#${BUTTON_ID}`)) { event.preventDefault(); openRangeDialog(); return; }
      if (target.closest("#coreActionsToggle")) { queueMicrotask(ensureMenuButton); return; }
      if (target.closest("[data-print-range-cancel]")) { closeModal(); return; }
      const confirm = target.closest("[data-print-range-confirm]");
      if (confirm instanceof HTMLButtonElement) { void confirmRange(confirm); return; }
      if (target.closest("[data-print-close]")) { document.getElementById(PREVIEW_ID)?.remove(); preview = null; return; }
      if (target.closest("[data-print-now]")) doPrint();
    }, true);
    document.addEventListener("change", (event) => {
      if (!(event.target instanceof HTMLSelectElement) || event.target.id !== "schedulePrintOrientation" || !preview) return;
      preview.orientationMode = event.target.value; renderPages();
    });
    window.addEventListener("afterprint", () => document.body.classList.remove("schedule-printing"));
  }

  if (document.readyState === "complete") install();
  else window.addEventListener("load", install, { once: true });
})();

// 匯出請假 Excel：第一欄加入姓名，原有欄位依序向後移。
(function installLeaveExportNameColumn() {
  if (typeof document === "undefined") return;

  function install() {
    const exporter = window.schedulerBrowserExporter;
    if (!exporter?.createLeaveWorkbook || exporter.createLeaveWorkbook.__fyhIncludesEmployeeName) {
      return;
    }

    const originalCreateLeaveWorkbook = exporter.createLeaveWorkbook.bind(exporter);
    const wrapped = async (payload) => {
      const workbook = await originalCreateLeaveWorkbook(payload);
      const sheet = workbook.getWorksheet("匯出請假") || workbook.worksheets?.[0];
      if (!sheet) return workbook;

      const nameByEmployeeCode = new Map(
        (Array.isArray(payload?.exportRows) ? payload.exportRows : []).map((row) => [
          String(row.employee_code || ""),
          String(row.employee_name || "")
        ])
      );

      sheet.eachRow((row, rowNumber) => {
        const employeeCode = rowNumber === 1 ? "" : String(row.getCell(1).value || "");
        row.splice(1, 0, rowNumber === 1 ? "姓名" : (nameByEmployeeCode.get(employeeCode) || ""));
        row.getCell(1).style = { ...row.getCell(2).style };
      });

      [14, 14, 14, 14, 14, 14, 12, 28].forEach((width, index) => {
        sheet.getColumn(index + 1).width = width;
      });
      return workbook;
    };
    wrapped.__fyhIncludesEmployeeName = true;
    exporter.createLeaveWorkbook = wrapped;
  }

  if (document.readyState === "complete") install();
  else window.addEventListener("load", install, { once: true });
})();

// 繁中／越文語系層。
// 固定介面文字由本層翻譯；群組、單位、人員、班別、假別、餐點則讀取資料庫越文欄位，空白時維持中文。
(function installVietnameseLocalization() {
  if (typeof document === "undefined") return;

  const LANGUAGE_KEY = "fyh.language";
  const VI = "vi-VN";
  const ZH = "zh-TW";
  const config = window.SCHEDULER_CONFIG || {};
  const baseUrl = String(config.supabaseUrl || "").replace(/\/+$/, "");
  const anonKey = String(config.supabaseAnonKey || "");
  let language = localStorage.getItem(LANGUAGE_KEY) === VI ? VI : ZH;
  let installed = false;
  let labelsLoaded = false;
  let labels = { groups: [], departments: [], members: [], shifts: [], leaves: [], roles: [], mealProducts: [] };
  let applying = false;

  const fixedVi = new Map(Object.entries({
    "首頁": "Trang chủ",
    "打卡": "Chấm công",
    "訂餐": "Đặt cơm",
    "紀錄": "Lịch sử",
    "簽到簿": "Sổ chấm công",
    "班表": "Lịch làm việc",
    "登入": "Đăng nhập",
    "登出": "Đăng xuất",
    "修改密碼": "Đổi mật khẩu",
    "語言": "Ngôn ngữ",
    "設定": "Cài đặt",
    "排班": "Xếp ca",
    "匯出": "Xuất dữ liệu",
    "班別": "Ca làm việc",
    "假別": "Loại nghỉ",
    "加班": "Tăng ca",
    "例休檢查": "Kiểm tra ngày nghỉ",
    "權限設定": "Cài đặt quyền",
    "群組設定": "Cài đặt nhóm",
    "週期設定": "Cài đặt chu kỳ",
    "班表封存": "Lưu trữ lịch",
    "排班條件": "Điều kiện xếp ca",
    "自動排班預覽": "Xem trước xếp ca tự động",
    "自動補班預覽": "Xem trước bổ sung ca",
    "套用預覽": "Áp dụng bản xem trước",
    "取消預覽": "Hủy bản xem trước",
    "匯出上班日": "Xuất ngày làm việc",
    "匯出休例假": "Xuất ngày nghỉ",
    "匯出請假": "Xuất nghỉ phép",
    "匯出加班": "Xuất tăng ca",
    "列印班表": "In lịch làm việc",
    "班表列印預覽": "Xem trước lịch in",
    "列印": "In",
    "返回": "Quay lại",
    "方向": "Hướng",
    "自動": "Tự động",
    "直式": "Dọc",
    "橫式": "Ngang",
    "前八週": "8 tuần trước",
    "前一週": "Tuần trước",
    "後一週": "Tuần sau",
    "後八週": "8 tuần sau",
    "人員檢視": "Theo nhân viên",
    "人員檢視-統計欄": "Theo nhân viên - thống kê",
    "班別檢視": "Theo ca",
    "單位": "Bộ phận",
    "人員": "Nhân viên",
    "員工": "Nhân viên",
    "統計": "Thống kê",
    "姓名": "Họ tên",
    "工號": "Mã nhân viên",
    "開始日期": "Ngày bắt đầu",
    "結束日期": "Ngày kết thúc",
    "到職日": "Ngày vào làm",
    "離職日": "Ngày nghỉ việc",
    "狀態": "Trạng thái",
    "操作": "Thao tác",
    "編輯": "Sửa",
    "刪除": "Xóa",
    "新增": "Thêm",
    "儲存": "Lưu",
    "儲存修改": "Lưu thay đổi",
    "取消": "Hủy",
    "確認": "Xác nhận",
    "全部": "Tất cả",
    "全部顯示": "Hiển thị tất cả",
    "全部群組": "Tất cả nhóm",
    "全部人員": "Tất cả nhân viên",
    "全部單位": "Tất cả bộ phận",
    "未指定": "Chưa chỉ định",
    "未設定": "Chưa cài đặt",
    "啟用": "Bật",
    "停用": "Tắt",
    "是": "Có",
    "否": "Không",
    "月薪": "Lương tháng",
    "日薪": "Lương ngày",
    "計薪方式": "Cách tính lương",
    "例假星期": "Ngày nghỉ cố định",
    "所屬群組": "Nhóm",
    "所屬單位": "Bộ phận",
    "排班班別": "Ca có thể xếp",
    "群組": "Nhóm",
    "群組名稱": "Tên nhóm",
    "群組代碼": "Mã nhóm",
    "單位名稱": "Tên bộ phận",
    "越文名稱": "Tên tiếng Việt",
    "所屬人員": "Nhân viên thuộc bộ phận",
    "預覽": "Xem trước",
    "假別代碼": "Mã loại nghỉ",
    "適用單位": "Bộ phận áp dụng",
    "需求人數": "Số người cần",
    "排班人員": "Nhân viên xếp ca",
    "時段": "Khung giờ",
    "需填時間": "Yêu cầu nhập giờ",
    "需填原因": "Yêu cầu lý do",
    "角色名稱": "Tên vai trò",
    "適用群組": "Nhóm áp dụng",
    "權限項目": "Quyền hạn",
    "權限": "Quyền",
    "在職": "Đang làm việc",
    "離職": "Đã nghỉ việc",
    "名稱": "Tên",
    "上班時間": "Giờ vào ca",
    "下班時間": "Giờ tan ca",
    "查看": "Xem",
    "管理": "Quản lý",
    "修改單位": "Sửa bộ phận",
    "新增單位": "Thêm bộ phận",
    "修改人員": "Sửa nhân viên",
    "新增人員": "Thêm nhân viên",
    "修改班別": "Sửa ca",
    "新增班別": "Thêm ca",
    "修改假別": "Sửa loại nghỉ",
    "新增假別": "Thêm loại nghỉ",
    "修改角色": "Sửa vai trò",
    "新增角色": "Thêm vai trò",
    "不顯示於班表": "Không hiển thị trên lịch",
    "請輸入單位名稱": "Nhập tên bộ phận",
    "請輸入班別": "Nhập tên ca",
    "請輸入名稱": "Nhập tên",
    "輸入姓名": "Nhập họ tên",
    "可留空": "Có thể để trống",
    "可留空；越文模式會顯示中文": "Có thể để trống; nếu trống sẽ hiển thị tiếng Trung",
    "可否訂餐": "Cho phép đặt cơm",
    "不顯示": "Không hiển thị",
    "可否打卡": "Cho phép chấm công",
    "是否啟用打卡": "Bật chấm công",
    "地址": "Địa chỉ",
    "緯度": "Vĩ độ",
    "經度": "Kinh độ",
    "固定對外 IP": "IP công cộng cố định",
    "人員設定": "Cài đặt nhân viên",
    "單位設定": "Cài đặt bộ phận",
    "班別設定": "Cài đặt ca",
    "假別設定": "Cài đặt loại nghỉ",
    "訂餐管理": "Quản lý đặt cơm",
    "訂餐設定": "Cài đặt đặt cơm",
    "品項": "Món",
    "價格": "Giá",
    "公司補助（元）": "Trợ cấp công ty (NT$)",
    "新增商品": "Thêm món",
    "儲存設定": "Lưu cài đặt",
    "今日訂餐": "Đặt cơm hôm nay",
    "數量": "Số lượng",
    "單價": "Đơn giá",
    "小計": "Thành tiền",
    "備註": "Ghi chú",
    "常用備註": "Ghi chú thường dùng",
    "個人記錄": "Lịch sử cá nhân",
    "簽到審核": "Duyệt chấm công",
    "日期": "Ngày",
    "圖示": "Biểu tượng",
    "打卡時間": "Giờ chấm công",
    "上班時數": "Giờ làm việc",
    "加班時數": "Giờ tăng ca",
    "異常": "Bất thường",
    "審核": "Duyệt",
    "未審": "Chưa duyệt",
    "已審": "Đã duyệt",
    "批次審核": "Duyệt hàng loạt",
    "批次退回": "Trả lại hàng loạt",
    "設為未審": "Đặt thành chưa duyệt",
    "設為已審": "Đặt thành đã duyệt",
    "歷程": "Lịch sử",
    "上班": "Vào ca",
    "下班": "Tan ca",
    "上班打卡": "Chấm công vào ca",
    "下班打卡": "Chấm công tan ca",
    "上一頁": "Trang trước",
    "下一頁": "Trang sau",
    "讀取中…": "Đang tải…",
    "載入中…": "Đang tải…",
    "沒有資料": "Không có dữ liệu",
    "正常": "Bình thường",
    "使用者": "Người dùng",
    "拖曳排序": "Kéo để sắp xếp",
    "返回首頁": "Về trang chủ",
    "上一步（Ctrl+Z）": "Hoàn tác (Ctrl+Z)",
    "下一步（Ctrl+Y）": "Làm lại (Ctrl+Y)",
    "收合工具列": "Thu gọn thanh công cụ"
  }));

  function normalizeLabelRows(value) {
    return Array.isArray(value) ? value.map((row) => ({ id: String(row?.id || ""), nameVi: String(row?.nameVi || "").trim() })) : [];
  }

  function setLabels(payload) {
    labels = {
      groups: normalizeLabelRows(payload?.groups),
      departments: normalizeLabelRows(payload?.departments),
      members: normalizeLabelRows(payload?.members),
      shifts: normalizeLabelRows(payload?.shifts),
      leaves: normalizeLabelRows(payload?.leaves),
      roles: normalizeLabelRows(payload?.roles),
      mealProducts: normalizeLabelRows(payload?.mealProducts)
    };
    labelsLoaded = true;
  }

  function labelMap(category) {
    return new Map((labels[category] || []).map((row) => [row.id, row.nameVi]));
  }

  function applyLabels(items, category) {
    const byId = labelMap(category);
    return Array.isArray(items) ? items.map((item) => ({ ...item, nameVi: byId.get(String(item?.id || "")) || item?.nameVi || "" })) : items;
  }

  function enrichPayload(payload) {
    if (!payload || typeof payload !== "object") return payload;
    if (Array.isArray(payload.departments)) payload.departments = applyLabels(payload.departments, "departments");
    if (Array.isArray(payload.members)) payload.members = applyLabels(payload.members, "members");
    if (Array.isArray(payload.shifts)) payload.shifts = applyLabels(payload.shifts, "shifts");
    if (Array.isArray(payload.leaves)) payload.leaves = applyLabels(payload.leaves, "leaves");
    if (Array.isArray(payload.products)) payload.products = applyLabels(payload.products, "mealProducts");
    if (payload.accessBundle?.groups) payload.accessBundle.groups = applyLabels(payload.accessBundle.groups, "groups");
    if (payload.accessBundle?.roles) payload.accessBundle.roles = applyLabels(payload.accessBundle.roles, "roles");
    if (payload.status?.products) payload.status.products = applyLabels(payload.status.products, "mealProducts");
    return payload;
  }

  function mergeGlobalLabels() {
    try {
      if (typeof state !== "undefined" && state) {
        state.departments = applyLabels(state.departments, "departments");
        state.members = applyLabels(state.members, "members");
        state.shifts = applyLabels(state.shifts, "shifts");
        state.leaves = applyLabels(state.leaves, "leaves");
      }
      if (typeof groupFeatureState !== "undefined" && groupFeatureState?.bundle) {
        groupFeatureState.bundle.groups = applyLabels(groupFeatureState.bundle.groups, "groups");
        groupFeatureState.bundle.roles = applyLabels(groupFeatureState.bundle.roles, "roles");
      }
      if (typeof recordsState !== "undefined" && recordsState?.mealAdmin?.products) {
        recordsState.mealAdmin.products = applyLabels(recordsState.mealAdmin.products, "mealProducts");
      }
      if (typeof mealOrderState !== "undefined" && mealOrderState?.status?.products) {
        mealOrderState.status.products = applyLabels(mealOrderState.status.products, "mealProducts");
      }
    } catch (error) {
      console.warn("套用越文名稱失敗", error);
    }
  }

  let labelRefreshPromise = null;

  function isAuthenticated() {
    return Boolean(window.schedulerApi?.getAuthContext?.()?.authenticated);
  }

  async function refreshLabels() {
    if (!isAuthenticated() || typeof window.schedulerApi?.getVietnameseLabels !== "function") return labels;
    if (labelRefreshPromise) return labelRefreshPromise;
    labelRefreshPromise = Promise.resolve(window.schedulerApi.getVietnameseLabels())
      .then((payload) => {
        setLabels(payload || {});
        mergeGlobalLabels();
        return labels;
      })
      .finally(() => { labelRefreshPromise = null; });
    return labelRefreshPromise;
  }

  function upsertCachedLabel(category, id, nameVi) {
    if (!id) return;
    const rows = labels[category] || [];
    const index = rows.findIndex((row) => row.id === id);
    const next = { id, nameVi: String(nameVi || "").trim() };
    if (index >= 0) rows[index] = next;
    else rows.push(next);
  }

  async function saveLabel(entity, category, id, value) {
    const normalizedId = String(id || "").trim();
    if (!normalizedId || typeof window.schedulerApi?.saveVietnameseLabel !== "function") return;
    await window.schedulerApi.saveVietnameseLabel(entity, normalizedId, String(value || "").trim());
    upsertCachedLabel(category, normalizedId, value);
    mergeGlobalLabels();
  }

  function installApiIntegration() {
    // Vietnamese data access is part of the formal schedulerApi provider.
    // Entity save paths explicitly persist their localized field; no runtime method override is used here.
  }

  function currentEntity(category) {
    const targetId = typeof modalContext !== "undefined" ? String(modalContext?.targetId || "") : "";
    try {
      if (category === "group") return (typeof groupFeatureState !== "undefined" ? groupFeatureState.bundle?.groups : [])?.find((item) => String(item.id) === targetId) || null;
      if (category === "role") return (typeof groupFeatureState !== "undefined" ? groupFeatureState.bundle?.roles : [])?.find((item) => String(item.id) === targetId) || null;
      if (typeof state === "undefined") return null;
      if (category === "department") return state.departments?.find((item) => String(item.id) === targetId) || null;
      if (category === "member") return state.members?.find((item) => String(item.id) === targetId) || null;
      if (category === "shift") return state.shifts?.find((item) => String(item.id) === targetId) || null;
      if (category === "leave") return state.leaves?.find((item) => String(item.id) === targetId) || null;
    } catch {}
    return null;
  }

  function addLocalizedField(sourceId, localizedId, category) {
    const source = document.getElementById(sourceId);
    if (!(source instanceof HTMLInputElement) || document.getElementById(localizedId)) return;
    const row = source.closest(".form-row");
    if (!row) return;
    const wrapper = document.createElement("div");
    wrapper.className = "form-row fyh-localized-name-field";
    const item = currentEntity(category);
    wrapper.innerHTML = `<label for="${localizedId}">越文名稱</label><input id="${localizedId}" type="text" maxlength="60" value="${String(item?.nameVi || "").replaceAll("&", "&amp;").replaceAll("\"", "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}" placeholder="可留空；越文模式會顯示中文">`;
    row.insertAdjacentElement("afterend", wrapper);
  }

  function ensureLocalizedFormFields() {
    addLocalizedField("groupName", "groupNameVi", "group");
    addLocalizedField("departmentName", "departmentNameVi", "department");
    addLocalizedField("memberName", "memberNameVi", "member");
    addLocalizedField("shiftName", "shiftNameVi", "shift");
    addLocalizedField("accessRoleName", "accessRoleNameVi", "role");
    const contextCategory = typeof modalContext !== "undefined" ? modalContext?.category : "";
    if (contextCategory === "leave") {
      const leaveSourceId = document.getElementById("leaveCatalogName") ? "leaveCatalogName" : document.getElementById("namedItemName") ? "namedItemName" : "";
      if (leaveSourceId) addLocalizedField(leaveSourceId, "leaveNameVi", "leave");
    }
  }

  function ensureMealLocalizedColumn() {
    const table = document.querySelector(".meal-settings-table");
    if (!table) return;
    const headRow = table.querySelector("thead tr");
    const nameHead = headRow?.querySelector(".meal-settings-name-col");
    if (headRow && nameHead && !headRow.querySelector("[data-meal-name-vi-head]")) {
      const th = document.createElement("th");
      th.className = "meal-settings-name-col";
      th.dataset.mealNameViHead = "true";
      th.textContent = "越文名稱";
      nameHead.insertAdjacentElement("afterend", th);
    }
    table.querySelectorAll("tbody [data-meal-product-row]").forEach((row) => {
      if (row.querySelector("[data-meal-product-name-vi]")) return;
      const nameCell = row.querySelector(".meal-settings-name-col");
      const id = row.querySelector('[data-meal-product-field="id"]')?.value || "";
      const cached = labelMap("mealProducts").get(String(id)) || "";
      if (!nameCell) return;
      const td = document.createElement("td");
      td.className = "meal-settings-name-col";
      td.innerHTML = `<input type="text" maxlength="60" value="${cached.replaceAll("&", "&amp;").replaceAll("\"", "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}" data-meal-product-name-vi placeholder="可留空">`;
      nameCell.insertAdjacentElement("afterend", td);
    });
  }

  function entityTranslationMap() {
    const map = new Map();
    const add = (items) => (items || []).forEach((item) => {
      const zh = String(item?.name || item?.full_name || "").trim();
      const vi = String(item?.nameVi || "").trim();
      if (zh && vi) map.set(zh, vi);
    });
    try {
      if (typeof groupFeatureState !== "undefined") { add(groupFeatureState.bundle?.groups); add(groupFeatureState.bundle?.roles); }
      if (typeof state !== "undefined") {
        add(state.departments); add(state.members); add(state.shifts); add(state.leaves);
      }
      if (typeof recordsState !== "undefined") add(recordsState.mealAdmin?.products);
      if (typeof mealOrderState !== "undefined") add(mealOrderState.status?.products);
    } catch {}
    return map;
  }

  function translateDynamic(text) {
    const month = text.match(/^(\d{4})\s*年\s*(\d{1,2})\s*月$/);
    if (month) return `Tháng ${Number(month[2])} năm ${month[1]}`;
    const page = text.match(/^共\s*(\d+)\s*筆，第\s*(\d+)\s*\/\s*(\d+)\s*頁$/);
    if (page) return `Tổng ${page[1]} mục, trang ${page[2]} / ${page[3]}`;
    const total = text.match(/^目前合計\s*(\d+)\s*份，\$(.+)$/);
    if (total) return `Tổng hiện tại ${total[1]} phần, $${total[2]}`;
    return "";
  }

  function translateText(text, entityMap) {
    const trimmed = String(text || "").trim();
    if (!trimmed) return text;
    const translated = fixedVi.get(trimmed) || entityMap.get(trimmed) || translateDynamic(trimmed);
    if (!translated) return text;
    const leading = text.match(/^\s*/)?.[0] || "";
    const trailing = text.match(/\s*$/)?.[0] || "";
    return `${leading}${translated}${trailing}`;
  }

  function translateDom(root = document.body) {
    if (language !== VI || !root || applying) return;
    applying = true;
    try {
      const entities = entityTranslationMap();
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach((node) => {
        const parent = node.parentElement;
        if (!parent || ["SCRIPT", "STYLE", "TEXTAREA"].includes(parent.tagName)) return;
        const next = translateText(node.nodeValue || "", entities);
        if (next !== node.nodeValue) node.nodeValue = next;
      });
      root.querySelectorAll?.("[title], [aria-label], [placeholder]").forEach((element) => {
        ["title", "aria-label", "placeholder"].forEach((attribute) => {
          const value = element.getAttribute(attribute);
          if (!value) return;
          const next = translateText(value, entities).trim();
          if (next !== value) element.setAttribute(attribute, next);
        });
      });
      document.documentElement.lang = "vi";
    } finally {
      applying = false;
    }
  }

  function ensureLanguageControl() {
    const actions = document.querySelector("#homeCard .home-header-actions");
    const passwordButton = actions?.querySelector(".home-password-btn");
    const existing = document.querySelector(".fyh-language-switch");
    if (!actions || !passwordButton) {
      existing?.remove();
      return;
    }

    if (!document.getElementById("fyhLanguageStyles")) {
      const style = document.createElement("style");
      style.id = "fyhLanguageStyles";
      style.textContent = ".fyh-language-switch{display:inline-flex;align-items:center}.fyh-language-switch select{min-height:40px;padding:0 34px 0 12px;border:1px solid rgba(166,143,111,.35);border-radius:12px;background:#fffdf8;color:var(--text,#2b241c);font-weight:700;outline:none}.fyh-localized-name-field input{width:100%}";
      document.head.appendChild(style);
    }

    let shell = existing;
    if (!shell) {
      shell = document.createElement("div");
      shell.className = "fyh-language-switch";
      shell.innerHTML = `<select id="fyhLanguageSelect" aria-label="語言"><option value="${ZH}" ${language === ZH ? "selected" : ""}>繁體中文</option><option value="${VI}" ${language === VI ? "selected" : ""}>Tiếng Việt</option></select>`;
      shell.querySelector("select")?.addEventListener("change", (event) => {
        localStorage.setItem(LANGUAGE_KEY, event.target.value === VI ? VI : ZH);
        window.location.reload();
      });
    }

    if (shell.parentElement !== actions || shell.nextElementSibling !== passwordButton) {
      actions.insertBefore(shell, passwordButton);
    }
  }

  function refreshUi() {
    ensureLanguageControl();
    ensureLocalizedFormFields();
    ensureMealLocalizedColumn();
    if (labelsLoaded) mergeGlobalLabels();
    if (isAuthenticated() && !labelsLoaded && !labelRefreshPromise) {
      refreshLabels().then(() => queueMicrotask(refreshUi)).catch((error) => console.warn("讀取越文名稱失敗", error));
    }
    translateDom(document.body);
  }

  function install() {
    if (installed) return;
    if (!window.schedulerApi) { setTimeout(install, 25); return; }
    installed = true;
    installApiIntegration();
    window.fyhI18n = {
      get language() { return language; },
      isVietnamese: () => language === VI,
      displayName(item) {
        const vi = String(item?.nameVi || "").trim();
        return language === VI && vi ? vi : String(item?.name || "");
      },
      refreshLabels,
      saveLabel,
      refresh: refreshUi
    };
    const observer = new MutationObserver(() => queueMicrotask(refreshUi));
    observer.observe(document.documentElement, { childList: true, subtree: true });
    if (isAuthenticated()) refreshLabels().catch((error) => console.warn("讀取越文名稱失敗", error)).finally(refreshUi);
    else refreshUi();
  }

  setTimeout(install, 0);
})();
