# AI 開發代理人注意事項

本檔只記錄 AI 每次處理本儲存庫時都必須遵守的長期規則。功能需求、介面規則、資料模型與驗收標準，以根目錄 `規格書.md` 為唯一正式來源；專案操作與部署方式以 `README.md` 為準。

## 開始處理前

1. 先閱讀本檔，再閱讀 `規格書.md` 中與任務相關的章節。
2. 需要了解目錄、指令或部署方式時，再閱讀 `README.md`。
3. 修改前先確認程式與規格是否一致；有衝突時以 `規格書.md` 為準。
4. 只修改本次需求相關檔案，不因順手整理而擴大變更範圍。
5. 穩定的新規則直接整理進 `規格書.md`；不新增獨立規格書、臨時需求文件或一次性說明文件。

## 工具能力與查找方式

1. 不可只憑記憶判斷「沒有工具」或「無法修改」。工具能力可能依對話與權限變動，執行前應先查詢目前可用工具。
2. GitHub 工具從 `api_tool.list_resources` 查找：
   - `paths` 使用 `["GitHub"]`
   - `query` 使用單一功能關鍵字，例如 `fetch_file`、`update_file`、`search`、`commit`、`workflow`、`pull request`
3. 查到工具定義後，直接呼叫對應的 `GitHub.*` 函式，不要反覆查找同一項能力。
4. GitHub 常用能力包括：
   - 搜尋儲存庫與程式碼
   - 讀取、建立、更新、刪除儲存庫檔案
   - 讀取提交、差異與狀態
   - 讀取與管理 Issue、Pull Request
   - 讀取 GitHub Actions 的 run、job、step、log、artifact 與狀態
   - 在權限允許時重跑失敗的 workflow 或 job
5. 修改既有 GitHub 檔案的標準流程：
   - 先用 `GitHub.fetch_file` 取得最新內容與 `sha`
   - 再用 `GitHub.update_file` 完整覆寫並直接提交到 `main`
   - 建立新檔用 `GitHub.create_file`；刪除檔案先讀取最新 `sha`，再用 `GitHub.delete_file`
6. 工具清單是當下能力的唯一準據；若查不到特定寫入或刪除函式，才說明目前無法執行。不得因一次查詢沒有結果，就推論整個 GitHub 連接器不能讀寫。
7. 本檔只記錄穩定的工具查找方法，不列出可能隨系統更新而變動的完整函式清單。

## 主要目錄

- 前端原始碼：`src/renderer/`
- CSS 原始碼：`src/renderer/css/`
- JavaScript 模組：`src/renderer/*.js`
- 產生檔：`src/renderer/app.css`、`src/renderer/app.js`、`docs/app.css`、`docs/app.js`
- GitHub Pages：`docs/`
- Supabase：`supabase/`
- 工具與檢查：`scripts/`
- 測試：`tests/`

## 編碼與回覆

- 文字檔一律使用 UTF-8。
- 中文文件與回覆使用繁體中文，除非使用者明確要求其他語言。
- 回覆只報告重要進度與結果，不逐項描述低階操作。

## Git 與 GitHub 流程

1. 所有修改預設直接提交到 `main`，不建立 PR，不建立臨時分支；只有使用者明確要求時才例外。
2. 多檔案修改應一次完成後，以單一提交推送，避免半成品進入 `main`。
3. 禁止建立一次性 GitHub Workflow，包括 `Apply...`、`Audit...`、`Cleanup...`、`Canonical...`、`Consolidate...` 或任何只為單次任務存在的流程。
4. `.github/workflows/` 只保留長期固定流程。不得為了套用修改而新增會自動改分支、產生提交或重複發布 Pages 的 workflow。
5. GitHub Pages 使用 `main/docs` 發布；不得建立第二套重複部署流程。
6. 重要修改若有風險，可先記錄目前 `main` 提交編號或建立備份分支，但仍不需要 PR。

## 前端與發布規則

1. 前端修改完成後執行：

```bash
npm run web:publish
```

2. `docs/` 必須由 `npm run web:publish` 重建，不得直接修改。
3. CSS 只修改 `src/renderer/css/` 的正式模組，不得直接修改 `app.css`，也不得新增 `fix`、`refinement`、`final` 等補丁 CSS。
4. 共用按鈕、表單、頁籤、卡片、彈窗與一般表格，以 `src/renderer/css/components.css` 為共用規則；頁面 CSS 只保留必要差異。
5. JavaScript 不得直接修改 `app.js`；修改模組後由建置程序產生 bundle。
6. 不得新增靠載入順序覆寫舊函式的補丁檔，也不得重複載入同一模組。
7. 調整 `scripts/build-js.js` 的模組順序前，必須確認依賴並執行完整驗證。

## 驗證策略

### 小型修改

小型修改包含文字、顏色、間距、圓角、欄寬、單一頁面樣式或低風險顯示邏輯。

只執行與本次變更直接相關的快速驗證，例如：

- `npm run web:publish`
- `npm run js:check`
- 相關單元測試
- 必要的 CSS 或 Renderer 檢查

不得因小修改每次都執行全部驗證。

### 重要修改

重要修改包含資料庫、權限、登入、訂單、打卡、加班、資料儲存、跨模組重構或部署流程。

提交到 `main` 前執行完整驗證，視修改範圍包含：

```bash
npm test
npm run web:check
node scripts/check-normalized-storage.js
node scripts/check-expansion-acceptance.js
node scripts/check-settings-lists.js
npm run renderer:check
npm run css:architecture
npm run js:architecture
```

只執行與任務相關的檢查；沒有涉及的資料庫或架構檢查可以略過。完整驗證可保留為手動 workflow，需要時再執行。

## Supabase 長期規則

1. 現行正式 SQL：
   - `supabase/001_current_schema.sql`
   - `supabase/002_current_updates.sql`
2. 全新資料庫依序執行 `001_current_schema.sql`、`002_current_updates.sql`。
3. 新增資料庫異動時，將具備冪等性的完整區段附加至 `002_current_updates.sql`；若影響全新環境，也同步更新 `001_current_schema.sql`。
4. 不新增零散的一次性 SQL、migration 子檔或額外 SQL 順序文件；全新環境不得先建立淘汰結構再執行清理。
5. Edge Function 正式部署清單以 `scripts/deploy-edge-functions.ps1` 為準。
6. 新增、移除或改名正式 Edge Function 時，同步更新部署腳本、README 與規格書。
7. 權限必須由 RPC、RLS 或 Edge Function 實作，不得以純前端限制作為安全邊界。
8. 新增或重構 API 時，需直接更新唯一正式的錯誤碼、角色與 Request／Response 契約；本系統尚未上線，不保留切換期雙軌、舊端點、舊欄位、相容代理或回滾分支。
9. SQL Editor 發生錯誤時立即停止，不可略過後續區段。
10. 瀏覽器不得直接 CRUD 核心資料表；資料層只允許具名 RPC / Edge Function。
11. 不得新增通用 `restSelect/restInsert/restUpdate/restDelete`、整包 `saveState/syncCatalogs` 或依資料表名稱分派的寫入器。
12. 權限判斷以 `access_role_id + access_roles.permissions + access_role_groups` 為唯一來源，不得用 `set_employee.role`、`access_roles.legacy_role` 或 `admin/manager` 字串授權。
13. 需要受保護主檔的 mutation RPC 必須 `SECURITY DEFINER`，並在函式內先驗證 `auth.uid()`、功能權限與適用群組。
14. 資料存取架構不得以後載入 script、runtime monkey patch 或 API wrapper 覆寫修補；必須直接修改正式模組。
15. RLS 與 Trigger 必須使用與正式 API 相同的明確權限鍵；不得用泛化 `is_manager()` / `is_admin()` 代替 `schedule_manage`、`member_settings`、`leave_settings`、`meal_admin` 等領域權限。
16. Trigger、內部 helper 與資料完整性函式不得授予 `authenticated` 直接 EXECUTE；瀏覽器只允許呼叫正式具名 RPC。
17. 同一完整性規則只保留一個正式 Trigger；修改前需檢查是否已有舊版 Trigger，避免重複執行同一守門或 `updated_at` 邏輯。
18. 所有本人 Edge Function 都必須同時檢查任職日期與 `deleted_at`；軟刪除後即使舊 Session 尚未失效，也不得再通過受保護操作。
19. 涉及群組實體的 Edge Function 必須先限制資料列至本人所屬群組或角色適用群組，再進行 GPS、IP、日期或其他業務判斷；不得先讀全公司資料再只靠前端篩選。

## 文件維護原則

1. `AGENTS.md` 只保留長期有效、每次開發都需要遵守的規則。
2. 一次性任務、歷史除錯紀錄、已完成的特殊注意事項與舊流程，完成後必須移除。
3. 詳細功能規格放在 `規格書.md`，操作方式放在 `README.md`；不得在三個文件間重複維護相同內容。
4. 修改功能、介面、資料庫、權限或部署行為時，必要時同步更新 `規格書.md`。
5. 架構、端點、資料欄位或函式完成清理後，必須同步搜尋所有 Markdown，移除已不存在的名稱、舊流程與過渡說明。
6. 維持本檔精簡，不得把每次任務的處理紀錄持續累積進來。

## 最終回覆

完成修改後，只需說明：

- 已修改的主要內容。
- 是否已更新 `docs/`、測試與規格書。
- 是否已直接提交到 `main`。
- 實際執行了哪些驗證，以及是否通過。

### 效能守門規則

- 不得為了開啟班表預先下載人員管理專用欄位；完整人員目錄只能由人員設定功能 lazy load。
- 個人記錄與簽到審核為不同資料生命週期，不得在載入個人記錄時順帶查簽到審核。
- 大型匯出套件（目前為 ExcelJS）不得放在首頁 eager script；必須在匯入／匯出動作才載入。
- 班表批次讀寫 SQL 必須先物化 actor/allowed groups，再集合式處理；禁止 row-by-row 權限 helper。
- Browser 核心資料表沒有直接寫入 GRANT，因此也不得恢復 authenticated 的直接寫入 RLS policy；具名 RPC／Edge Function 是唯一正式寫入入口。
- 新增 RLS 時 auth.uid()/auth.jwt() 要使用 init-plan 形式，並避免同一 role/action 存在多個 permissive policy。
