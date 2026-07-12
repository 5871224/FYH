/* 班表目錄同步、月週設定與例休檢查畫面。
 * 由 renderer.js 最終拆分；維持既有全域 bundle 與功能行為。
 */

async function syncScheduleCatalogs() {
  if (!isManager()) {
    return;
  }
  await window.schedulerApi.syncCatalogs(state);
}

function formatMonthText(year, month) {
  return `${year} 年 ${month + 1} 月`;
}

function formatWeekStartLabel(value) {
  return WEEK_START_OPTIONS.find((option) => option.value === value)?.label || "星期日";
}

function getConfiguredMonthStartDay() {
  const value = Number(state.rules?.monthStartDay);
  return Number.isInteger(value) && value >= 1 && value <= 31 ? value : 1;
}

function formatDateTextFromIso(dateString) {
  const date = toDateObject(dateString);
  if (!date) {
    return dateString || "";
  }
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

function formatWeekRangeText(startDate, endDate) {
  return `${formatDateTextFromIso(startDate)} - ${formatDateTextFromIso(endDate)}`;
}

function getScheduleSlotByDateString(memberId, dateString) {
  const date = toDateObject(dateString);
  if (!date) {
    return null;
  }
  return state.schedule[scheduleKey(memberId, date.getFullYear(), date.getMonth(), date.getDate())] || null;
}

function getVisibleScheduleWeeks() {
  const visibleDates = getVisibleDates();
  const weeks = [];
  for (let index = 0; index < visibleDates.length; index += 7) {
    const dates = visibleDates.slice(index, index + 7);
    if (dates.length) {
      weeks.push({
        startDate: dates[0],
        endDate: dates[dates.length - 1],
        dates
      });
    }
  }
  return weeks;
}

function buildRestComplianceCalendars(weeks) {
  const checker = window.restCompliance;
  if (!checker) {
    return [];
  }
  const dateRange = [...new Set(weeks.flatMap((week) => week.dates))];
  const visibleStartDate = dateRange[0] || getTodayDateString();
  const visibleEndDate = dateRange[dateRange.length - 1] || visibleStartDate;
  const slidingDateRange = enumerateDateRange(
    addDaysToDateString(visibleStartDate, -7),
    visibleEndDate
  );

  return state.members.map((member) => {
    const buildDay = (dateString) => {
      const slot = getScheduleSlotByDateString(member.id, dateString);
      const leave = getItem("leave", slot?.leave);
      return {
        date: dateString,
        active: isMemberActiveOnDateString(member, dateString),
        leaveCode: leave?.code || "",
        hasShift: Boolean(slot?.shift),
        hasOvertime: Boolean(slot?.overtime)
      };
    };
    const days = dateRange.map(buildDay);
    return {
      memberId: member.id,
      memberName: member.name,
      memberCode: member.code || "",
      hireDate: member.hireDate || "",
      leaveDate: member.leaveDate || "",
      days,
      slidingDays: slidingDateRange.map(buildDay)
    };
  }).filter((member) => member.days.some((day) => day.active));
}

function openWeekStartSettingModal() {
  if (!promptManagerAccess("設定週期規則前請先登入主管帳號")) {
    return;
  }
  openEntityListModal({
    title: "週期設定",
    modalClass: "modal modal-wide",
    body: `
      <div class="form-grid">
        <div class="form-row">
          <label for="eightWeekStartSetting">八週起算日</label>
          <input id="eightWeekStartSetting" type="date" value="${escapeHtml(getConfiguredEightWeekAnchorDate())}">
        </div>
        <div class="form-row">
          <label for="weekStartSetting">每週起算日</label>
          <select id="weekStartSetting">${WEEK_START_OPTIONS.map((option) => (
            `<option value="${option.value}" ${option.value === getConfiguredWeekStart() ? "selected" : ""}>${option.label}</option>`
          )).join("")}</select>
        </div>
        <div class="form-row">
          <label for="monthStartSetting">每月起算日</label>
          <select id="monthStartSetting">${Array.from({ length: 31 }, (_, index) => {
            const day = index + 1;
            return `<option value="${day}" ${day === getConfiguredMonthStartDay() ? "selected" : ""}>${day} 日</option>`;
          }).join("")}</select>
        </div>
      </div>
      <div class="result-item">
        <div class="result-title">說明</div>
        <div class="result-detail">班表預設顯示今天所在的八週週期；週期由八週起算日往前後每 56 天推算。</div>
      </div>
    `,
    headerButtons: '<button class="btn-primary" type="button" data-save-week-start="true">儲存設定</button>',
    hideFooterClose: true
  });
}

async function saveWeekStartSettingFromModal() {
  const weekValue = Number(document.getElementById("weekStartSetting")?.value || 0);
  const monthValue = Number(document.getElementById("monthStartSetting")?.value || 1);
  const eightWeekStartDate = document.getElementById("eightWeekStartSetting")?.value || getTodayDateString();
  state.rules.weekStart = Number.isInteger(weekValue) && weekValue >= 0 && weekValue <= 6 ? weekValue : 0;
  state.rules.monthStartDay = Number.isInteger(monthValue) && monthValue >= 1 && monthValue <= 31 ? monthValue : 1;
  state.rules.eightWeekStartDate = toDateObject(eightWeekStartDate) ? eightWeekStartDate : getTodayDateString();
  state.scheduleStartDate = getEightWeekCycleStartForDate(getTodayDateString());
  syncVisibleDatePartsFromStart();
  closeModal();
  renderAll();
  await forceSave();
}

function openRestComplianceModal() {
  if (!promptManagerAccess("執行例休檢查前請先登入主管帳號")) {
    return;
  }
  const checker = window.restCompliance;
  if (!checker) {
    showInfoMessage("例休檢查模組尚未載入");
    return;
  }

  const complianceWeeks = getVisibleScheduleWeeks();
  const complianceStartDate = complianceWeeks[0]?.startDate || getTodayDateString();
  const complianceEndDate = complianceWeeks[complianceWeeks.length - 1]?.endDate || complianceStartDate;
  const result = checker.checkRestCompliance({
    year: state.year,
    month: state.month,
    weeks: complianceWeeks,
    weekStart: getConfiguredWeekStart(),
    maxConsecutiveWorkDays: Math.max(1, Number(state.rules?.maxConsecutiveWorkDays) || 6),
    reportStartDate: complianceStartDate,
    reportEndDate: complianceEndDate,
    memberCalendars: buildRestComplianceCalendars(complianceWeeks)
  });
  const issueCount = result.issues.length;
  const errorCount = result.issues.filter((issue) => issue.severity === "error").length;
  const warningCount = result.issues.filter((issue) => issue.severity === "warning").length;
  const groupedIssues = result.issues.reduce((groups, issue) => {
    const key = issue.memberId || `${issue.memberCode || ""}-${issue.memberName || ""}`;
    if (!groups.has(key)) {
      groups.set(key, {
        memberId: issue.memberId,
        memberName: issue.memberName,
        memberCode: issue.memberCode || "",
        issues: []
      });
    }
    groups.get(key).issues.push(issue);
    return groups;
  }, new Map());
  const summaryCards = `
    <div class="compliance-summary-grid">
      <div class="result-item">
        <div class="result-title">檢查範圍</div>
        <div class="result-detail">${escapeHtml(formatWeekRangeText(complianceStartDate, complianceEndDate))}</div>
      </div>
      <div class="result-item ${issueCount ? "warning" : "success"}">
        <div class="result-title">檢查結果</div>
        <div class="result-detail">${issueCount ? `${errorCount} 筆缺漏，${warningCount} 筆待確認` : "目前未發現缺少例假"}</div>
      </div>
    </div>
  `;
  const notes = `
    <div class="result-item">
      <div class="result-title">檢查說明</div>
      <div class="result-detail compliance-check-note">
        <div>目前檢查畫面顯示的 8 週，每 7 天為一週。</div>
        <div>到職日或離職日落在該週時，每週例假／休息日檢查會略過，改檢查「未在職日＋例假＋休息日」是否至少 2 天。</div>
        <div>這版只檢查系統內已標記的「例假 0036」；空白未排班不自動視為例假。</div>
      </div>
    </div>
  `;
  const issuesMarkup = issueCount
    ? `
      <div class="compliance-check-list">
        ${Array.from(groupedIssues.values()).map((group) => `
          <div class="result-item ${group.issues.some((issue) => issue.severity === "error") ? "error" : "warning"} compliance-member-group">
            <div class="compliance-member-head">
              <div class="result-title compliance-member-name">${escapeHtml(group.memberName || group.memberId)}</div>
              <div class="result-detail compliance-member-summary">
                <span>缺漏：${group.issues.filter((issue) => issue.severity === "error").length} 筆</span>
                <span>待確認：${group.issues.filter((issue) => issue.severity === "warning").length} 筆</span>
              </div>
            </div>
            <div class="result-detail">
              ${group.issues.map((issue) => `
                <div>${issue.type === "regular_holiday_work" && issue.date
                  ? `${escapeHtml(formatDateTextFromIso(issue.date))}｜${escapeHtml(issue.message)}`
                  : `${escapeHtml(formatWeekRangeText(issue.weekStart, issue.weekEnd))}｜${escapeHtml(issue.message)}`
                }${issue.streakStartDate ? `｜連續區間：${escapeHtml(formatDateTextFromIso(issue.streakStartDate))} - ${escapeHtml(formatDateTextFromIso(issue.date || issue.streakStartDate))}` : ""}</div>
              `).join("")}
            </div>
          </div>
        `).join("")}
      </div>
    `
    : `
      <div class="result-item success">
        <div class="result-title">檢查完成</div>
        <div class="result-detail">目前依系統標記，顯示的 8 週未發現例假缺漏。</div>
      </div>
    `;

  openEntityListModal({
    title: "例休檢查",
    modalClass: "modal modal-wide compliance-check-modal",
    body: `${summaryCards}${notes}${issuesMarkup}`,
    hideFooterClose: true
  });
}
