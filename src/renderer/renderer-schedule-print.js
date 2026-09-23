/* 班表列印：日期區間 -> 預覽 -> 瀏覽器列印。
 * 沿用正式班表 renderer；由中央 Renderer 事件系統註冊，不使用 runtime polling / wrapper。
 */
const schedulePrintFeature = (() => {

  const PREVIEW_ID = "schedulePrintPreview";
  const PAGE_STYLE_ID = "schedulePrintPageStyle";
  const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
  let preview = null;

  function canPrint() {
    try {
      if (typeof appView === "undefined" || appView !== "schedule") return false;
      return Boolean(typeof hasCommonPermission === "function" && hasCommonPermission("export"));
    } catch { return false; }
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
    const weekdayLabels = window.fyhI18n?.isVietnamese?.() ? ["CN", "T2", "T3", "T4", "T5", "T6", "T7"] : WEEKDAYS;
    return `${date.getMonth() + 1}/${date.getDate()}<span>${weekdayLabels[date.getDay()]}</span>`;
  }

  function renderTable(dates, groups) {
    let html = '<table class="schedule-print-table"><colgroup><col><col>' + dates.map(() => '<col>').join("") + '</colgroup><thead><tr><th>單位</th><th>姓名</th>';
    html += dates.map((dateString) => {
      const date = toDateObject(dateString);
      const special = state.holidays.some((holiday) => holiday.date === dateString) || date.getDay() === 0 || date.getDay() === 6;
      return `<th class="${special ? "schedule-print-weekend" : ""}">${dateHeader(dateString)}</th>`;
    }).join("") + '</tr></thead><tbody>';
    if (!groups.length) html += `<tr><td class="schedule-print-empty" colspan="${dates.length + 2}">目前沒有符合範圍的人員</td></tr>`;
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
    const rowPages = splitRows(preview.groups, mode === "portrait" ? 48 : 33);
    root.innerHTML = datePages.flatMap((datePage) => rowPages.map((rowPage) => `<section class="schedule-print-page" data-orientation="${mode}">${renderTable(datePage, rowPage)}</section>`)).join("");
    refreshLocalization(document.getElementById(PREVIEW_ID));
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
    root.innerHTML = `<div class="schedule-print-preview-toolbar"><div><strong>班表列印預覽</strong><span>${startDate} ～ ${endDate}</span></div><div><span class="schedule-print-paper-size">A4</span><label>方向 <select id="schedulePrintOrientation"><option value="auto">自動</option><option value="portrait">直式</option><option value="landscape">橫式</option></select></label><button class="ghost-btn" type="button" data-print-close>返回</button><button class="primary-btn" type="button" data-print-now>列印</button></div></div><div class="schedule-print-pages"></div>`;
    document.body.appendChild(root);
    renderPages();
  }

  function openRangeDialog() {
    if (!canPrint()) { showInfoMessage("沒有班表管理權限"); return; }
    closeCoreActionsMenu();
    const range = getVisibleDateRange();
    openDateRangeActionModal({
      title: "列印班表",
      startDate: range.startDate,
      endDate: range.endDate,
      startId: "schedulePrintStartDate",
      endId: "schedulePrintEndDate",
      actionButton: '<button class="btn-primary" type="button" data-print-range-confirm>預覽列印</button>'
    });
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

  function bindEvents() {
    document.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      const confirm = target.closest("[data-print-range-confirm]");
      if (confirm instanceof HTMLButtonElement) { void confirmRange(confirm); return; }
      if (target.closest("[data-print-close]")) { document.getElementById(PREVIEW_ID)?.remove(); preview = null; return; }
      if (target.closest("[data-print-now]")) doPrint();
    }, true);
    document.addEventListener("change", (event) => {
      if (!(event.target instanceof HTMLSelectElement) || event.target.id !== "schedulePrintOrientation" || !preview) return;
      preview.orientationMode = event.target.value;
      renderPages();
    });
    window.addEventListener("afterprint", () => document.body.classList.remove("schedule-printing"));
  }

  return {
    openRangeDialog,
    bindEvents
  };
})();

function openSchedulePrintRangeDialog() {
  return schedulePrintFeature.openRangeDialog();
}

function bindSchedulePrintEvents() {
  schedulePrintFeature.bindEvents();
}
