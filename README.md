# 排班系統

這是瀏覽器版排班系統，資料存放在 Supabase，GitHub Pages 發佈內容在 `docs/`。

## 主要功能

- 單位、人員、班別、假別、加班、國定假日設定
- 班表檢視與編輯
- 員工登入、首頁、打卡、訂餐、個人記錄
- 主管訂餐設定、訂餐統計與匯出
- 管理員打卡管理、打卡修改歷程、加班審核
- 透過 Supabase RPC 批次儲存班表格
- 自動排班預覽 / 套用流程
- 例假、休息日、連續上班檢查
- 匯入 / 匯出輔助工具

## 規格書摘要

本 README 摘錄《規格書》的目前需求；完整且最新規格以儲存庫根目錄的 `規格書.txt` 為準。系統以手機優先，正式時間判定一律使用伺服器端 `Asia/Taipei`，不得用使用者本機時間作為到離職有效期、打卡、加班申請期限、訂餐日期與截止時間的正式判定。

角色分為：

- `employee`：查看完整班表、打卡、今日訂餐、個人記錄、提出與期限內重提自己的加班申請；沒有新增、修改或刪除帳號的權限。
- `manager`：具備員工權限，可管理班表、員工與主管的非權限資料、一般單位、訂餐商品與截止時間，並查看及匯出訂餐統計。主管可刪除員工或主管帳號，但不可建立、修改、重設或刪除管理員帳號。
- `admin`：具備全部功能，可管理角色、管理員、打卡設定、打卡補登/修改/刪除、打卡稽核資料、加班審核與批次操作。

V2 頁面與權限重點：

- 首頁只顯示主要入口；管理功能依角色顯示，不讓員工看到主管/管理員工具。
- 手機版首頁的「修改密碼」與「登出」放在姓名右側並靠右對齊；首頁四個主入口按鈕採較小尺寸且文字置中。
- Android 系統返回鍵：目前畫面有可關閉視窗時等同按「關閉」；沒有可關閉視窗時回到首頁。
- 打卡、訂餐、記錄頁的返回首頁控制使用 X 圖示，放在姓名右側並靠右對齊。
- 班表頁所有登入角色都可查看完整班表表格；手機版班表頂部控制列必須可換行，不得撐破版面。
- 手機登入使用可跨關閉保留的 48 小時滑動閒置期限；Android 平板、iPad、其他平板與觸控筆電一律視為電腦，使用分頁階段儲存與 30 分鐘滑動閒置期限。不確定裝置類型時預設視為電腦。
- 刪除帳號時，Supabase Auth 登入帳號與 `set_employee` 人員資料必須由資料庫外鍵級聯在同一筆刪除交易中完成；任何一步失敗都不得留下單邊資料。
- 打卡使用伺服器端有效任職檢查、單位打卡設定、GPS/IP/距離資料與異常標記。打卡頁顯示今日班別與時間，已打卡狀態顯示在上下班打卡按鈕內，例如 `08:50在莊敬打卡(GPS)`。管理員可補登或修改上下班時間，修改歷程寫入 `attendance_action_logs`；本次異動原因為選填。
- 加班以 `attendance_overtime_requests` 為正式申請來源，審核歷程寫入 `overtime_review_logs`。打卡頁的員工加班申請預設只顯示「加班申請」勾選框，勾選後才載入完整申請區塊；下班打卡後若提早上班或延後下班達 0.5 小時以上，系統自動詢問是否申請並帶入計算時數。員工可在期限內刪除待審或退回申請後重新申請；管理員可審核、退回、調整核准時數與代為申請。
- 訂餐以 `meal_orders` 為正式訂單來源，不另設訂單主檔。商品與價格在 `meal_products`，截止時間在 `meal_settings`。訂餐數量只能輸入 0 或正整數，負數、小數及其他非整數內容必須在輸入當下拒絕，不得自動轉成其他數值。
- 主管與管理員可在訂餐頁設定商品、截止時間、查看訂餐統計與匯出 Excel。訂餐統計可切換「明細」、「品項」、「人員」報表；警告併入備註欄，不另顯示警告欄。訂餐統計與匯出不顯示員工工號、首次下訂時間及最後修改時間。
- 記錄頁權限：員工只有個人記錄；管理員另有加班審核、打卡管理。訂餐統計不放在記錄頁。

驗收重點：

- 員工不能看到或呼叫主管/管理員資料與操作，也不能刪除任何帳號。
- 主管可管理員工與主管，但不能建立、修改、重設或刪除管理員，不能使用打卡管理與加班審核。
- 帳號刪除必須同步移除 Auth 與人員資料，不得先刪其中一邊再嘗試刪另一邊。
- 管理員操作應留下必要歷程，打卡異動原因為選填，空白原因不得阻擋補登或修改。
- 訂餐統計不顯示員工工號，不顯示首次下訂與最後修改欄位。
- GitHub Pages 發佈內容必須由 `npm run web:publish` 更新 `docs/`。

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

## GitHub Pages 發佈

- Pages 發佈來源為 `docs/`。
- 自訂工作流程位於 `.github/workflows/deploy-pages.yml`。
- 工作流程使用 `actions/checkout@v5`、`actions/configure-pages@v5`、`actions/upload-pages-artifact@v5` 與 `actions/deploy-pages@v5`。
- 網站為靜態檔案，不需要在 Pages 工作流程中執行 npm 建置。

## 目前儲存模型

目前使用正規化 Supabase 資料表。舊的 JSON 文件儲存已不是正式資料來源。

目前班表格儲存方式：

- `schedule_entries` 是班表格唯一正式來源。
- 一個格子以 `member_id + work_date` 唯一識別。
- 班別、假別、加班存在同一列。
- 批次寫入使用 `public.save_schedule_entries_bulk(entries jsonb)`。
- 打卡資料以 `attendance_records` 為目前有效資料，修改歷程寫入 `attendance_action_logs`。
- 加班申請以 `attendance_overtime_requests` 為來源，審核歷程寫入 `overtime_review_logs`。
- 訂餐商品、截止時間、訂單分別存在 `meal_products`、`meal_settings`、`meal_orders`。

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
node scripts/check-settings-lists.js
npm run web:publish
```
