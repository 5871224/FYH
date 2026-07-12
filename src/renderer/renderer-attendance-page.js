/* 打卡頁資料讀取與打卡控制。
 * 由 renderer.js 拆分；維持既有全域 bundle 執行方式。
 */

function formatClockTime(value) {
  if (!value) {
    return "--:--";
  }
  return new Intl.DateTimeFormat("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Taipei"
  }).format(new Date(value));
}

function getTodayShiftSummary() {
  const member = currentMember || resolveCurrentMember();
  const dateString = attendanceState.serverDate || getTodayDateString();
  const shift = getItem("shift", getSlot(member?.id || "", dateString)?.shift);
  if (!shift) {
    return "今日未排班";
  }
  return `${shift.name || "班別"}：${shift.startTime || "--:--"} ~ ${shift.endTime || "--:--"}`;
}

function getBrowserPosition() {
  const userAgent = navigator.userAgent || "";
  const isTablet = /iPad|Tablet|Silk/i.test(userAgent)
    || (/Android/i.test(userAgent) && !/Mobile|Mobi/i.test(userAgent));
  const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches;
  const narrowTouch = !isTablet && coarsePointer && navigator.maxTouchPoints > 0 && Math.min(window.screen?.width || window.innerWidth, window.screen?.height || window.innerHeight) <= 820;
  const isPhone = Boolean(navigator.userAgentData?.mobile || narrowTouch || (!isTablet && /Android|iPhone|iPod|Windows Phone|Mobi|Mobile/i.test(userAgent)));
  if (!isPhone || !navigator.geolocation) {
    return Promise.resolve({});
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      }),
      (error) => {
        const message = error.code === error.PERMISSION_DENIED
          ? "手機定位權限未開啟，請允許瀏覽器定位後再打卡"
          : error.code === error.TIMEOUT
            ? "手機定位逾時，請到空曠處或重新開啟定位後再打卡"
            : "手機無法取得 GPS 定位，請確認定位服務已開啟";
        resolve({ geolocationError: message });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

async function loadTodayAttendance() {
  if (!isLoggedIn()) {
    return;
  }
  attendanceState = { ...attendanceState, loading: true, error: "" };
  renderAll();
  try {
    const result = await window.schedulerApi.getTodayAttendance();
    attendanceState = {
      loading: false,
      saving: false,
      record: result.record || null,
      serverDate: result.serverDate || getTodayDateString(),
      error: ""
    };
  } catch (error) {
    attendanceState = {
      loading: false,
      saving: false,
      record: null,
      serverDate: getTodayDateString(),
      error: error.message || "讀取打卡狀態失敗"
    };
  }
  renderAll();
}

async function maybePromptOvertimeAfterClockOut() {
  return false;
}

async function submitAttendanceClock(action) {
  if (!isLoggedIn()) {
    openSignInDialog();
    return;
  }
  if (attendanceState.saving) {
    return;
  }
  const confirmed = await confirmAction(action === "clock_in" ? "確定要上班打卡嗎？" : "確定要下班打卡嗎？");
  if (!confirmed) {
    return;
  }
  attendanceState = { ...attendanceState, saving: true, error: "" };
  renderAll();
  try {
    const position = await getBrowserPosition();
    const result = await window.schedulerApi.clockAttendance(action, position);
    attendanceState = {
      loading: false,
      saving: false,
      record: result.record || null,
      serverDate: result.serverDate || getTodayDateString(),
      error: ""
    };
    const overtimeStatus = action === "clock_out" ? await loadTodayAttendanceOvertime(false) : null;
    const promptedOvertime = action === "clock_out" ? await maybePromptOvertimeAfterClockOut(overtimeStatus) : false;
    if (!promptedOvertime) {
      showInfoMessage(action === "clock_in" ? "上班打卡完成" : "下班打卡完成");
    }
  } catch (error) {
    attendanceState = {
      ...attendanceState,
      loading: false,
      saving: false,
      error: error.message || "打卡失敗"
    };
  }
  renderAll();
}
