/* 班表請假與加班提示框事件。
 * 由 renderer.js 最終拆分；事件註冊順序與原行為不變。
 */

function bindScheduleTooltipEvents() {
  document.body.addEventListener("mouseover", (event) => {
    const target = event.target.closest("[data-hover-schedule-detail]");
    if (!target) {
      return;
    }
    const [memberId, day, category] = target.dataset.hoverScheduleDetail.split(":");
    if (leaveTooltipTimer) {
      clearTimeout(leaveTooltipTimer);
      leaveTooltipTimer = null;
    }
    showScheduleTooltip(memberId, day, category, target.getBoundingClientRect());
  });

  document.body.addEventListener("mouseout", (event) => {
    const target = event.target.closest("[data-hover-schedule-detail]");
    if (!target) {
      return;
    }
    const related = event.relatedTarget;
    if (related instanceof HTMLElement && (related.closest("[data-hover-schedule-detail]") || related.closest("#leaveTooltipRoot"))) {
      return;
    }
    scheduleHideLeaveTooltip();
  });
}
