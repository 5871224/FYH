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
  if (!isPhone) return Promise.resolve({});
  if (!navigator.geolocation) {
    return Promise.resolve({ geolocationError: "手機瀏覽器無法使用定位，請開啟定位服務或改用支援定位的瀏覽器" });
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

function attendanceClockFailureReason(error) {
  const message = String(error?.message || error || "").trim();
  if (!message) return "無法取得失敗原因，請重新嘗試或洽管理員";
  if (/Failed to fetch|NetworkError|Load failed|Network request failed|fetch failed|ERR_CONNECTION_RESET|HTTP 50[234]/i.test(message)) {
    return "無法連線到打卡服務，請檢查網路後重試";
  }
  if (/HTTP 40[13]|Invalid JWT|JWT expired|Unauthorized/i.test(message)) {
    return "登入狀態已失效，請重新登入";
  }
  if (/HTTP 429/i.test(message)) return "打卡請求過於頻繁，請稍後再試";
  return message;
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
  const confirmed = await confirmAction("確定要" + label + "打卡嗎？");
  if (!confirmed) return;
  attendanceState = { saving: true, error: "" };
  renderAll();
  try {
    const position = await getBrowserPosition();
    const response = await window.schedulerApi.clockAttendance(action, position);
    if (response?.ok === false) {
      throw new Error(response.message || "打卡服務未接受本次打卡");
    }
  } catch (error) {
    attendanceState = { saving: false, error: attendanceClockFailureReason(error) };
    showInfoMessage(label + "打卡失敗：" + attendanceState.error);
    renderAll();
    return;
  }
  attendanceState = { saving: false, error: "" };
  try {
    await loadRecordsPage();
    showInfoMessage(label + "打卡完成");
  } catch (error) {
    showInfoMessage(label + "打卡已完成，但畫面更新失敗，請重新整理確認紀錄");
    renderAll();
  }
}
