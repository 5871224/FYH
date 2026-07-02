# 排班系統

這是瀏覽器版排班系統，資料存放在 Supabase，GitHub Pages 發佈內容在 `docs/`。

## 主要功能

- 單位、人員、班別、假別、加班、國定假日設定
- 班表檢視與編輯
- 透過 Supabase RPC 批次儲存班表格
- 自動排班預覽 / 套用流程
- 例假、休息日、連續上班檢查
- 匯入 / 匯出輔助工具

## 專案結構

- `src/renderer/`：前端原始碼。
- `docs/`：GitHub Pages 使用的靜態網站輸出。
- `supabase/`：SQL migration、RPC、Edge Function。
- `scripts/`：本機檢查與發佈輔助腳本。

## 常用指令

```bash
npm run web
npm run web:check
npm run web:publish
```

- `npm run web`：啟動本機靜態預覽伺服器。
- `npm run web:check`：檢查公開 Supabase 設定。
- `npm run web:publish`：將 `src/renderer/` 複製到 `docs/`，並更新資源版本參數。

修改前端後要執行 `npm run web:publish`，否則 GitHub Pages 可能仍是舊版。

## 目前儲存模型

目前使用正規化 Supabase 資料表。舊的 JSON 文件儲存已不是正式資料來源。

目前班表格儲存方式：

- `schedule_entries` 是班表格唯一正式來源。
- 一個格子以 `member_id + work_date` 唯一識別。
- 班別、假別、加班存在同一列。
- 批次寫入使用 `public.save_schedule_entries_bulk(entries jsonb)`。

舊申請流程物件已移除，不應再使用：

- `leave_requests`
- `overtime_requests`
- `request_status`
- `request_type`
- `get_public_schedule_requests()`

## 自動排班

自動排班目前是「先預覽、再套用」流程，會使用：

- 人員在職日期
- 人員可支援單位順序
- 班別需求人數
- 固定休假星期
- 每月休假天數目標
- 例假 / 休息日 / 連續上班規則

重要函式：

- `buildAutoSchedulePreview()`
- `findMinimumCostFlowAssignments()`
- `placeDailySurplusRestDays()`
- `applyAutoSchedulePreview()`

## 驗證

常用檢查：

```bash
node --check src/renderer/renderer.js
node --check src/renderer/web-api.js
node scripts/check-normalized-storage.js
node scripts/check-request-overlay-imports.js
node scripts/check-settings-lists.js
npm run web:publish
```
