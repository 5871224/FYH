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
4. GitHub 常用能力包括：搜尋程式碼、讀寫檔案、讀取提交與差異、管理 Issue／Pull Request、檢查 GitHub Actions。
5. 修改既有 GitHub 檔案時，先取得最新內容與 `sha`，再更新；建立或刪除檔案也必須以目前 `main` 狀態為準。
6. 工具清單是當下能力的唯一準據；若查不到特定能力，才說明目前無法執行。

## 主要目錄

- 前端原始碼：`src/renderer/`
- CSS 原始碼：`src/renderer/css/`
- JavaScript 模組：`src/renderer/*.js`
- 後端：`src/backend/`
- PostgreSQL 正式 SQL：`supabase/`
- GitHub Pages：`docs/`
- 工具與檢查：`scripts/`
- 測試：`tests/`

`supabase/` 只是目前沿用的資料庫 SQL 目錄名稱；正式 SQL 必須可用於一般 PostgreSQL，不得把 Supabase 專屬機制當成應用程式契約。

## 編碼與回覆

- 文字檔一律使用 UTF-8。
- 中文文件與回覆使用繁體中文，除非使用者明確要求其他語言。
- 回覆只報告重要進度與結果，不逐項描述低階操作。

## Git 與 GitHub 流程

1. 所有修改預設直接提交到 `main`，不建立 PR、不建立臨時分支；只有使用者明確要求時才例外。
2. 多檔案修改盡量在同一完整階段完成，避免半成品長期留在 `main`。
3. 禁止建立一次性 GitHub Workflow，包括只為單次 Apply、Audit、Cleanup、Canonical 或 Consolidate 任務存在的流程。
4. `.github/workflows/` 只保留長期固定流程，不得新增會自動改寫程式碼或重複發布 Pages 的暫時 workflow。
5. GitHub Pages 使用 `main/docs` 發布；不得建立第二套重複部署流程。
6. 重要修改若有風險，可先記錄目前 `main` 提交編號，但不需要為此建立 PR。

## 前端與發布規則

1. 前端修改完成後執行 `npm run web:publish`。
2. `docs/` 必須由 `npm run web:publish` 重建，不得直接修改。
3. CSS 只修改 `src/renderer/css/` 正式模組，不得直接修改 bundle，也不得新增 `fix`、`refinement`、`final` 等補丁 CSS。
4. 共用按鈕、表單、頁籤、卡片、彈窗與一般表格，以 `src/renderer/css/components.css` 為共用規則；頁面 CSS 只保留必要差異。
5. JavaScript 不得直接修改產生後的 `app.js`；修改模組後由建置程序產生 bundle。
6. 不得新增靠載入順序覆寫舊函式的補丁檔，也不得重複載入同一模組。
7. 調整 `scripts/build-js.js` 的模組順序前，必須確認依賴。

## 現行資料流

正式資料流固定為：

```text
瀏覽器
  ↓ /api/v1/*
FYH Node.js Backend
  ├─ Native Auth / Session
  ├─ API Router / Contract
  ├─ Domain Services
  └─ Native Repositories
  ↓ PostgreSQL transaction / SQL
PostgreSQL
```

1. 瀏覽器只使用 FYH API，不直接呼叫 PostgreSQL、Supabase REST、RPC 或 Edge Functions。
2. 登入、Session、功能權限與適用群組由 FYH Backend 處理。
3. Repository 使用一般 PostgreSQL SQL 與 transaction；不得把平台 SDK 或平台角色當成必要資料存取層。
4. PostgreSQL 可保留 constraint、index、trigger 與必要的內部 helper，但資料庫 function 不得成為瀏覽器 API。
5. 需要原子性的跨表操作優先由 Backend transaction 實作；只有純資料完整性規則才放在 trigger/helper。
6. Supabase 目前只作為 PostgreSQL 託管服務；Supabase 專案 Edge Functions 數量必須維持 0，不得重新部署舊 Function。

## PostgreSQL 長期規則

1. 現行正式 SQL 只有：
   - `supabase/001_current_schema.sql`
   - `supabase/002_current_updates.sql`
2. 全新資料庫依序執行 `001_current_schema.sql`、`002_current_updates.sql`。
3. `001` 描述全新環境完整資料結構；`002` 只保留目前有效的索引、內部 helper、trigger 與必要初始資料。
4. 不新增歷史 migration 串、一次性補丁 SQL、舊結構 backfill 或為舊資料存在的相容層；本系統只維護單一正式資料結構。
5. 正式 SQL 必須以一般 PostgreSQL 為基準，未來更換 PostgreSQL 供應商時不應需要重寫應用資料存取層。
6. 不得新增 `auth.uid()`、`auth.role()`、平台專用 RLS policy、`anon`／`authenticated`／`service_role` 授權或 browser-facing RPC。
7. 不得新增自動替新表啟用平台 RLS 的 event trigger。
8. 內部 PostgreSQL helper 預設不提供給 `PUBLIC` 作為遠端 RPC；Backend 透過資料庫連線正常使用。
9. 權限判斷以 `access_role_id + access_roles.permissions + access_role_groups` 為正式來源，由 Backend service/repository 執行；不得使用 `set_employee.role`、legacy role 或固定文字角色作為授權依據。
10. 同一資料完整性規則只保留一個正式 trigger；不得同時在多個舊 trigger 重複執行。
11. 班表封存不可變動、群組一致性、打卡／訂餐名稱快照等適合資料庫層保護的規則，可保留為純 PostgreSQL trigger/helper。
12. 若 Backend 已完整負責權限或交易，不得再為舊平台架構保留第二套相同驗證。

## 驗證策略

### 小型修改

文字、顏色、間距、圓角、欄寬、單一頁面樣式或低風險顯示邏輯，只執行與本次變更直接相關的快速驗證，例如：

- `npm run web:publish`
- `npm run js:check`
- 相關單元測試
- 必要的 CSS 或 Renderer 檢查

不得因小修改每次都執行全部驗證。

### 重要修改

資料庫、權限、登入、訂單、打卡、加班、資料儲存、跨模組重構或部署流程，依實際影響範圍選擇下列檢查：

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

只執行與任務相關的必要檢查；不要為沒有變更的領域重複跑完整驗證。GitHub Actions 是最後整合守門。

## 權限與資料存取守門

1. 前端隱藏按鈕不是安全邊界；受保護操作必須由 Backend 再驗證 Session、功能權限及適用群組。
2. 沒有對應功能權限者不得透過 API 繞過頁面限制。
3. 群組範圍必須在 Backend 查詢／寫入時限制，不能先讀全公司資料再只靠前端篩選。
4. 已刪除或超過帳號有效期間的人員，即使舊 Session 尚未過期，也不得通過受保護操作。
5. 打卡地點必須先限制在人員所屬群組，再進行 GPS／IP 判斷。
6. 角色中的 `permission_settings` 是最高管理能力判斷依據，不以 `admin` 文字名稱判斷。

## 效能守門規則

- 不得為了開啟班表預先下載人員管理專用欄位；完整人員目錄只能由人員設定功能 lazy load。
- 個人記錄與簽到審核為不同資料生命週期，不得在載入個人記錄時順帶查簽到審核。
- 大型匯出套件（目前為 ExcelJS）不得放在首頁 eager script；必須在匯入／匯出動作才載入。
- 班表批次查詢與寫入優先採集合式 SQL，避免逐列 round-trip。
- Backend API 成功後若能局部更新前端狀態，不應為單筆操作重新載入整份資料。

## Canonical Cleanup 守門規則

- 不得重新加入 `set_employee.role`、`access_roles.legacy_role`、固定 `admin/manager/employee` 授權判斷或角色相容 helper。
- 不得建立 entityMap 來重複保存已存在於正式 DTO 的 groupId／roleId／deleted；封存範圍使用獨立 archiveRanges。
- 排班寫入只接受 UUID memberId；不得再以工號查回 UUID 作為相容 fallback。
- 無效 catalog ID 不可猜測替代值；正式資料契約應明確處理不存在或已刪除項目。
- 不得為舊 Supabase API 恢復 RPC、RLS、Edge Function 或 browser direct CRUD。

## 文件維護原則

1. `AGENTS.md` 只保留長期有效、每次開發都需要遵守的規則。
2. 一次性任務、歷史除錯紀錄、已完成的特殊注意事項與舊流程，完成後必須移除。
3. 詳細功能規格放在 `規格書.md`，操作方式放在 `README.md`；不得在三個文件間重複維護相同內容。
4. 修改功能、介面、資料庫、權限或部署行為時，必要時同步更新 `規格書.md`。
5. 架構、端點、資料欄位或函式完成清理後，必須同步搜尋 Markdown，移除已不存在的名稱、舊流程與過渡說明。
6. 維持本檔精簡，不得把每次任務的處理紀錄持續累積進來。

## 最終回覆

完成修改後，只需說明：

- 已修改的主要內容。
- 是否已更新 `docs/`、測試與規格書。
- 是否已直接提交到 `main`。
- 實際執行了哪些驗證，以及是否通過。
