# 福圓號排班系統

福圓號排班系統是手機優先的瀏覽器應用程式，涵蓋排班、打卡、加班、訂餐、個人記錄與管理功能。前端以 GitHub Pages 發布，登入、資料庫、RPC 與伺服器端 API 由 Supabase 提供。

## 文件分工

- `README.md`：專案入口、目錄、開發指令與部署方式。
- `規格書.txt`：唯一正式功能、介面、資料模型、安全與驗收規格。
- `AGENTS.md`：AI 開發代理人在本儲存庫工作時必須遵守的注意事項。

README 不重複保存詳細功能規格；需求與實作有差異時，以 `規格書.txt` 為準。

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
- `supabase/functions/` 保存 Edge Function 原始碼；正式部署清單以 `scripts/deploy-v2-final.ps1` 為準，不以資料夾是否存在判定。

## 專案結構

- `src/renderer/`：前端原始碼。
- `docs/`：GitHub Pages 正式發布內容。
- `supabase/001_current_schema.sql`：全新資料庫的基準結構。
- `supabase/002_current_updates.sql`：基準結構後的現行正式更新。
- `supabase/functions/`：Supabase Edge Functions 原始碼。
- `scripts/`：檢查、同步與部署腳本。
- `.github/workflows/`：GitHub Pages 與自動化流程。

## 本機執行與常用指令

需要 Node.js。可在儲存庫根目錄執行：

```bash
npm run web
npm run web:check
npm run web:publish
npm run v2:check
```

- `npm run web`：啟動本機靜態預覽伺服器。
- `npm run web:check`：檢查公開 Supabase 設定。
- `npm run web:publish`：將 `src/renderer/` 同步到 `docs/`，並更新靜態資源版本參數。
- `npm run v2:check`：執行 V2 結構與發布內容對齊檢查。

## 前端發布

1. 修改前端原始碼時，只修改 `src/renderer/` 的正式來源。
2. 完成後執行：

```bash
npm run web:publish
```

3. 確認 `src/renderer/` 與 `docs/` 同步後提交至 `main`。
4. GitHub Pages 工作流程 `.github/workflows/deploy-pages.yml` 會發布 `docs/`。

GitHub Pages 是靜態網站，不需要在 Pages 工作流程執行 npm 建置。

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
node --check src/renderer/renderer.js
node --check src/renderer/web-api.js
node --check src/renderer/v2-auto-fill-schedule.js
node scripts/check-normalized-storage.js
node scripts/check-expansion-acceptance.js
node scripts/check-settings-lists.js
npm run v2:check
```

前端有修改時，最後仍須執行 `npm run web:publish` 並確認 `docs/` 已更新。
