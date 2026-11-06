const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.resolve(__dirname, "../src/renderer/renderer-records-actions.js"), "utf8");

async function exercise({ confirmed = true, failure = null } = {}) {
  const calls = [];
  const button = { dataset: { deleteAttendanceHistory: "log-42", historyRecordId: "day-17" }, disabled: false };
  const sandbox = {
    button,
    window: { schedulerApi: { deleteAttendanceHistory: async (recordId, logId) => {
      calls.push(["delete", recordId, logId]);
      if (failure) throw new Error(failure);
    } } },
    confirmAction: async () => { calls.push(["confirm"]); return confirmed; },
    openAttendanceHistoryModal: async (recordId) => { calls.push(["reload", recordId]); },
    showInfoMessage: (message) => { calls.push(["error", message]); }
  };
  await vm.runInNewContext(source + "\n deleteAttendanceHistoryLog(button)", sandbox);
  return { calls, button };
}

test("歷程刪除取消時不呼叫後端", async () => {
  const { calls, button } = await exercise({ confirmed: false });
  assert.deepEqual(calls, [["confirm"]]);
  assert.equal(button.disabled, false);
});

test("歷程刪除只傳送指定紀錄，成功後刷新歷程", async () => {
  const { calls, button } = await exercise();
  assert.deepEqual(calls, [["confirm"], ["delete", "day-17", "log-42"], ["reload", "day-17"]]);
  assert.equal(button.disabled, true);
});

test("歷程刪除失敗恢復按鈕並顯示錯誤", async () => {
  const { calls, button } = await exercise({ failure: "沒有簽到審核權限" });
  assert.deepEqual(calls, [["confirm"], ["delete", "day-17", "log-42"], ["error", "沒有簽到審核權限"]]);
  assert.equal(button.disabled, false);
});
