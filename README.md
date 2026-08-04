# 福圓號排班系統

福圓號排班系統是手機優先的瀏覽器應用程式，涵蓋班表、簽到簿、訂餐、個人記錄與管理功能。前端由 GitHub Pages 發布；登入、資料庫、RLS、RPC 與 Edge Function 由 Supabase 提供。

## 文件分工

- `README.md`：專案入口、目錄、開發指令與部署順序。
- `規格書.md`：唯一正式功能、介面、資料模型、安全、API、維運與驗收規格。
- `AGENTS.md`：AI 開發代理人在本儲存庫工作時必須遵守的規則。

需求與實作有差異時，以根目錄 `規格書.md` 為準；不得另建 TXT 或其他規格補充檔取代正式規格書。

## 現行架構

```text
瀏覽器前端（GitHub Pages）
  ↓ 登入憑證與使用者操作
Supabase Edge Functions／REST／RPC
  ↓ 身分、角色、Asia/Taipei 時間、安全與交易驗證
Supabase PostgreSQL
```

- GitHub Pages 只託管 `docs/` 靜態發布成品。
- 前端唯一正式原始碼位於 `src/renderer/`。
- Supabase Auth 負責登入身分。
- PostgreSQL、RLS 與 RPC 負責正式資料、權限與交易一致性。
- 人員查詢依用途分為 `get_my_profile_v2()`、`get_schedule_directory_v2()` 與 `get_employee_admin_directory_v2()`；不得再以單一名錄同時服務登入、班表與管理頁。
- `supabase/functions/` 只保存目前正式 Edge Function；資料夾清單必須與 `scripts/deploy-edge-functions.ps1` 一致。

## 專案結構

```text
FYH/
├─ .github/
│  └─ workflows/
│     └─ deploy-pages.yml
├─ docs/
├─ scripts/
├─ src/
│  ├─ web-server.js
│  └─ renderer/
│     └─ css/
├─ supabase/
│  ├─ 001_current_schema.sql
│  ├─ 002_current_updates.sql
│  ├─ 003_attendance_ledger.sql
│  └─ functions/
├─ tests/
├─ AGENTS.md
├─ README.md
├─ package.json
├─ 規格書.md
└─ 啟動網頁版.bat
```

員工、班表、簽到、訂餐等正式營運資料只存放於 Supabase PostgreSQL，不存放在 GitHub。

## 前端原始碼與發布成品

### `src/renderer/`

- `index.html`：前端頁面結構。
- `app-config.js`：公開 Supabase 連線設定，獨立於 bundle 載入。
- `web-api.js`：REST、RPC 與 Edge Function 的集中呼叫介面。
- `renderer.js`：狀態與啟動流程。
- `renderer-*.js`：依頁面與責任拆分的正式功能模組。
- `app.js`：自動產生的單一 JavaScript bundle，不直接修改。
- `app.css`：自動產生的單一 CSS bundle，不直接修改。

### `src/renderer/css/`

固定模組：

1. `foundation.css`
2. `schedule.css`
3. `components.css`
4. `responsive.css`
5. `pages.css`

不得新增依賴後載入覆寫的 `fix.css`、`final.css` 或其他補丁檔。

### `docs/`

GitHub Pages 正式發布成品，由 `npm run web:publish` 完整重建。不得直接手動修改 `docs/app.js`、`docs/app.css` 或 `docs/index.html`。

## 每日簽到簿架構

新版把原本分散的打卡頁、加班申請、加班審核與打卡管理整合為：

- **個人記錄**：員工查看每日班別、上下班、正常時數、加班時數、備註、訂餐與審核狀態；今天未審核資料可直接在表格內打卡及修改。
- **簽到審核**：管理員依日期、人員、審核狀態與異常篩選，修改每日資料、批次審核、批次退回、查看異動歷程及匯出。

正式資料來源：

- `attendance_days`：每人每日唯一一筆簽到、工時、備註與審核資料。
- `attendance_audit_logs`：所有打卡、員工修改、管理員修改、審核與資料遷移歷程。

正式 Edge Function：

- `attendance-clock`
- `attendance-ledger`
- `attendance-ledger-export`
- `meal-order`

已淘汰的獨立加班與打卡管理端點不得重新加入前端、部署清單或正式原始碼。

## Supabase SQL 執行順序

全新環境或完整還原時，必須依序執行：

```text
1. supabase/001_current_schema.sql
2. supabase/002_current_updates.sql
3. supabase/003_attendance_ledger.sql
```

### `001_current_schema.sql`

建立基準資料表、索引、RLS、權限、Trigger 與核心 RPC。

### `002_current_updates.sql`

套用基準結構後仍有效的正式更新，包括安全目錄、設定管理、匯出與帳號歷史保護。

### `003_attendance_ledger.sql`

每日簽到簿正式更新，內容包括：

- 建立 `attendance_days` 與 `attendance_audit_logs`。
- 啟用 RLS，員工只能直接讀取自己的每日簽到；寫入由受驗證後端處理。
- 將舊 `attendance_records`、有效的 `attendance_overtime_requests` 與 `attendance_action_logs` 非破壞性遷移至新版資料模型。
- 以 `migration_backfill` 稽核紀錄標示資料遷移。
- 更新 `save_attendance_clock()` 與 `save_meal_order()`，統一使用 `attendance_days`。
- 更新 `delete_member_account_v4()`，人員刪除歷史保護涵蓋新版簽到及稽核資料。

本檔採可重複執行設計，不覆蓋新版已修改的資料。舊表暫時保留供發布切換與回滾；確認新版網站穩定後，再以獨立清理程序移除舊表與線上舊 Edge Function。

Edge Function 部署不會自動執行 SQL。必須先完成三個 SQL 階段，再執行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy-edge-functions.ps1
```

## 正式 Edge Function 清單

`scripts/deploy-edge-functions.ps1` 是唯一正式部署清單，目前包含：

- `member-auth-admin`
- `catalog-admin`
- `attendance-clock`
- `attendance-ledger`
- `attendance-ledger-export`
- `meal-order`
- `department-attendance-v2`
- `member-delete-v2`
- `member-order-v2`
- `meal-report-v2`
- `meal-cancel-v2`

新增、停用或更名端點時，必須同步修改原始碼、部署清單、README、規格書與契約檢查。

## 常用指令

需要 Node.js 22 或相容版本。在儲存庫根目錄執行：

```bash
npm run css:build
npm run css:check
npm run js:build
npm run js:check
npm run web
npm run web:check
npm run web:publish
npm run scope:check
npm test
npm run renderer:check
npm run css:architecture
npm run js:architecture
npm run ci:check
```

- `npm run css:build`：依固定順序產生 `src/renderer/app.css`。
- `npm run css:check`：確認 CSS bundle、來源與快取版本一致。
- `npm run js:build`：依固定模組清單產生 `src/renderer/app.js`。
- `npm run js:check`：確認 JavaScript bundle、來源、入口與語法一致。
- `npm run web`：建立 bundle 並啟動本機預覽。
- `npm run web:publish`：正規化換行、重建 bundle 並完整重建 `docs/`。
- `npm run scope:check`：比對 PR 宣告的允許／禁止修改範圍。
- `npm test`：執行所有 `tests/**/*.test.js`。
- `npm run renderer:check`：執行 bundle、來源對齊及正式契約檢查。
- `npm run ci:check`：執行合併前完整驗證。

## 修改位置速查

| 內容 | 正式位置 |
|---|---|
| 前端 HTML、功能與互動 | `src/renderer/` |
| CSS 樣式 | `src/renderer/css/` |
| 資料庫、RLS、RPC、資料遷移 | `supabase/001_current_schema.sql`、`002_current_updates.sql`、`003_attendance_ledger.sql` |
| Edge Function | `supabase/functions/` |
| 建置、發布、部署與檢查工具 | `scripts/` |
| 單元及架構守門測試 | `tests/` |
| GitHub Actions | `.github/workflows/deploy-pages.yml` |
| 正式功能與技術規格 | `規格書.md` |
| GitHub Pages 成品 | 由 `npm run web:publish` 產生至 `docs/` |

## 合併與發布門檻

合併前至少必須確認：

1. `npm test` 全數通過。
2. `npm run renderer:check` 通過。
3. `npm run web:publish` 後 `docs/` 無未提交差異。
4. GitHub Actions `Validate` 工作完整通過。
5. Supabase 三階段 SQL 已套用並核對資料筆數。
6. 正式 Edge Function 已部署，且前端不再呼叫舊端點。
7. 新版網站穩定前，不刪除舊資料表；清理前需保留可回滾資料與驗證結果。
