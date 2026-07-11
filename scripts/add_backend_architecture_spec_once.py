from pathlib import Path

SPEC_PATH = Path("規格書.txt")
SCRIPT_PATH = Path("scripts/add_backend_architecture_spec_once.py")
WORKFLOW_PATH = Path(".github/workflows/add-backend-architecture-spec-once.yml")

text = SPEC_PATH.read_text(encoding="utf-8-sig")

old_toc = """└─ 第六章　介面樣式統一規格  
   ├─ 6.1 適用範圍  
   ├─ 6.2 CSS 架構與載入順序  
   ├─ 6.3 共用尺寸與間距  
   ├─ 6.4 配色與狀態  
   ├─ 6.5 表單控制項  
   ├─ 6.6 按鈕與頁籤  
   ├─ 6.7 表格  
   ├─ 6.8 卡片、區塊與彈出視窗  
   ├─ 6.9 手機版頁面配置  
   ├─ 6.10 無障礙與實作規則  
   └─ 6.11 驗收標準"""

new_toc = """├─ 第六章　介面樣式統一規格  
│  ├─ 6.1 適用範圍  
│  ├─ 6.2 CSS 架構與載入順序  
│  ├─ 6.3 共用尺寸與間距  
│  ├─ 6.4 配色與狀態  
│  ├─ 6.5 表單控制項  
│  ├─ 6.6 按鈕與頁籤  
│  ├─ 6.7 表格  
│  ├─ 6.8 卡片、區塊與彈出視窗  
│  ├─ 6.9 手機版頁面配置  
│  ├─ 6.10 無障礙與實作規則  
│  └─ 6.11 驗收標準  
└─ 第七章　後端架構與平台遷移  
   ├─ 7.1 章節目的  
   ├─ 7.2 現行架構與採用原因  
   ├─ 7.3 前端、Edge Function 與資料庫分工  
   ├─ 7.4 現行後端功能清單  
   ├─ 7.5 遷移至其他後端平台的對應原則  
   ├─ 7.6 建議遷移順序  
   ├─ 7.7 遷移時不得破壞的規則  
   └─ 7.8 驗收與切換原則"""

if old_toc in text:
    text = text.replace(old_toc, new_toc, 1)
elif "第七章　後端架構與平台遷移" not in text:
    raise SystemExit("找不到預期的第六章目錄區塊")

chapter = r"""

---

# 第七章　後端架構與平台遷移

## 7.1 章節目的

本章說明目前採用「GitHub Pages 靜態前端＋Supabase 後端服務」的原因、各層責任與安全邊界，並定義未來遷移至具備自有後端執行環境的平台時的對應方式。

本章的目的不是限定未來一定使用 Supabase，而是確保更換託管平台、後端語言或身分驗證服務時，現有權限、安全、交易、稽核與資料一致性規則不會遺失。

## 7.2 現行架構與採用原因

### 7.2.1 GitHub Pages 的定位

1. GitHub Pages 只負責託管 `docs/` 內的 HTML、CSS、JavaScript、圖片與其他靜態檔案。
2. GitHub Pages 不提供可執行伺服器端程式的常駐後端環境，不能直接執行 Node.js、PHP、Python、.NET 或其他後端程式。
3. 發布到 GitHub Pages 的 JavaScript 會下載到使用者瀏覽器，程式碼與其中的公開設定均可被查看或修改。
4. 因此前端 JavaScript 不得保存高權限金鑰，也不得作為角色、權限、正式時間、IP、GPS、交易及稽核的唯一判定者。

### 7.2.2 Supabase 在目前架構中的角色

目前由 Supabase 提供：

- Supabase Auth：登入與使用者身分。
- PostgreSQL：正式資料庫。
- RLS 與資料庫限制：資料列權限、唯一性、外鍵與基本安全邊界。
- PostgreSQL RPC：原子寫入、批次保存及需交易一致性的資料庫操作。
- Edge Functions：伺服器端 API、角色驗證、敏感資料處理、請求資訊判斷與多步驟業務流程。

`supabase/functions/` 內的每個子資料夾代表一個 Edge Function 的原始碼；部署後在 Supabase 執行，不會由 GitHub Pages 直接執行。

### 7.2.3 與 GitHub Pages 的關係

1. 目前需要 Edge Functions，主要原因是 GitHub Pages 本身沒有後端執行環境，而系統又需要可信任的伺服器端處理。
2. 但角色驗證、敏感資料保護、伺服器時間、交易一致性、冪等性與稽核等需求，不會因未來改用具備後端的平台而消失。
3. 未來若遷移至自有後端平台，Edge Functions 的程式可改寫成該平台的 API Controller、Route、Service 或 Serverless Function；不能單純把這些邏輯移回瀏覽器 JavaScript。

## 7.3 前端、Edge Function 與資料庫分工

### 7.3.1 前端 JavaScript

前端負責：

- 顯示頁面、表單、按鈕及操作狀態。
- 收集使用者輸入與手機 GPS 資料。
- 執行方便使用者操作的格式檢查與提示。
- 帶入登入憑證呼叫正式 API。
- 顯示後端回傳的結果與錯誤。

前端不得：

- 保存 `service_role`、資料庫密碼或其他伺服器 Secret。
- 只靠隱藏按鈕或前端變數判定權限。
- 相信前端自行傳入的角色、使用者 ID、正式日期、來源 IP 或核准狀態。
- 直接執行可繞過 RLS 的管理操作。

### 7.3.2 Edge Functions

Edge Functions 負責：

- 驗證登入 Token 並取得真正的使用者身分。
- 重新查詢角色、帳號啟用狀態及任職有效期間。
- 使用伺服器端 `Asia/Taipei` 日期與時間進行正式判定。
- 取得平台收到的來源 IP、請求 Header 與其他可信任請求資訊。
- 使用伺服器端 Secret 或管理權限存取必要資料。
- 隔離固定 IP、原始 GPS、定位精準度、距離及稽核資料等敏感內容。
- 協調多個查詢、RPC 或外部服務，形成完整業務流程。
- 回傳前先過濾欄位，只提供目前角色必要的資料。
- 統一錯誤格式、操作結果及安全紀錄。

### 7.3.3 PostgreSQL、RLS 與 RPC

資料庫層負責：

- 正式資料保存。
- 主鍵、外鍵、唯一限制及欄位限制。
- RLS 與資料列層級權限。
- 需要原子性的新增、修改、刪除及批次操作。
- 防止重複請求改寫第一次有效結果。
- 交易失敗時完整回復，不留下部分完成資料。
- 保存稽核、歷史快照及不可由前端任意變更的結果。

### 7.3.4 標準資料流程

```text
瀏覽器前端
  ↓ 登入憑證＋使用者輸入
Edge Function／正式後端 API
  ↓ 驗證身分、角色、時間、位置與業務規則
PostgreSQL RPC／資料庫交易
  ↓ 原子保存、限制、RLS 與稽核
Edge Function／正式後端 API
  ↓ 過濾敏感欄位
瀏覽器前端
```

## 7.4 現行後端功能清單

下列 Edge Functions 均視為正式後端 API；未來遷移時需逐項建立對應端點或服務：

| 現行 Edge Function | 主要責任 | 未來後端對應 |
|---|---|---|
| `attendance-clock` | 今日打卡狀態、GPS／IP 驗證、上下班打卡 | 打卡 Controller＋位置驗證 Service |
| `attendance-overtime-employee` | 員工加班資格、送出、刪除與狀態 | 員工加班 API＋加班 Service |
| `attendance-overtime-admin-list` | 管理員加班審核清單 | 管理端查詢 API |
| `attendance-overtime-admin-action` | 調整、核准、退回、批次處理與代為申請 | 管理端命令 API＋交易 Service |
| `attendance-admin-list-v2` | 管理員打卡資料與異常查詢 | 打卡管理查詢 API |
| `attendance-admin-action-v2` | 補登、修改、清除與異動歷程 | 打卡管理命令 API＋稽核 Service |
| `meal-order` | 今日訂餐、商品設定讀取與訂單保存 | 訂餐 API＋訂單 Service |
| `meal-report-v2` | 訂餐統計與管理查詢 | 報表查詢 API |
| `meal-cancel-v2` | 整張取消今日訂餐 | 訂單取消 API＋交易 Service |
| `personal-records-v2` | 個人班表、打卡、加班與訂餐記錄 | 個人記錄彙整 API |
| `member-auth-admin` | 建立帳號、修改、重設密碼與刪除 | 帳號管理 API＋身分服務介接 |
| `member-order-v2` | 人員排序讀取與保存 | 排序設定 API |
| `department-attendance-v2` | 管理員讀取及維護單位打卡敏感設定 | 單位打卡設定管理 API |

實際清單以 `supabase/functions/` 及第五章主要 Edge Functions 為準；新增、移除或改名時，本表必須同步更新。

## 7.5 遷移至其他後端平台的對應原則

| 現行元件 | 遷移後可對應為 | 必須保留的能力 |
|---|---|---|
| GitHub Pages `docs/` | 新平台靜態檔案、CDN 或前端網站 | 相同前端功能與 HTTPS |
| `src/renderer/web-api.js` | 新後端 API Client／Gateway | 集中設定 API Base URL 與認證方式 |
| Supabase Edge Function | Controller、Route、Service、Serverless Function | 身分、角色、時間、安全與業務驗證 |
| Supabase Auth | 保留 Supabase Auth或改用其他身分服務 | 唯一使用者 ID、登入、Token／Session、停用與密碼管理 |
| Supabase JWT | 新平台 JWT 或安全 Session Cookie | 後端可驗證且不可由前端偽造 |
| `service_role` | 後端 Secret、資料庫服務帳號 | 只能存在伺服器環境，不得送到瀏覽器 |
| PostgreSQL RPC | 後端 Service＋交易、Stored Procedure 或保留 RPC | 原子性、冪等性、限制與錯誤回復 |
| RLS | 保留 RLS，或改由後端授權層加資料庫權限 | 每次讀寫均依使用者及角色限制 |
| Supabase PostgreSQL | 新平台 PostgreSQL 或相容資料庫 | 資料型別、關聯、唯一限制、歷史與稽核完整 |

遷移後可更換程式語言與框架，但前端不應直接依賴某個後端框架的內部實作。前端與後端之間應以穩定的 API 請求及回應格式連接。

## 7.6 建議遷移順序

1. 盤點 `supabase/functions/`、RPC、RLS、資料表、Secret 與排程。
2. 整理每個 API 的網址、HTTP 方法、請求欄位、回應欄位、錯誤格式及角色限制。
3. 讓 `src/renderer/web-api.js` 集中處理 API Base URL、Token／Session 及錯誤格式，避免頁面直接寫死 Supabase Function 網址。
4. 在新平台先建立身分驗證、使用者 ID 對應、角色與任職有效期間驗證。
5. 依功能逐項建立相容 API，優先保持原本前端呼叫格式，降低同時修改前後端的風險。
6. 搬移或連接 PostgreSQL 資料庫，重建外鍵、唯一限制、索引、RLS 或等效授權規則。
7. 搬移 RPC 與交易邏輯，逐項驗證重複請求、失敗回復與併發操作。
8. 以測試帳號同時比較舊後端與新後端的回應及資料結果。
9. 完成完整備份、切換計畫與回復計畫後，才將正式前端 API 位址切至新平台。
10. 舊 Supabase 後端保留至新平台通過正式驗收及觀察期，再停止服務。

## 7.7 遷移時不得破壞的規則

1. 不得把伺服器 Secret、高權限金鑰或資料庫密碼移到前端。
2. 不得只依靠前端隱藏按鈕、角色文字或使用者傳入的 ID 判定權限。
3. 正式日期、時間、截止時間及任職有效期間仍由後端以 `Asia/Taipei` 判定。
4. 來源 IP 必須由後端根據可信任 Proxy Header 取得，不接受前端自行填入。
5. GPS 可由前端取得，但距離、精準度與打卡資格必須由後端重新計算及驗證。
6. 角色與帳號狀態必須在受保護操作時由後端重新確認。
7. 原有交易一致性、冪等性、唯一限制、歷史快照與稽核紀錄必須保留。
8. 一般員工與主管不得取得固定 IP、原始 GPS、定位精準度、距離或管理稽核資料。
9. 帳號、打卡、加班、訂餐及班表的歷史關聯不得因遷移而中斷。
10. 新後端錯誤時不得留下部分完成資料，也不得把內部錯誤、SQL 或 Secret 回傳前端。
11. 遷移過程不得同時讓兩個後端對同一筆資料進行無協調寫入，避免重複或衝突。
12. API 改版應保留相容層或版本化端點，避免舊前端在快取期間呼叫失敗。

## 7.8 驗收與切換原則

遷移至其他後端平台前，至少完成：

- 所有第五章既有登入、打卡、加班、訂餐、班表與帳號管理驗收。
- 員工、主管、管理員三種角色的允許與拒絕測試。
- 帳號停用、未到職、離職超過有效期間及最後一位管理員保護測試。
- GPS、IP、伺服器時間與 `Asia/Taipei` 日期邊界測試。
- 重複送出、快速連按、網路重送與併發修改測試。
- 任一步驟失敗時的交易回復測試。
- 舊資料筆數、關聯、快照、稽核與報表結果比對。
- 前端不得出現任何高權限 Secret 或資料庫連線資訊。
- 正式切換前完成資料庫備份、DNS／API 位址切換方式及可執行的回復程序。

完成切換後，`規格書.txt`、`AGENTS.md`、部署文件、環境變數說明及驗證腳本必須同步更新，不得繼續把已停用的 Supabase Edge Function 當成正式後端來源。
"""

if "# 第七章　後端架構與平台遷移" not in text:
    text = text.rstrip() + chapter + "\n"

SPEC_PATH.write_text(text, encoding="utf-8-sig")

for temp_path in (SCRIPT_PATH, WORKFLOW_PATH):
    if temp_path.exists():
        temp_path.unlink()
