/* 共用訊息、操作確認與時間輸入元件工具
 * 由 renderer.js 第二階段拆分；維持既有全域 bundle 執行方式。
 */

function reportValidationError(message) {
  setSaveStatus(message);
  if (window.schedulerApi?.showMessage) {
    window.schedulerApi.showMessage("提示", message);
    return;
  }
  window.alert(message);
}

function syncCoreActionsMenu() {
  const menu = document.getElementById("coreActionsMenu");
  const toggle = document.getElementById("coreActionsToggle");
  if (!menu || !toggle) {
    return;
  }
  menu.classList.toggle("open", coreActionsOpen);
  menu.setAttribute("aria-hidden", coreActionsOpen ? "false" : "true");
  toggle.setAttribute("aria-expanded", coreActionsOpen ? "true" : "false");
}

function toggleCoreActionsMenu(force) {
  coreActionsOpen = typeof force === "boolean" ? force : !coreActionsOpen;
  syncCoreActionsMenu();
}

function closeCoreActionsMenu() {
  if (!coreActionsOpen) {
    return;
  }
  coreActionsOpen = false;
  syncCoreActionsMenu();
}

function showInfoMessage(message) {
  if (window.schedulerApi?.showMessage) {
    window.schedulerApi.showMessage("提示", message);
    return;
  }
  window.alert(message);
}

function formatSchedulerError(error, fallback = "操作失敗") {
  const message = String(error?.message || error || "").trim();
  if (
    message.includes("Could not find the 'overtime_end_time' column of 'schedule_entries'") ||
    message.includes("Could not find the 'overtime_start_time' column of 'schedule_entries'")
  ) {
    return "加班資料庫尚未套用新版欄位，請先確認 supabase/001_current_schema.sql 與 002_current_updates.sql 已套用。";
  }
  return message || fallback;
}

async function confirmAction(message) {
  if (window.schedulerApi?.confirmAction) {
    return window.schedulerApi.confirmAction("確認", message);
  }
  return window.confirm(message);
}

function buildTimeOptions(selectedValue, values) {
  const options = ['<option value=""></option>'];
  values.forEach((value) => {
    options.push(`<option value="${value}" ${value === selectedValue ? "selected" : ""}>${value}</option>`);
  });
  return options.join("");
}

function splitTimeValue(value) {
  const normalized = normalizeTimeText(value);
  if (!normalized) {
    return ["", ""];
  }
  return normalized.split(":");
}

function timeInputMarkup(id, value, disabled = false) {
  const [hour, minute] = splitTimeValue(value);
  const hours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
  const minutes = ["00", "10", "20", "30", "40", "50"];
  return `
    <div class="time-picker" data-time-field="${id}">
      <select id="${id}Hour" ${disabled ? "disabled" : ""}>
        ${buildTimeOptions(hour, hours)}
      </select>
      <span class="time-picker-separator">:</span>
      <select id="${id}Minute" ${disabled ? "disabled" : ""}>
        ${buildTimeOptions(minute, minutes)}
      </select>
    </div>
  `;
}

function readTimeInputValue(id) {
  const hour = document.getElementById(`${id}Hour`)?.value || "";
  const minute = document.getElementById(`${id}Minute`)?.value || "";
  if (!hour || !minute) {
    return "";
  }
  return normalizeTimeText(`${hour}:${minute}`);
}

function setTimeInputDisabled(id, disabled) {
  const hourInput = document.getElementById(`${id}Hour`);
  const minuteInput = document.getElementById(`${id}Minute`);
  if (hourInput) {
    hourInput.disabled = disabled;
  }
  if (minuteInput) {
    minuteInput.disabled = disabled;
  }
}


function getFixedEdgeAutoScrollDelta(position, start, end, edgeSize = 56, speed = 18) {
  if (!Number.isFinite(position) || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return 0;
  }
  const edge = Math.max(1, Number(edgeSize) || 1);
  const fixedSpeed = Math.max(0, Number(speed) || 0);
  if (position < start + edge) {
    return -fixedSpeed;
  }
  if (position > end - edge) {
    return fixedSpeed;
  }
  return 0;
}

function createFixedEdgeAutoScrollController({
  isActive,
  getBounds,
  onStep,
  horizontal = false,
  vertical = true,
  edgeSize = 56,
  speedX = 24,
  speedY = 18
} = {}) {
  let pointer = null;
  let frameId = 0;

  const stop = () => {
    pointer = null;
    if (frameId) {
      window.cancelAnimationFrame(frameId);
      frameId = 0;
    }
  };

  const run = () => {
    frameId = 0;
    if (!pointer || typeof isActive !== "function" || !isActive()) {
      return;
    }
    const bounds = typeof getBounds === "function" ? getBounds() : null;
    if (!bounds) {
      return;
    }
    const deltaX = horizontal
      ? getFixedEdgeAutoScrollDelta(pointer.x, bounds.left, bounds.right, edgeSize, speedX)
      : 0;
    const deltaY = vertical
      ? getFixedEdgeAutoScrollDelta(pointer.y, bounds.top, bounds.bottom, edgeSize, speedY)
      : 0;
    if (!deltaX && !deltaY) {
      return;
    }
    const changed = typeof onStep === "function"
      ? Boolean(onStep({ deltaX, deltaY, pointer: { ...pointer }, bounds }))
      : false;
    if (changed && isActive()) {
      frameId = window.requestAnimationFrame(run);
    }
  };

  const schedule = () => {
    if (!frameId && pointer && typeof isActive === "function" && isActive()) {
      frameId = window.requestAnimationFrame(run);
    }
  };

  return {
    updatePointer(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return;
      }
      pointer = { x, y };
      schedule();
    },
    stop,
    getPointer() {
      return pointer ? { ...pointer } : null;
    }
  };
}

function findNearestVerticalDragScrollContainer(target) {
  let element = target instanceof Element ? target : null;
  while (element && element !== document.body && element !== document.documentElement) {
    if (element instanceof HTMLElement && element.scrollHeight > element.clientHeight + 1) {
      const style = getComputedStyle(element);
      if (/(auto|scroll)/.test(style.overflowY || "")) {
        return element;
      }
    }
    element = element.parentElement;
  }
  return null;
}

function getVerticalDragScrollBounds(container) {
  if (container instanceof HTMLElement) {
    const rect = container.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      top: Math.max(0, rect.top),
      bottom: Math.min(window.innerHeight || document.documentElement.clientHeight || rect.bottom, rect.bottom)
    };
  }
  const height = window.innerHeight || document.documentElement.clientHeight || 0;
  return { left: 0, right: window.innerWidth || 0, top: 0, bottom: height };
}

function scrollVerticalDragTarget(container, deltaY) {
  if (!deltaY) {
    return false;
  }
  if (container instanceof HTMLElement) {
    const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
    const nextScrollTop = Math.min(maxScrollTop, Math.max(0, container.scrollTop + deltaY));
    if (Math.abs(nextScrollTop - container.scrollTop) <= 0.1) {
      return false;
    }
    container.scrollTop = nextScrollTop;
    return true;
  }
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const pageHeight = Math.max(document.documentElement.scrollHeight || 0, document.body?.scrollHeight || 0);
  const currentScrollY = window.scrollY || document.documentElement.scrollTop || 0;
  const maxScrollY = Math.max(0, pageHeight - viewportHeight);
  const nextScrollY = Math.min(maxScrollY, Math.max(0, currentScrollY + deltaY));
  if (Math.abs(nextScrollY - currentScrollY) <= 0.1) {
    return false;
  }
  window.scrollTo(window.scrollX || 0, nextScrollY);
  return true;
}
