# 排班系統

這個專案是排班管理的網頁版程式，主要功能包含：

- 班表編輯
- 班別、假別、加班設定
- 人員、單位設定
- 主管設定請假與加班
- 例休檢查
- 匯入 / 匯出

目前前端來源在 `src/renderer/`，GitHub Pages 發佈內容在 `docs/`。

## 重點摘要

- 目前資料不再以 `schedule_documents.payload` JSON 作為主要儲存來源。
- 單位、人員、班別、假別、加班、假日、班表排班與系統設定，都已拆到各自的 Supabase 資料表。
- 排班演算法名稱：`八週預覽式日別最小費用最大流排班法`。
- 演算法代號：`8W-Daily-MCMF Preview Scheduler`。
- 自動排班採用「先預覽、再存檔」，預排結果不會直接覆蓋正式班表。
- 主管權限負責維護單位、人員、班別、假別、加班與班表排班資料。

## 啟動與發佈

常用指令：

```bash
npm run web
npm run web:config
npm run web:check
npm run web:publish
npm run infra:migrate
```

說明：

- `npm run web`：啟動本機網頁版
- `npm run web:config`：依 `.env` 產生 `src/renderer/app-config.js`
- `npm run web:check`：檢查公開版 Supabase 設定
- `npm run web:publish`：把 `src/renderer/` 產生到 `docs/`，供 GitHub Pages 使用（會同步 `app-config.js`）
- `npm run infra:migrate`：對內網 Postgres 依序套用 `supabase/*.sql`（需設定 `DATABASE_URL`）

只要有改到網頁畫面、互動、樣式或前端資料流程，就要重新執行 `npm run web:publish`，否則 GitHub Pages 不會更新。

## 公開網域 + 內網資料庫

若要把前端部署到公開網域，同時讓 Postgres 只留在公司內網，請看 [infra/README.md](infra/README.md)。

重點：

- 前端：GitHub Pages 或 Cloudflare Pages（`docs/`）
- API：內網自架 Supabase + Cloudflare Tunnel 或 Nginx（`api.*` 子網域）
- 設定：repo 根目錄 `.env`（見 `.env.example`）
- 安全：套用 `supabase/018_tighten_anon_read_policies.sql`，移除匿名讀取班表

## 目前資料結構重點

- `src/renderer/`
  - 前端畫面、互動、班表邏輯
- `docs/`
  - GitHub Pages 靜態輸出
- `supabase/`
  - SQL schema、migration、Edge Functions
- `scripts/`
  - 發佈與檢查腳本

主要資料表：

- `scheduler_settings`：目前年月、畫面篩選、週期設定與排班規則設定。
- `departments`：單位資料，包含營業起訖日、是否隱藏於假別設定、排序。
- `profiles`：人員主檔，包含工號、姓名、角色、到離職日、日薪/月薪、固定例假星期。
- `member_departments`：人員可排單位與優先順序。
- `shift_types`：班別設定，包含適用單位、時間、需求人數、顏色與排序。
- `leave_types`：假別設定。
- `overtime_types`：加班設定。
- `holidays`：假日設定。
- `schedule_months`：班表月份資料。
- `schedule_entries`：每日排班格資料，包含班別、假別、加班與相關時間/原因。

## 自動排班邏輯與作法

目前自動排班採用「先預覽、再存檔」：按「自動排班」選定期間並開始排班後，預排結果會以綠色底色顯示在班表格子中；確認「確定存檔」後才寫入班表，綠色底色會消失。存檔後可使用「重新排班」以相同期間再次產生預覽。

演算法名稱：`八週預覽式日別最小費用最大流排班法`。

這個名稱的意思是：

- `八週預覽式`：以目前畫面選定的 8 週日期範圍建立預排結果，先顯示預覽，再由主管決定是否存檔。
- `日別`：每天分開求解，不做 8 週全域最佳化。
- `最小費用最大流`：每日班別派工用 min-cost max-flow，在盡量補滿需求人數的前提下，依成本排序挑選較適合的人員。
- `排班法`：最小費用最大流只負責派班，固定例假與休息日補足另由規則流程處理。

### 使用資料

- 排班範圍以目前班表顯示的 8 週為準，不一次排整個月。
- `週期設定` 可設定 `八週起算日`、`每週起算日`、`每月起算日`；八週起算日決定預設顯示哪個 8 週週期。
- 班別只納入「未隱藏」、`需求人數 > 0`，且適用單位當天在營業期間內的班別；不顯示或非營業期間的班別不會被自動排入。
- 單位只填開始日期時，從開始日期當天起視為營業；只填結束日期時，結束日期以前視為營業；兩者都沒填則視為不限期間。
- 人員需在職才會被納入；`排班單位` 用來判斷可排哪些班別，第一個排班單位視為主要單位。
- 人員的 `例假星期` 用來安排固定例假；`計薪方式` 用來區分月薪、日薪排班優先順序。
- 假別代碼 `0036` 視為例假，`0047` 視為休息日。
- 主管已手動指定的班別、假別原則上視為既有結果，不會被自動排班移除。

### 排班流程

1. 建立預覽用班表

- 先複製目前班表資料，所有計算都先寫在預覽資料裡。
- 預覽只記錄和原班表不同的格子，避免存檔時覆蓋不相關資料。

2. 先安排固定例假

- 每位在職人員依 `例假星期`，在 8 週內對應星期排入 `例假 0036`。
- 若該日已經有班別，保留班別並加上例假，視為「例假加班」。
- 若該日原本已有假別，會以預排規則覆蓋為固定例假。

3. 計算每人應有休假目標

- 以 8 週 56 天為基準，先算 `在職日數 / 56 * 16`，四捨五入得到應有休假總天數。
- 扣掉已排入的固定例假後，剩餘天數就是這 8 週要補足的休息日目標。
- 在職未滿 8 週的人會依在職日數比例給假。

4. 每天用最小費用最大流排班

- 每天重新統計各班別需求人數，已手動排好的班別會先扣掉需求。
- 候選人必須當天在職、尚未排班、尚未排假，且排班單位可支援該班別。
- 先盡量讓總缺班數最少；同樣可排人數下，優先讓每個缺人的班別至少有 1 人。
- 候選人成本由低到高為：一定要上班、月薪本單位、月薪、月薪且休息日未達上限且本週未排休息日、日薪。
- 每人每天最多只會被排一個班別。
- `需求人數` 用來計算自動排班目標與缺額；手動點選、貼上班表可超過需求人數。

5. 每天排完後補多餘人力為休息日

- 當天沒有被排班、沒有排假，且休息日仍不足的人，會被補成 `休息日 0047`。
- 補休息日時，同一週已經有休息日的人不再補。
- 日薪人員優先補休息日；月薪人員依目前休息日較少者優先。

6. 最後補足仍不足的休息日

- 若 8 週排完後仍有人休息日不足，會找該人沒有休息日的週期第一個可用日期補上。
- 若該日已經有班別，保留班別並加上休息日，視為「休息日加班」。
- 若找不到可補日期，會留下提醒訊息。

7. 確定存檔

- 存檔前會再次確認。
- 存檔時會把預覽格子寫入正式班表。
- 存檔完成後會重新整理主管設定的請假/加班資料、清掉空白班表格，再存檔。
- 存檔後可使用「重新排班」以相同期間再次產生預覽。

### 已知限制

- 目前不考慮人員職位。
- 派班演算法是「每日」最小費用最大流，不是一次對 8 週做全域最佳化。
- 休息日分配使用貪婪補法，目標是穩定快速，不窮舉所有排列。
- 如果人力不足，系統會保留缺班並顯示提醒，不會硬塞不符合條件的人。
- 班別檢視只用來查看結果，不做自動排班操作。

### 主要程式入口

- `buildAutoSchedulePreview()`：建立自動排班預覽。
- `findMinimumCostFlowAssignments()`：每日最小費用最大流排班。
- `placeDailySurplusRestDays()`：每日排完班後，把多餘人力補為休息日。
- `applyAutoSchedulePreview()`：確定存檔並寫入正式班表。

## 例休檢查

目前例休檢查重點：

- 每 7 天至少 1 天例假
- 每 7 天至少 1 天休息日
- 連續出勤不得超過 6 天

補充：

- `連續出勤 > 6 天` 是用任意滑動日數檢查，不是只看單週
- 檢查會包含上個月銜接資料
- 目前系統以已標記的 `例假 0036 / 休息日 0047` 為準
- 空白未排班不自動視為例假或休息日

## 資料庫 / Supabase

主要班表資料已改為正規化資料表儲存，不再用 `schedule_documents.payload` JSON 作為正式讀寫來源。舊 JSON 只在 migration 內作為一次性回填來源。

目前必須確認已執行：

- `supabase/017_normalized_scheduler_storage.sql`

自動排班相關基礎設定目前已對應到資料欄位或前端狀態，重點包含：

- `profiles.schedule_department_ids`
- `profiles.pay_by_day`
- `member_departments.sort_order`
- `shift_types.required_staff_count`
- `schedule_months.month_start_day`
- `scheduler_settings.week_start`
- `scheduler_settings.eight_week_start_date`
- `state.rules.weekStart`
- `state.rules.eightWeekStartDate`
- `member.fixedRestWeekday`

如果新環境要補齊這些欄位，請確認有執行：

- `supabase/015_auto_schedule_settings.sql`

如果有動到會員 / 人員同步相關欄位，也要同步確認：

- `supabase/functions/member-auth-admin/index.ts`

## 維護提醒

- 改前端後，記得執行 `npm run web:publish`
- GitHub Pages 使用的是 `docs/`，不是直接讀 `src/renderer/`
- 若只有改 SQL 或文件，不一定要重建 `docs/`
- 若有改到頁面行為，提交前最好至少檢查：

```bash
node --check src/renderer/renderer.js
node --check src/renderer/web-api.js
npm run web:publish
```

## 備註

這份 README 的重點是整理目前已經實作好的結構與規則，尤其是自動排班的資料來源、計算流程和目前限制。若後續調整排班策略，請同步更新「自動排班邏輯與作法」段落。
