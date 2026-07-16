# 福圓號排班系統

福圓號排班系統是手機優先的瀏覽器應用程式，涵蓋排班、打卡、加班、訂餐、個人記錄與管理功能。前端以 GitHub Pages 發布，登入、資料庫、RPC 與伺服器端 API 由 Supabase 提供。

## 文件分工

- `README.md`：專案入口、目錄、開發指令與部署方式。
- `規格書.md`：唯一正式功能、介面、資料模型、安全、API 契約、非功能性、維運與驗收規格。
- `AGENTS.md`：AI 開發代理人在本儲存庫工作時必須遵守的注意事項。

README 不重複保存詳細功能規格；需求與實作有差異時，以 `規格書.md` 為準。

## 現行架構

```text
瀏覽器前端（GitHub Pages）
  ↓ 登入憑證與使用者操作
Supabase Edge Functions／REST／RPC
  ↓ 身分、角色、時間、安全及交易驗證
Supabase PostgreSQL
```

- GitHub Pages 只託管 `docs/` 內的靜態檔案。
- 前端原始碼位於 `src/renderer/`。
- Supabase Auth 負責登入身分。
- PostgreSQL、RLS 與 RPC 負責正式資料、權限與交易一致性。
- 人員資料查詢依用途分為 `get_my_profile_v2()`、`get_schedule_directory_v2()` 與 `get_employee_admin_directory_v2()`；不得再以單一名錄同時服務登入、班表及管理頁面。管理名錄只在進入管理功能時延遲載入。
- `supabase/functions/` 保存 Edge Function 原始碼；正式部署清單以 `scripts/deploy-edge-functions.ps1` 為準，不以資料夾是否存在判定。

## 專案結構與資料夾用途

```text
FYH/
├─ .github/
│  ├─ pull_request_template.md
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
│  └─ functions/
├─ tests/
├─ AGENTS.md
├─ README.md
├─ package.json
├─ 規格書.md
└─ 啟動網頁版.bat
```

儲存庫保存的是程式、資料庫結構、後端 API、建置工具與測試。員工、班表、打卡、訂餐等正式營運資料不存放在 GitHub 資料夾內，而是存放在 Supabase PostgreSQL。

### `.github/`

存放 GitHub 專案管理與自動化設定。

- `.github/pull_request_template.md`：建立 Pull Request 時使用的格式，要求列出需求摘要、允許修改範圍、禁止修改範圍與驗收方式。
- `.github/workflows/deploy-pages.yml`：唯一正式 GitHub Actions workflow，負責 PR 與 `main` 的修改範圍檢查、建置、測試、發布一致性及架構驗證。

一般功能開發不應在 `.github/` 新增額外 workflow；如需調整 CI，應修改現有 `deploy-pages.yml`。

### `docs/`

GitHub Pages 的正式靜態發布成品，由 `npm run web:publish` 自動重建。

主要內容：

- `index.html`：正式網站入口。
- `app.css`：由 CSS 模組合併後的正式樣式。
- `app.js`：由 JavaScript 模組合併後的正式前端程式。
- `app-config.js`：正式環境的公開 Supabase 連線設定。
- `.nojekyll`：告訴 GitHub Pages 不使用 Jekyll 處理。
- `README.txt`：標示本資料夾為自動產生的部署內容。

`docs/` 不直接手動修改。前端來源應修改 `src/renderer/`，完成後執行 `npm run web:publish` 重新產生。

### `scripts/`

存放建置、發布、檢查、稽核與部署工具，不存放網站畫面或正式業務資料。

主要類型：

- 建置：`build-css.js`、`build-js.js`。
- 發布：`publish-static-web.js`。
- PR 範圍檢查：`check-change-scope.js`。
- 公開設定與資料結構檢查：`check-public-supabase.js`、`check-normalized-storage.js`。
- 功能契約與設定驗收：`check-expansion-acceptance.js`、`check-settings-lists.js`。
- 前端產生檔與來源對齊：`check-renderer-alignment.js`、`check-renderer-contracts.js`。
- 架構稽核：`audit-css-duplicates.js`、`audit-js-duplicates.js`。
- Edge Function 部署：`deploy-edge-functions.ps1`。

正式 npm 指令以 `package.json` 的 `scripts` 區段為準。

### `src/`

存放可執行的主要原始碼。

- `src/web-server.js`：本機預覽使用的 Node.js 靜態伺服器，由 `npm run web` 啟動。
- `src/renderer/`：前端唯一正式原始碼位置。

### `src/renderer/`

存放 HTML、公開環境設定、前端 JavaScript 模組及自動產生的 bundle。

主要內容：

- `index.html`：頁面 HTML 結構與正式前端資源入口。
- `app-config.js`：Supabase URL、公開金鑰等部署環境設定，維持獨立載入。
- `web-api.js`：前端呼叫 Supabase REST、RPC 與 Edge Function 的集中介面。
- `rest-compliance.js`：例假、休息日與連續出勤規則。
- `renderer.js`：前端狀態、初始化與啟動流程。
- `renderer-*.js`：依畫面或責任拆分的正式前端模組。
- `app.css`：由 `src/renderer/css/` 自動合併的產生檔，不直接修改。
- `app.js`：由正式 JavaScript 模組自動合併的產生檔，不直接修改。

前端功能應修改對應的 `renderer-*.js` 或其他責任模組，不得直接修改 `app.js`，也不得新增依靠後載入覆寫前檔的補丁模組。

### `src/renderer/css/`

模組化 CSS 的唯一正式原始來源。

- `foundation.css`：全站基礎樣式、變數及主要結構。
- `schedule.css`：班表頁專屬布局、表格與工具列。
- `components.css`：按鈕、表單、卡片、Modal 等共用元件。
- `responsive.css`：手機、平板與電腦的響應式規則。
- `pages.css`：首頁、打卡、訂餐、紀錄等頁面專屬樣式。

修改 CSS 時只修改這些模組，再執行 `npm run css:build` 或 `npm run web:publish` 產生 `app.css`。

### `supabase/`

存放 PostgreSQL 結構、正式更新與 Edge Function 原始碼。

- `001_current_schema.sql`：全新環境的基準資料庫結構，包含資料表、欄位、索引、RLS、權限、Trigger 與核心 RPC。
- `002_current_updates.sql`：基準結構建立後，所有仍有效且需要正式保留的更新。
- `functions/`：Supabase Edge Function 原始碼。

全新資料庫固定先執行 `001_current_schema.sql`，再執行 `002_current_updates.sql`。Edge Function 部署不會自動套用 SQL。

### `supabase/functions/`

每個子資料夾代表一個 Edge Function，通常以 `index.ts` 作為入口。

功能大致分為：

- 帳號與人員管理。
- 班表與設定管理。
- 上下班打卡與打卡管理。
- 員工加班申請與管理員審核。
- 訂餐、取消與統計報表。
- 個人記錄與管理報表。

資料夾存在不代表仍為正式端點；正式部署名單只以 `scripts/deploy-edge-functions.ps1` 的 `$functions` 陣列為準。

### `tests/`

存放 Node.js 單元測試與架構守門測試，所有 `tests/**/*.test.js` 都由 `npm test` 執行。

測試內容包括：

- 日期、週期、例假與連續出勤計算。
- 金額、訂餐、加班資格與匯出格式。
- 前端模組責任與事件註冊邊界。
- API、資料庫與畫面契約。
- GitHub Actions workflow 安全與一致性。
- 防止重新加入舊版本補丁、一次性腳本及未部署端點。

### 根目錄重要檔案

- `README.md`：專案入口、目錄、開發指令與部署方式。
- `規格書.md`：唯一正式功能與技術規格。
- `AGENTS.md`：AI 開發代理人修改本儲存庫時必須遵守的規則。
- `package.json`：專案名稱及 npm 建置、測試、發布與驗證指令。
- `啟動網頁版.bat`：Windows 一鍵啟動本機預覽網站。
- `.gitignore`：不提交 Git 的本機依賴、紀錄檔及暫存內容。

### 修改位置速查

| 要修改的內容 | 正式修改位置 |
|---|---|
| 前端 HTML、功能與互動 | `src/renderer/` |
| CSS 樣式 | `src/renderer/css/` |
| 資料庫結構、RLS、RPC | `supabase/001_current_schema.sql`、`supabase/002_current_updates.sql` |
| 後端 API | `supabase/functions/` |
| 建置、發布與檢查工具 | `scripts/` |
| 單元與架構測試 | `tests/` |
| GitHub Actions | `.github/workflows/deploy-pages.yml` |
| 正式發布成品 | 由 `npm run web:publish` 自動產生至 `docs/` |

## 本機執行與常用指令

需要 Node.js。可在儲存庫根目錄執行：

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

- `npm run css:build`：依固定模組順序產生單一 `src/renderer/app.css`。
- `npm run css:check`：確認 `app.css` 與 CSS 模組及快取版本一致。
- `npm run js:build`：依固定清單與既有載入順序產生單一 `src/renderer/app.js`。
- `npm run js:check`：確認每個 JavaScript 原始模組都已明確列入建置清單，且 `app.js`、入口版本、動態載入限制與語法一致。
- `npm run web`：先建立 CSS 與 JavaScript bundle，再啟動本機靜態預覽伺服器。
- `npm run web:check`：檢查公開 Supabase 設定。
- `npm run web:publish`：先將來源文字換行正規化為 LF，建立兩種 bundle，清理並依來源內容完整重建 `docs/`；相同來源在 Windows 與 Linux 會產生相同內容及快取版本。
- `npm run scope:check`：在 Pull Request 中比對 PR 說明聲明的允許／禁止修改範圍與實際變更檔案。
- `npm test`：執行 `tests/` 中的 Node.js 單元測試。
- `npm run renderer:check`：檢查 CSS、JavaScript bundle、renderer 結構與發布內容對齊。
- `npm run css:architecture`：檢查完全相同的 CSS 重複規則。
- `npm run js:architecture`：檢查共享模組同名函式、相同函式內容、覆蓋式指定與過時 UI 標記。
- `npm run ci:check`：先執行單元測試，再執行公開設定、資料結構、設定清單、renderer 與 JavaScript／CSS 架構驗證。

## Pull Request 修改範圍

1. 功能、介面、資料庫、權限或部署流程的修改，預設由工作分支建立 Draft Pull Request。
2. PR 依 `.github/pull_request_template.md` 列出「允許修改範圍」、「禁止修改範圍」與驗收案例。
3. Pull Request 的 CI 會執行 `npm run scope:check`；實際變更檔案未符合聲明範圍時，驗證失敗。
4. 不可使用 `**` 或 `*` 允許整個儲存庫，必須列出實際檔案或有意義的子目錄。

## 前端發布

1. CSS 只修改 `src/renderer/css/` 中對應模組，不直接修改 `app.css` 或 `docs/`。
2. JavaScript 修改現有責任模組，不直接修改 `app.js`；不得新增依靠後載入覆寫前檔的 `fix`、`refinement` 或新版本補丁檔。
3. `app-config.js` 是部署環境設定，維持獨立載入；其他正式前端程式由 `app.js` 提供。
4. HTML 及其他前端來源只修改 `src/renderer/`。
5. 完成後執行：

```bash
npm run web:publish
npm run renderer:check
npm run css:architecture
npm run js:architecture
```

6. 發布腳本會依固定順序產生單一 `app.css` 與 `app.js`，清理舊的 `docs/` 後完整重建發布內容。
7. `docs/` 發布 `index.html`、`app.css`、`app-config.js` 與 `app.js`，不發布個別 CSS／JavaScript 原始模組。
8. 儲存庫內只保留 `.github/workflows/deploy-pages.yml`，負責 Pull Request 與 `main` 的建置、測試及完整驗證。
9. Pull Request 只執行修改範圍、建置、單元測試與完整驗證，不部署正式網站。
10. 推送至 `main` 後，GitHub 內建的 `pages-build-deployment` 會依 `main/docs` 發布正式網站；自訂 workflow 不再另外上傳或部署 Pages，避免同一版本重複發布。
11. 多檔案修改應先在工作分支整理完成後再建立 PR，避免每個中間提交都產生一筆重複驗證紀錄。

## Supabase 資料庫建置

全新環境固定依下列順序，在 Supabase SQL Editor 完整執行：

1. `supabase/001_current_schema.sql`
2. `supabase/002_current_updates.sql`

`001_current_schema.sql` 建立基準資料表、索引、RLS、權限與核心 RPC；`002_current_updates.sql` 整併基準結構後所有仍有效的正式更新。

SQL 執行期間只要出現錯誤就應立即停止，不可略過錯誤繼續執行。Edge Function 部署不會自動套用 SQL。

## Supabase Edge Functions 部署

完成兩份 SQL 後，在 Windows PowerShell 由儲存庫根目錄執行：

```powershell
.\scripts\deploy-edge-functions.ps1
```

腳本透過 `npx supabase@latest functions deploy` 逐一部署目前正式使用的 Edge Functions。部署名單以該腳本內的 `$functions` 陣列為唯一準據；不要直接把 `supabase/functions/` 下所有資料夾都視為正式端點。

## 驗證

依修改範圍執行下列檢查：

```bash
npm test
npm run web:check
npm run css:check
npm run js:check
node --check src/renderer/renderer.js
node --check src/renderer/web-api.js
node --check src/renderer/renderer-auto-fill-schedule.js
node scripts/check-normalized-storage.js
node scripts/check-expansion-acceptance.js
node scripts/check-settings-lists.js
npm run renderer:check
npm run css:architecture
npm run js:architecture
```

Pull Request 另外由 GitHub Actions 執行 `npm run scope:check`。前端有修改時，最後仍須執行 `npm run web:publish` 並確認 `docs/` 已更新。
