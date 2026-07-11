# AI 開發代理人注意事項

本檔只記錄 AI 在本儲存庫執行工作時必須遵守的注意事項。所有功能需求、介面規則、資料模型與驗收標準，均以根目錄的 `規格書.md` 為唯一正式來源，不得在本檔或 README 另行定義規格。

## 文件分工與開始處理前

1. 先閱讀本檔，再閱讀 `規格書.md` 中與任務相關的章節。
2. 需要了解目錄、指令或部署方式時，再閱讀根目錄 `README.md`。
3. 修改前先確認目前程式與規格是否一致；有衝突時以 `規格書.md` 為準，並在需要時同步修正程式。
4. 不新增獨立規格書、補充規格、SQL 套用順序文件或臨時需求文件；規格異動直接整理進 `規格書.md` 的既有樹狀章節。
5. README 只保留專案入口與操作方式，不複製詳細功能規格或 AI 工作規則。
6. 新增或修改關鍵功能時，檢查 `規格書.md` 第八章的共通狀態與非功能性要求，以及第九章的 API、資料生命週期、維運與測試追蹤。
7. 不另建 API 規格、測試計畫、Wireframe 規格或維運規格文件；穩定規則直接更新 `規格書.md`，一次性截圖與討論留在 PR。

主要目錄：

- 前端原始碼：`src/renderer/`
- CSS 模組原始碼：`src/renderer/css/`
- CSS 產生檔：`src/renderer/app.css`、`docs/app.css`（不得直接修改）
- JavaScript 模組：`src/renderer/*.js`；正式順序以 `scripts/build-js.js` 為準
- JavaScript 產生檔：`src/renderer/app.js`、`docs/app.js`（不得直接修改）
- GitHub Pages 發布檔案：`docs/`
- Supabase 現行資料庫結構與 RPC：`supabase/`
- 工具、檢查與部署腳本：`scripts/`

## 編碼與語言

- 文字檔一律使用 UTF-8 編碼儲存。
- 中文文件與回覆使用繁體中文，除非使用者明確要求其他語言。
- 回覆保持精簡，只回報高層次進度，不逐項報告低階操作。

## 修改與發布規則

1. 若工作涉及網頁介面、互動、樣式或前端資料流程，必須執行：

```bash
npm run web:publish
```

2. GitHub Pages 使用 `docs/`；`docs/` 必須由 `npm run web:publish` 清理重建，不得直接手動修改。
3. CSS 只修改 `src/renderer/css/` 的正確模組；不得直接修改 `app.css`，也不得新增 fix、refinement、final 等補丁 CSS。
4. 共用按鈕、表單、頁籤、卡片、彈窗與一般表格以 `css/components.css` 為唯一正式規則；頁面檔只保留無法共用的差異。
5. JavaScript 不得直接修改 `app.js`；修改現有模組後由 `npm run js:build` 產生 bundle。
6. 不得新增動態補載本機 JavaScript、重複載入同一模組，或新增 `fix`、`refinement`、`v3` 等靠載入順序覆寫既有函式的補丁檔。
7. 第一階段仍保留既有全域相依性；調整 `scripts/build-js.js` 的模組順序前，必須確認所有前置依賴並執行完整驗證。
8. 若前端程式有修改，且使用者未明確要求不要提交，應提交並推送至 `main`。
9. GitHub Actions 正式流程只保留 `.github/workflows/deploy-pages.yml`；Pull Request 只驗證，`main` 必須在同一 workflow 的 `validate` 成功後才執行 `deploy`。不得新增重複執行 V2 檢查或 Pages 部署的獨立 workflow。
10. 最終回覆必須說明：
   - `docs/` 是否已更新。
   - 是否已推送至 `main`。

## Supabase 維護規則

1. 現行正式 SQL 只有：
   - `supabase/001_current_schema.sql`
   - `supabase/002_current_updates.sql`
2. 全新資料庫固定先執行 `001_current_schema.sql`，再執行 `002_current_updates.sql`。
3. 新增資料庫異動時，將具備冪等性的完整區段附加至 `002_current_updates.sql`；若影響全新環境，也必須同步更新 `001_current_schema.sql`。
4. 不新增零散的一次性 SQL、migration 子檔或額外 SQL 順序文件。
5. Edge Function 正式部署清單以 `scripts/deploy-v2-final.ps1` 的 `$functions` 陣列為準；不得因 `supabase/functions/` 中存在資料夾，就自行判定該函式仍在正式使用。
6. 新增、移除或改名正式 Edge Function 時，必須同步更新部署腳本、根 README 與規格書第七章的現行後端功能清單。
7. 人員資料介面依用途固定分為本人資料、共同班表名錄與管理名錄；新增頁面時不得直接讀取 `set_employee`，也不得把管理名錄拿給一般頁面使用。管理名錄必須依管理頁面延遲載入，不得在一般登入初始化時預載。
8. 權限控制必須由 RPC、RLS 或 Edge Function 明確實作，不得以攔截 `fetch`、前端刪除欄位或後載入覆寫作為主要安全邊界。
9. 新增或重構 API 時，必須定義穩定錯誤碼、角色、Request／Response、相容與回滾方式；不得只讓頁面比對中文錯誤全文。
10. 新增資料表或敏感欄位時，必須確認資料分類、保存、刪除、備份與稽核要求。
11. SQL Editor 出現錯誤時立即停止，不可跳過後續區段。

## 修改時的檔案檢查

涉及自動排班基礎欄位時，至少檢查：

- `supabase/001_current_schema.sql`
- `supabase/functions/member-auth-admin/index.ts`
- `src/renderer/web-api.js`

涉及班表格資料儲存時，至少檢查：

- `supabase/001_current_schema.sql`
- `supabase/002_current_updates.sql`
- `src/renderer/web-api.js`
- `scripts/check-normalized-storage.js`

涉及登入身分、人員名錄或跨頁面權限時，至少檢查：

- `supabase/001_current_schema.sql`
- `supabase/002_current_updates.sql`
- `src/renderer/web-api.js`
- `src/renderer/v2-api.js`
- 各頁使用的 Edge Function 權限檢查
- `規格書.md` 第 5.4.1 節權限矩陣

涉及 Supabase 資料庫結構、RPC 或部署方式時，至少檢查：

- 根目錄 `README.md`
- `supabase/001_current_schema.sql`
- `supabase/002_current_updates.sql`
- `scripts/deploy-v2-final.ps1`
- 相關 Edge Function 與驗證腳本

## 驗證原則

- 依修改範圍執行既有檢查，不得只確認檔案可儲存。
- 前端修改後執行 `npm run web:publish`，確認 `app.css`、`app.js` 與 `docs/` 一致；入口只載入單一 `app.css`，本機 JavaScript 只載入 `app-config.js` 與單一 `app.js`。
- JavaScript 修改後至少執行 `npm run js:check`；功能模組仍需保留在 `scripts/build-js.js` 的固定順序清單中。
- 資料庫或班表儲存修改後，至少考慮執行：

```bash
node scripts/check-normalized-storage.js
node scripts/check-expansion-acceptance.js
npm run v2:check
```

- 不得為了讓檢查通過而刪除仍有效的安全、權限、資料一致性或正式規格驗證。
- 關鍵需求應使用第 9.9 節穩定編號；PR 說明受影響需求、實作模組與驗收案例。
- GitHub Actions 修改後執行 `npm run ci:check`，並確認部署工作明確依賴驗證工作。
- 發布前除功能正確外，需考慮第 8.7 節效能容量、第 9.6 節備份復原及第 9.7 節回滾。
