# AI 開發代理人專案說明

本儲存庫是福圓號排班系統。

## 開始處理前

- 前端原始碼：`src/renderer/`
- GitHub Pages 發布檔案：`docs/`
- Supabase 現行資料庫結構與 RPC：`supabase/`
- 工具與檢查腳本：`scripts/`

## 編碼與語言

- 本儲存庫的文字檔一律使用 UTF-8 編碼儲存。
- 中文文件維持使用繁體中文，除非使用者明確要求英文。

## 必須遵守的規則

0. 回覆保持精簡，只回報高層次的處理進度，不逐項報告低階操作。

1. 若工作涉及網頁介面、互動、樣式或前端資料流程，必須執行：

```bash
npm run web:publish
```

2. GitHub Pages 使用的是 `docs/`，不是 `src/renderer/`。若 `docs/` 未同步，正式網站就不會是最新版本。

3. 若前端程式有修改，且使用者沒有明確要求不要提交，應提交並推送至 `main`，讓 GitHub Pages 更新。

4. 最終回覆必須說明：
   - `docs/` 是否已更新。
   - 是否已推送至 `main`。

## 班表資料儲存規則

- `schedule_entries` 是目前唯一正式使用的班表格資料表。
- 每一列代表一位人員在一個日期的班表格：`member_id + work_date`。
- 班別、假別與班表加班均儲存在同一列的不同欄位。
- 下列舊版員工申請物件已停用，不得重新使用：
  - `leave_requests`
  - `overtime_requests`
  - `request_status`
  - `request_type`
  - `get_public_schedule_requests()`
- 班表格批次寫入應使用 `supabase/002_current_updates.sql` 內的 RPC。

## 自動排班現況

自動排班功能目前已有基礎設定，以及「預覽／套用」流程。下列欄位均視為正式使用中：

- `rules.weekStart`
- `rules.monthStartDay`
- `shift.requiredStaffCount`
- `member.scheduleDeptIds`
- `member.monthlyRestDays`

除非使用者另有指示，目前採用下列規則：

- 每位人員每天最多只能安排一個班別。
- 優先安排人員所屬單位，其次才安排可支援的其他單位。
- 手動設定的班別與假別視為鎖定資料，不得由自動排班覆寫。
- 每月休假天數是固定目標。
- 已排入的例假與休息日均計入每月休假天數。
- 若需求人數無法補足，保留空白班表格，不強制安排。
- 同一單位同一天有多個班別缺人時，依班別設定順序補足。

## 例假與休息日檢查

目前檢查規則：

- 每 7 天至少有 1 天例假。
- 每 7 天至少有 1 天休息日。
- 連續上班不得超過 6 天。

連續上班檢查採滑動區間計算，並包含上個月延續下來的上班天數。

## SQL 與同步檢查提醒

若工作涉及自動排班的基礎欄位，必須檢查：

- `supabase/001_current_schema.sql`
- `supabase/functions/member-auth-admin/index.ts`
- `src/renderer/web-api.js`

若工作涉及班表格資料儲存，必須檢查：

- `supabase/001_current_schema.sql`
- `supabase/002_current_updates.sql`
- `src/renderer/web-api.js`
- `scripts/check-normalized-storage.js`
