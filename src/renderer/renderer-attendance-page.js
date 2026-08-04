/* 簽到簿表格內的定位與上、下班打卡控制。 */

function formatClockTime(value) {
  if (!value) return "--:--";
  return new Intl.DateTimeFormat("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Taipei"
  }).format(new Date(value));
}

function getBrowserPosition() {
  const userAgent = navigator.userAgent || "";
  const isTablet = /iPad|Tablet|Silk/i.test(userAgent)
    || (/Android/i.test(userAgent) && !/Mobile|Mobi/i.test(userAgent));
  const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches;
  const narrowTouch = !isTablet && coarsePointer && navigator.maxTouchPoints > 0
    && Math.min(window.screen?.width || window.innerWidth, window.screen?.height || window.innerHeight) <= 820;
  const isPhone = Boolean(navigator.userAgentData?.mobile || narrowTouch
    || (!isTablet && /Android|iPhone|iPod|Windows Phone|Mobi|Mobile/i.test(userAgent)));
  if (!isPhone || !navigator.geolocation) return Promise.resolve({});
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

async function submitAttendanceClock(action, workDate) {
  if (!isLoggedIn()) {
    openSignInDialog();
    return;
  }
  if (workDate !== getTodayDateString()) {
    showInfoMessage("只能在今天的紀錄列打卡");
    return;
  }
  if (attendanceState.saving) return;
  const label = action === "clock_in" ? "上班" : "下班";
  const confirmed = await confirmAction(`確定要${label}打卡嗎？`);
  if (!confirmed) return;
  attendanceState = { saving: true, error: "" };
  renderAll();
  try {
    const position = await getBrowserPosition();
    await window.schedulerApi.clockAttendance(action, position);
    attendanceState = { saving: false, error: "" };
    await loadRecordsPage();
    showInfoMessage(`${label}打卡完成`);
  } catch (error) {
    attendanceState = { saving: false, error: error.message || "打卡失敗" };
    showInfoMessage(attendanceState.error);
    renderAll();
  }
}
