# 福圓號排班系統

福圓號排班系統是手機優先的瀏覽器應用程式，涵蓋排班、打卡、加班、訂餐、個人記錄與管理功能。前端以 GitHub Pages 發布，登入、資料庫、RPC 與伺服器端 API 由 Supabase 提供。

## 文件分工

- `README.md`：專案入口、目錄、開發指令與部署方式。
- `規格書.md`：唯一正式功能、介面、資料模型、安全與驗收規格。
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
- 人員資料查詢依用途分為 `get_my_profile_v2()`、`get_schedule_directory_v2()` 與 `get_employee_admin_directory_v2()`；不得再以單一名錄同時服務登入、班表及管理頁面。
- `supabase/functions/` 保存 Edge Function 原始碼；正式部署清單以 `scripts/deploy-v2-final.ps1` 為準，不以資料夾是否存在判定。

## 專案結構

- `src/renderer/`：HTML、部署設定、前端 JavaScript 模組，以及自動產生的 `app.css`、`app.js`。
- `src/renderer/css/`：模組化 CSS 唯一原始來源；分為基礎、班表、共用元件、響應式與頁面專屬樣式。
- `scripts/build-js.js`：依固定順序把現行 JavaScript 模組合併成單一 `app.js`；第一階段保留既有全域行為。
- `docs/`：`npm run web:publish` 產生的 GitHub Pages 正式發布內容，不直接手動修改。
- `supabase/001_current_schema.sql`：全新資料庫的基準結構。
- `supabase/002_current_updates.sql`：基準結構後的現行正式更新。
- `supabase/functions/`：Supabase Edge Functions 原始碼。
- `scripts/`：CSS 建置、檢查、同步與部署腳本。
- `.github/workflows/`：GitHub Pages 與自動化流程。

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
npm run v2:check
```

- `npm run css:build`：依固定模組順序產生單一 `src/renderer/app.css`。
- `npm run css:check`：確認 `app.css` 與 CSS 模組及快取版本一致。
- `npm run js:build`：依固定清單與既有載入順序產生單一 `src/renderer/app.js`。
- `npm run js:check`：確認每個 JavaScript 原始模組都已明確列入建置清單，且 `app.js`、入口版本、動態載入限制與語法一致。
- `npm run web`：先建立 CSS 與 JavaScript bundle，再啟動本機靜態預覽伺服器。
- `npm run web:check`：檢查公開 Supabase 設定。
- `npm run web:publish`：建立兩種 bundle、清理並重建 `docs/`，再更新靜態資源版本參數。
- `npm run v2:check`：檢查 CSS、JavaScript bundle、V2 結構與發布內容對齊。

## 前端發布

1. CSS 只修改 `src/renderer/css/` 中對應模組，不直接修改 `app.css` 或 `docs/`。
2. JavaScript 修改現有責任模組，不直接修改 `app.js`；不得新增依靠後載入覆寫前檔的 `fix`、`refinement` 或新版本補丁檔。
3. `app-config.js` 是部署環境設定，維持獨立載入；其他正式前端程式由 `app.js` 提供。
4. HTML 及其他前端來源只修改 `src/renderer/`。
5. 完成後執行：

```bash
npm run web:publish
npm run v2:check
```

6. 發布腳本會依固定順序產生單一 `app.css` 與 `app.js`，清理舊的 `docs/` 後完整重建發布內容。
7. `docs/` 只發布 `app-config.js` 與 `app.js`，不發布個別 JavaScript 原始模組。
8. GitHub Pages 工作流程也會在上傳前執行 `npm run web:publish`，避免發布舊 bundle。

## Supabase 資料庫建置

全新環境固定依下列順序，在 Supabase SQL Editor 完整執行：

1. `supabase/001_current_schema.sql`
2. `supabase/002_current_updates.sql`

`001_current_schema.sql` 建立基準資料表、索引、RLS、權限與核心 RPC；`002_current_updates.sql` 整併基準結構後所有仍有效的正式更新。

SQL 執行期間只要出現錯誤就應立即停止，不可略過錯誤繼續執行。Edge Function 部署不會自動套用 SQL。

## Supabase Edge Functions 部署

完成兩份 SQL 後，在 Windows PowerShell 由儲存庫根目錄執行：

```powershell
.\scripts\deploy-v2-final.ps1
```

腳本透過 `npx supabase@latest functions deploy` 逐一部署目前正式使用的 Edge Functions。部署名單以該腳本內的 `$functions` 陣列為唯一準據；不要直接把 `supabase/functions/` 下所有資料夾都視為正式端點。

## 驗證

依修改範圍執行下列檢查：

```bash
npm run web:check
npm run css:check
npm run js:check
node --check src/renderer/renderer.js
node --check src/renderer/web-api.js
node --check src/renderer/v2-auto-fill-schedule.js
node scripts/check-normalized-storage.js
node scripts/check-expansion-acceptance.js
node scripts/check-settings-lists.js
npm run v2:check
```

前端有修改時，最後仍須執行 `npm run web:publish` 並確認 `docs/` 已更新。
