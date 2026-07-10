(() => {
  // 打卡完成後不再依提早上班或延後下班時間自動建議加班。
  // 員工仍可從打卡頁手動展開並送出加班申請。
  maybePromptOvertimeAfterClockOut = async function neverPromptOvertimeAfterClockOut() {
    return false;
  };
})();
