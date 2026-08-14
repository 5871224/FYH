# 福圓號排班系統

福圓號排班系統是手機優先的瀏覽器應用程式，涵蓋多群組班表、簽到簿、訂餐、個人記錄、簽到審核、角色權限與班表封存。

詳細功能、資料、安全、介面與驗收規格以 [`規格書.md`](規格書.md) 為唯一正式依據。

## 現行架構

```text
瀏覽器前端
  ↓ /api/v1/*（FYH API）
FYH Node.js Backend
  ├─ Session / Native Auth
  ├─ API Router / API Contract
  ├─ Domain Services
  └─ Native Repositories
  ↓ PostgreSQL transaction / SQL
PostgreSQL
```

目前 PostgreSQL 由 Supabase 提供主機服務，但 FYH 的應用程式資料契約不依賴 Supabase 專屬執行機制；未來可改接其他一般 PostgreSQL 服務。

正式責任邊界：

- 瀏覽器只呼叫 `/api/v1/*`，不得直接呼叫 Supabase REST、RPC 或 Edge Functions。
- 登入由 FYH Backend 的 Native Auth 與 Session 管理。
- 權限、適用群組與交易流程由 Backend services / repositories 負責。
- Backend 使用 `pg` 透過 PostgreSQL 連線字串直接存取資料庫。
- PostgreSQL 保存正式資料，並只保留必要的 constraint、index、trigger 與內部 helper。
- 資料庫 function 不得成為瀏覽器 API。
- `src/renderer/web-api.js` 是瀏覽器對 FYH API 的唯一正式 transport adapter。
- `src/backend/api-contract.js` 是 FYH API 路由契約的正式清單。
- Supabase Edge Functions 已退出正式架構；repository 不再保存 Edge Function 原始碼、Deno runtime 或部署腳本。

## 單一正式版本原則

本系統尚未正式上線，因此 repository 只維護目前正式資料模型與 API 契約：

- 不保留舊資料表、舊欄位、舊端點、舊 payload 或雙軌讀寫。
- 不以 `try/catch` 靜默退回舊流程；必要正式服務不可用時直接回報錯誤。
- 不以後載入模組覆寫既有函式，不新增 `fix`、`patch`、`override` 或相容代理模組。
- 不在瀏覽器保存資料庫平台金鑰或資料表直連 helper。
- 資料庫調整直接更新兩份正式 SQL，不保留歷史 migration 串作為正式建置流程。

## 主要頁面

- **首頁：** 登入者姓名、角色、簽到簿、班表、依所屬群組開關顯示的訂餐、修改密碼與登出。
- **簽到簿：** 個人記錄、今日上下班打卡、簽到審核、備註與匯出。
- **班表：** 群組切換、八週班表、班別／假別／班表加班、排班工具、群組設定、角色權限與班表封存。
- **訂餐：** 今日訂餐、訂餐統計與訂餐設定；首頁訂餐入口依人員所屬群組的「可否訂餐」設定顯示。

## 專案結構

```text
FYH/
├─ .github/workflows/deploy-pages.yml
├─ docs/                              # GitHub Pages 發布成品
├─ scripts/                           # 建置、檢查與架構稽核
├─ src/
│  ├─ web-server.js                   # FYH HTTP server
│  ├─ backend/                        # FYH API / Auth / Session / Domain / Repository
│  └─ renderer/                       # 前端唯一正式原始碼
│     └─ css/                         # CSS 模組原始碼
├─ supabase/
│  ├─ 001_current_schema.sql          # 全新 PostgreSQL 完整結構
│  └─ 002_current_updates.sql         # 索引、內部 helper、trigger、初始設定
├─ tests/
├─ AGENTS.md
├─ README.md
├─ package.json
├─ 規格書.md
└─ 啟動網頁版.bat
```

`supabase/` 是沿用的 SQL 目錄名稱，不代表 SQL 必須使用 Supabase 專屬功能。

## FYH Backend

主要模組：

- `src/backend/api-contract.js`：FYH API method/path 契約。
- `src/backend/api-router.js`：HTTP request routing、Session 與錯誤回應。
- `src/backend/session-store.js`：Session 生命週期。
- `src/backend/providers/native-auth-provider.js`：Native 登入、登入狀態與改密碼。
- `src/backend/services/`：排班、設定、人員、群組／角色等領域規則。
- `src/backend/repositories/`：PostgreSQL 資料存取與交易。
- `src/backend/native-attendance.js`：簽到、簽到簿、簽到審核與匯出。
- `src/backend/native-meal.js`：訂餐、取消、設定與統計。
- `src/backend/db/database.js`：共用 query / one / transaction 介面。
- `src/backend/db/postgres.js`：以 `DATABASE_URL` 或 `POSTGRES_URL` 建立 PostgreSQL pool。

Production 必須使用持久化 Session store；記憶體 Session 只適合非 production 執行與測試。

## 資料庫建置順序

全新 PostgreSQL 固定依序執行：

```text
1. supabase/001_current_schema.sql
2. supabase/002_current_updates.sql
```

這兩個檔案是唯一正式 SQL 來源。

資料層原則：

- `001_current_schema.sql` 直接建立目前正式資料表與 constraint，不先建立淘汰結構再清理。
- `002_current_updates.sql` 只建立目前有效的 index、資料完整性 helper、trigger 與必要預設資料。
- 正式資料使用 normalized tables，例如 `schedule_entries`、`attendance_days`、`attendance_audit_logs`、`meal_orders`。
- Backend 使用 PostgreSQL transaction 實作跨表一致性。
- PostgreSQL trigger/helper 只負責真正適合資料庫層的資料完整性，例如封存班表不可變動、群組一致性與名稱快照。
- 登入、Session、功能權限與適用群組驗證不依賴資料庫平台身分系統。
- 正式 SQL 不依賴 Supabase Auth、平台 RLS、平台 API roles 或 browser-facing RPC。

## 權限與資料存取

瀏覽器不直接 CRUD 核心資料表。正式資料流固定為：

`瀏覽器 → FYH API → Session → 權限／適用群組驗證 → Native service/repository → PostgreSQL`

- 班表讀取需要 `schedule_view`；班表修改需要 `schedule_manage`。
- 人員設定以 `member_settings` 等明確權限項目判斷。
- 簽到審核以 `attendance_review` 與角色適用群組判斷。
- 訂餐管理以 `meal_admin` 與角色適用群組判斷。
- 已軟刪除或已超過帳號有效期間的人員，即使舊 Session 仍存在，也不得繼續使用受保護功能。
- 打卡可用單位必須先限制在人員所屬群組，再執行 GPS／IP 比對。
- 不使用文字 `admin/manager/employee` 作為實際授權依據；正式授權依 `access_role_id`、permissions 與 `access_role_groups`。

## 前端資料存取限制

`src/renderer/` 必須遵守：

- 不出現 `/rest/v1/` 核心資料直連。
- 不出現 `/functions/v1/`。
- 不出現 `callRpc()`、`requestFunction()`、`restSelect()`、`restInsert()`、`restUpdate()`、`restDelete()`。
- 不保存 Supabase anon/service key。
- 所有正式網路操作由 `web-api.js` 使用具名 `/api/v1/*` 路徑完成。

## Supabase 專屬機制清理狀態

FYH 應用層的清理已完成：

- 瀏覽器已移除 Supabase REST／RPC／Edge Function transport。
- Edge Function 原始碼與 Deno runtime 已從 repository 移除。
- Edge Function 部署腳本與公開 Supabase 檢查腳本已移除。
- 正式 SQL 已移除 `auth.uid()`／`auth.role()` 相依。
- 正式 SQL 已移除應用層 RLS policy 與自動啟用 RLS 的機制。
- 正式 SQL 已移除 `anon`／`authenticated`／`service_role` 作為應用授權契約。
- 舊班表、設定、人員、打卡與訂餐 browser-facing RPC 已移除。
- 仍保留的資料庫 functions 只屬一般 PostgreSQL 資料完整性 helper，且不作為瀏覽器端 API。

目前資料庫仍可由 Supabase 託管；Supabase 平台自身的管理服務與平台內部物件不屬於 FYH 應用程式契約，未來換 PostgreSQL 主機時不需要搬移它們。

## 本機執行與驗證

需要 Node.js 22 或相容版本。

```bash
npm run web
npm run web:check
npm run web:publish
npm test
npm run renderer:check
npm run css:architecture
npm run js:architecture
npm run ci:check
```

依修改範圍執行必要檢查，不需要每次小修改都重跑全部流程。

## 修改位置

| 內容 | 正式位置 |
|---|---|
| HTML、前端功能與互動 | `src/renderer/` |
| CSS | `src/renderer/css/` |
| FYH HTTP/API | `src/web-server.js`、`src/backend/` |
| PostgreSQL 結構 | `supabase/001_current_schema.sql`、`supabase/002_current_updates.sql` |
| 建置與驗證 | `scripts/` |
| 測試 | `tests/` |
| 正式規格 | `規格書.md` |
| 發布成品 | 由 `npm run web:publish` 產生至 `docs/` |

## 發布流程

1. 修改正式來源。
2. 前端有異動時執行 `npm run web:publish`。
3. 執行與變更相關的必要測試／架構檢查。
4. 全新資料庫依序套用兩份正式 SQL；既有資料庫只套用本次必要 DDL。
5. 部署 FYH Backend，設定 PostgreSQL 連線與 Production 持久化 Session store。
6. 合併至 `main`。
7. GitHub Pages 若仍作為靜態入口，使用 `docs/` 發布成品；正式 API 必須指向 FYH Backend。

`.github/workflows/deploy-pages.yml` 是唯一正式 GitHub Actions 驗證流程；不得新增重複監聽或自動改寫程式碼的 workflow。

## 效能與架構守門

- 首頁只載入登入身分與權限摘要；第一次進班表才載班表資料。
- 班表首次載入只抓目前八週，後續可視範圍由 FYH API 分頁讀取。
- 人員管理完整資料只在人員設定開啟時載入。
- 個人簽到簿不預載簽到審核；切換到「簽到審核」時才第一次讀取。
- 簽到審核單筆／批次操作使用 Backend transaction，成功後前端局部更新，不重新讀取完整簽到簿。
- ExcelJS 只在 XLSX 匯入／匯出實際發生時動態載入。
- CSS 與 JavaScript architecture audit 必須通過；不得以重複 selector、重複 function 或後載入 override 解決問題。
