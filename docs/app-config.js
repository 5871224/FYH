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
      const archive = document.getElementById("scheduleArchiveMenuButton");
      archive ? archive.insertAdjacentElement("afterend", button) : menu.prepend(button);
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
