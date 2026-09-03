# 福圓號排班系統

福圓號排班系統（FYH）是手機優先的瀏覽器應用程式，涵蓋多群組班表、簽到簿、訂餐、個人記錄、簽到審核、角色權限、匯出與班表封存。前端由 GitHub Pages 發布；登入、資料庫、RPC 與伺服器端 API 由 Supabase 提供。

功能、資料、安全、介面與驗收標準以 [`規格書.md`](規格書.md) 為唯一正式依據；開發與架構規則以 [`AGENTS.md`](AGENTS.md) 為準。

## 現行架構

```text
瀏覽器前端（GitHub Pages）
  ↓ Supabase Auth Token
具名 RPC / Supabase Edge Functions
  ↓ 身分、共用權限、逐群組權限、業務規則與交易驗證
Supabase PostgreSQL
```

- GitHub Pages 只託管 `docs/` 靜態成品。
- 前端正式原始碼位於 `src/renderer/`。
- `src/renderer/app.css`、`src/renderer/app.js` 與 `docs/` 都是建置產生檔，不直接修改。
- PostgreSQL、RLS、Trigger、RPC 與 Edge Function 共同負責正式資料與安全邊界。
- 瀏覽器不直接 CRUD 核心資料表。

## 單一正式版本原則

本系統只維護目前唯一正式架構：

- 不保留舊資料表、舊欄位、舊端點、舊 payload、雙軌讀寫或文字角色授權。
- 不以 `try/catch` 靜默退回舊流程；正式入口不可用時直接修正正式入口。
- 不新增 `fix`、`patch`、`override`、compatibility bridge 或後載入覆寫模組。
- 權限 UI 必須在 canonical render 階段決定是否建立，不以 DOM 掃描、`MutationObserver`、CSS 隱藏或載入後搬移修補。
- 詳細禁止補丁規則與 CSS 模組分工統一記錄於 `AGENTS.md`。

## 主要頁面

- **首頁：** 登入者姓名、角色、簽到簿、班表、依群組設定顯示的訂餐、修改密碼與登出。
- **簽到簿：** 個人記錄與逐群組 `attendance_review` 的簽到審核；今日列直接提供上下班打卡。
- **班表：** 群組切換、八週班表、班別／假別／加班、排班工具、設定、匯出與封存。
- **訂餐：** 今日訂餐、訂餐統計與訂餐設定；管理能力依逐群組 `meal_admin`。

## 專案結構

```text
FYH/
├─ .github/
│  └─ workflows/deploy-pages.yml     # 唯一正式 GitHub Actions 驗證流程
├─ docs/                              # GitHub Pages 發布成品，由建置產生
├─ scripts/                           # 建置、檢查、稽核與部署工具
├─ src/
│  ├─ web-server.js
│  └─ renderer/                       # 前端唯一正式原始碼
│     └─ css/                         # CSS 正式模組
├─ supabase/
│  ├─ 001_current_schema.sql          # 全新環境完整正式結構
│  ├─ 002_current_updates.sql         # 仍有效且可重複執行的正式更新
│  ├─ migrations/                     # 正式環境增量部署 migration
│  └─ functions/                      # 正式 Edge Function 原始碼
├─ tests/
├─ AGENTS.md
├─ README.md
├─ package.json
├─ 規格書.md
└─ 啟動網頁版.bat
```

專案只維護三份正式 Markdown：`規格書.md`、`AGENTS.md`、`README.md`。不另設 PR 模板或子目錄 README 保存開發規則，避免規則分散與不同步。

## 資料庫建置與 migration

全新資料庫固定依序執行：

```text
1. supabase/001_current_schema.sql
2. supabase/002_current_updates.sql
```

`supabase/migrations/` 用於正式環境增量部署，不是第二套 fresh-install 規格；任何 migration 完成後，最終正式狀態也必須反映回 canonical SQL。

## Canonical 權限模型

人員角色只使用 `set_employee.access_role_id`。

### 共用權限

保存於 `access_roles.common_permissions`：

- `settings`
- `export`
- `leave_settings`

### 逐群組權限

保存於 `access_role_group_permissions(role_id, group_id, permissions)`：

- `schedule_view`
- `schedule_manage`
- `department_settings`
- `attendance_review`
- `meal_admin`

`schedule_manage` 必須連動 `schedule_view`；其他權限互不推導。不得以 `access_roles.permissions`、`access_role_groups`、`member_settings`、`permission_settings`、`legacy_role`、`set_employee.role` 或 `admin/manager` 文字角色授權。

## 班表「功能」選單權限對應

| 分類 | 權限 | 固定項目 |
|---|---|---|
| 設定 | 共用 `settings` | 權限設定、群組設定、週期設定、班表封存 |
| 排班 | 目前群組 `schedule_manage` | 排班條件、自動排班預覽、自動補班預覽、套用預覽、取消預覽 |
| 匯出 | 共用 `export` | 列印班表、匯出上班日、匯出休例假、匯出請假、匯出加班 |

只有 `schedule_manage` 時只出現「排班」；`列印班表` 固定位於「功能 → 匯出」，使用共用 `export`。

## 權限與資料存取

正式資料流：

```text
瀏覽器
  → 具名 RPC / Edge Function
  → 驗證 auth.uid() + 精確共用／群組權限
  → PostgreSQL
```

- 群組設定、權限設定：共用 `settings`。
- 人員設定、帳號管理、班別、排班條件、班表編輯：目標群組 `schedule_manage`。
- 單位設定：目標群組 `department_settings`。
- 簽到審核：目標群組 `attendance_review`。
- 訂餐統計與設定：目標群組 `meal_admin`。
- 班表列印與班表匯出：共用 `export`。
- 假別設定：共用 `leave_settings`。

前端可見性不是安全邊界；RPC、RLS、Trigger 與 Edge Function 必須再次驗證相同正式權限。

## 正式 Edge Functions

`scripts/deploy-edge-functions.ps1` 與 `supabase/functions/` 必須維持相同正式清單：

- `access-control`：登入後權限 bundle、角色共用／逐群組權限管理。
- `member-auth-admin`：人員登入帳號管理，以目標群組 `schedule_manage` 驗證。
- `attendance-clock`：本人打卡。
- `attendance-ledger`：本人簽到簿資料。
- `attendance-ledger-export`：簽到資料正式匯出。
- `attendance-review-groups`：依逐群組 `attendance_review` 進行簽到審核。
- `meal-order`：本人訂餐與訂餐管理操作。
- `meal-report-v2`：依逐群組 `meal_admin` 產生訂餐報表。
- `meal-cancel-v2`：本人取消訂餐。

`_shared` 有變更時，需重新部署所有依賴它的正式 Edge Function；正式環境不得保留仍可執行淘汰邏輯的歷史端點。

## CSS 模組

CSS 詳細維護規則已合併至 `AGENTS.md`。正式模組為：

- `foundation.css`：全域基礎與主要頁面既有結構。
- `schedule.css`：班表專屬布局。
- `components.css`：共用元件與設計變數。
- `responsive.css`：跨頁響應式規則。
- `pages.css`：頁面專屬差異。

不直接修改產生的 `app.css`，也不建立 `fix.css`、`patch.css` 等補丁檔。

## 本機執行與檢查

需要 Node.js 22 或相容版本。

```bash
npm run css:build
npm run css:check
npm run js:build
npm run js:check
npm run web
npm run web:check
npm run web:publish
npm test
npm run renderer:check
npm run css:architecture
npm run js:architecture
npm run ci:check
```

常用指令：

- `npm run web`：建立 bundle 後啟動本機預覽。
- `npm run web:publish`：從正式來源重建 bundle 與 `docs/`。
- `npm test`：執行功能與架構守門測試。
- `npm run renderer:check`：檢查 Renderer、bundle、發布對齊與正式契約。
- `npm run ci:check`：執行正式完整檢查。

## 修改位置

| 內容 | 正式位置 |
|---|---|
| HTML、前端功能與互動 | `src/renderer/` |
| CSS | `src/renderer/css/` |
| 資料庫、RLS、RPC | `supabase/*.sql` |
| 正式環境增量 SQL | `supabase/migrations/`，完成後同步 canonical SQL |
| 後端 API | `supabase/functions/` |
| 建置與驗證 | `scripts/` |
| 測試 | `tests/` |
| 正式功能規格 | `規格書.md` |
| 開發與架構規則 | `AGENTS.md` |
| 發布成品 | `docs/`，由 `npm run web:publish` 產生 |

## 發布流程

本專案預設直接提交 `main`，不以 PR 作為必要流程：

1. 修改正式來源，不建立補丁檔或一次性 workflow。
2. 前端有變更時執行 `npm run web:publish`；重要變更執行 `npm run ci:check`。
3. 同一需求的多檔案以單一完整 commit 提交到 `main`。
4. 若有 SQL / Edge Function 變更，依正式部署程序套用 migration／部署 Edge Function，並同步 canonical SQL 與部署腳本。
5. 確認 `main` 正式驗證 workflow 與 GitHub Pages 部署成功。
6. 權限變更需驗證重新登入、切換群組、離開再進頁面與重新整理後仍顯示相同正確功能。