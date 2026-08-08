# 福圓號排班系統

福圓號排班系統是手機優先的瀏覽器應用程式，涵蓋多群組班表、簽到簿、訂餐、個人記錄、簽到審核、角色權限與班表封存。前端由 GitHub Pages 發布；登入、資料庫、RPC 與伺服器端 API 由 Supabase 提供。

詳細功能、資料、安全、介面與驗收規格以 [`規格書.md`](規格書.md) 為唯一正式依據。

## 現行架構

```text
瀏覽器前端（GitHub Pages）
  ↓ Supabase Auth Token
Supabase Edge Functions／REST／RPC
  ↓ 身分、角色、適用群組、伺服器時間、位置與交易驗證
Supabase PostgreSQL
```

- GitHub Pages 只託管 `docs/` 靜態檔案。
- 前端正式原始碼位於 `src/renderer/`。
- `src/renderer/app.css`、`src/renderer/app.js` 與 `docs/` 都是自動產生檔，不直接修改。
- Supabase Auth 負責登入身分。
- PostgreSQL、RLS、限制與 RPC 負責正式資料、群組權限、班表封存與交易一致性。
- `supabase/functions/` 只保存目前正式 Edge Function；資料夾清單必須與 `scripts/deploy-edge-functions.ps1` 一致。

## 單一正式版本原則

本系統尚未正式上線，因此程式庫只維護目前正式資料模型與 API 契約：

- 不保留舊資料表、舊欄位、舊端點、舊 payload 或雙軌讀寫。
- 不以 `try/catch` 靜默退回舊流程；必要正式服務不可用時直接回報錯誤。
- 不以後載入模組覆寫既有函式，不新增 `fix`、`patch`、`override` 或相容代理模組。
- 格式調整直接修改正式匯出器、正式 API 與正式事件處理器。

## 主要頁面

- **首頁：** 登入者姓名、角色、簽到簿、班表、依所屬群組開關顯示的訂餐、修改密碼與登出。
- **簽到簿：**
  - 個人記錄：班表、上下班打卡、上班時數、加班時數、備註與訂餐。
  - 簽到審核：依角色適用群組篩選、補登／修改、批次審核、批次退回、歷程與正式加班匯出。
  - 今日列直接提供上班及下班打卡。
- **班表：** 群組切換、八週班表、班別／假別／班表加班、排班工具、群組設定、角色權限與班表封存。
- **訂餐：** 今日訂餐、訂餐統計與訂餐設定；首頁訂餐入口依人員所屬群組的「可否訂餐」設定顯示。

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
│  ├─ 001_current_schema.sql          # 全新環境完整結構
│  ├─ 002_current_updates.sql         # 仍有效的冪等更新
│  └─ functions/                      # 正式 Edge Function 原始碼
├─ tests/
├─ AGENTS.md
├─ README.md
├─ package.json
├─ 規格書.md
└─ 啟動網頁版.bat
```

## 資料庫建置順序

全新資料庫固定依序執行：

```text
1. supabase/001_current_schema.sql
2. supabase/002_current_updates.sql
```

`001_current_schema.sql` 必須直接建立目前正式資料表、索引、RLS、限制、Trigger 與核心 RPC；不得先建立已淘汰結構再刪除。`002_current_updates.sql` 只保存仍有效且可重複執行的正式更新，包含群組、角色權限及班表封存的資料模型與安全規則。Edge Function 部署不會自動執行 SQL。

## 權限與資料存取架構

瀏覽器不直接 CRUD 核心資料表。正式資料流固定為：

`瀏覽器 → 具名 RPC / Edge Function → 權限與適用群組檢查 → 資料表`

- 核心班表、人員、單位、班別、假別與設定的讀寫使用具名 `SECURITY DEFINER` RPC。
- 人員登入帳號的新增、修改、重設密碼與刪除統一由 `member-auth-admin` 處理。
- 簽到與訂餐使用各自的 Edge Function；Edge Function 以 `access_role_id`、權限項目與適用群組判斷，不以舊 `admin/manager` 文字角色做授權。
- `anon` / `authenticated` 不具核心資料表直接權限；RLS 保留為第二層防護。
- RLS、Trigger 與 RPC 必須使用明確的權限項目，例如 `schedule_manage`、`member_settings`、`meal_admin`；不得以 `is_manager`、`is_admin` 或 `legacy_role` 作為實際授權依據。
- `has_access_permission`、`can_access_group` 等內部權限 helper 不作為瀏覽器公開 RPC，正式執行權只保留給後端／`service_role`；瀏覽器只能呼叫有明確領域用途且自行驗證權限的公開 RPC。
- 同一資料完整性規則只保留一個正式 Trigger；不得同時保留舊版與新版「最後管理者保護」或重複 `updated_at` Trigger。
- 已軟刪除人員即使仍持有舊 Session，也不得使用打卡、個人簽到、訂餐或其他受保護功能。
- 打卡可用單位必須先限制在人員所屬群組，再執行 GPS／IP 比對；不得跨群組使用其他單位的打卡條件。
- 不使用通用整包 `saveState`、資料表名稱型 REST helper、runtime monkey patch 或舊版相容橋接。

## Edge Functions

- `member-auth-admin`：人員登入帳號新增、修改、密碼重設、軟刪除與權限角色驗證。
- `attendance-clock`：本人打卡；只允許有效且未刪除帳號，GPS／IP 只比對本人所屬群組的啟用單位。
- `attendance-ledger`：本人簽到簿資料；已軟刪除帳號不得存取。
- `attendance-review-groups`：依 `attendance_review` 與適用群組進行簽到審核、編輯與歷程查詢。
- `attendance-ledger-export`：依 `attendance_review` 與適用群組匯出已審簽到資料。
- `meal-order`：訂餐與訂餐管理。
- `meal-report-v2`：訂餐統計報表。
- `meal-cancel-v2`：本人訂餐取消；已軟刪除帳號不得執行。

`supabase/functions/` 是 Edge Function 唯一正式清單。正式上線前，Supabase 遠端已部署函式也必須與此清單一致；不在清單內的歷史端點不得繼續提供舊邏輯，應直接刪除。若部署工具當下無刪除能力，至少先停用舊端點，之後由 Supabase Dashboard 或 CLI 完成實體刪除。

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
5. 部署正式 Edge Functions，並確認 Supabase 遠端清單沒有仍可執行舊邏輯的歷史端點。
6. 合併至 `main`。
7. GitHub Pages 由內建 `pages-build-deployment` 發布 `main/docs`。
8. 以員工、主管與管理員測試登入、簽到簿、群組班表、封存、訂餐與主要管理入口。

`.github/workflows/deploy-pages.yml` 是唯一正式 GitHub Actions 驗證流程；不得新增重複監聽或自動改寫程式碼的 workflow。

## 效能與載入原則

- 首頁只載入登入身分與權限摘要；第一次進班表才載班表資料，人員管理完整資料只在人員設定開啟時載入。
- 個人簽到簿不預載簽到審核；只有切換到「簽到審核」時才第一次讀取。
- ExcelJS 屬大型非核心相依套件，只在 XLSX 匯入／匯出實際發生時動態載入。
- 班表高頻 RPC 先一次解析目前使用者的角色與適用群組，再以集合式 JOIN 篩選；禁止在每一列班表上重複呼叫 can_access_group/has_access_permission。
- 核心資料表維持 anon/authenticated 無直接 GRANT；因此不建立 authenticated 直接 INSERT/UPDATE/DELETE RLS policy。RLS 只作唯讀防線，正式寫入一律走具名 RPC／Edge Function。
- 資料庫 DDL 或權限調整後，需重新檢查 Supabase Performance Advisor；auth RLS init-plan 與 multiple permissive policy 警告不可無理由新增。

## Canonical 程式簡化原則

- 正式狀態只保存目前功能真正需要的欄位；群組／角色／刪除狀態由 canonical API 直接提供，不再透過第二份 entity map 補值。
- 前端排班人員主鍵一律為 UUID；不得以工號或臨時字串 ID 猜測／二次查詢主鍵。
- 已刪除的歷史班別、假別、加班由後端明確回傳歷史項目；不存在的 ID 不得自動替換成第一個可用項目。
- Edge Functions 的台北日期、帳號有效期間、UUID 與權限 helper 統一放在 `supabase/functions/_shared/`。
- XLSX 建立與格式由 `browser-exporter.js` 負責；`web-api.js` 僅處理 transport、RPC／Edge 呼叫與下載協調。
- SQL 正式來源不保留文字角色相容欄位、動態文字改寫 policy、重複 policy 定義或瀏覽器直接寫入 policy。
