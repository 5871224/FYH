# 福圓號排班系統

福圓號排班系統是手機優先的瀏覽器應用程式，涵蓋班表、簽到簿、訂餐、個人記錄、簽到審核與管理設定。前端由 GitHub Pages 發布；登入、資料庫、RPC 與伺服器端 API 由 Supabase 提供。

詳細功能、資料、安全、介面與驗收規格以 [`規格書.md`](規格書.md) 為唯一正式依據。

## 現行架構

```text
瀏覽器前端（GitHub Pages）
  ↓ Supabase Auth Token
Supabase Edge Functions／REST／RPC
  ↓ 身分、角色、伺服器時間、位置與交易驗證
Supabase PostgreSQL
```

- GitHub Pages 只託管 `docs/` 靜態檔案。
- 前端正式原始碼位於 `src/renderer/`。
- `src/renderer/app.css`、`src/renderer/app.js` 與 `docs/` 都是自動產生檔，不直接修改。
- Supabase Auth 負責登入身分。
- PostgreSQL、RLS、限制與 RPC 負責正式資料、權限與交易一致性。
- `supabase/functions/` 只保存目前正式 Edge Function；資料夾清單必須與 `scripts/deploy-edge-functions.ps1` 一致。

## 主要頁面

- **首頁：** 登入者姓名、角色、簽到簿、班表、訂餐、修改密碼與登出。
- **簽到簿：**
  - 個人記錄：班表、上下班打卡、上班時數、加班時數、備註與訂餐。
  - 簽到審核：管理員補登／修改、批次審核、批次退回與歷程。
  - 今日列直接提供上班及下班打卡，不再保留獨立打卡頁、加班申請頁、加班審核頁或打卡管理頁。
- **班表：** 八週班表、班別／假別／班表加班、排班工具與各項設定。
- **訂餐：** 今日訂餐、訂餐統計與訂餐設定。

## 專案結構

```text
FYH/
├─ .github/workflows/deploy-pages.yml
├─ docs/                              # GitHub Pages 發布成品
├─ scripts/                           # 建置、檢查、稽核與部署工具
├─ src/
│  ├─ web-server.js
│  └─ renderer/                       # 前端唯一正式原始碼
│     └─ css/                         # CSS 模組原始碼
├─ supabase/
│  ├─ 001_current_schema.sql
│  ├─ 002_current_updates.sql
│  ├─ 003_attendance_ledger.sql
│  ├─ 004_remove_legacy_attendance.sql
│  └─ functions/                      # 正式 Edge Function 原始碼
├─ tests/
├─ AGENTS.md
├─ README.md
├─ package.json
├─ 規格書.md
└─ 啟動網頁版.bat
```

## 資料庫建置順序

全新資料庫或重建環境固定依序執行：

```text
1. supabase/001_current_schema.sql
2. supabase/002_current_updates.sql
3. supabase/003_attendance_ledger.sql
4. supabase/004_remove_legacy_attendance.sql
```

用途：

1. `001_current_schema.sql`：建立基準資料表、索引、RLS、限制、Trigger 與核心 RPC。
2. `002_current_updates.sql`：套用目前仍有效的班表、訂餐、人員、權限與安全更新。
3. `003_attendance_ledger.sql`：建立 `attendance_days`、`attendance_audit_logs`、簽到 RPC 與簽到簿資料契約。
4. `004_remove_legacy_attendance.sql`：移除舊 `attendance_records`、`attendance_action_logs`、`attendance_overtime_requests`、`overtime_review_logs` 與舊 RPC。

本系統尚未正式上線，舊出勤測試資料不保留；正式資料模型只剩每日簽到簿。Edge Function 部署不會自動執行 SQL。

## 正式 Edge Functions

部署清單以 `scripts/deploy-edge-functions.ps1` 為準，目前包括：

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

已淘汰的打卡、加班與記錄端點不得重新加入部署清單。平台若暫時無法實體刪除舊端點，只能回傳 HTTP 410，不得執行舊業務或寫入資料。

## 本機執行

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

常用指令：

- `npm run web`：建立 bundle 後啟動本機預覽。
- `npm run web:publish`：依來源完整重建 `docs/`。
- `npm test`：執行功能與架構守門測試。
- `npm run renderer:check`：檢查前端 bundle、發布對齊與正式契約。
- `npm run ci:check`：執行正式 CI 的完整本機檢查。

## 修改位置

| 內容 | 正式位置 |
|---|---|
| HTML、前端功能與互動 | `src/renderer/` |
| CSS | `src/renderer/css/` |
| 資料庫、RLS、RPC | `supabase/*.sql` |
| 後端 API | `supabase/functions/` |
| 建置與驗證 | `scripts/` |
| 測試 | `tests/` |
| 正式規格 | `規格書.md` |
| 發布成品 | 由 `npm run web:publish` 產生至 `docs/` |

## 發布流程

1. 修改正式來源。
2. 執行 `npm run web:publish`。
3. 執行 `npm run ci:check`。
4. 依順序套用 SQL。
5. 部署正式 Edge Functions。
6. 合併至 `main`。
7. GitHub Pages 由內建 `pages-build-deployment` 發布 `main/docs`。
8. 以員工、主管與管理員測試登入、簽到簿、班表、訂餐與主要管理入口。

`.github/workflows/deploy-pages.yml` 是唯一正式 GitHub Actions 驗證流程；不得新增重複監聽 `main` 或重複部署 Pages 的 workflow。
