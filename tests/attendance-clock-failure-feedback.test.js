const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const script = fs.readFileSync(path.resolve(__dirname, "../src/renderer/renderer-attendance-page.js"), "utf8");

async function runClock({ clockAttendance, loadRecordsPage = async () => {} }) {
  const messages = [];
  const sandbox = {
    navigator: { userAgent: "Desktop" },
    window: { schedulerApi: { clockAttendance } },
    attendanceState: { saving: false, error: "" },
    isLoggedIn: () => true,
    getTodayDateString: () => "2026-11-05",
    confirmAction: async () => true,
    showInfoMessage: (message) => messages.push(message),
    renderAll: () => {},
    loadRecordsPage
  };
  vm.runInNewContext(script, sandbox);
  await sandbox.submitAttendanceClock("clock_in", "2026-11-05");
  return { messages, state: sandbox.attendanceState };
}

test("打卡遭拒應顯示實際位置原因，不得顯示成功", async () => {
  const result = await runClock({
    clockAttendance: async () => {
      throw new Error("目前距離最近可打卡單位約 450 公尺，需在 300 公尺內");
    }
  });
  assert.deepEqual(result.messages, ["上班打卡失敗：目前距離最近可打卡單位約 450 公尺，需在 300 公尺內"]);
  assert.equal(result.state.saving, false);
});

test("打卡服務連線中斷應顯示網路原因", async () => {
  const result = await runClock({ clockAttendance: async () => { throw new TypeError("Failed to fetch"); } });
  assert.deepEqual(result.messages, ["上班打卡失敗：無法連線到打卡服務，請檢查網路後重試"]);
});

test("伺服器已打卡成功但畫面更新失敗，不得誤報打卡失敗", async () => {
  const result = await runClock({
    clockAttendance: async () => ({ ok: true }),
    loadRecordsPage: async () => { throw new Error("讀取失敗"); }
  });
  assert.deepEqual(result.messages, ["上班打卡已完成，但畫面更新失敗，請重新整理確認紀錄"]);
  assert.equal(result.state.error, "");
});

test("伺服器明確拒絕打卡不可當作成功", async () => {
  const result = await runClock({
    clockAttendance: async () => ({ ok: false, message: "今日已打過上班卡" })
  });
  assert.deepEqual(result.messages, ["上班打卡失敗：今日已打過上班卡"]);
});
