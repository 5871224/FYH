# AI 開發代理人注意事項

本檔記錄每次處理本儲存庫都必須遵守的長期開發規則。功能需求、介面、資料模型、權限與驗收標準以根目錄 `規格書.md` 為唯一正式來源；專案結構、建置與部署方式以 `README.md` 為準。

## 開始處理前

1. 先閱讀本檔，再閱讀 `規格書.md` 與任務相關章節；需要建置或部署資訊時再讀 `README.md`。
2. 修改前先確認現行程式、測試與文件是否一致；有衝突時先修正正式來源，不新增相容層掩蓋衝突。
3. 架構、權限鍵、端點、資料欄位或功能位置有變更時，必須搜尋專案全部 Markdown，移除舊名稱與舊流程。
4. 穩定功能規則直接更新 `規格書.md`，不得另建臨時規格、一次性說明或補充規格檔。
5. 中文文件與回覆使用繁體中文；文字檔使用 UTF-8。

## Git 與 GitHub 流程

1. 預設直接提交到 `main`；只有使用者明確要求時才建立 PR 或臨時分支。
2. 多檔案屬同一需求時應以單一完整提交完成，不把半成品逐檔推到 `main`。
3. 禁止為單次修改建立 GitHub Workflow。`.github/workflows/` 只保留長期正式流程，不得用 workflow 自動改寫程式、產生補丁提交或建立第二套 Pages 發布流程。
4. 可直接使用 GitHub 檔案或 Git object 寫入能力完成多檔案原子提交；不要因為寫入不方便而改用一次性 workflow。
5. GitHub Pages 使用 `main/docs`；`docs/` 必須由正式建置產生，不直接手改。

## 正式原始碼位置

- 前端：`src/renderer/`
- CSS：`src/renderer/css/`
- 產生檔：`src/renderer/app.css`、`src/renderer/app.js`、`docs/`
- Supabase SQL：`supabase/001_current_schema.sql`、`supabase/002_current_updates.sql`
- 正式 Edge Functions：`supabase/functions/`
- 正式增量資料庫部署紀錄：`supabase/migrations/`
- 建置與檢查：`scripts/`
- 測試：`tests/`

## Canonical 權限模型

授權只使用目前兩層模型，不得自行推導「主管」、「管理員」或泛用「管理能力」。

### 共用權限

保存於 `access_roles.common_permissions`：

- `settings`
- `export`
- `leave_settings`

### 逐群組權限

保存於 `access_role_group_permissions.permissions`：

- `schedule_view`
- `schedule_manage`
- `department_settings`
- `attendance_review`
- `meal_admin`

`schedule_manage` 必須連動 `schedule_view`；其他權限彼此不推導。

不得再以以下項目作為正式授權來源：

- `access_roles.permissions`
- `access_role_groups`
- `member_settings`
- `permission_settings`
- `legacy_role`
- `set_employee.role`
- `admin` / `manager` 文字角色
- `is_admin()` / `is_manager()` 或前端泛用 `hasManagementAccess()` 類型判定

前端權限判斷使用明確 helper，例如 `hasCommonPermission(permission)`、`hasGroupPermission(groupId, permission)`；後端 RPC、RLS、Trigger 與 Edge Function 必須用相同正式權限鍵再次驗證。

## 班表「功能」選單固定對應

班表功能選單由同一份 canonical 選單模型直接產生：

| 分類 | 建立條件 | 項目 |
|---|---|---|
| 設定 | 共用 `settings` | 權限設定、群組設定、週期設定、班表封存 |
| 排班 | 目前群組 `schedule_manage` | 排班條件、自動排班預覽、自動補班預覽、套用預覽、取消預覽 |
| 匯出 | 共用 `export` | 列印班表、匯出上班日、匯出休例假、匯出請假、匯出加班 |

`列印班表` 固定屬於「匯出」，不得因 `schedule_manage` 顯示；`attendance_review`、`meal_admin`、`department_settings` 也不得讓班表功能選單出現無關分類。

## 禁止補丁式實作

這是專案硬性架構規則，不只適用權限頁。

1. **權限 UI 在 render 時決定是否建立。** 無權限的選單、分類、按鈕、頁籤不得先建立，再用 `style.display`、`hidden`、CSS selector 或後續程式藏起來。
2. **禁止載入後搬移或補插 UI。** 不得以 `prepend`、`appendChild`、`insertAdjacentElement`、`MutationObserver`、DOM 掃描或 timer fallback 把功能移到正確位置。
3. **禁止相容層覆寫正式模組。** 不得以後載入 script、runtime monkey patch、wrapper、override、重複事件 listener 或函式重新定義修補原程式。
4. **禁止泛用管理權限。** 每個入口、按鈕、頁籤與 API 都直接判斷自己的正式權限，不得用「只要有任一管理權限就顯示」的聚合判定。
5. **禁止 CSS 當授權機制。** CSS 只負責樣式與響應式配置，不得用 `display:none`、`:has(...)` 或載入順序修正錯誤的權限 DOM。
6. 若舊程式與新需求衝突，應直接修改 canonical renderer / API / SQL，並在同一變更移除舊路徑；不得保留舊邏輯再加新判斷蓋過去。
7. 新功能若屬現有分類，直接加入正式模型；不得另外寫「確保按鈕存在」、「找不到就補一個」之類 fallback。
8. 權限或 UI 架構修改必須新增／更新守門測試；若同類補丁式模式再次出現，CI 應失敗。

## 前端與發布規則

1. 只修改 `src/renderer/` 正式來源；JavaScript 不直接修改 `app.js`。
2. CSS 只修改 `src/renderer/css/` 正式模組，不直接修改產生的 `app.css`，也不新增 `fix.css`、`patch.css`、`refinement.css`、`final.css` 等補丁檔。
3. 共用元件規則優先放 `components.css`；班表結構放 `schedule.css`；頁面特殊規則放 `pages.css`；跨頁響應式規則放 `responsive.css`。
4. 前端修改完成後執行 `npm run web:publish`，由建置程序重建 bundle 與 `docs/`。
5. 調整建置模組順序前必須確認依賴，不得以載入順序當修正工具。

## Supabase 與資料層規則

1. 全新資料庫唯一正式建置順序：`001_current_schema.sql` → `002_current_updates.sql`。
2. `supabase/migrations/` 可保存正式環境需要的增量部署 migration，但 migration 不是全新環境的第二套規格；最終狀態必須同步回 canonical SQL。
3. 瀏覽器不得直接 CRUD 核心資料表；正式寫入只走具名 RPC / Edge Function。
4. 不新增通用 `restSelect/restInsert/restUpdate/restDelete`、整包 `saveState/syncCatalogs` 或依資料表名稱分派的通用寫入器。
5. 受保護 mutation 必須在資料庫或 Edge Function 端重新驗證 `auth.uid()` 與精確權限；前端隱藏永遠不是安全邊界。
6. Trigger、內部完整性 helper 不得開放給 `authenticated` 直接 EXECUTE；瀏覽器只能呼叫正式具名入口。
7. 同一完整性規則只保留一套 Trigger / RPC / Edge 實作；不要並存 v1/v2 或 fallback 路徑。
8. Edge Function 正式清單以 `supabase/functions/` 與 `scripts/deploy-edge-functions.ps1` 為準；新增、移除或改名時同步更新 README 與規格書。
9. 所有本人功能需同時檢查任職有效期間與 `deleted_at`；群組資料先以正式群組權限縮小資料列，再做 GPS、IP、日期或業務判斷。

## 驗證策略

小型純文字／樣式修改執行相關快速檢查即可。涉及權限、資料庫、登入、打卡、訂餐、匯出、跨模組重構或 canonical 架構時，提交前至少執行與變更相關的完整守門；正式完整檢查為：

```bash
npm run ci:check
```

其中包含單元測試、公開 Supabase 設定、儲存架構、擴充驗收、設定清單、Renderer、CSS 與 JavaScript 架構檢查。

權限介面變更另需確認：重新登入、切換群組、離開再進入頁面、重新整理後仍由同一 canonical 權限狀態產生相同 UI，不依賴前一次 DOM 狀態。

## 效能守門

- 班表只載顯示需要的共同人員資料；完整人員管理欄位 lazy load。
- 個人記錄與簽到審核分開載入，不互相預載。
- ExcelJS 等大型匯出套件只在實際匯入／匯出時動態載入。
- 班表高頻 SQL 先解析 actor 與 allowed groups，再集合式處理；禁止 row-by-row 權限 helper。
- 核心資料表維持 anon/authenticated 無直接寫入 GRANT，正式寫入走具名 RPC／Edge Function。

## 文件維護

1. `規格書.md`：唯一功能／資料／權限／驗收規格。
2. `AGENTS.md`：長期開發與架構守門規則。
3. `README.md`：專案結構、操作、建置與部署方式。
4. `src/renderer/css/README.md`：CSS 模組責任與 CSS 專屬禁止事項。
5. `.github/pull_request_template.md`：只有使用 PR 時的檢查清單。
6. 修改架構、權限或功能位置後，必須搜尋全部 `.md`；不能只更新其中一份，讓舊文件繼續指導出錯誤實作。
